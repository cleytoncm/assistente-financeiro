# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

No implementation code exists yet — this repository currently contains only planning
specs (`specs/`), a README, and this file. Before writing any code, read
`specs/00-overview/constitution.md` first, then the `requirements.md` and `design.md` of the
phase you're working on. Do not start implementing a phase whose `requirements.md`/`design.md`
haven't been confirmed by the user (see "Metodologia" in the constitution).

## Spec-driven development

This project is built phase-by-phase under `specs/<number>-<name>/`, each with:
- `requirements.md` — functional requirements with acceptance criteria
- `design.md` — data model, API contracts, technical decisions for that phase
- `tasks.md` — trackable task checklist, each task referencing the requirement it satisfies

Phases are ordered and mostly dependent on prior phases (e.g., every later phase assumes
Phase 1's authentication and `user_id` scoping exists). Check `constitution.md`'s roadmap for
the current phase order before assuming a later phase can be built standalone.

## Architecture (from constitution.md and phase designs)

- **Stack**: Node.js + TypeScript backend, MySQL (Cloud SQL in production)
- **Multi-user**: every domain table is scoped by `user_id`. `user_id` must always come from
  the authenticated request (`req.userId`, populated by the `requireAuth` JWT middleware from
  Phase 1), never from client input — this is the core data-isolation invariant of the system.
- **Access-control helper**: data queries should go through a centralized `scopedToUser`
  helper rather than each endpoint re-implementing the `user_id` filter — this is what allows
  the future subusers phase (view-only shared access) to be added without touching every
  endpoint.
- **Interfaces**: a Telegram bot (webhook mode, not polling — required by Cloud Run's
  request-driven model) and a web dashboard, both calling the same backend API.
- **Deploy target**: GCP — Cloud Run (backend container) + Cloud SQL (MySQL) + Secret Manager
  (JWT secret, DB credentials, bot token) + Artifact Registry.
- **Money values**: always `DECIMAL`, never floating point.
- **Credit cards**: a card may optionally link to a bank account (`linked_account_id`,
  nullable); an unlinked card still requires picking a paying account per invoice (handled in
  the credit-card/invoice phase, not the accounts/cards phase).

## Non-goals (currently)

- Password recovery, email verification, social login
- Automatic bank integration (Open Finance/Pluggy) — deliberately replaced by file import
  (OFX/CSV/PDF)
- Native mobile app — deliberately replaced by bot + web
