# Assistente Financeiro

Sistema pessoal de controle financeiro, multi-usuário (cada usuário só vê os próprios dados),
com suporte planejado a subusuários com visualização compartilhada.

## O que o projeto faz
- Registro de receitas e despesas, associadas a uma conta bancária ou cartão de crédito
- Cadastro de contas bancárias e cartões de crédito (um cartão pode ou não estar vinculado a
  um banco)
- Contas a pagar/receber
- Metas financeiras e acompanhamento de patrimônio/investimentos
- Lançamento manual **e** importação de extratos/faturas (OFX, CSV, PDF)
- Uso via bot conversacional (Telegram) e painel web
- Deploy na GCP (Cloud Run + Cloud SQL para PostgreSQL)

## Status
Fase 1 (MVP) concluída — Etapas 1 a 6, backend e frontend implementados e testados. Fase 2
(pós-MVP: bot conversacional, subusuários) ainda não iniciada. O desenvolvimento é guiado por
especificações (*spec-driven development*): veja `specs/00-overview/constitution.md` para a
visão completa, decisões técnicas e o roadmap de fases e etapas. Cada etapa tem seus próprios
`requirements.md`, `design.md` e `tasks.md` em `specs/fase-<N>/etapa-<NN>-<nome>/`.

Etapa 6 (importação de arquivos) depende de Cloud Tasks e Vertex AI (Gemini), sem credenciais
neste ambiente — ambos ficaram atrás de uma interface com um fake determinístico para dev/teste;
a integração real precisa ser validada contra um projeto GCP antes do deploy (ver
`specs/fase-1/etapa-06-importacao-arquivos/tasks.md`).

## Rodando localmente

Pré-requisitos: Node.js 22+, Docker (com `docker compose`).

```bash
docker compose up -d          # Postgres de dev (5432) e de teste (5433)

cd backend
cp .env.example .env          # ajustar se necessário
npm install
npx prisma migrate deploy     # aplica as migrations no banco de dev
npm run dev                   # http://localhost:3000

# em outro terminal
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

### Testes
```bash
cd backend && npm test          # testes de integração contra o Postgres de teste (porta 5433)
cd frontend && npm test         # testes de componente (Vitest + Testing Library + MSW)
cd frontend && npm run test:e2e # E2E (Playwright); sobe backend+frontend automaticamente
```

O Playwright precisa de bibliotecas do sistema para rodar o Chromium
(`npx playwright install --with-deps chromium`, requer sudo). Se preferir não usar sudo, dá
pra baixar os pacotes sem instalar (`apt-get download libnss3 libnspr4 libasound2t64`),
extrair com `dpkg -x <pacote>.deb <pasta>` e apontar `LD_LIBRARY_PATH` pra
`<pasta>/usr/lib/x86_64-linux-gnu` antes de rodar os testes E2E.
