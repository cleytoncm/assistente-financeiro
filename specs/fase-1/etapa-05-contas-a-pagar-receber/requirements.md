# Requisitos — Contas a Pagar/Receber

## Contexto
Depende da Etapa 1 (Autenticação), Etapa 2 (`Account`) e Etapa 3 (`Transaction`, cálculo de saldo
"até uma data"). Não depende da Etapa 4 (Cartão e Faturas) — o motivador desta etapa é justamente
o crediário/financiamento **fora** do cartão (compra parcelada direto com uma loja, empréstimo
com terceiro, aluguel, assinatura), deixado de fora da Etapa 3 (ver
`specs/fase-1/etapa-03-lancamentos-manuais/requirements.md`, "Fora de escopo") e da Etapa 4 (ver
`specs/fase-1/etapa-04-cartao-e-faturas/requirements.md`, "Fora de escopo").

Uma conta a pagar/receber é uma obrigação futura (ainda não é um fato financeiro consumado) —
diferente de `Transaction`, que representa dinheiro que já entrou ou saiu de uma conta. Uma
parcela de conta a pagar/receber só vira um `Transaction` real no momento em que é paga/recebida
(RF-05).

## Requisitos funcionais

### RF-01 — Conta a pagar/receber avulsa
Como usuário, quero cadastrar uma obrigação única (sem repetição), com valor e data de
vencimento.
- Critérios de aceite:
  - Campos: `type` (a pagar/a receber), `amount`, `due_date`, `description` opcional,
    `counterparty` opcional (nome de quem devo ou de quem vai me pagar), `account_id` opcional
    (conta sugerida para o pagamento/recebimento)
  - Uma conta avulsa não pertence a nenhum grupo (RF-02/RF-03)

### RF-02 — Conta a pagar/receber parcelada (crediário/financiamento)
Como usuário, quero cadastrar uma obrigação parcelada em N vezes com valor fixo por parcela
(ex.: financiamento, crediário de loja), sem o sistema calcular juros/amortização.
- Critérios de aceite:
  - Usuário informa o valor de cada parcela diretamente (não um total a ser dividido) e a
    quantidade de parcelas (`installment_count >= 2`)
  - Todas as `installment_count` parcelas são criadas de uma vez no cadastro, com vencimento
    mensal a partir de `due_day` e uma data de referência inicial, cada uma com seu próprio
    `installment_number` (1 a N)
  - As parcelas ficam agrupadas por uma conta a pagar/receber "grupo" (RF-06/RF-07/RF-10), que
    guarda os dados comuns (`type`, `description`, `counterparty`, `account_id` sugerido)

### RF-03 — Conta a pagar/receber recorrente (indefinida)
Como usuário, quero cadastrar uma obrigação recorrente sem data de término definida (ex.:
aluguel, assinatura mensal).
- Critérios de aceite:
  - Recorrência é sempre mensal (mesmo dia do mês, `due_day`); outras periodicidades (semanal,
    trimestral etc.) ficam fora desta etapa
  - No cadastro, o sistema já materializa as primeiras 6 parcelas (6 meses) do grupo
  - Enquanto a recorrência não for encerrada (RF-10), o sistema estende o horizonte
    automaticamente: ao consultar as parcelas do usuário e encontrar uma recorrência cujo
    horizonte materializado está a menos de 3 meses do fim, gera o próximo lote de 6 parcelas
    — sem job/cron agendado, disparado pela própria leitura

### RF-04 — Status da parcela (derivado)
Como usuário, quero ver se uma parcela está pendente, vencendo hoje, atrasada, paga ou
cancelada, sem precisar de nenhuma ação para "atualizar" esse status.
- Critérios de aceite:
  - `pendente`: `due_date` no futuro, não paga, não cancelada
  - `vence_hoje`: `due_date` igual a hoje, não paga, não cancelada
  - `atrasada`: `due_date` no passado, não paga, não cancelada
  - `paga`: tem uma `Transaction` vinculada (RF-05), independente da data
  - `cancelada`: cancelada manualmente (RF-08), independente da data
  - Todas as transições por data são automáticas, calculadas na leitura, sem coluna de status
    persistida (mesmo padrão da Etapa 4 para fatura)

### RF-05 — Registrar pagamento/recebimento de uma parcela
Como usuário, quero marcar uma parcela como paga/recebida, informando a conta bancária e o
valor efetivamente movimentado (que pode diferir do valor previsto por desconto, juros ou
multa).
- Critérios de aceite:
  - Ação exige `account_id` (mesmo que a parcela já tivesse um `account_id` sugerido, pode ser
    trocado neste momento) e aceita `paid_amount` opcional (default: igual a `amount` previsto)
  - Cria automaticamente uma `Transaction` (Etapa 3) na conta informada — `expense` para conta a
    pagar, `income` para conta a receber — com o `paid_amount` como valor
  - Vincula a `Transaction` criada à parcela (`paid_transaction_id`) e marca `paid_at`
  - Não permitido para parcela já paga ou já cancelada

### RF-06 — Editar parcela individual
Como usuário, quero editar uma parcela específica (ex.: valor diferente só naquele mês por
reajuste pontual) sem afetar as demais parcelas do grupo nem o grupo em si.
- Critérios de aceite:
  - Campos editáveis: `amount`, `due_date`, `description`, `counterparty`, `account_id`
  - Bloqueado se a parcela já estiver paga ou cancelada

### RF-07 — Editar grupo (conta a pagar/receber)
Como usuário, quero editar os dados gerais de uma conta a pagar/receber parcelada ou recorrente
(ex.: valor do aluguel reajustou, mudou o dia de vencimento) e ver isso refletido nas parcelas
futuras, sem precisar editar uma por uma.
- Critérios de aceite:
  - Campos editáveis no grupo: `amount` (valor-base), `due_day`, `description`, `counterparty`,
    `account_id`
  - A mudança se propaga automaticamente para todas as parcelas do grupo que ainda não estão
    pagas nem canceladas (pendente/vence_hoje/atrasada); parcelas já pagas ou já canceladas
    nunca são alteradas

### RF-08 — Cancelar parcela
Como usuário, quero cancelar uma parcela específica que não vou mais pagar/receber, mantendo o
registro para histórico, com um motivo opcional.
- Critérios de aceite:
  - Aceita `cancellation_reason` opcional (texto livre)
  - Bloqueado para parcela já paga, a menos que o usuário confirme também desfazer o pagamento
    (ver RF-09 — mesma trava de confirmação)
  - Parcela cancelada nunca entra na projeção de saldo (RF-11)

### RF-09 — Excluir parcela
Como usuário, quero excluir definitivamente uma parcela cadastrada por engano.
- Critérios de aceite:
  - Remove a linha permanentemente (diferente de cancelar, que mantém o registro)
  - Se a parcela já estiver paga, exige confirmação explícita (`confirmDeleteTransaction: true`)
    para também excluir a `Transaction` vinculada (RF-05) — sem essa confirmação, a exclusão é
    rejeitada com aviso do valor/data da transação que seria removida

### RF-10 — Cancelar/excluir grupo inteiro
Como usuário, quero encerrar ou remover de uma vez todas as parcelas de uma conta a
pagar/receber parcelada ou recorrente (ex.: parei de pagar aluguel do apartamento antigo).
- Critérios de aceite:
  - Escopo `pending`: exclui (hard delete) todas as parcelas do grupo que ainda não estão pagas
    nem canceladas; parcelas já pagas continuam intactas como histórico; o grupo continua
    existindo (ainda tem parcelas pagas vinculadas)
  - Escopo `all`: exclui todas as parcelas do grupo, inclusive as já pagas — exige confirmação
    explícita (`confirmDeleteTransactions: true`) sempre que houver ao menos uma parcela paga no
    grupo, excluindo também as `Transactions` vinculadas a elas
  - Ação em grupo é sempre exclusão definitiva (hard delete); não existe "cancelar o grupo com
    motivo" — o motivo, se relevante, fica registrado como observação (`description`) do grupo
    antes de excluir
  - Encerrar uma recorrência (ex.: aluguel do apartamento antigo) não afeta e não se relaciona
    de nenhuma forma com o cadastro de uma nova conta a pagar/receber (ex.: aluguel do novo
    apartamento) — são grupos independentes

### RF-11 — Consultar parcelas por data e projeção de saldo
Como usuário, quero escolher uma data e ver quais valores estão previstos (a pagar e a receber)
até aquele dia, e ver esse impacto refletido no saldo projetado de cada conta bancária.
- Critérios de aceite:
  - Endpoint de listagem/resumo de parcelas aceita filtro por `due_date <= data escolhida` e por
    status
  - O saldo projetado de uma conta (extensão da Etapa 3, RF-10) passa a somar também parcelas não
    pagas/não canceladas com `account_id` daquela conta e `due_date <= data escolhida` —
    despesas subtraem, receitas somam
  - Parcelas sem `account_id` definido entram apenas no resumo geral (todas as contas), não na
    projeção de uma conta específica

### RF-12 — Listar contas a pagar/receber e detalhe do grupo
Como usuário, quero ver a lista de todas as minhas contas a pagar/receber (avulsas e grupos) e,
para um grupo, uma tela com os dados gerais dele (observação, contraparte) e a lista de todas
as suas parcelas com status individual.
- Critérios de aceite:
  - Listagem aceita filtro por `type` (a pagar/a receber) e por status de parcela
  - Detalhe do grupo mostra todas as parcelas (passadas, atual e futuras já materializadas) com
    seu status calculado (RF-04)

## Fora de escopo desta feature
- Cálculo de juros/amortização de financiamento (Price, SAC etc.) — usuário sempre informa o
  valor já definido de cada parcela (RF-02)
- Recorrência com periodicidade diferente de mensal (semanal, quinzenal, trimestral, anual)
- Notificação/lembrete de vencimento — fica para a Fase 2, Etapa 1 (bot conversacional via
  Telegram),
  quando o canal de aviso proativo existir
- Pagamento parcial de uma parcela (ex.: pagar metade agora, metade depois) — `paid_amount`
  cobre diferença de valor (desconto/juros), mas a parcela vira "paga" por inteiro, não fica
  "parcialmente paga"
- Transferência/migração de parcelas entre grupos (ex.: mover parcelas restantes de um grupo
  para outro) — encerrar um grupo e criar outro do zero (RF-10) já cobre o caso de uso
  identificado (ex.: troca de aluguel entre apartamentos)

## Decisões confirmadas
- Entidade própria, separada de `Transaction`: conta a pagar/receber representa uma obrigação
  ainda não consumada; `Transaction` continua representando só fatos financeiros já ocorridos
- `type` da conta a pagar/receber reaproveita o mesmo enum de `Transaction.type`
  (`income`/`expense`), já que uma parcela paga sempre vira uma `Transaction` com o mesmo `type`
  dela — evita um segundo vocabulário para o mesmo conceito
- Terminologia do domínio: "conta a pagar/receber" é o grupo (obrigação como um todo); "parcela"
  é cada ocorrência individual dele. Uma conta a pagar/receber avulsa (RF-01) é o caso
  degenerado de um grupo com uma única parcela, mas não materializa uma linha de grupo — a
  parcela avulsa carrega seus próprios `description`/`counterparty`/`account_id` diretamente

## Frontend desta etapa (painel web)
Construído junto com o backend desta etapa. Todas as páginas exigem login (guarda de rota da
Etapa 1).
- Listagem de contas a pagar/receber (RF-12): filtro por tipo e status, com indicador de total
  previsto até uma data escolhida (RF-11)
- Cadastro: avulsa (RF-01), parcelada (RF-02) ou recorrente (RF-03), com os campos de cada modo
- Tela de detalhe do grupo (RF-12): observação geral, contraparte, lista de parcelas com status
- Ação de pagar/receber uma parcela (RF-05): seleção de conta, valor pré-preenchido e editável
- Ação de editar parcela (RF-06) e editar grupo (RF-07), com aviso de que editar o grupo afeta
  as parcelas futuras não pagas
- Ação de cancelar (RF-08, com campo de motivo opcional) e excluir (RF-09) parcela, com modal de
  confirmação extra quando a parcela já está paga
- Ação de encerrar (RF-10) um grupo inteiro, com escolha entre "só as pendentes" ou "tudo",
  mesmo modal de confirmação extra quando há parcelas pagas envolvidas
