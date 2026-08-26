# Constituição do Projeto — Assistente Financeiro Pessoal

## Visão
Sistema pessoal para controle financeiro: registrar receitas/despesas, gerenciar contas
bancárias e cartões de crédito, acompanhar contas a pagar/receber, metas e patrimônio.
Uso via bot conversacional (lançamentos rápidos) e painel web (visão consolidada e relatórios).

## Escopo funcional (confirmado com o usuário)
- Receitas e despesas, com categorização
- Cadastro de contas bancárias e cartões de crédito
  - Cartão pode ou não estar vinculado a um banco/conta
  - Cada gasto é associado a uma conta ou cartão específico
  - Fatura do cartão indica qual conta bancária paga o valor
- Contas a pagar/receber
- Metas financeiras e acompanhamento de investimentos/patrimônio
- Entrada de dados manual **e** por importação de arquivo (OFX, CSV, PDF de fatura)
- Interfaces: bot conversacional + painel web (painel web construído incrementalmente junto
  com cada fase, não como fase isolada — ver Roadmap de fases)
- Múltiplos usuários com login, cada um vendo apenas seus próprios dados
- (fase futura) Subusuários: um usuário principal pode conceder a outros usuários
  visualização (somente leitura) dos seus dados

## Decisões técnicas
| Decisão | Escolha | Status |
|---|---|---|
| Stack | Node.js + TypeScript | Confirmado pelo usuário |
| Canal do bot | Telegram | Assumido (sem resposta) — reavaliar |
| Banco de dados | PostgreSQL | Confirmado pelo usuário |
| ORM | Prisma | Confirmado pelo usuário |
| Frontend | React + Vite + TypeScript, SPA consumindo a API REST | Confirmado pelo usuário |
| Autenticação no front | Token JWT em `localStorage`, enviado manualmente no header `Authorization` | Confirmado pelo usuário |
| Hospedagem | GCP (Cloud Run + Cloud SQL) | Confirmado pelo usuário |
| Usuários | Multi-usuário com login, dados isolados; subusuários (view-only) planejado para fase futura | Confirmado pelo usuário |
| Formatos de importação | OFX, CSV, PDF de fatura | Confirmado pelo usuário |

Decisões marcadas como "Assumido" devem ser confirmadas antes ou durante a Fase 1 —
não bloqueiam o início do trabalho de modelagem, mas podem afetar design de fases futuras
(ex.: multi-usuário mudaria o modelo de dados; WhatsApp mudaria a integração do bot).

## Infraestrutura de deploy (GCP)
- **Compute**: Cloud Run para o backend Node.js/TypeScript (contêiner) — serverless, escala a
  zero, paga por uso (adequado para uso pessoal)
- **Banco de dados**: Cloud SQL para PostgreSQL — gerenciado pelo GCP; conexão via Cloud SQL
  Auth Proxy/conector, não host/porta direto
- **Segredos**: Secret Manager (token do bot, credenciais de banco) — nunca em `.env` versionado
- **Imagens**: Artifact Registry
- **CI/CD**: a definir (Cloud Build ou GitHub Actions) — não bloqueia a Fase 1
- **Bot**: modo *webhook* (não polling), pois Cloud Run é request-driven; o endpoint do webhook
  deve validar um secret token do Telegram para rejeitar chamadas forjadas
- **Acesso público**: como o sistema agora é multi-usuário com login (ver Fase 1 —
  Autenticação e Usuários), o controle de acesso é a autenticação real (JWT), não mais uma
  chave de API fixa como se pensou quando o projeto ainda era single-user
- **Ambientes**: desenvolvimento continua local via Docker Compose; GCP é o ambiente de produção

## Metodologia — Spec-Driven Development
Cada feature vive em `specs/<numero>-<nome>/` com três documentos:
- `requirements.md` — o quê e por quê, em requisitos funcionais com critérios de aceite
- `design.md` — como: modelo de dados, contratos de API, decisões técnicas da feature
- `tasks.md` — lista de tarefas rastreáveis, cada uma referenciando o requisito que atende

Nenhuma implementação começa sem `requirements.md` e `design.md` aprovados pelo usuário.
`tasks.md` é atualizado conforme o trabalho avança (marcar concluído, não reescrever histórico).

## Estratégia de Testes
Toda funcionalidade desenvolvida — backend e frontend — precisa de teste automatizado
correspondente. Cada task de feature nos `tasks.md` de cada fase já inclui seu teste embutido
(não existe mais uma task genérica de "testes" separada ao final): uma task não é considerada
concluída sem o teste que a acompanha.

### Ferramental
- **Backend**: Vitest. Testes de API/integração rodam contra um PostgreSQL de teste real (via
  Docker, resetado entre execuções), exercitando o Prisma de verdade — não mocka o banco, já
  que boa parte das regras do sistema vive em constraints (`UNIQUE`, `FK`, `CHECK`) que só um
  teste de integração real pega. Regras de negócio puras (ex.: divisão de valor em parcelas,
  status derivado da fatura, cálculo de saldo "até uma data") vivem isoladas em módulos
  próprios, sem tocar banco/HTTP, com testes unitários dedicados.
- **Frontend**: Vitest + React Testing Library para testes de componente/tela, com a API
  mockada via MSW. Playwright para testes E2E (front + back + banco rodando juntos).
- **E2E incremental**: cada fase adiciona pelo menos um teste E2E cobrindo seu fluxo principal,
  em vez de concentrar tudo num conjunto de E2E gigante só no final.

### Cobertura mínima
- 90% de cobertura de linhas em backend e frontend
- 100% de cobertura nos módulos de regra de negócio do backend (isolados conforme acima),
  cobrindo cenários positivos **e** negativos — não só o caminho feliz
- Sem meta de cobertura equivalente no frontend, que é majoritariamente UI/integração com a
  API, não regra de negócio

### CI/CD
Ainda em aberto (ver "Infraestrutura de deploy" abaixo — Cloud Build ou GitHub Actions a
definir). A exigência de teste/cobertura vale independente de automação de CI: por ora é
aplicada por revisão/localmente, sem gate automático bloqueando push/PR.

## Roadmap de fases
Não existe uma fase isolada de "painel web": o front (React + Vite + TypeScript) é construído
incrementalmente dentro de cada fase, junto com o backend correspondente — cada fase entrega
API **e** as telas que a usam. O bot conversacional (Telegram) continua como interface própria,
à parte do painel web.

1. **Autenticação e Usuários** — cadastro, login, token, isolamento de dados por usuário
   (+ telas de login/cadastro)
2. **Contas e Cartões** — modelo de dados base (contas, cartões, vínculo opcional)
   (+ telas de listagem/cadastro de contas, cartões e bancos)
3. **Lançamentos manuais** — receitas/despesas, saldo por conta/cartão
   (+ tela de lançamento e extrato)
4. **Cartão de crédito e faturas** — fechamento/vencimento, conta pagadora (+ tela de fatura).
   Parcelamento simples já foi coberto na Fase 3; esta fase agrupa os lançamentos de cartão em
   faturas reais (ver `specs/04-cartao-e-faturas/`)
5. **Contas a pagar/receber** (+ tela correspondente) — cobrir aqui crediário/financiamento
   fora do cartão (compra parcelada direto com uma loja, débito futuro em conta bancária),
   deixado de fora da Fase 3 (ver `specs/03-lancamentos-manuais/requirements.md`)
6. **Importação de arquivos** — OFX e CSV primeiro, PDF de fatura depois
   (+ tela de upload e revisão de importação)
7. **Bot conversacional** — lançar, consultar saldo, enviar arquivo para importar (interface
   própria via Telegram, não é tela do painel web)
8. **Subusuários (visualização compartilhada)** — usuário principal concede acesso somente
   leitura a outro usuário aos seus dados (+ tela de gestão de acesso concedido)

## Não-objetivos (por ora)
- Recuperação de senha, verificação de e-mail, login social (fase de Autenticação cobre só
  cadastro/login básico)
- Integração bancária automática (Open Finance/Pluggy) — descartada em favor de importação de arquivo
- App mobile nativo — descartado em favor de bot + web
