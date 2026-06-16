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
- Date: 2026-06-16
- Outcome: 🟡 Phase 6a partial — GameStore interface + MemoryStore foundation complete; env config added; pool/migrations/CI deferred (179 tests passing)
- Branch/PR: nightly/2026-06-16-2146

## Blockers / Needs Human Input
(none)

## Notes for Next Run
Phase 6a (database foundation) is PARTIALLY COMPLETE.

**Completed (6a items 1-3):**
  ✅ Created packages/db workspace with GameStore interface (abstraction for session/room storage)
  ✅ Refactored packages/server/src/store.ts → memoryStore.ts (MemoryStore class implementing GameStore)
  ✅ Created packages/server/src/databaseConfig.ts (env-based store selection logic)
  
**Deferred to next run (6a items 4-9):**
  ⬜ Connection pooling setup (depends on Drizzle + PG driver)
  ⬜ Migration tooling & workflow (Drizzle Kit or Prisma Migrate)
  ⬜ Local dev database (docker-compose.yml + setup docs)
  ⬜ Migration CI gate
  
**Architecture decisions made:**
  - Database engine: PostgreSQL (per DEVELOPMENT_PLAN recommendation)
  - ORM: Drizzle ORM (TS-first, lightweight, per plan)
  - Managed host: Railway/Neon/Supabase (not picked yet; deferred to next run or human decision)
  
**Next task:** Phase 6b (Data-access layer & schema) — implement PostgresStore class and define database schema (users, auth_sessions, rooms, games, game_players, game_events, player_stats). Requires installing Drizzle + pg driver.
