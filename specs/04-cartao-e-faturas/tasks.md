# Tasks — Cartão de Crédito e Faturas

Status: não iniciado. Depende da Fase 1, Fase 2 e Fase 3 implementadas. Nenhuma task começa
antes de requirements.md e design.md serem confirmados pelo usuário.

Política de testes (ver `constitution.md`, "Estratégia de Testes"): toda task de feature
abaixo já inclui o teste correspondente — nenhuma é considerada concluída sem ele.

- [ ] T01 — Migration: tabela `invoices`
      (requisito: RF-01, RF-02, RF-05)
- [ ] T02 — Migration: coluna `invoice_id` em `transactions`
      (requisito: RF-01)
- [ ] T03 — Lógica de resolução/criação sob demanda de `invoice_id` ao criar/editar
      `Transaction` de cartão + testes unitários (atribuição ao período correto, criação de
      faturas intermediárias vazias quando a data-alvo está vários meses à frente)
      (requisito: RF-01)
- [ ] T04 — Cálculo de status derivado da fatura + testes unitários (todas as transições:
      aberta/fechada/atrasada/paga, incluindo o caso de `date` igual ao `closing_date`)
      (requisito: RF-03)
- [ ] T05 — Endpoint GET /cards/:id/invoices + teste
      (requisito: RF-08)
- [ ] T06 — Endpoint GET /invoices/:id e GET /invoices/:id/transactions + teste
      (requisito: RF-08)
- [ ] T07 — Endpoint PATCH /invoices/:id (ajuste manual de datas) + teste (bloqueado quando já
      paga)
      (requisito: RF-02)
- [ ] T08 — Endpoint POST /invoices/:id/pay + testes (pagamento normal, pagamento antecipado
      de fatura aberta, fatura já paga rejeitada)
      (requisito: RF-04, RF-05)
- [ ] T09 — Trava de edição/remoção de Transaction em fatura não aberta + teste (409 esperado)
      (requisito: RF-07)
- [ ] T10 — Fluxo de lançamento retroativo em fatura fechada/paga + ajuste do
      `payment_transaction` + testes (fatura fechada recalcula total sem gravar nada extra;
      fatura paga atualiza o valor do lançamento de pagamento)
      (requisito: RF-06)
- [ ] T11 — Tela de fatura: listagem + detalhe com lançamentos e total + teste de componente +
      E2E (ver faturas do cartão, abrir detalhe)
      (requisito: RF-08)
- [ ] T12 — Ação de editar fechamento/vencimento de uma fatura + teste de componente
      (requisito: RF-02)
- [ ] T13 — Ação de pagar fatura com seleção de conta + teste de componente + E2E (pagar
      fatura, ver saldo da conta debitado)
      (requisito: RF-04, RF-05)
- [ ] T14 — Modal de confirmação de ajuste de pagamento ao lançar em fatura já paga + teste de
      componente
      (requisito: RF-06)
- [ ] T15 — Bloqueio visual de editar/remover lançamento de fatura não aberta + teste de
      componente
      (requisito: RF-07)

## Backlog de fases futuras (specs ainda não escritas)
- 05-contas-a-pagar-receber — specs escritas em `specs/05-contas-a-pagar-receber/`
- 06-importacao-arquivos
- 07-bot-conversacional (sem fatia de painel web — interface própria via Telegram)
- 08-subusuarios (visualização compartilhada)
