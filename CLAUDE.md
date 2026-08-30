# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

No implementation code exists yet — this repository currently contains only planning
specs (`specs/`), a README, and this file. Before writing any code, read
`specs/00-overview/constitution.md` first, then the `requirements.md` and `design.md` of the
etapa you're working on. Do not start implementing an etapa whose `requirements.md`/`design.md`
haven't been confirmed by the user (see "Metodologia" in the constitution).

## Spec-driven development

"Fase" is the macro level (**Fase 1 = MVP**, **Fase 2 = post-MVP**); each fase breaks down into
numbered "etapas". This project is built etapa-by-etapa under `specs/fase-<N>/etapa-<NN>-<name>/`,
each with:
- `requirements.md` — functional requirements with acceptance criteria
- `design.md` — data model, API contracts, technical decisions for that etapa
- `tasks.md` — trackable task checklist, each task referencing the requirement it satisfies

Etapas are ordered and mostly dependent on prior etapas (e.g., every later etapa assumes
Fase 1, Etapa 1's authentication and `user_id` scoping exists). Check `constitution.md`'s
roadmap for the current fase/etapa order before assuming a later etapa can be built standalone.

## Architecture (from constitution.md and phase designs)

- **Stack**: Node.js + TypeScript backend, PostgreSQL (Cloud SQL in production)
- **Multi-user**: every domain table is scoped by `user_id`. `user_id` must always come from
  the authenticated request (`req.userId`, populated by the `requireAuth` JWT middleware from
  Fase 1, Etapa 1), never from client input — this is the core data-isolation invariant of the
  system.
- **Access-control helper**: data queries should go through a centralized `scopedToUser`
  helper rather than each endpoint re-implementing the `user_id` filter — this is what allows
  the future subusers phase (view-only shared access) to be added without touching every
  endpoint.
- **Interfaces**: a Telegram bot (webhook mode, not polling — required by Cloud Run's
  request-driven model) and a web dashboard, both calling the same backend API.
- **Deploy target**: GCP — Cloud Run (backend container) + Cloud SQL (PostgreSQL) + Secret Manager
  (JWT secret, DB credentials, bot token) + Artifact Registry.
- **Money values**: always `DECIMAL`, never floating point.
- **Credit cards**: a card may optionally link to a bank account (`linked_account_id`,
  nullable); an unlinked card still requires picking a paying account per invoice (handled in
  Fase 1, Etapa 4 — credit-card/invoice, not Etapa 2 — accounts/cards).

## Non-goals (currently)

- Password recovery, email verification, social login
- Automatic bank integration (Open Finance/Pluggy) — deliberately replaced by file import
  (OFX/CSV/PDF)
- Native mobile app — deliberately replaced by bot + web
