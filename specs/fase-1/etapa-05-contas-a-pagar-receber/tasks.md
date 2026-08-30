# Tasks — Contas a Pagar/Receber

Status: não iniciado. Depende da Etapa 1, Etapa 2 e Etapa 3 implementadas. Nenhuma task começa
antes de requirements.md e design.md serem confirmados pelo usuário.

Política de testes (ver `constitution.md`, "Estratégia de Testes"): toda task de feature abaixo
já inclui o teste correspondente — nenhuma é considerada concluída sem ele.

- [ ] T01 — Migration: tabela `payable_groups`
      (requisito: RF-02, RF-03)
- [ ] T02 — Migration: tabela `payables`
      (requisito: RF-01, RF-02, RF-03, RF-04)
- [ ] T03 — Endpoint POST /payable-groups modo parcelada (`recurrence_type='installment'`) +
      testes (materializa as N parcelas com valor fixo por parcela, `due_day` ajustando dias
      inexistentes no mês, `installment_count < 2` rejeitado)
      (requisito: RF-02)
- [ ] T04 — Endpoint POST /payable-groups modo recorrente (`recurrence_type='recurring'`) +
      testes (materializa lote inicial de 6 parcelas mensais)
      (requisito: RF-03)
- [ ] T05 — Endpoint POST /payables avulsa + testes (criação válida, conta de outro usuário
      rejeitada, conta desativada rejeitada)
      (requisito: RF-01)
- [ ] T06 — Cálculo de status derivado da parcela + testes unitários (todas as transições:
      pendente/vence_hoje/atrasada/paga/cancelada, incluindo `due_date` igual a hoje)
      (requisito: RF-04)
- [ ] T07 — Extensão de horizonte de recorrência disparada por leitura + testes unitários (gera
      próximo lote de 6 quando restam menos de 3 meses de horizonte; não gera quando ainda há
      folga; ignora grupos parcelados/finitos)
      (requisito: RF-03)
- [ ] T08 — Endpoint GET /payables (filtros `type`, `status`, `until`, `group_id`, `account_id`
      + paginação) + teste
      (requisito: RF-11, RF-12)
- [ ] T09 — Endpoints GET /payable-groups e GET /payable-groups/:id (com parcelas e status
      calculado) + teste
      (requisito: RF-12)
- [ ] T10 — Endpoint PATCH /payables/:id + testes (edição válida, bloqueado se paga ou
      cancelada)
      (requisito: RF-06)
- [ ] T11 — Endpoint PATCH /payable-groups/:id + testes (cascade só nas parcelas
      pendente/vence_hoje/atrasada, pagas/canceladas intocadas, `due_day` recalcula `due_date`
      mantendo o mês de cada parcela)
      (requisito: RF-07)
- [ ] T12 — Endpoint POST /payables/:id/cancel + testes (motivo opcional, bloqueado se já
      cancelada, cancelamento de parcela paga exige `confirmDeleteTransaction` e remove a
      `Transaction` vinculada em cascata)
      (requisito: RF-08)
- [ ] T13 — Endpoint DELETE /payables/:id + testes (exclusão simples, exclusão de parcela paga
      exige `confirmDeleteTransaction`, cascata remove a `Transaction` vinculada)
      (requisito: RF-09)
- [ ] T14 — Endpoint DELETE /payable-groups/:id (scope pending/all) + testes (`pending` mantém
      parcelas pagas intactas, `all` exige `confirmDeleteTransactions` quando há parcela paga e
      remove tudo em cascata)
      (requisito: RF-10)
- [ ] T15 — Endpoint POST /payables/:id/pay + testes (cria `Transaction` com `type` correto,
      `paid_amount` diferente do previsto — desconto e juros/multa —, vincula
      `paid_transaction_id`, bloqueado se já paga ou cancelada)
      (requisito: RF-05)
- [ ] T16 — Endpoint GET /payables/summary + teste (agrega total a pagar/a receber até a data,
      ignora pagas/canceladas)
      (requisito: RF-11)
- [ ] T17 — Extensão de GET /accounts com `projected_balance` + teste (soma parcelas
      pendente/vence_hoje/atrasada com `account_id` da conta até a data; parcela sem
      `account_id` não entra)
      (requisito: RF-11)
- [ ] T18 — Tela de listagem de contas a pagar/receber com filtro por tipo/status + indicador de
      total previsto por data (consumindo GET /payables/summary) + teste de componente + E2E
      (cadastrar avulsa, ver total previsto mudar)
      (requisito: RF-11, RF-12)
- [ ] T19 — Formulário de cadastro com os 3 modos (avulsa/parcelada/recorrente) + teste de
      componente
      (requisito: RF-01, RF-02, RF-03)
- [ ] T20 — Tela de detalhe do grupo (observação/contraparte + lista de parcelas com status) +
      ações de editar grupo e encerrar grupo (pending/all) + teste de componente
      (requisito: RF-07, RF-10, RF-12)
- [ ] T21 — Ação de pagar parcela (seleção de conta, valor pré-preenchido editável) + teste de
      componente + E2E (pagar parcela, ver `projected_balance` da conta atualizar)
      (requisito: RF-05)
- [ ] T22 — Ações de cancelar (motivo opcional) e excluir parcela, com modal de confirmação
      extra quando já paga + teste de componente
      (requisito: RF-08, RF-09)
- [ ] T23 — Exibição de `projected_balance` ao lado de `current_balance` nas telas de conta da
      Etapa 2/3 + teste de componente
      (requisito: RF-11)

## Backlog de fases/etapas futuras
- Etapa 6 (Importação de arquivos) — specs escritas em
  `specs/fase-1/etapa-06-importacao-arquivos/`
- Fase 2, Etapa 1 — bot conversacional (sem fatia de painel web — interface própria via
  Telegram; cobrir aqui notificação/lembrete de vencimento de conta a pagar/receber, deixado de
  fora desta etapa — ver
  `specs/fase-1/etapa-05-contas-a-pagar-receber/requirements.md`, "Fora de escopo") (spec ainda
  não escrita)
- Fase 2, Etapa 2 — subusuários (visualização compartilhada) (spec ainda não escrita)
