# Tasks — Autenticação e Usuários

Status: não iniciado. Nenhuma task começa antes de requirements.md e design.md serem
confirmados pelo usuário. Esta fase bloqueia o início da Fase 2 (Contas e Cartões), pois
todas as tabelas seguintes dependem de `user_id` vindo de um usuário real autenticado.

- [ ] T01 — Migration: tabela `users` (name, email unique, password_hash)
      (requisito: RF-01)
- [ ] T02 — Endpoint POST /auth/register (hash de senha com bcrypt)
      (requisito: RF-01)
- [ ] T03 — Endpoint POST /auth/login (valida senha, emite JWT)
      (requisito: RF-02)
- [ ] T04 — Middleware requireAuth (valida JWT, popula req.userId)
      (requisito: RF-03)
- [ ] T05 — Helper scopedToUser centralizando filtro por usuário
      (requisito: RF-04; base de extensibilidade para subusuários)
- [ ] T06 — Endpoint GET /auth/me
      (requisito: RF-05)
- [ ] T07 — Testes automatizados (registro, login, acesso negado sem token, isolamento entre
      dois usuários distintos)
- [ ] T08 — Rate limiting em POST /auth/register e POST /auth/login (429 acima do limite)
      (requisito: RF-06)
- [ ] T09 — Setup do projeto front (React + Vite + TypeScript)
      (requisito: base para as tasks de frontend abaixo)
- [ ] T10 — Client HTTP central (injeta Authorization, trata 401 globalmente)
      (requisito: base de frontend desta e das próximas fases)
- [ ] T11 — Tela de cadastro (React) consumindo POST /auth/register
      (requisito: RF-01)
- [ ] T12 — Tela de login (React) consumindo POST /auth/login, salva token em localStorage
      (requisito: RF-02)
- [ ] T13 — Guarda de rota autenticada no front (redireciona para /login sem token/em 401)
      (requisito: RF-03)
