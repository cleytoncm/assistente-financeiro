# Tasks — Contas e Cartões

Status: não iniciado. Depende da Fase 1 (Autenticação e Usuários) estar implementada —
`requireAuth` e a tabela `users` já existem antes desta fase começar. Nenhuma task começa
antes de requirements.md e design.md serem confirmados pelo usuário.

- [ ] T01 — Setup do projeto Node.js/TypeScript (estrutura de pastas, lint, scripts de dev)
      (requisito: base para todas as tasks abaixo — pode ser feito junto com a Fase 1)
- [ ] T02 — Setup do banco de dados (PostgreSQL) e ORM (Prisma), migration inicial vazia
      (requisito: base para RF-01..RF-05 — pode ser feito junto com a Fase 1)
- [ ] T03b — Migration: tabela `banks` + seed com principais bancos brasileiros (nome + código
      Bacen/COMPE)
      (requisito: RF-06)
- [ ] T04 — Migration: tabela `accounts` com `bank_id` (FK `banks`) e `currency` (default 'BRL')
      (requisito: RF-01)
- [ ] T05 — Migration: tabela `cards` com `linked_account_id` nullable
      (requisito: RF-02)
- [ ] T06 — Endpoint POST /accounts + validação
      (requisito: RF-01)
- [ ] T06b — Endpoints POST /banks e GET /banks (catálogo compartilhado, sem escopo por usuário)
      (requisito: RF-06)
- [ ] T07 — Endpoint GET /accounts
      (requisito: RF-05)
- [ ] T08 — Endpoint PATCH /accounts/:id
      (requisito: RF-03)
- [ ] T09 — Endpoint DELETE /accounts/:id (bloqueio simples, sem lançamentos ainda)
      (requisito: RF-04)
- [ ] T10 — Endpoint POST /cards + validação de vínculo opcional
      (requisito: RF-02)
- [ ] T11 — Endpoint GET /cards (incluindo dados da conta vinculada)
      (requisito: RF-05)
- [ ] T12 — Endpoint PATCH /cards/:id
      (requisito: RF-03)
- [ ] T13 — Endpoint DELETE /cards/:id
      (requisito: RF-04)
- [ ] T14 — Testes automatizados dos endpoints acima
- [ ] T15 — Página de listagem de contas e cartões (React), com indicação de vínculo
      (requisito: RF-05)
- [ ] T16 — Formulário de conta (nome, banco via select + cadastro de banco novo, moeda,
      saldo inicial)
      (requisito: RF-01, RF-06)
- [ ] T17 — Formulário de cartão (nome, limite, dias de fechamento/vencimento, vínculo
      opcional)
      (requisito: RF-02)
- [ ] T18 — Ação de remover conta/cartão na UI, com tratamento de bloqueio (há lançamentos)
      (requisito: RF-04)

## Backlog de fases futuras (specs ainda não escritas)
Cada fase abaixo inclui sua própria fatia de frontend (React), não há mais uma fase isolada
de "painel web" — ver roadmap em `constitution.md`.
- 03-lancamentos-manuais
- 04-cartao-e-faturas
- 05-contas-a-pagar-receber
- 06-importacao-arquivos
- 07-bot-conversacional (sem fatia de painel web — interface própria via Telegram)
- 08-subusuarios (visualização compartilhada)
