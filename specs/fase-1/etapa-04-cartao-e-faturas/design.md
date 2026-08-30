# Design — Cartão de Crédito e Faturas

## Modelo de dados

```
Invoice (fatura)
  id, user_id (FK User), card_id (FK Card),
  period_year (INT), period_month (INT 1-12),   -- referência da fatura (mês do vencimento)
  closing_date (DATE), due_date (DATE),         -- calculadas ao criar, editáveis depois (RF-02)
  paid_at (DATETIME, NULLABLE),
  payment_account_id (FK Account, NULLABLE),    -- preenchido só quando paga
  payment_transaction_id (FK Transaction, NULLABLE, UNIQUE), -- preenchido só quando paga
  created_at
  unique(card_id, period_year, period_month)

Transaction (lançamento — Etapa 3, alterado nesta etapa)
  ... campos já existentes ...
  invoice_id (FK Invoice, NULLABLE)  -- preenchido só quando card_id está preenchido;
                                      -- sempre nulo em lançamentos de account_id
```

Notas:
- Nenhuma coluna de status é gravada em `Invoice`. Status é sempre derivado na leitura (ver
  seção abaixo) — só `paid_at` é estado real persistido, porque pagamento é a única transição
  que depende de uma ação do usuário, não de data.
- `Invoice` não guarda `total_amount`: o total é sempre `SUM(Transaction.amount WHERE type=
  'expense') - SUM(amount WHERE type='income')` dos lançamentos com aquele `invoice_id`. Isso é
  o que permite RF-06 (lançamento retroativo) sem precisar de um recálculo/migração de campo —
  o total simplesmente já reflete a soma atual toda vez que é consultado.
- `payment_transaction_id` é a `Transaction` de despesa criada na conta pagadora ao pagar
  (RF-05); ela não tem `invoice_id` (não é um lançamento de cartão, é um lançamento de conta).

## Status derivado (RF-03)

```
function status(invoice, today):
  if invoice.paid_at is not null:      return 'paga'
  if today > invoice.due_date:         return 'atrasada'
  if today > invoice.closing_date:     return 'fechada'
  return 'aberta'
```

Calculado a cada leitura (`GET /cards/:id/invoices`, `GET /invoices/:id`) — sem cron, sem
coluna de status para manter sincronizada, consistente com o mesmo raciocínio já usado para
saldo "até uma data" na Etapa 3.

## Atribuição de lançamento a uma fatura (RF-01)

Ao criar ou editar uma `Transaction` com `card_id` preenchido (Etapa 3, `POST /transactions` e
`PATCH /transactions/:id`), o backend resolve `invoice_id` assim:
1. Busca, entre as faturas existentes do cartão, uma cujo `closing_date >= transaction.date` e
   cujo período anterior não cobre essa data (ou seja, a primeira fatura "aberta pra frente"
   que ainda não fechou antes dessa data)
2. Se não existir, cria a próxima fatura em sequência a partir da última existente (ou da
   primeira, calculada a partir de `card.closing_day`/`due_day`, se o cartão ainda não tem
   nenhuma), repetindo até cobrir a data — cobre o caso de uma parcela (Etapa 3, RF-02) cair
   vários meses à frente e nenhuma fatura intermediária existir ainda
3. Faturas intermediárias criadas nesse processo (que ainda não têm lançamento próprio) nascem
   vazias, com `closing_date`/`due_date` já calculadas — elas só existem fisicamente porque o
   passo 2 precisou criá-las para chegar até a data-alvo

`closing_date`/`due_date` de uma nova fatura = mês seguinte à última fatura existente do
cartão (ou ao mês de criação do cartão, se for a primeira), no dia `closing_day`/`due_day`
cadastrado no `Card` (Etapa 2).

## Trava de edição (RF-07) e lançamento retroativo (RF-06)

- **Editar/remover uma `Transaction` já existente**: bloqueado (`409`) se
  `status(transaction.invoice) != 'aberta'`
- **Criar uma nova `Transaction`** cujo `invoice_id` resolvido (ver acima) tem status diferente
  de `aberta`: permitido
  - Se `status == 'paga'`: a resposta da API sinaliza esse caso (ex.: campo
    `invoicePaymentAdjustment: { invoiceId, oldAmount, newAmount }`) para o frontend exibir a
    confirmação (RF-06); ao confirmar, o cliente chama um segundo endpoint (ou a criação já
    aceita um `confirmPaymentAdjustment: true` no corpo) que atualiza
    `payment_transaction.amount` para o novo total da fatura
  - Se `status` for `fechada`/`atrasada`: só recalcula o total (nada gravado a mais, já que o
    total é sempre somado dinamicamente)
- **Editar uma `Transaction` existente que está numa fatura `aberta`**, mudando `date`/`card_id`
  de forma que o novo `invoice_id` resolvido aponte para uma fatura não-aberta: mesma regra da
  criação acima (permitido, com o mesmo aviso se a fatura de destino já estiver paga)

## API (REST)

```
GET    /cards/:id/invoices                 lista faturas do cartão (status calculado), paginado
GET    /invoices/:id                       detalhe da fatura (inclui status, total calculado)
GET    /invoices/:id/transactions          lançamentos daquela fatura (reaproveita paginação da Etapa 3)

PATCH  /invoices/:id                       { closing_date?, due_date? }  (RF-02)
  - só permitido enquanto status != 'paga'

POST   /invoices/:id/pay
  body: { account_id }
  -> marca paid_at = now, payment_account_id = account_id, cria Transaction de despesa na
     conta com o total atual da fatura, grava payment_transaction_id
  -> permitido em qualquer status (inclusive 'aberta' — pagamento antecipado, RF-05)
```

`POST /transactions` e `PATCH /transactions/:id` (Etapa 3) passam a resolver `invoice_id`
automaticamente quando `card_id` está envolvido (ver seção acima), sem mudança na assinatura
pública desses endpoints — exceto o campo opcional `confirmPaymentAdjustment` (RF-06) e o
possível campo de resposta `invoicePaymentAdjustment`.

Autenticação: todo endpoint exige `requireAuth` (Etapa 1); toda query de `Invoice` passa pelo
helper `scopedToUser`.

## Validações
- `PATCH /invoices/:id` (datas): `closing_date < due_date`; bloqueado se `paid_at` não for nulo
- `POST /invoices/:id/pay`: `account_id` deve pertencer ao usuário autenticado e estar
  `is_active = true` (Etapa 3); fatura não pode já estar paga (`paid_at` nulo é pré-condição)
- Criar/editar `Transaction` com `card_id`: mesmas validações da Etapa 3, mais a resolução de
  `invoice_id` acima (nunca vem do cliente, sempre calculado no backend)

## Decisões técnicas
- Sem coluna de status persistida em `Invoice` (ver "Status derivado" acima) — evita job
  agendado e mantém consistência com o padrão "calculado até uma data" já usado na Etapa 3
- `payment_transaction_id` como `UNIQUE` garante 1:1 entre fatura paga e seu lançamento de
  pagamento, permitindo localizar e editar esse lançamento quando o total muda (RF-06)
- Criação de faturas intermediárias vazias (passo 2 da atribuição) é aceitável mesmo que o
  usuário nunca veja essas faturas na tela até terem lançamento — simplifica a lógica de
  atribuição em vez de tentar "pular" períodos sem persistir nada

## Frontend (React + Vite + TypeScript)
Reaproveita client HTTP e guarda de rota da Etapa 1; estende as telas de cartão da Etapa 2/3.
- Tela de fatura: lista de faturas do cartão com badge de status (aberta/fechada/atrasada/paga)
  usando `GET /cards/:id/invoices`; detalhe mostra lançamentos (`GET /invoices/:id/transactions`,
  reaproveitando a tabela de extrato da Etapa 3) e o total calculado
- Ação de editar fechamento/vencimento de uma fatura (`PATCH /invoices/:id`), desabilitada se
  paga
- Ação de pagar fatura: seletor de conta (pré-selecionado se `Card.linked_account_id` existir),
  chama `POST /invoices/:id/pay`
- Ao criar/editar um lançamento de cartão cuja fatura de destino já está paga, exibe o modal de
  confirmação com o novo total antes de enviar `confirmPaymentAdjustment: true`
- Mensagem de bloqueio ao tentar editar/remover lançamento de fatura não aberta (reaproveita o
  formulário de lançamento da Etapa 3, desabilitando salvar/remover quando a API retornar 409)
