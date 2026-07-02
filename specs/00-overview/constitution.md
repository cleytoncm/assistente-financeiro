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
- Interfaces: bot conversacional + painel web
- Múltiplos usuários com login, cada um vendo apenas seus próprios dados
- (fase futura) Subusuários: um usuário principal pode conceder a outros usuários
  visualização (somente leitura) dos seus dados

## Decisões técnicas
| Decisão | Escolha | Status |
|---|---|---|
| Stack | Node.js + TypeScript | Confirmado pelo usuário |
| Canal do bot | Telegram | Assumido (sem resposta) — reavaliar |
| Banco de dados | MySQL | Assumido (sem resposta) — reavaliar |
| Hospedagem | GCP (Cloud Run + Cloud SQL) | Confirmado pelo usuário |
| Usuários | Multi-usuário com login, dados isolados; subusuários (view-only) planejado para fase futura | Confirmado pelo usuário |
| Formatos de importação | OFX, CSV, PDF de fatura | Confirmado pelo usuário |

Decisões marcadas como "Assumido" devem ser confirmadas antes ou durante a Fase 1 —
não bloqueiam o início do trabalho de modelagem, mas podem afetar design de fases futuras
(ex.: multi-usuário mudaria o modelo de dados; WhatsApp mudaria a integração do bot).

## Infraestrutura de deploy (GCP)
- **Compute**: Cloud Run para o backend Node.js/TypeScript (contêiner) — serverless, escala a
  zero, paga por uso (adequado para uso pessoal)
- **Banco de dados**: Cloud SQL para MySQL — mantém a escolha de MySQL, agora gerenciado;
  conexão via Cloud SQL Auth Proxy/conector, não host/porta direto
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

## Roadmap de fases
1. **Autenticação e Usuários** — cadastro, login, token, isolamento de dados por usuário
2. **Contas e Cartões** — modelo de dados base (contas, cartões, vínculo opcional)
3. **Lançamentos manuais** — receitas/despesas, saldo por conta/cartão
4. **Cartão de crédito e faturas** — parcelamento, fechamento/vencimento, conta pagadora
5. **Contas a pagar/receber**
6. **Importação de arquivos** — OFX e CSV primeiro, PDF de fatura depois
7. **Bot conversacional** — lançar, consultar saldo, enviar arquivo para importar
8. **Painel web** — dashboards, orçamento por categoria, metas, patrimônio
9. **Subusuários (visualização compartilhada)** — usuário principal concede acesso somente
   leitura a outro usuário aos seus dados

## Não-objetivos (por ora)
- Recuperação de senha, verificação de e-mail, login social (fase de Autenticação cobre só
  cadastro/login básico)
- Integração bancária automática (Open Finance/Pluggy) — descartada em favor de importação de arquivo
- App mobile nativo — descartado em favor de bot + web
