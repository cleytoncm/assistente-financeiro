# Requisitos — Cartão de Crédito e Faturas

## Contexto
Depende da Fase 1 (Autenticação), Fase 2 (Contas e Cartões — `Card.closing_day`/`due_day`/
`linked_account_id`) e Fase 3 (Lançamentos Manuais — `Transaction`, parcelamento simples no
cartão sem noção de ciclo de fatura). Esta fase agrupa os lançamentos de cartão em faturas
mensais reais, com fechamento, vencimento e pagamento — o que a Fase 3 explicitamente deixou
de fora (ver `specs/03-lancamentos-manuais/design.md`, RF-02).

## Requisitos funcionais

### RF-01 — Fatura como entidade
Como sistema, preciso agrupar os lançamentos de um cartão em faturas (períodos mensais reais),
com data de fechamento, vencimento e status.
- Critérios de aceite:
  - Cada lançamento de cartão (`Transaction.card_id` preenchido) pertence a exatamente uma
    fatura
  - A fatura é criada sob demanda: só passa a existir quando o primeiro lançamento cujo
    período ela cobre é registrado (incluindo parcelas futuras de um parcelamento — RF-02 da
    Fase 3 — que precisam de faturas futuras já existirem para receber essas parcelas)
  - Um lançamento com `date <= closing_date` da fatura entra nela; com `date` maior, entra na
    próxima (convenção usual de fatura de cartão no Brasil)

### RF-02 — Datas de fechamento e vencimento ajustáveis por fatura
Como usuário, quero que a data de fechamento/vencimento de uma fatura específica siga por
padrão o `closing_day`/`due_day` cadastrado no cartão, mas possa ser ajustada manualmente
quando necessário (ex.: o banco antecipou o fechamento por causa de feriado).
- Critérios de aceite:
  - Ao criar uma fatura, `closing_date`/`due_date` são calculadas a partir do
    `closing_day`/`due_day` do cartão (Fase 2)
  - O usuário pode editar `closing_date`/`due_date` de uma fatura específica sem afetar outras
    faturas nem o `closing_day`/`due_day` cadastrado no cartão

### RF-03 — Status da fatura
Como usuário, quero ver se uma fatura está aberta, fechada, atrasada ou paga.
- Critérios de aceite:
  - `aberta`: ainda pode receber lançamentos livremente, hoje ainda não passou do
    `closing_date`
  - `fechada`: hoje já passou do `closing_date`, ainda não foi paga, hoje ainda não passou do
    `due_date`
  - `atrasada`: hoje já passou do `due_date` e ainda não foi paga
  - `paga`: foi registrado um pagamento (RF-05), independente da data de hoje
  - As transições `aberta → fechada → atrasada` são automáticas por data, sem exigir ação do
    usuário nem job agendado

### RF-04 — Conta pagadora da fatura
Como usuário, quero indicar de qual conta bancária uma fatura será paga.
- Critérios de aceite:
  - Cartão **com** `linked_account_id` (Fase 2): essa conta vem pré-selecionada como sugestão
    de pagamento, mas pode ser trocada pontualmente só para aquela fatura, sem alterar o
    vínculo do cartão
  - Cartão **sem** `linked_account_id`: o usuário é obrigado a escolher manualmente a conta
    pagadora a cada fatura

### RF-05 — Pagar fatura
Como usuário, quero registrar o pagamento de uma fatura, debitando o valor da conta escolhida.
- Critérios de aceite:
  - Pagamento é sempre do valor **total** da fatura (sem pagamento parcial/rotativo neste MVP)
  - Pagamento pode ser feito a qualquer momento, inclusive em uma fatura ainda **aberta**
    (pagamento antecipado) — nesse caso a fatura vai direto para `paga`, sem passar por
    `fechada`/`atrasada`
  - Pagar a fatura cria automaticamente um lançamento de despesa (`Transaction`, sem
    `invoice_id`) na conta pagadora escolhida, refletindo a saída de dinheiro no saldo da conta
    (Fase 3)

### RF-06 — Lançamento retroativo em fatura já fechada
Como usuário, quero poder registrar um lançamento esquecido cuja data cai numa fatura que já
fechou, mesmo que isso mude o valor total dela.
- Critérios de aceite:
  - Criar um lançamento novo com `date` dentro do período de uma fatura `fechada`/`atrasada`/
    `paga` é permitido (a fatura recalcula o total automaticamente, já que o total nunca é um
    valor fixo gravado, é sempre a soma dos lançamentos vinculados)
  - Se a fatura já estiver **paga**, o sistema avisa o usuário no momento (fatura já paga, o
    pagamento de R$X será atualizado para R$Y) e, ao confirmar, atualiza o valor do lançamento
    de pagamento (RF-05) para o novo total da fatura — sem criar um lançamento de ajuste
    separado
  - Esse aviso é só uma confirmação no momento da ação; não é uma notificação persistida (não
    existe central de notificações no sistema)

### RF-07 — Trava de edição em fatura fechada
Como usuário, não quero conseguir editar ou remover um lançamento que já pertence a uma fatura
que não está mais aberta, para não corromper um valor já fechado/pago.
- Critérios de aceite:
  - Editar ou remover um lançamento **já existente** cuja fatura não está `aberta`
    (`fechada`/`atrasada`/`paga`) é bloqueado
  - Essa trava é só para lançamentos já existentes — não se aplica a criar um lançamento novo
    (RF-06)

### RF-08 — Listar faturas e detalhe da fatura
Como usuário, quero ver as faturas de um cartão (passadas, atual e futuras já existentes) e o
detalhe de uma fatura específica com seus lançamentos.

## Fora de escopo desta feature
- Pagamento parcial ou rotativo de fatura (juros, multa por atraso) — não solicitado
- Crediário/financiamento fora do cartão — Fase 5 (já anotado em
  `specs/03-lancamentos-manuais/requirements.md`)
- Central de notificações persistida (ex.: lembrete de vencimento) — o aviso do RF-06 é só
  confirmação pontual na hora da ação
- Geração antecipada em lote de faturas futuras sem lançamento algum — faturas só nascem sob
  demanda (RF-01)

## Decisões confirmadas
- Fatura é uma entidade persistida (`Invoice`), não um cálculo puramente dinâmico — necessário
  para suportar pagamento, status e a trava de edição
- Regra de fechamento: `transaction.date <= invoice.closing_date` entra na fatura atual
  (convenção usual de "melhor dia de compra" ser o dia seguinte ao fechamento)

## Frontend desta fase (painel web)
Construído junto com o backend desta fase. Todas as páginas exigem login (guarda de rota da
Fase 1).
- Tela de fatura (RF-08): lista de faturas do cartão (com status), detalhe de uma fatura com
  seus lançamentos e o total
- Ação de editar data de fechamento/vencimento de uma fatura específica (RF-02)
- Ação de pagar fatura (RF-04, RF-05): seleção de conta pagadora (pré-selecionada se o cartão
  tiver vínculo), confirmação do valor total
- Modal de confirmação ao lançar/editar algo que muda o valor de uma fatura já paga (RF-06)
- Mensagem de bloqueio ao tentar editar/remover lançamento de fatura fechada (RF-07)
