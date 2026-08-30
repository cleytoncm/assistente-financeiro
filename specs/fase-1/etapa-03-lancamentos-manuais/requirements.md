# Requisitos — Lançamentos Manuais

## Contexto
Depende da Etapa 1 (Autenticação e Usuários) e da Etapa 2 (Contas e Cartões): todo lançamento
pertence a um usuário autenticado e está associado a uma conta bancária ou a um cartão de
crédito já cadastrado. Esta etapa entrega o núcleo transacional do sistema — sem ela, contas e
cartões da Etapa 2 não têm movimentação nem saldo real.

## Requisitos funcionais

### RF-01 — Registrar lançamento (receita ou despesa)
Como usuário, quero registrar uma receita ou despesa associada a uma conta bancária ou a um
cartão de crédito.
- Critérios de aceite:
  - Um lançamento pertence a exatamente uma conta OU um cartão, nunca os dois nem nenhum
  - Tipo (`income`/`expense`), valor (sempre positivo — o tipo define o sinal no cálculo de
    saldo), data e descrição são obrigatórios; categoria é opcional (RF-03)
  - Valor sempre em `DECIMAL`, nunca ponto flutuante
  - A data do lançamento pode ser passada, de hoje ou futura (ex.: já lançar hoje uma despesa
    que só vai ocorrer daqui a alguns dias)
  - Conta ou cartão informado deve pertencer ao usuário autenticado e estar **ativo**
    (RF-08) — lançamento novo é bloqueado em conta/cartão desativado

### RF-02 — Parcelamento no cartão de crédito
Como usuário, quero dividir uma compra no cartão em N parcelas, sem precisar lançar cada uma
manualmente.
- Critérios de aceite:
  - Parcelamento só se aplica a lançamentos de **cartão** (`type = expense`); lançamento de
    conta bancária é sempre avulso — parcelamento fora do cartão (ex.: crediário/financiamento
    direto com uma loja) **não** é tratado aqui, fica para a Etapa 5 (Contas a pagar/receber),
    que é o lugar certo para obrigações futuras agendadas (ver "Fora de escopo")
  - Usuário informa o valor **total** da compra e o número de parcelas (N ≥ 2); o sistema
    divide automaticamente em N lançamentos, ajustando o arredondamento (centavos) na última
    parcela
  - Cada parcela vira um lançamento independente, datado no mesmo dia da compra somando um mês
    por parcela (ex.: compra em 10/03 e 3x → parcelas em 10/03, 10/04 e 10/05)
  - Cada parcela guarda a informação do grupo de parcelamento e sua posição (ex.: "2/3") para
    exibição no extrato
  - Depois de geradas, o usuário pode ajustar manualmente o valor de uma parcela específica sem
    afetar as demais (RF-04)

### RF-03 — Categorizar lançamento
Como usuário, quero categorizar um lançamento para organizar meus gastos e receitas.
- Critérios de aceite:
  - Categoria é opcional — lançamento pode ser salvo sem categoria
  - Cada categoria pertence a um tipo fixo (`income` ou `expense`); só é possível associar uma
    categoria cujo tipo bate com o tipo do lançamento
  - O catálogo de categorias já vem populado via seed com categorias comuns, compartilhado
    entre todos os usuários (mesmo padrão do catálogo de bancos da Etapa 2 — RF-06)
  - Qualquer usuário autenticado pode criar categorias próprias (visíveis só para ele),
    seguindo o mesmo tipo fixo (`income`/`expense`)

### RF-04 — Editar lançamento
Como usuário, quero editar qualquer campo de um lançamento já criado, incluindo trocar a
conta/cartão associado e o tipo (receita↔despesa) — cobre o caso de ter lançado no lugar
errado sem precisar apagar e recriar.
- Critérios de aceite:
  - Todos os campos são editáveis: tipo, valor, data, descrição, categoria, conta/cartão
  - As mesmas validações da criação (RF-01) se aplicam à edição (ex.: categoria deve bater com
    o novo tipo se ambos forem alterados juntos)
  - Editar uma parcela de um lançamento parcelado (RF-02) pede ao usuário se a mudança se aplica
    só a essa parcela ou a ela e todas as parcelas restantes (as já passadas não são afetadas)

### RF-05 — Remover lançamento
Como usuário, quero remover um lançamento incorreto ou duplicado.
- Critérios de aceite:
  - Remover uma parcela de um lançamento parcelado (RF-02) pede ao usuário se a remoção é só
    dessa parcela ou dela e todas as parcelas restantes

### RF-06 — Estorno/devolução vinculado ao lançamento original
Como usuário, quero registrar um estorno ou devolução vinculado ao lançamento original, para
manter rastreável a relação entre os dois.
- Critérios de aceite:
  - Um lançamento pode opcionalmente referenciar outro lançamento como "estorno de"
  - O estorno deve ter tipo oposto ao do lançamento original, estar na mesma conta/cartão, e
    ter valor menor ou igual ao valor original

### RF-07 — Listar lançamentos (extrato)
Como usuário, quero ver o extrato de lançamentos de uma conta ou cartão, com filtros por
período e categoria.
- Critérios de aceite:
  - Filtros disponíveis: conta ou cartão, intervalo de datas, categoria
  - Resultado é paginado (a lista não retorna tudo de uma vez, mesmo em contas com muito
    histórico acumulado)

### RF-08 — Desativar ou ocultar conta/cartão
Como usuário, quero desativar ou ocultar uma conta/cartão sem perder o histórico de
lançamentos, como alternativa a excluir definitivamente.
- Critérios de aceite:
  - **Desativar**: conta/cartão para de aceitar novos lançamentos (RF-01), mas continua
    aparecendo normalmente nas listagens e no histórico
  - **Ocultar**: conta/cartão some da listagem padrão e do seletor de conta/cartão no
    formulário de lançamento; pode ser reexibida a qualquer momento. Independente de estar
    ativa ou desativada
  - Ambas as ações estão sempre disponíveis, mesmo em conta/cartão sem nenhum lançamento

### RF-09 — Remover conta/cartão com lançamentos (finaliza decisão adiada da Etapa 2)
Como usuário, quero poder remover definitivamente uma conta/cartão mesmo que já tenha
lançamentos, entendendo que isso apaga todo o histórico associado.
- Critérios de aceite:
  - Conta/cartão **sem** nenhum lançamento: remoção continua direta e simples, sem confirmação
    extra (comportamento já previsto na Etapa 2)
  - Conta/cartão **com** lançamentos: ao tentar remover, o usuário vê um aviso claro de que a
    exclusão é definitiva e irreversível, com três opções: (1) desativar (RF-08), (2) ocultar
    (RF-08), ou (3) excluir em cascata (remove a conta/cartão e todos os lançamentos
    associados)

### RF-10 — Consultar saldo/gasto até uma data
Como usuário, quero consultar o saldo de uma conta, ou o gasto atual/limite disponível de um
cartão, numa data específica — com hoje como padrão.
- Critérios de aceite:
  - A data do lançamento (RF-01) aceita passado, presente e futuro
  - Todo endpoint de saldo/gasto aceita uma data opcional (padrão: hoje) e considera apenas
    lançamentos com data menor ou igual à informada — permite ver o saldo de hoje, um saldo
    projetado (data futura) ou um saldo histórico (data passada)
  - Cartão já expõe "gasto atual" e "limite disponível" calculados da mesma forma, mesmo sem o
    ciclo de fatura da Etapa 4

## Fora de escopo desta feature
- **Crediário/financiamento fora do cartão** (ex.: compra parcelada direto com uma loja, sem
  ser no cartão de crédito, mesmo que o pagamento saia de uma conta bancária): não é um
  "lançamento" avulso, é uma obrigação futura agendada — fica para a **Etapa 5 (Contas a
  pagar/receber)**. **Anotação para não esquecer ao especificar a Etapa 5**: cobrir esse cenário
  lá (ex.: uma "conta a pagar" recorrente/parcelada não vinculada a cartão).
- Fatura de cartão: fechamento, vencimento, conta pagadora, agrupamento de parcelas em fatura
  mensal (Etapa 4) — nesta etapa o cartão só acumula lançamentos e parcelas soltas, sem ciclo de
  fatura
- Contas a pagar/receber, agendamento e recorrência de lançamentos fora do parcelamento de
  cartão (Etapa 5)
- Importação de arquivos (Etapa 6)

## Decisões confirmadas
- Categorias seguem o mesmo padrão de catálogo compartilhado + personalização por usuário já
  usado para bancos na Etapa 2 (RF-06 daquela etapa)

## Frontend desta etapa (painel web)
Construído junto com o backend desta etapa (não é etapa isolada — ver roadmap na
`constitution.md`). Todas as páginas exigem login (guarda de rota da Etapa 1).
- Tela de lançamento (RF-01, RF-02, RF-03): formulário com tipo, valor, data, descrição,
  conta/cartão (só ativos e não ocultos), categoria (filtrada pelo tipo escolhido), e opção de
  parcelamento quando o destino é um cartão
- Tela de extrato (RF-07): lista paginada de lançamentos com filtros de conta/cartão, período e
  categoria; exibe indicação de parcela (ex.: "2/3") e de estorno vinculado
- Seletor de data para saldo/gasto atual (RF-10), com "hoje" como padrão, nas telas de contas
  e cartões (estendendo a listagem da Etapa 2)
- Ações de editar/remover lançamento (RF-04, RF-05), com o diálogo de escopo
  (parcela única vs. parcelas restantes) quando aplicável
- Fluxo de remoção de conta/cartão (RF-09) com o modal de 3 opções (desativar/ocultar/excluir
  em cascata) quando há lançamentos associados; toggles de desativar/ocultar sempre visíveis na
  listagem de contas/cartões (RF-08), independente de haver histórico
