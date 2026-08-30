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
Em planejamento — ainda não há código de implementação. O desenvolvimento é guiado por
especificações (*spec-driven development*): veja `specs/00-overview/constitution.md` para a
visão completa, decisões técnicas e o roadmap de fases e etapas (Fase 1 = MVP, Fase 2 =
pós-MVP). Cada etapa tem seus próprios `requirements.md`, `design.md` e `tasks.md` em
`specs/fase-<N>/etapa-<NN>-<nome>/`.
