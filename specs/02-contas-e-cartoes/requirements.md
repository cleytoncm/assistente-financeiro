# Requisitos — Contas e Cartões

## Contexto
Depende da Fase 1 (Autenticação e Usuários): toda conta/cartão pertence a um usuário
autenticado. Fundação de dados do sistema: toda transação futura (Fase 3+) referencia uma
conta bancária ou um cartão de crédito. Sem isso, nenhuma outra feature pode ser implementada.

## Requisitos funcionais

### RF-01 — Cadastrar conta bancária
Como usuário, quero cadastrar uma conta bancária para associar lançamentos e saldo a ela.
- Critérios de aceite:
  - Dado que informo nome, banco (selecionado do catálogo de bancos — ver RF-06), moeda e
    saldo inicial, uma conta é criada com esse saldo
  - Nome da conta é obrigatório e único por usuário
  - Saldo inicial pode ser zero ou negativo (ex.: conta já no cheque especial)
  - Moeda é opcional na criação, com padrão `BRL`; aceita outros códigos ISO 4217 (ex.: `USD`)
    para contas em moeda estrangeira (ex.: conta dólar de Inter/Mercado Pago)

### RF-02 — Cadastrar cartão de crédito
Como usuário, quero cadastrar um cartão de crédito, podendo vinculá-lo a uma conta bancária
existente ou deixá-lo sem vínculo.
- Critérios de aceite:
  - Dado que informo nome do cartão, limite, dia de fechamento e dia de vencimento, o cartão
    é criado
  - Vínculo com conta bancária é opcional; se informado, deve referenciar uma conta existente
    do mesmo usuário
  - Cartão sem vínculo ainda exige indicar a conta pagadora no momento de pagar a fatura
    (tratado na Fase 4 — aqui só cadastramos o cartão)

### RF-03 — Editar conta ou cartão
Como usuário, quero editar dados de uma conta ou cartão (nome, limite, vínculo, dias de
fechamento/vencimento) sem perder o histórico de lançamentos já associados.

### RF-04 — Remover conta ou cartão
Como usuário, quero remover uma conta ou cartão que não uso mais.
- Critérios de aceite:
  - Se existirem lançamentos associados (Fase 3+), a remoção é bloqueada ou exige confirmação
    explícita — decisão de design será detalhada quando a Fase 3 existir; por ora, remoção só
    é permitida para conta/cartão sem nenhum lançamento
  - **Atualizado na Fase 3** (`specs/03-lancamentos-manuais/requirements.md`, RF-08/RF-09):
    conta/cartão sem lançamentos continua removida direto como aqui; com lançamentos, o usuário
    passa a poder escolher entre desativar, ocultar ou excluir em cascata

### RF-05 — Listar contas e cartões
Como usuário, quero ver todas as minhas contas e cartões, incluindo qual cartão está vinculado
a qual conta (se algum).

### RF-06 — Catálogo de bancos
Como usuário, quero escolher o banco de uma conta a partir de uma lista com nome e código
oficial (Bacen/COMPE), e poder cadastrar um banco que não esteja na lista.
- Critérios de aceite:
  - O catálogo já vem populado via seed com os principais bancos brasileiros (nome + código)
  - O catálogo é compartilhado entre todos os usuários (não é dado pessoal — não tem
    `user_id`, não é afetado pelo isolamento do RF-04 da Fase 1)
  - Qualquer usuário autenticado pode cadastrar um banco novo (nome + código) quando o dele
    não estiver na lista
  - Código do banco é único no catálogo

## Fora de escopo desta feature
- Cálculo de saldo por lançamentos (Fase 3)
- Parcelamento simples no cartão (Fase 3); fechamento/vencimento de fatura e pagamento (Fase 4)
- Visualização compartilhada por subusuários (Fase 8 — futura; esta fase só modela o dono
  único de cada conta/cartão via `user_id`)
- Moeda no cartão (`Card`) — por ora só a conta bancária tem moeda; se surgir cartão faturado
  em moeda estrangeira, é um campo novo a adicionar quando isso existir
- Conversão de câmbio / consolidação de patrimônio entre moedas — metas financeiras e
  patrimônio fazem parte da visão do produto (`constitution.md`), mas ainda não têm fase
  própria no roadmap atual; esta fase só grava a moeda de cada conta

## Decisões confirmadas
- O vínculo `linked_account_id` do cartão é apenas a conta pagadora **padrão**. Na Fase 4
  (fatura), o usuário pode escolher pagar uma fatura específica com outra conta, sem alterar
  o vínculo cadastrado do cartão. Cartão sem vínculo continua exigindo escolha manual da conta
  pagadora em toda fatura (RF-02).

## Frontend desta fase (painel web)
Construído junto com o backend desta fase (não é fase isolada — ver roadmap na
`constitution.md`). Todas as páginas exigem login (guarda de rota da Fase 1).
- Tela de listagem de contas e cartões (RF-05), mostrando qual cartão está vinculado a qual
  conta
- Formulário de criar/editar conta (RF-01, RF-03): nome, banco (selecionado do catálogo —
  RF-06, com opção de cadastrar um banco novo), moeda (padrão BRL), saldo inicial
- Formulário de criar/editar cartão (RF-02, RF-03): nome, limite, dia de fechamento, dia de
  vencimento, vínculo opcional com conta existente
- Ação de remover conta/cartão (RF-04), com mensagem de bloqueio se houver lançamentos
  associados (a partir da Fase 3)
