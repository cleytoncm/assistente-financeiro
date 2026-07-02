# Tasks — Contas e Cartões

Status: não iniciado. Depende da Fase 1 (Autenticação e Usuários) estar implementada —
`requireAuth` e a tabela `users` já existem antes desta fase começar. Nenhuma task começa
antes de requirements.md e design.md serem confirmados pelo usuário.

- [ ] T01 — Setup do projeto Node.js/TypeScript (estrutura de pastas, lint, scripts de dev)
      (requisito: base para todas as tasks abaixo — pode ser feito junto com a Fase 1)
- [ ] T02 — Setup do banco de dados (MySQL) e ORM, migration inicial vazia
      (requisito: base para RF-01..RF-05 — pode ser feito junto com a Fase 1)
- [ ] T04 — Migration: tabela `accounts`
      (requisito: RF-01)
- [ ] T05 — Migration: tabela `cards` com `linked_account_id` nullable
      (requisito: RF-02)
- [ ] T06 — Endpoint POST /accounts + validação
      (requisito: RF-01)
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

## Backlog de fases futuras (specs ainda não escritas)
- 03-lancamentos-manuais
- 04-cartao-e-faturas
- 05-contas-a-pagar-receber
- 06-importacao-arquivos
- 07-bot-conversacional
- 08-painel-web
- 09-subusuarios (visualização compartilhada)
