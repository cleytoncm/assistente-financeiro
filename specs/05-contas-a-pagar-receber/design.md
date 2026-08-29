# Design — Contas a Pagar/Receber

## Modelo de dados

```
PayableGroup (conta a pagar/receber — grupo; existe só quando há mais de uma parcela)
  id, user_id (FK User),
  type (ENUM 'income'|'expense'),               -- mesmo enum de Transaction.type
  recurrence_type (ENUM 'installment'|'recurring'),
  installment_count (INT, NULLABLE),            -- obrigatório se recurrence_type='installment'
  amount (DECIMAL(12,2)),                       -- valor-base de cada parcela (RF-07)
  due_day (INT 1-31),                           -- dia do mês de vencimento de cada parcela
  description (TEXT, NULLABLE),
  counterparty (VARCHAR, NULLABLE),
  account_id (FK Account, NULLABLE),            -- conta sugerida, propagada a novas parcelas
  created_at
  CHECK: installment_count is not null iff recurrence_type = 'installment'

Payable (parcela — avulsa quando group_id é nulo, ou pertencente a um PayableGroup)
  id, user_id (FK User),
  group_id (FK PayableGroup, NULLABLE),
  type (ENUM 'income'|'expense'),
  amount (DECIMAL(12,2)),                       -- valor previsto
  due_date (DATE),
  installment_number (INT, NULLABLE),           -- posição no grupo (1..N), nulo se avulsa
  description (TEXT, NULLABLE),
  counterparty (VARCHAR, NULLABLE),
  account_id (FK Account, NULLABLE),
  paid_amount (DECIMAL(12,2), NULLABLE),        -- preenchido só quando paga
  paid_transaction_id (FK Transaction, NULLABLE, UNIQUE),
  paid_at (DATETIME, NULLABLE),
  cancelled_at (DATETIME, NULLABLE),
  cancellation_reason (TEXT, NULLABLE),
  created_at
  CHECK: group_id is null OR type = (SELECT type FROM PayableGroup WHERE id = group_id)
  CHECK: paid_transaction_id/paid_at são nulos ou preenchidos juntos
  CHECK: cancelled_at is not null OR cancellation_reason is null (motivo só existe se cancelada)
```

Notas:
- Nenhuma coluna de status persistida em `Payable` — mesmo padrão de `Invoice` na Fase 4. Status
  é sempre calculado na leitura (ver seção abaixo).
- `PayableGroup` não existe para uma conta a pagar/receber avulsa (RF-01): a `Payable` avulsa
  carrega `description`/`counterparty`/`account_id` diretamente, com `group_id` nulo e
  `installment_number` nulo.
- `type` fica duplicado em `PayableGroup` e em cada `Payable` do grupo (denormalizado) para que
  toda leitura de `Payable` (ex.: listagem, cálculo de projeção) não precise de `JOIN` com
  `PayableGroup` — o valor nunca diverge entre grupo e parcela (garantido pela ausência de
  endpoint que edite `type` depois de criado).
- `description`/`counterparty`/`account_id` também ficam em ambas as tabelas: ao criar as
  parcelas de um grupo (RF-02/RF-03), o valor do grupo é copiado para cada `Payable` gerada;
  editar o grupo (RF-07) sobrescreve essas colunas nas parcelas ainda não pagas/canceladas;
  editar uma parcela (RF-06) sobrescreve só aquela linha, sem tocar no grupo.

## Status derivado (RF-04)

```
function status(payable, today):
  if payable.cancelled_at is not null:      return 'cancelada'
  if payable.paid_transaction_id is not null: return 'paga'
  if payable.due_date < today:              return 'atrasada'
  if payable.due_date == today:             return 'vence_hoje'
  return 'pendente'
```

Calculado a cada leitura (`GET /payables`, `GET /payable-groups/:id`), sem cron — mesmo
raciocínio da Fase 4 para status de fatura.

## Criação de parcelas (RF-02, RF-03)

**Parcelada (`recurrence_type='installment'`)**: cria o `PayableGroup` e, na mesma operação,
todas as `installment_count` parcelas de uma vez — `due_date` de cada parcela = `start_date` +
`(installment_number - 1)` meses, ajustado para o dia `due_day` (mesma regra de "dia do mês" do
parcelamento de cartão na Fase 3). `amount` de cada parcela = `PayableGroup.amount` (valor por
parcela informado pelo usuário, sem cálculo de juros).

**Recorrente (`recurrence_type='recurring'`)**: cria o `PayableGroup` e um primeiro lote de 6
parcelas mensais a partir de `start_date`/`due_day`. `installment_count` fica nulo (indefinida).

## Extensão de horizonte de recorrência (RF-03)

Sem job agendado — disparado por leitura. Toda vez que o backend responde `GET /payables` ou
`GET /payable-groups` para um usuário autenticado:

```
for each PayableGroup do usuário with recurrence_type = 'recurring':
  lastDueDate = MAX(due_date) das Payables desse group_id que não estão cancelled
  if lastDueDate < today + 3 meses:
    gera as próximas 6 parcelas mensais, continuando a cadência de due_day a partir de lastDueDate
```

Essa checagem roda antes de montar a resposta da listagem, então o resultado já reflete as
parcelas recém-geradas na mesma request. Custo é uma comparação de data por grupo recorrente
ativo do usuário — desprezível mesmo com muitos grupos.

## Pagamento (RF-05)

`POST /payables/:id/pay` cria uma `Transaction` (Fase 3) com `type = payable.type`, `amount =
paid_amount` (ou `payable.amount` se `paid_amount` omitido), `account_id` informado no corpo,
`date` = hoje (ou informada), sem `category_id` (usuário categoriza depois pelo extrato, se
quiser). Grava `paid_transaction_id`, `paid_amount`, `paid_at` na `Payable`.

## Cancelamento e exclusão (RF-08, RF-09, RF-10)

- **Cancelar parcela** (`POST /payables/:id/cancel`): grava `cancelled_at`/`cancellation_reason`.
  Bloqueado se já `paga` (status) ou já `cancelada`.
- **Excluir parcela** (`DELETE /payables/:id`): remove a linha. Se status = `paga`, exige
  `confirmDeleteTransaction: true` no corpo — sem isso, responde `409` com os dados da
  `Transaction` que seria removida (valor, data, conta); com a confirmação, exclui a `Payable` e
  a `Transaction` vinculada numa única transação de banco.
- **Excluir grupo** (`DELETE /payable-groups/:id?scope=pending|all`):
  - `scope=pending`: exclui todas as `Payable` do grupo com status em
    (`pendente`,`vence_hoje`,`atrasada`) — as pagas/canceladas continuam intocadas, o
    `PayableGroup` continua existindo
  - `scope=all`: exclui todas as `Payable` do grupo, sem exceção; se houver ao menos uma com
    status `paga`, exige `confirmDeleteTransactions: true` (mesma regra de aviso da exclusão
    individual, em lote) e exclui também as `Transactions` vinculadas a elas; ao final, exclui o
    próprio `PayableGroup`
  - Não existe "cancelar o grupo" — só exclusão (RF-10)

## Edição (RF-06, RF-07)

- `PATCH /payables/:id`: atualiza só aquela linha (`amount`, `due_date`, `description`,
  `counterparty`, `account_id`). Bloqueado se status é `paga` ou `cancelada`.
- `PATCH /payable-groups/:id`: atualiza `amount`, `due_day`, `description`, `counterparty`,
  `account_id` no `PayableGroup` e faz `UPDATE` em cascata nas mesmas colunas de toda `Payable`
  do grupo com status em (`pendente`,`vence_hoje`,`atrasada`). Mudar `due_day` recalcula
  `due_date` das parcelas afetadas mantendo o mês de cada uma, só trocando o dia.

## Projeção de saldo (RF-11)

Estende o cálculo de saldo da Fase 3 (`GET /accounts?date=`):

```
saldo_projetado(account, date) =
  saldo_atual(account, date)                                   -- Fase 3, só Transactions
  - SUM(Payable.amount WHERE account_id=account AND type='expense'
        AND status(payable, hoje) IN ('pendente','vence_hoje','atrasada') AND due_date <= date)
  + SUM(Payable.amount WHERE account_id=account AND type='income'
        AND status(payable, hoje) IN ('pendente','vence_hoje','atrasada') AND due_date <= date)
```

`current_balance` (Fase 3) continua existindo sem mudança (saldo real, só `Transaction`); um
novo campo `projected_balance` é adicionado à resposta de `GET /accounts`, calculado como acima.
Parcelas sem `account_id` não entram em nenhum `projected_balance` de conta específica — só no
resumo geral (`GET /payables/summary`, abaixo).

## API (REST)

```
POST   /payable-groups
  body: { type, recurrence_type: 'installment'|'recurring', amount, due_day, start_date,
          installment_count?,  -- obrigatório se recurrence_type='installment'
          description?, counterparty?, account_id? }
  -> cria o grupo e já materializa as parcelas (RF-02/RF-03)

GET    /payable-groups                          lista grupos do usuário (type?, filtro simples)
GET    /payable-groups/:id                      grupo + lista de parcelas com status calculado
PATCH  /payable-groups/:id
  body: { amount?, due_day?, description?, counterparty?, account_id? }
  -> cascade para parcelas não pagas/não canceladas (RF-07)

DELETE /payable-groups/:id
  query: scope=pending|all
  body: { confirmDeleteTransactions? }   -- obrigatório true se scope=all e houver parcela paga

POST   /payables                                cria parcela avulsa (RF-01)
  body: { type, amount, due_date, description?, counterparty?, account_id? }

GET    /payables
  query: type?, status?, until? (due_date <=), group_id?, account_id?, limit, cursor (paginado)

GET    /payables/:id
PATCH  /payables/:id
  body: { amount?, due_date?, description?, counterparty?, account_id? }   (RF-06)

DELETE /payables/:id
  body: { confirmDeleteTransaction? }    -- obrigatório true se status='paga'

POST   /payables/:id/cancel
  body: { cancellation_reason? }         (RF-08)

POST   /payables/:id/pay
  body: { account_id, paid_amount?, date? }   (RF-05)

GET    /payables/summary
  query: until (due_date <=)
  -> { totalPayable, totalReceivable } agregados de parcelas não pagas/não canceladas com
     due_date <= until, sem quebra por conta (RF-11, resumo geral)

GET    /accounts?date=YYYY-MM-DD    (estende Fase 3)
  -> adiciona `projected_balance` calculado até `date` (default hoje), além do `current_balance`
     já existente
```

Autenticação: todo endpoint exige `requireAuth` (Fase 1); toda query de `PayableGroup` e
`Payable` passa pelo helper `scopedToUser`. A extensão do horizonte de recorrência (ver acima)
roda dentro do handler de `GET /payables` e `GET /payable-groups`, sempre restrita ao
`user_id` autenticado da própria request.

## Validações
- `type`: `income` ou `expense`
- `amount` > 0 (tanto no grupo quanto na parcela avulsa/individual)
- `due_date`/`due_day`: `due_day` entre 1 e 31 (dias inexistentes no mês, ex. 31 em fevereiro,
  ajustam para o último dia do mês — mesma regra já usada no parcelamento de cartão da Fase 3)
- `account_id`, se informado: deve pertencer ao usuário autenticado e estar `is_active = true`
  (Fase 3)
- `installment_count`: obrigatório e `>= 2` quando `recurrence_type = 'installment'`; deve ser
  omitido/nulo quando `recurrence_type = 'recurring'`
- `POST /payables/:id/pay`: bloqueado se status já é `paga` ou `cancelada`; `account_id`
  obrigatório
- `POST /payables/:id/cancel`: bloqueado se status já é `paga` ou `cancelada`
- `PATCH /payables/:id`, `PATCH /payable-groups/:id`: bloqueado editar parcela/grupo cuja
  situação impede (ver seções acima)
- `DELETE /payables/:id` e `DELETE /payable-groups/:id?scope=all`: exigem confirmação explícita
  quando há `Transaction` vinculada a ser removida em cascata

## Decisões técnicas
- `type` de `Payable`/`PayableGroup` reaproveita o enum `income`/`expense` de `Transaction` —
  evita um segundo vocabulário para o mesmo conceito e torna a criação da `Transaction` de
  pagamento (RF-05) uma cópia direta do campo, sem mapeamento
- Sem coluna de status persistida (mesmo racional da Fase 4 para `Invoice`) — todas as
  transições por data (`pendente → vence_hoje → atrasada`) são automáticas e sem custo de
  manutenção
- Geração de horizonte de recorrência via checagem na leitura (sem Cloud Scheduler/cron) —
  consistente com a decisão de manter a infra de jobs agendados em aberto (ver
  `constitution.md`, "Infraestrutura de deploy")
- Lote de 6 meses e limiar de extensão de 3 meses restantes são constantes de aplicação, não
  configuráveis pelo usuário nesta fase — simples o bastante para não precisar de tela de
  configuração, ajustável depois se necessário
- `paid_transaction_id` como `UNIQUE` garante 1:1 entre parcela paga e sua `Transaction` de
  pagamento, permitindo localizar e excluir essa transação em cascata (RF-09/RF-10)

## Frontend (React + Vite + TypeScript)
Reaproveita client HTTP e guarda de rota da Fase 1; estende as telas de contas da Fase 2/3.
- Listagem de contas a pagar/receber: consome `GET /payables` (avulsas) e `GET /payable-groups`
  (grupos, mostrando próxima parcela e contagem), com filtro por tipo/status e um seletor de
  data que consulta `GET /payables/summary?until=` para o total previsto
- Formulário de cadastro com 3 modos (avulsa/parcelada/recorrente), reaproveitando os campos
  comuns e mostrando `installment_count` só no modo parcelada
- Tela de detalhe do grupo (`GET /payable-groups/:id`): observação/contraparte do grupo + tabela
  de parcelas com badge de status; ação de editar grupo (modal avisando "afeta parcelas
  futuras") e de encerrar grupo (escolha pending/all)
- Ação de pagar (modal com conta pré-selecionada se houver `account_id` sugerido, valor
  pré-preenchido e editável)
- Ação de cancelar (campo de motivo opcional) e excluir parcela, com modal de confirmação extra
  exibindo o valor/data da `Transaction` quando a parcela já está paga
- Seletor de data nas telas de conta (Fase 2/3) passa a exibir `projected_balance` ao lado do
  `current_balance` já existente
