# Tasks — Contas e Cartões

Status: não iniciado. Depende da Etapa 1 (Autenticação e Usuários) estar implementada —
`requireAuth` e a tabela `users` já existem antes desta etapa começar. Nenhuma task começa
antes de requirements.md e design.md serem confirmados pelo usuário.

Política de testes (ver `constitution.md`, "Estratégia de Testes"): toda task de feature
abaixo já inclui o teste correspondente — nenhuma é considerada concluída sem ele.

- [ ] T01 — Setup do projeto Node.js/TypeScript (estrutura de pastas, lint, scripts de dev)
      (requisito: base para todas as tasks abaixo — pode ser feito junto com a Etapa 1)
- [ ] T02 — Setup do banco de dados (PostgreSQL) e ORM (Prisma), migration inicial vazia
      (requisito: base para RF-01..RF-05 — pode ser feito junto com a Etapa 1)
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

## Backlog de fases/etapas futuras
Cada etapa abaixo inclui sua própria fatia de frontend (React), não há mais uma etapa isolada
de "painel web" — ver roadmap em `constitution.md`.
- Etapa 3 (Lançamentos manuais) — specs escritas em
  `specs/fase-1/etapa-03-lancamentos-manuais/`
- Etapa 4 (Cartão e faturas) — specs escritas em `specs/fase-1/etapa-04-cartao-e-faturas/`
- Etapa 5 (Contas a pagar/receber) — specs escritas em
  `specs/fase-1/etapa-05-contas-a-pagar-receber/`
- Etapa 6 (Importação de arquivos) — specs escritas em
  `specs/fase-1/etapa-06-importacao-arquivos/`
- Fase 2, Etapa 1 — bot conversacional (sem fatia de painel web — interface própria via
  Telegram) (spec ainda não escrita)
- Fase 2, Etapa 2 — subusuários (visualização compartilhada) (spec ainda não escrita)
