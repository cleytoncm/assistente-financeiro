# Design — Autenticação e Usuários

## Modelo de dados

```
User
  id, name, email (UNIQUE, lowercase), password_hash, created_at
```

`email` é sempre normalizado para lowercase antes de gravar ou consultar (registro e login).

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
- Mínimo de 8 caracteres, validado no `POST /auth/register`
- Sem política de complexidade forçada no MVP (não solicitado)

## API

```
POST /auth/register    { name, email, password } -> 201
POST /auth/login       { email, password } -> { token }
GET  /auth/me          (autenticado) -> { id, name, email }
```

## Rate limiting (RF-06)
`POST /auth/register` e `POST /auth/login` aplicam limite de tentativas por IP+e-mail (ex.:
5 tentativas / 15 min), retornando 429 acima do limite. Middleware leve em memória no MVP
(ex.: equivalente a `express-rate-limit`) — sem necessidade de Redis dado o volume de uso
pessoal; revisitar se o backend escalar para múltiplas instâncias simultâneas.

## Regra de isolamento (RF-04) — helper centralizado
Toda query de dados de outras etapas deve passar por um helper único, ex.:
`scopedToUser(userId, query)`, em vez de cada endpoint reimplementar o filtro por `user_id`.
Isso é o que permite, na Fase 2, Etapa 2 (subusuários — pós-MVP), trocar esse helper para
também aceitar "usuários com acesso concedido" sem reescrever cada endpoint individualmente.

## Nota de extensibilidade — subusuários (Fase 2, Etapa 2 — pós-MVP, não implementar agora)
Quando essa etapa existir, o modelo provável é uma tabela de concessão de acesso, ex.:
```
UserAccess
  id, owner_user_id (FK User), viewer_user_id (FK User), permission (ex.: 'view'), created_at
```
E o helper `scopedToUser` passaria a resolver "todos os `owner_user_id` que `viewer_user_id`
pode ver" antes de filtrar os dados. Não criar essa tabela agora — só manter o acesso a dados
centralizado no helper para que essa mudança não exija tocar em todos os endpoints depois.

## Integração com o bot (Telegram) — decisão adiada para a Fase 2, Etapa 1 (bot conversacional)
O bot precisa mapear um `chat_id` do Telegram para um `user_id` do sistema (ex.: comando
`/vincular <código>` gerado no painel web). Detalhar no design da Fase 2, Etapa 1 ("Bot
conversacional").

## Frontend (React + Vite + TypeScript)
- SPA separada do backend, consumindo a API REST via `fetch`/`axios`
- Token guardado em `localStorage` após login/cadastro; um client HTTP central injeta o
  header `Authorization: Bearer <token>` em toda chamada autenticada
- Um interceptor trata resposta 401 globalmente: limpa o `localStorage` e redireciona para
  `/login`
- Páginas desta etapa: `/login`, `/cadastro`; demais rotas do painel exigem token (guarda de
  rota simples checando presença do token antes de renderizar)

## Impacto no deploy GCP
Substitui a solução temporária de "chave de API fixa" descrita antes na constitution.md —
agora é autenticação real por usuário. O secret do JWT vai para o Secret Manager, assim como
o hash de senha nunca trafega nem é logado.
