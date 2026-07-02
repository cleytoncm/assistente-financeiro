# Design — Contas e Cartões

## Modelo de dados

```
User
  id, name, email, created_at

Account (conta bancária)
  id, user_id (FK), name, bank_name, initial_balance (DECIMAL), created_at
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
- Valores monetários em `DECIMAL(12,2)` — nunca float, para evitar erro de arredondamento.
- `initial_balance` é o ponto de partida do saldo; saldo corrente será calculado somando
  lançamentos (Fase 2), não armazenado como campo mutável aqui.

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
```

Autenticação: esta fase depende da Fase 1 (Autenticação e Usuários). Todo endpoint exige o
middleware `requireAuth` (JWT no header `Authorization`); `user_id` nunca é enviado pelo
cliente — vem sempre de `req.userId`, populado a partir do token. Isso garante o isolamento
entre usuários (RF-04 da Fase 1) sem que esta fase precise reimplementar nada de autenticação.

## Validações
- `closing_day` e `due_day`: inteiros entre 1 e 31
- `linked_account_id`, se informado, deve pertencer ao mesmo `user_id` do cartão
- Nome de conta/cartão único por usuário (case-insensitive)

## Decisões técnicas
- ORM: a definir na implementação (Prisma é o candidato natural para Node.js/TypeScript +
  MySQL — decisão a confirmar no início da Fase 1, não bloqueia este design)
- Sem exclusão física por padrão seria uma opção (soft delete), mas como Fase 1 só bloqueia
  remoção quando há lançamentos, exclusão física é suficiente por ora
