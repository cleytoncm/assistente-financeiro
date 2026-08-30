# Tasks — Autenticação e Usuários

Status: não iniciado. Nenhuma task começa antes de requirements.md e design.md serem
confirmados pelo usuário. Esta etapa bloqueia o início da Etapa 2 (Contas e Cartões), pois
todas as tabelas seguintes dependem de `user_id` vindo de um usuário real autenticado.

Política de testes (ver `constitution.md`, "Estratégia de Testes"): toda task de feature
abaixo já inclui o teste correspondente — nenhuma é considerada concluída sem ele.

- [ ] T01 — Setup de ferramental de teste do backend: Vitest, PostgreSQL de teste via Docker,
      threshold de cobertura (90% geral / 100% em módulos de regra de negócio)
      (requisito: base para todas as tasks de backend abaixo)
- [ ] T02 — Migration: tabela `users` (name, email unique, password_hash)
      (requisito: RF-01)
- [ ] T03 — Endpoint POST /auth/register (hash de senha com bcrypt) + testes de integração
      (cadastro válido, e-mail duplicado, senha curta)
      (requisito: RF-01)
- [ ] T04 — Endpoint POST /auth/login (valida senha, emite JWT) + testes de integração
      (login válido, credenciais inválidas retornando erro genérico)
      (requisito: RF-02)
- [ ] T05 — Middleware requireAuth (valida JWT, popula req.userId) + testes (sem token, token
      inválido, token expirado → 401)
      (requisito: RF-03)
- [ ] T06 — Helper scopedToUser centralizando filtro por usuário + teste unitário (isolamento
      entre dois usuários distintos)
      (requisito: RF-04; base de extensibilidade para subusuários)
- [ ] T07 — Endpoint GET /auth/me + teste de integração
      (requisito: RF-05)
- [ ] T08 — Rate limiting em POST /auth/register e POST /auth/login + teste (429 acima do
      limite)
      (requisito: RF-06)
- [ ] T09 — Setup do projeto front (React + Vite + TypeScript) e ferramental de teste do
      frontend: Vitest + React Testing Library + MSW, Playwright (E2E)
      (requisito: base para as tasks de frontend abaixo)
- [ ] T10 — Client HTTP central (injeta Authorization, trata 401 globalmente) + teste
      (requisito: base de frontend desta e das próximas etapas)
- [ ] T11 — Tela de cadastro (React) consumindo POST /auth/register + teste de componente
      (validação de campos, erro de e-mail duplicado) + E2E (cadastro completo)
      (requisito: RF-01)
- [ ] T12 — Tela de login (React) consumindo POST /auth/login, salva token em localStorage +
      teste de componente + E2E (cadastro → login)
      (requisito: RF-02)
- [ ] T13 — Guarda de rota autenticada no front (redireciona para /login sem token/em 401) +
      teste de componente
      (requisito: RF-03)
