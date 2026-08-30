# Requisitos — Autenticação e Usuários

## Contexto
O sistema deixou de ser single-user: múltiplos usuários vão usar o mesmo backend, cada um
com seus próprios dados. Esta feature é pré-requisito de todas as demais (Contas e Cartões
em diante), pois todo dado passa a pertencer a um usuário autenticado, não mais a um
`user_id` fixo de seed.

## Requisitos funcionais

### RF-01 — Cadastro de usuário
Como visitante, quero criar uma conta com nome, e-mail e senha.
- Critérios de aceite:
  - E-mail é único no sistema, normalizado para lowercase antes de salvar e antes de comparar
    (login e verificação de unicidade) — evita duplicidade por diferença de maiúsculas/minúsculas
  - Senha é armazenada com hash (nunca em texto puro)
  - Senha exige mínimo de 8 caracteres (sem exigir complexidade — maiúscula/número/símbolo)
  - Após cadastro, o usuário pode fazer login imediatamente

### RF-02 — Login
Como usuário cadastrado, quero entrar com e-mail e senha e receber um token de acesso.
- Critérios de aceite:
  - Credenciais inválidas retornam erro genérico (não revelar se o e-mail existe ou não)
  - Login válido retorna um token que identifica o usuário nas próximas requisições

### RF-03 — Autenticação obrigatória nos demais endpoints
Como sistema, todo endpoint de dados (contas, cartões, lançamentos, etc., das etapas
seguintes) exige um token válido no header `Authorization`.
- Critérios de aceite:
  - Requisição sem token ou com token inválido/expirado retorna 401
  - O usuário autenticado é identificado a partir do token, nunca de um campo enviado pelo
    cliente (evita que um usuário informe o `user_id` de outro)

### RF-04 — Isolamento de dados entre usuários
Como usuário, quero que meus dados (contas, cartões, lançamentos, metas etc.) nunca sejam
visíveis para outro usuário.
- Critérios de aceite:
  - Toda consulta/gravação filtra pelo usuário autenticado no token
  - Tentar acessar um recurso (ex.: `GET /accounts/:id`) que pertence a outro usuário
    retorna 404 (não 403, para não confirmar a existência do recurso a quem não é dono)

### RF-05 — Consultar dados do próprio usuário
Como usuário autenticado, quero consultar meu nome e e-mail (`GET /auth/me`).

### RF-06 — Limitar tentativas de login
Como sistema, quero limitar tentativas de login para dificultar ataques de força bruta.
- Critérios de aceite:
  - `POST /auth/login` (e `POST /auth/register`) aplica rate limiting por IP/e-mail (ex.: 5
    tentativas por 15 minutos)
  - Acima do limite, a requisição retorna 429, sem revelar detalhes sobre a conta-alvo

## Fora de escopo desta feature (Fase 2 — pós-MVP)
- **Subusuários**: um usuário principal poder cadastrar subusuários que visualizam (somente
  leitura) seus dados. Fica para a Fase 2, Etapa 2, mas o design desta feature deve evitar
  decisões que impeçam essa extensão depois (ver design.md — nota de extensibilidade).
- Recuperação de senha, verificação de e-mail, login social — não solicitados ainda.

## Decisões confirmadas
- Formato do token: **JWT stateless** (sem tabela de sessão), dado uso pessoal — sem suporte a
  revogação remota de login no MVP; revisitar se isso se tornar necessário.

## Frontend desta etapa (painel web)
Construído junto com o backend desta etapa (não é etapa isolada — ver roadmap na
`constitution.md`).
- Tela de cadastro (RF-01): formulário nome/e-mail/senha, chama `POST /auth/register`
- Tela de login (RF-02): formulário e-mail/senha, chama `POST /auth/login`, guarda o token
  recebido em `localStorage`
- Guarda de rota autenticada: páginas que exigem login redirecionam para a tela de login se
  não houver token em `localStorage`, ou se uma chamada à API retornar 401 (token
  ausente/expirado)
