# Ganatri Nightly State

> Single source of truth for autonomous nightly runs.
> Claude reads this FIRST and updates it LAST every run.

## Current Phase
Phase 6 — Persistence, Accounts, Statistics & Analytics

## Status
IN_PROGRESS   <!-- NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETE -->

## Completed Phases
- [x] Phase 1 — Rules Engine (153 tests passing)
- [x] Phase 2 — Server (26 tests passing)
- [x] Phase 3 — Web Client (all components functional, player names wired)
- [x] Phase 4 — Polish (animations, mobile, flat board, deployment config)
- [x] Phase 5 — Voice Chat (core + cross-browser + Perfect Negotiation + TURN; 5.7 smoke test requires human)
- [x] Phase 7 (pull-forward) — Auto-forfeit on grace expiry, TURN_TIMEOUT event, trick-reveal freeze fix, name sanitization (4/4 urgent fixes complete)

## Sequencing Note
Per DEVELOPMENT_PLAN.md §7 sequencing note (2026-06-16):
Before Phase 6 (DB), pull forward these urgent items from Phase 7:
  1. 7b: Auto-advance / forfeit when grace period expires during PLAYING
  2. 7b: Disclose auto-played move on turn timeout (broadcast toast "X's turn timed out")
  3. 7d: Align trick-reveal freeze duration with flash animation duration (1500ms freeze vs 2200ms flash)
  4. 7e: Sanitize player names server-side (XSS-safe trimming + 20-char limit)

Phase 5.7 (multi-tab voice smoke test) requires a human with a microphone — skip in nightly runs.
Phase 6 (Persistence/DB) is next after pull-forward items are done.

## Last Run
- Date: 2026-06-16 (nightly continuation)
- Outcome: ✅ Phase 6a complete — Database foundation scaffolding, Drizzle ORM, schema, docker-compose, local dev setup (179 tests passing)
- Branch: nightly/2026-06-16-2345

## Blockers / Needs Human Input
(none)

## Notes for Next Run
Phase 6a (Database Foundation) is COMPLETE:
  ✅ Decisions made: PostgreSQL + Drizzle ORM (local docker-compose for dev)
  ✅ packages/db workspace created with full schema (8 tables, 23 indexes)
  ✅ Drizzle migrations scaffolded and generated
  ✅ docker-compose.yml + local dev scripts (npm run db:up/down/migrate)
  ✅ Server integration (DATABASE_URL + pool config in .env.example)
  ⏭ Deferred: Managed Postgres host (Railway/Neon/Supabase) — user to provision & set DATABASE_URL for production

Next: Phase 6b — Data-access layer & schema
  - Define GameStore interface (mirrors GameTransport pattern)
  - Refactor in-memory store.ts → MemoryStore implementation
  - Implement PostgresStore (production persistence behind same interface)
  - Wire both into handlers via env selector (STORE=memory|postgres)
  - All existing tests remain green (MemoryStore uses in-memory for fast unit tests)

This is the bridge task that shifts the server from pure in-memory to DB-backed while keeping the engine + existing tests intact.
