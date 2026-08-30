# Tasks — Autenticação e Usuários

Status: concluído (backend e frontend implementados e testados). Esta etapa bloqueava o
início da Etapa 2 (Contas e Cartões), já que todas as tabelas seguintes dependem de `user_id`
vindo de um usuário real autenticado.

Política de testes (ver `constitution.md`, "Estratégia de Testes"): toda task de feature
abaixo já inclui o teste correspondente — nenhuma é considerada concluída sem ele.

- [x] T01 — Setup de ferramental de teste do backend: Vitest, PostgreSQL de teste via Docker,
      threshold de cobertura (90% geral / 100% em módulos de regra de negócio)
      (requisito: base para todas as tasks de backend abaixo)
- [x] T02 — Migration: tabela `users` (name, email unique, password_hash)
      (requisito: RF-01)
- [x] T03 — Endpoint POST /auth/register (hash de senha com bcrypt) + testes de integração
      (cadastro válido, e-mail duplicado, senha curta)
      (requisito: RF-01)
- [x] T04 — Endpoint POST /auth/login (valida senha, emite JWT) + testes de integração
      (login válido, credenciais inválidas retornando erro genérico)
      (requisito: RF-02)
- [x] T05 — Middleware requireAuth (valida JWT, popula req.userId) + testes (sem token, token
      inválido, token expirado → 401)
      (requisito: RF-03)
- [x] T06 — Helper scopedToUser centralizando filtro por usuário + teste unitário (isolamento
      entre dois usuários distintos)
      (requisito: RF-04; base de extensibilidade para subusuários)
- [x] T07 — Endpoint GET /auth/me + teste de integração
      (requisito: RF-05)
- [x] T08 — Rate limiting em POST /auth/register e POST /auth/login + teste (429 acima do
      limite)
      (requisito: RF-06)
- [x] T09 — Setup do projeto front (React + Vite + TypeScript) e ferramental de teste do
      frontend: Vitest + React Testing Library + MSW, Playwright (E2E)
      (requisito: base para as tasks de frontend abaixo)
- [x] T10 — Client HTTP central (injeta Authorization, trata 401 globalmente) + teste
      (requisito: base de frontend desta e das próximas etapas)
- [x] T11 — Tela de cadastro (React) consumindo POST /auth/register + teste de componente
      (validação de campos, erro de e-mail duplicado) + E2E (cadastro completo)
      (requisito: RF-01)
- [x] T12 — Tela de login (React) consumindo POST /auth/login, salva token em localStorage +
      teste de componente + E2E (cadastro → login)
      (requisito: RF-02)
- [x] T13 — Guarda de rota autenticada no front (redireciona para /login sem token/em 401) +
      teste de componente
      (requisito: RF-03)
