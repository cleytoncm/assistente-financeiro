# Tasks — Contas e Cartões

Status: concluído (backend e frontend implementados e testados).

Política de testes (ver `constitution.md`, "Estratégia de Testes"): toda task de feature
abaixo já inclui o teste correspondente — nenhuma é considerada concluída sem ele.

- [x] T01 — Setup do projeto Node.js/TypeScript (estrutura de pastas, lint, scripts de dev)
      (requisito: base para todas as tasks abaixo — pode ser feito junto com a Etapa 1)
- [x] T02 — Setup do banco de dados (PostgreSQL) e ORM (Prisma), migration inicial vazia
      (requisito: base para RF-01..RF-05 — pode ser feito junto com a Etapa 1)
- [x] T03 — Migration: tabela `banks` + seed com principais bancos brasileiros (nome + código
      Bacen/COMPE)
      (requisito: RF-06)
- [x] T04 — Migration: tabela `accounts` com `bank_id` (FK `banks`) e `currency` (default 'BRL')
      (requisito: RF-01)
- [x] T05 — Migration: tabela `cards` com `linked_account_id` nullable
      (requisito: RF-02)
- [x] T06 — Endpoints POST /banks e GET /banks + testes (cadastro de banco, código duplicado
      rejeitado, listagem)
      (requisito: RF-06)
- [x] T07 — Endpoint POST /accounts + validação + testes (criação válida, nome duplicado por
      usuário, saldo inicial negativo permitido)
      (requisito: RF-01)
- [x] T08 — Endpoint GET /accounts + teste
      (requisito: RF-05)
- [x] T09 — Endpoint PATCH /accounts/:id + teste
      (requisito: RF-03)
- [x] T10 — Endpoint DELETE /accounts/:id (bloqueio simples, sem lançamentos ainda) + teste
      (requisito: RF-04)
- [x] T11 — Endpoint POST /cards + validação de vínculo opcional + testes (com vínculo, sem
      vínculo, vínculo com conta de outro usuário rejeitado)
      (requisito: RF-02)
- [x] T12 — Endpoint GET /cards (incluindo dados da conta vinculada) + teste
      (requisito: RF-05)
- [x] T13 — Endpoint PATCH /cards/:id + teste
      (requisito: RF-03)
- [x] T14 — Endpoint DELETE /cards/:id + teste
      (requisito: RF-04)
- [x] T15 — Página de listagem de contas e cartões (React), com indicação de vínculo + teste
      de componente + E2E (criar conta, ver na listagem)
      (requisito: RF-05)
- [x] T16 — Formulário de conta (nome, banco via select + cadastro de banco novo, moeda,
      saldo inicial) + teste de componente
      (requisito: RF-01, RF-06)
- [x] T17 — Formulário de cartão (nome, limite, dias de fechamento/vencimento, vínculo
      opcional) + teste de componente
      (requisito: RF-02)
- [x] T18 — Ação de remover conta/cartão na UI, com tratamento de bloqueio (há lançamentos) +
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
