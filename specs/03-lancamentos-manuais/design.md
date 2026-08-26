# Design — Lançamentos Manuais

## Modelo de dados

```
Account (conta bancária — Fase 2, alterada nesta fase)
  ... campos já existentes ...
  is_active (BOOLEAN, default true)   -- novo: bloqueia novos lançamentos quando false
  is_hidden (BOOLEAN, default false)  -- novo: some de listagens/seletores quando true

Card (cartão de crédito — Fase 2, alterada nesta fase)
  ... campos já existentes ...
  is_active (BOOLEAN, default true)
  is_hidden (BOOLEAN, default false)

Category (catálogo de categorias — mesmo padrão de Bank na Fase 2)
  id, user_id (FK User, NULLABLE — null = categoria padrão do sistema, compartilhada),
  name, type (ENUM 'income'|'expense'), created_at
  unique(coalesce(user_id, 0), name, type)

Transaction (lançamento)
  id, user_id (FK User), type (ENUM 'income'|'expense'), amount (DECIMAL(12,2), sempre positivo),
  description, date (DATE),
  category_id (FK Category, NULLABLE),
  account_id (FK Account, NULLABLE), card_id (FK Card, NULLABLE),
  refund_of_transaction_id (FK Transaction, NULLABLE, self-referential),
  installment_group_id (UUID, NULLABLE — presente só em lançamentos gerados por parcelamento),
  installment_number (INT, NULLABLE), installment_count (INT, NULLABLE),
  created_at
  -- invoice_id (FK Invoice) é adicionado na Fase 4 (specs/04-cartao-e-faturas/design.md) —
  -- não existe ainda nesta fase, já que fatura como entidade só nasce na Fase 4

  CHECK: exatamente um entre account_id e card_id é não-nulo
  CHECK: installment_group_id, installment_number e installment_count são todos nulos ou
         todos preenchidos juntos
```

Notas:
- `Category.user_id` nulo = categoria do seed, visível para todos; preenchido = categoria
  própria do usuário, visível só para ele. Consulta de categorias não usa `scopedToUser` puro
  (que exigiria `user_id` sempre igual ao usuário logado) — usa uma variação:
  `WHERE user_id IS NULL OR user_id = :userId`, mesmo padrão de exceção já usado por `Bank`.
- Categorias do seed não podem ser editadas/removidas por usuários (só leitura, igual ao
  catálogo de bancos). Categoria própria (`user_id` preenchido) pode ser editada/removida pelo
  dono; não há requisito de bloqueio se já usada em lançamentos — remover a categoria de um
  lançamento existente só deixa `category_id` nulo (não é um requisito desta fase, mas é o
  comportamento natural de uma FK nullable com `ON DELETE SET NULL`).
- `refund_of_transaction_id` aponta para a transação original estornada (RF-06). Validado na
  escrita: tipo oposto ao original, mesmo `account_id`/`card_id` do original, `amount` menor ou
  igual ao `amount` do original.
- `installment_group_id` agrupa as N parcelas de uma mesma compra parcelada (RF-02). Cada linha
  já é um `Transaction` completo e independente — edições avulsas (RF-04) não mexem no grupo;
  só a ação explícita "aplicar às parcelas restantes" atualiza as demais linhas do mesmo
  `installment_group_id` com `date >= ` a data da parcela editada.
- Parcelamento se aplica só a `card_id` (nunca `account_id`) — ver requirements.md RF-02.

## Cálculo de saldo (conta) e gasto/limite (cartão) — "até uma data" (RF-10)

Toda consulta de saldo/gasto aceita um parâmetro `date` (default: hoje) e considera apenas
lançamentos com `date <= :date` — permite tanto saldo "de hoje" quanto projeção futura ou
consulta histórica.

- **Conta**: `saldo = initial_balance + SUM(amount WHERE type='income') - SUM(amount WHERE type='expense')`,
  considerando só lançamentos daquela conta com `date <= :date`
- **Cartão**: `gasto_atual = SUM(amount WHERE type='expense') - SUM(amount WHERE type='income')`
  (receita no cartão cobre estorno — RF-06), considerando só lançamentos daquele cartão com
  `date <= :date`; `limite_disponivel = credit_limit - gasto_atual`

## API (REST)

```
POST   /transactions
  body: { type, amount, date, description, category_id?, account_id? | card_id?,
          refund_of_transaction_id?, installments? }
  - `amount` é o valor TOTAL quando `installments` (inteiro >= 2) é informado; a resposta
    retorna as N parcelas criadas (array), cada uma já com installment_number/count
  - sem `installments`: cria um único lançamento avulso, resposta é o objeto criado

GET    /transactions
  query: account_id?, card_id?, category_id?, from?, to?, limit, cursor/offset (paginado)

PATCH  /transactions/:id
  body: campos a alterar (qualquer um, incl. type, account_id, card_id, category_id)
  query: applyToRemaining? (boolean, só relevante se a transação pertence a um
         installment_group_id) — quando true, aplica os mesmos campos alterados a todas as
         parcelas do grupo com date >= a data desta parcela

DELETE /transactions/:id
  query: scope=single|remaining (default single) — remaining remove esta e as parcelas
         seguintes do mesmo installment_group_id

GET    /accounts?date=YYYY-MM-DD&includeHidden=false   (estende Fase 2)
  -> inclui `current_balance` calculado até `date` (default hoje) em cada conta;
     `includeHidden=true` inclui contas com is_hidden=true no resultado

GET    /cards?date=YYYY-MM-DD&includeHidden=false       (estende Fase 2)
  -> inclui `current_spending` e `available_limit` calculados até `date` em cada cartão;
     mesmo parâmetro `includeHidden`

PATCH  /accounts/:id/status   { is_active?, is_hidden? }   (RF-08)
PATCH  /cards/:id/status      { is_active?, is_hidden? }   (RF-08)

DELETE /accounts/:id?cascade=true   (RF-09 — sem `cascade`, comportamento da Fase 2: bloqueia
                                      se houver lançamentos; com `cascade=true`, remove a conta
                                      e todos os lançamentos associados)
DELETE /cards/:id?cascade=true      (idem)

POST   /categories            cria categoria própria do usuário { name, type }
GET    /categories            lista categorias (seed + próprias do usuário)
```

Autenticação: todo endpoint exige `requireAuth` (Fase 1); `user_id` sempre de `req.userId`.
Toda query de `Transaction`, `Account` e `Card` passa pelo helper `scopedToUser`; `Category`
usa a variação `WHERE user_id IS NULL OR user_id = :userId` descrita acima.

## Validações
- `amount` > 0 (sempre; o `type` define o sinal no cálculo de saldo, nunca um valor negativo
  gravado)
- `type` obrigatório (`income`/`expense`)
- Exatamente um entre `account_id`/`card_id`; deve pertencer ao usuário autenticado e estar
  `is_active = true`
- `installments`, se informado, só é aceito quando o destino é `card_id` (não `account_id`);
  inteiro >= 2
- `category_id`, se informado: deve existir (seed ou do usuário) e ter `type` igual ao `type`
  do lançamento
- `refund_of_transaction_id`, se informado: transação referenciada deve existir, pertencer ao
  mesmo usuário, ter `type` oposto, mesmo `account_id`/`card_id`, e `amount` do estorno <=
  `amount` da original
- `DELETE /accounts/:id` e `/cards/:id` sem `cascade=true`: 409 se houver qualquer lançamento
  associado (mesma regra da Fase 2, agora efetivada)

## Decisões técnicas
- Divisão de parcelas: `amount_por_parcela = floor(total / N * 100) / 100` para as primeiras
  N-1 parcelas; a última recebe o resíduo (`total - soma das anteriores`), garantindo que a
  soma das parcelas bate exatamente com o total informado
- Geração de datas das parcelas: mesma regra de dia do mês da data da compra, +1 mês por
  parcela (sem considerar `closing_day`/`due_day` do cartão nesta fase — isso é refinado na
  Fase 4)
- `is_active`/`is_hidden` como colunas simples em `Account`/`Card` (não uma tabela de auditoria
  separada) — suficiente para o requisito atual; sem necessidade de histórico de quando foi
  desativada/ocultada

## Frontend (React + Vite + TypeScript)
Reaproveita client HTTP e guarda de rota da Fase 1; estende as telas de contas/cartões da
Fase 2.
- Formulário de lançamento: campos de RF-01/02/03; ao escolher cartão como destino, exibe
  opção "parcelar em Nx"; seletor de conta/cartão filtra `is_active=true` e `is_hidden=false`
  via `GET /accounts`/`GET /cards`
- Tela de extrato: tabela paginada consumindo `GET /transactions`, com filtros de conta/cartão,
  período e categoria; badge de parcela ("2/3") e ícone de estorno quando aplicável
- Seletor de data (padrão "hoje") nas telas de contas/cartões da Fase 2, refletindo em
  `current_balance`/`current_spending`/`available_limit`
- Toggle de "ativa/inativa" e "oculta/visível" na listagem de contas/cartões, com opção de
  exibir ocultas (`includeHidden=true`)
- Modal de remoção com lançamentos existentes: 3 opções (desativar, ocultar, excluir em
  cascata), com aviso explícito de que a exclusão em cascata é irreversível
