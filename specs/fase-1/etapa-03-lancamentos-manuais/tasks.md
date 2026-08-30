# Tasks — Lançamentos Manuais

Status: não iniciado. Depende da Etapa 1 (Autenticação) e da Etapa 2 (Contas e Cartões)
implementadas. Nenhuma task começa antes de requirements.md e design.md serem confirmados
pelo usuário.

Política de testes (ver `constitution.md`, "Estratégia de Testes"): toda task de feature
abaixo já inclui o teste correspondente — nenhuma é considerada concluída sem ele.

- [ ] T01 — Migration: colunas `is_active`, `is_hidden` em `accounts` e `cards`
      (requisito: RF-08)
- [ ] T02 — Migration: tabela `categories` + seed com categorias comuns (receita e despesa)
      (requisito: RF-03)
- [ ] T03 — Migration: tabela `transactions` (com `refund_of_transaction_id`,
      `installment_group_id`, `installment_number`, `installment_count`)
      (requisito: RF-01, RF-02, RF-06)
- [ ] T04 — Endpoint POST /transactions (avulso) + validações + testes (criação válida, tipo
      inválido, conta/cartão informados juntos ou nenhum dos dois, conta de outro usuário
      rejeitada, conta desativada rejeitada)
      (requisito: RF-01)
- [ ] T05 — Endpoint POST /transactions com `installments` + testes (divisão exata do total,
      arredondamento na última parcela, datas geradas mês a mês)
      (requisito: RF-02)
- [ ] T06 — Validação de estorno (`refund_of_transaction_id`) + testes (tipo oposto, mesma
      conta/cartão, valor <= original aceito, valor maior rejeitado)
      (requisito: RF-06)
- [ ] T07 — Endpoint GET /transactions (filtros + paginação) + teste
      (requisito: RF-07)
- [ ] T08 — Endpoint PATCH /transactions/:id (+ `applyToRemaining`) + testes (edição simples,
      edição aplicada às parcelas restantes)
      (requisito: RF-04)
- [ ] T09 — Endpoint DELETE /transactions/:id (+ `scope=single|remaining`) + teste
      (requisito: RF-05)
- [ ] T10 — Endpoints POST /categories e GET /categories + testes (seed visível a todos,
      categoria própria isolada por usuário, tipo bate com o lançamento)
      (requisito: RF-03)
- [ ] T11 — Estender GET /accounts e GET /cards com `date`/`includeHidden`,
      `current_balance`/`current_spending`/`available_limit` + testes unitários da função de
      cálculo (saldo em data passada, presente e futura) + teste de integração dos endpoints
      (requisito: RF-10)
- [ ] T12 — Endpoints PATCH /accounts/:id/status e PATCH /cards/:id/status + teste
      (requisito: RF-08)
- [ ] T13 — Estender DELETE /accounts/:id e DELETE /cards/:id com `cascade=true` + testes
      (bloqueio sem cascade quando há lançamentos, cascata remove tudo)
      (requisito: RF-09)
- [ ] T14 — Formulário de lançamento (React): tipo, valor, data, descrição, conta/cartão,
      categoria, parcelamento condicional + teste de componente + E2E (lançar receita e
      despesa, ver refletido no saldo)
      (requisito: RF-01, RF-02, RF-03)
- [ ] T15 — Tela de extrato paginada com filtros + teste de componente
      (requisito: RF-07)
- [ ] T16 — Ações de editar/remover lançamento com diálogo de escopo (parcela única vs.
      restantes) + teste de componente
      (requisito: RF-04, RF-05)
- [ ] T17 — Seletor de data (padrão hoje) nas telas de contas/cartões, refletindo saldo/gasto +
      teste de componente
      (requisito: RF-10)
- [ ] T18 — Toggles de ativar/desativar e mostrar/ocultar na listagem de contas/cartões + teste
      de componente
      (requisito: RF-08)
- [ ] T19 — Modal de remoção com 3 opções quando há lançamentos associados + teste de
      componente + E2E (fluxo de exclusão em cascata)
      (requisito: RF-09)

## Backlog de fases/etapas futuras
- Etapa 4 (Cartão e faturas) — specs escritas em `specs/fase-1/etapa-04-cartao-e-faturas/`
- Etapa 5 (Contas a pagar/receber) — specs escritas em
  `specs/fase-1/etapa-05-contas-a-pagar-receber/`
- Etapa 6 (Importação de arquivos) — specs escritas em
  `specs/fase-1/etapa-06-importacao-arquivos/`
- Fase 2, Etapa 1 — bot conversacional (sem fatia de painel web — interface própria via
  Telegram) (spec ainda não escrita)
- Fase 2, Etapa 2 — subusuários (visualização compartilhada) (spec ainda não escrita)
