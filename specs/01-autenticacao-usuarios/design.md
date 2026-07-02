# Design — Autenticação e Usuários

## Modelo de dados

```
User
  id, name, email (UNIQUE), password_hash, created_at
```

Nenhuma tabela de sessão no MVP (ver decisão de token abaixo). Todas as tabelas das fases
seguintes (Account, Card, ...) mantêm `user_id (FK User)` como já previsto no design de
Contas e Cartões — a diferença é que esse `user_id` agora vem do token autenticado, nunca do
corpo da requisição.

## Autenticação: JWT stateless
- Login válido gera um JWT assinado (secret em Secret Manager na GCP) contendo `sub` (user id)
  e expiração (ex.: 7 dias — uso pessoal, não justifica expiração curta com refresh token)
- Middleware `requireAuth` valida o JWT, popula `req.userId`, rejeita com 401 se ausente/inválido
- Logout é client-side (descartar o token); sem blacklist no MVP

## Senha
- Hash com `bcrypt` (custo 10-12), nunca armazenar em texto puro
- Sem política de complexidade forçada no MVP (não solicitado)

## API

```
POST /auth/register    { name, email, password } -> 201
POST /auth/login       { email, password } -> { token }
GET  /auth/me          (autenticado) -> { id, name, email }
```

## Regra de isolamento (RF-04) — helper centralizado
Toda query de dados de outras fases deve passar por um helper único, ex.:
`scopedToUser(userId, query)`, em vez de cada endpoint reimplementar o filtro por `user_id`.
Isso é o que permite, na fase futura de subusuários, trocar esse helper para também aceitar
"usuários com acesso concedido" sem reescrever cada endpoint individualmente.

## Nota de extensibilidade — subusuários (fase futura, não implementar agora)
Quando essa fase existir, o modelo provável é uma tabela de concessão de acesso, ex.:
```
UserAccess
  id, owner_user_id (FK User), viewer_user_id (FK User), permission (ex.: 'view'), created_at
```
E o helper `scopedToUser` passaria a resolver "todos os `owner_user_id` que `viewer_user_id`
pode ver" antes de filtrar os dados. Não criar essa tabela agora — só manter o acesso a dados
centralizado no helper para que essa mudança não exija tocar em todos os endpoints depois.

## Integração com o bot (Telegram) — decisão adiada para a fase do bot
O bot precisa mapear um `chat_id` do Telegram para um `user_id` do sistema (ex.: comando
`/vincular <código>` gerado no painel web). Detalhar no design da fase "Bot conversacional".

## Impacto no deploy GCP
Substitui a solução temporária de "chave de API fixa" descrita antes na constitution.md —
agora é autenticação real por usuário. O secret do JWT vai para o Secret Manager, assim como
o hash de senha nunca trafega nem é logado.
