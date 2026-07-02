# Requisitos — Contas e Cartões

## Contexto
Depende da Fase 1 (Autenticação e Usuários): toda conta/cartão pertence a um usuário
autenticado. Fundação de dados do sistema: toda transação futura (Fase 3+) referencia uma
conta bancária ou um cartão de crédito. Sem isso, nenhuma outra feature pode ser implementada.

## Requisitos funcionais

### RF-01 — Cadastrar conta bancária
Como usuário, quero cadastrar uma conta bancária para associar lançamentos e saldo a ela.
- Critérios de aceite:
  - Dado que informo nome, banco e saldo inicial, uma conta é criada com esse saldo
  - Nome da conta é obrigatório e único por usuário
  - Saldo inicial pode ser zero ou negativo (ex.: conta já no cheque especial)

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

### RF-05 — Listar contas e cartões
Como usuário, quero ver todas as minhas contas e cartões, incluindo qual cartão está vinculado
a qual conta (se algum).

## Fora de escopo desta feature
- Cálculo de saldo por lançamentos (Fase 3)
- Fatura, parcelamento, pagamento (Fase 4)
- Visualização compartilhada por subusuários (Fase 9 — futura; esta fase só modela o dono
  único de cada conta/cartão via `user_id`)

## Perguntas abertas
- Confirmar: cartão pode ter mais de um "responsável pelo pagamento" configurável por fatura,
  ou o vínculo cadastrado aqui é sempre a conta pagadora padrão? (assumido: vínculo é o padrão,
  mas pode ser sobrescrito por fatura na Fase 4)
