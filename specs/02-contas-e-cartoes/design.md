# Design — Contas e Cartões

## Modelo de dados

```
User
  id, name, email, created_at

Bank (catálogo de bancos — compartilhado entre usuários, sem user_id)
  id, name, code (UNIQUE), created_at

Account (conta bancária)
  id, user_id (FK), name, bank_id (FK Bank), currency (CHAR(3), default 'BRL'),
  initial_balance (DECIMAL), created_at
  unique(user_id, name)

Card (cartão de crédito)
  id, user_id (FK), name, credit_limit (DECIMAL),
  closing_day (INT 1-31), due_day (INT 1-31),
  linked_account_id (FK Account, NULLABLE),
  created_at
  unique(user_id, name)
```

Notas:
- `linked_account_id` nulo representa cartão "sem vínculo" (RF-02). Nenhum outro campo muda
  de comportamento — a ausência de vínculo só afeta o fluxo de pagamento de fatura (Fase 3),
  que exigirá escolher a conta pagadora manualmente lançamento a lançamento.
- `linked_account_id`, quando presente, é apenas a conta pagadora **padrão** sugerida para as
  faturas do cartão — a Fase 4 (fatura) permite escolher outra conta pontualmente para uma
  fatura específica, sem precisar editar o vínculo do cartão.
- Valores monetários em `DECIMAL(12,2)` — nunca float, para evitar erro de arredondamento.
- `initial_balance` é o ponto de partida do saldo; saldo corrente será calculado somando
  lançamentos (Fase 3), não armazenado como campo mutável aqui.
- `Bank` é catálogo compartilhado, não escopado por `user_id` — não passa pelo helper
  `scopedToUser` (RF-06). Populado via migration de seed com os principais bancos brasileiros
  (nome + código Bacen/COMPE); qualquer usuário autenticado pode adicionar um banco que falte.
- `currency` é código ISO 4217 (texto livre, sem tabela de catálogo — lista de moedas é
  estável); padrão `'BRL'` se não informado. Cada moeda diferente numa mesma instituição vira
  uma `Account` separada (ex.: "Inter Conta Corrente" em BRL e "Inter Dólar" em USD como duas
  contas distintas), não um saldo multi-moeda numa única conta. `Card` não tem `currency` nesta
  fase (ver Fora de escopo do requirements.md).

## API (REST, dentro do backend Node.js/TypeScript)

```
POST   /accounts              cria conta bancária
GET    /accounts              lista contas do usuário
PATCH  /accounts/:id          edita conta
DELETE /accounts/:id          remove conta (bloqueado se houver lançamentos — Fase 3+)

POST   /cards                 cria cartão (linked_account_id opcional)
GET    /cards                 lista cartões do usuário, com dados da conta vinculada se houver
PATCH  /cards/:id             edita cartão
DELETE /cards/:id             remove cartão (bloqueado se houver lançamentos — Fase 3+)

POST   /banks                 cadastra banco no catálogo (name, code) — compartilhado, sem user_id
GET    /banks                 lista bancos do catálogo
```

Autenticação: esta fase depende da Fase 1 (Autenticação e Usuários). Todo endpoint exige o
middleware `requireAuth` (JWT no header `Authorization`); `user_id` nunca é enviado pelo
cliente — vem sempre de `req.userId`, populado a partir do token. Isso garante o isolamento
entre usuários (RF-04 da Fase 1) sem que esta fase precise reimplementar nada de autenticação.

## Validações
- `closing_day` e `due_day`: inteiros entre 1 e 31 (sem validação de relação entre os dois —
  cada cartão/banco tem sua própria regra; usuário informa manualmente)
- `linked_account_id`, se informado, deve pertencer ao mesmo `user_id` do cartão
- Nome de conta/cartão único por usuário (case-insensitive)
- `bank_id` deve existir no catálogo `Bank`
- `code` do banco é único no catálogo (RF-06)

## Decisões técnicas
- ORM: Prisma, com `provider = "postgresql"` (Node.js/TypeScript + PostgreSQL)
- Sem exclusão física por padrão seria uma opção (soft delete), mas como esta fase (RF-04) só
  bloqueia remoção quando há lançamentos, exclusão física é suficiente por ora — revisitado na
  Fase 3 (RF-09), que introduz exclusão em cascata como alternativa

## Frontend (React + Vite + TypeScript)
Reaproveita o client HTTP e a guarda de rota da Fase 1.
- Página de listagem: tabela de contas e de cartões (com indicação visual do vínculo
  cartão↔conta), usando `GET /accounts` e `GET /cards`
- Formulário de conta: campo de banco é um `select` populado por `GET /banks`, com opção
  "cadastrar novo banco" que abre um formulário simples (`POST /banks`) sem sair da tela
- Formulário de cartão: `select` de conta vinculada (opcional) populado por `GET /accounts`
