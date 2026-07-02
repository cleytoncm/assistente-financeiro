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
  - E-mail é único no sistema
  - Senha é armazenada com hash (nunca em texto puro)
  - Após cadastro, o usuário pode fazer login imediatamente

### RF-02 — Login
Como usuário cadastrado, quero entrar com e-mail e senha e receber um token de acesso.
- Critérios de aceite:
  - Credenciais inválidas retornam erro genérico (não revelar se o e-mail existe ou não)
  - Login válido retorna um token que identifica o usuário nas próximas requisições

### RF-03 — Autenticação obrigatória nos demais endpoints
Como sistema, todo endpoint de dados (contas, cartões, lançamentos, etc., das fases
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

## Fora de escopo desta feature (fase futura)
- **Subusuários**: um usuário principal poder cadastrar subusuários que visualizam (somente
  leitura) seus dados. Fica para uma fase própria, mas o design desta feature deve evitar
  decisões que impeçam essa extensão depois (ver design.md — nota de extensibilidade).
- Recuperação de senha, verificação de e-mail, login social — não solicitados ainda.

## Perguntas abertas
- Formato do token: JWT stateless (mais simples, sem tabela de sessão) ou token opaco com
  tabela de sessões (permite revogar login remotamente)? Recomendação: JWT stateless para o
  MVP, dado uso pessoal; revisitar se revogação de sessão se tornar necessária.
