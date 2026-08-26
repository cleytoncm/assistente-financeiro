# Tasks — Contas e Cartões

Status: não iniciado. Depende da Fase 1 (Autenticação e Usuários) estar implementada —
`requireAuth` e a tabela `users` já existem antes desta fase começar. Nenhuma task começa
antes de requirements.md e design.md serem confirmados pelo usuário.

Política de testes (ver `constitution.md`, "Estratégia de Testes"): toda task de feature
abaixo já inclui o teste correspondente — nenhuma é considerada concluída sem ele.

- [ ] T01 — Setup do projeto Node.js/TypeScript (estrutura de pastas, lint, scripts de dev)
      (requisito: base para todas as tasks abaixo — pode ser feito junto com a Fase 1)
- [ ] T02 — Setup do banco de dados (PostgreSQL) e ORM (Prisma), migration inicial vazia
      (requisito: base para RF-01..RF-05 — pode ser feito junto com a Fase 1)
- [ ] T03 — Migration: tabela `banks` + seed com principais bancos brasileiros (nome + código
      Bacen/COMPE)
      (requisito: RF-06)
- [ ] T04 — Migration: tabela `accounts` com `bank_id` (FK `banks`) e `currency` (default 'BRL')
      (requisito: RF-01)
- [ ] T05 — Migration: tabela `cards` com `linked_account_id` nullable
      (requisito: RF-02)
- [ ] T06 — Endpoints POST /banks e GET /banks + testes (cadastro de banco, código duplicado
      rejeitado, listagem)
      (requisito: RF-06)
- [ ] T07 — Endpoint POST /accounts + validação + testes (criação válida, nome duplicado por
      usuário, saldo inicial negativo permitido)
      (requisito: RF-01)
- [ ] T08 — Endpoint GET /accounts + teste
      (requisito: RF-05)
- [ ] T09 — Endpoint PATCH /accounts/:id + teste
      (requisito: RF-03)
- [ ] T10 — Endpoint DELETE /accounts/:id (bloqueio simples, sem lançamentos ainda) + teste
      (requisito: RF-04)
- [ ] T11 — Endpoint POST /cards + validação de vínculo opcional + testes (com vínculo, sem
      vínculo, vínculo com conta de outro usuário rejeitado)
      (requisito: RF-02)
- [ ] T12 — Endpoint GET /cards (incluindo dados da conta vinculada) + teste
      (requisito: RF-05)
- [ ] T13 — Endpoint PATCH /cards/:id + teste
      (requisito: RF-03)
- [ ] T14 — Endpoint DELETE /cards/:id + teste
      (requisito: RF-04)
- [ ] T15 — Página de listagem de contas e cartões (React), com indicação de vínculo + teste
      de componente + E2E (criar conta, ver na listagem)
      (requisito: RF-05)
- [ ] T16 — Formulário de conta (nome, banco via select + cadastro de banco novo, moeda,
      saldo inicial) + teste de componente
      (requisito: RF-01, RF-06)
- [ ] T17 — Formulário de cartão (nome, limite, dias de fechamento/vencimento, vínculo
      opcional) + teste de componente
      (requisito: RF-02)
- [ ] T18 — Ação de remover conta/cartão na UI, com tratamento de bloqueio (há lançamentos) +
      teste de componente
      (requisito: RF-04)

## Backlog de fases futuras (specs ainda não escritas)
Cada fase abaixo inclui sua própria fatia de frontend (React), não há mais uma fase isolada
de "painel web" — ver roadmap em `constitution.md`.
- 03-lancamentos-manuais — specs escritas em `specs/03-lancamentos-manuais/`
- 04-cartao-e-faturas — specs escritas em `specs/04-cartao-e-faturas/`
- 05-contas-a-pagar-receber — lembrar de cobrir crediário/financiamento fora do cartão (ver
  `specs/03-lancamentos-manuais/requirements.md`, "Fora de escopo")
- 06-importacao-arquivos
- 07-bot-conversacional (sem fatia de painel web — interface própria via Telegram)
- 08-subusuarios (visualização compartilhada)
