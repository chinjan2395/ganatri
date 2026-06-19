# Ganatri Nightly State

> Single source of truth for autonomous nightly runs.
> Claude reads this FIRST and updates it LAST every run.

## Current Phase
Phase 6 — Persistence, Accounts, Statistics & Analytics

## Status
COMPLETE — Phase 6a (Database foundation) ✅   <!-- NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETE -->

## Completed Phases
- [x] Phase 1 — Rules Engine (153 tests passing)
- [x] Phase 2 — Server (26 tests passing)
- [x] Phase 3 — Web Client (all components functional, player names wired)
- [x] Phase 4 — Polish (animations, mobile, flat board, deployment config)
- [x] Phase 5 — Voice Chat (core + cross-browser + Perfect Negotiation + TURN; 5.7 smoke test requires human)
- [x] Phase 7 (pull-forward) — Auto-forfeit on grace expiry, TURN_TIMEOUT event, trick-reveal freeze fix, name sanitization (4/4 urgent fixes complete)
- [x] Phase 6a — Database foundation (PostgreSQL + Drizzle ORM + Neon; packages/db workspace created; 6 core tables with schema; GameStore interface; initial migration)

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
- Outcome: ✅ Phase 6a complete — Database foundation (PostgreSQL + Drizzle + Neon), packages/db workspace, 6 core tables, GameStore interface, initial migration. Fixed TypeScript/schema issues. Build passes. (179 tests passing)
- Branch/PR: nightly/2026-06-16-0935

## Blockers / Needs Human Input
(none)

## Notes for Next Run
Phase 6a (Database foundation & infrastructure) is now COMPLETE. Locked in:
  ✅ Database engine: PostgreSQL (JSONB, relational integrity)
  ✅ ORM: Drizzle (TS-first, fully inferred types, lightweight migrations)
  ✅ Managed host: Neon (serverless, free tier, dev branching)
  ✅ packages/db workspace created with full schema (users, rooms, games, game_players, game_events, player_stats)
  ✅ First migration generated (0000_initial_schema.sql)
  ✅ Environment config wired (.env.example, config.ts)

Next: Start Phase 6b — Data-access layer & schema.
This phase converts the schema definitions into working repository implementations:
  1. Refactor in-memory store.ts → MemoryStore (keep existing tests green)
  2. Implement PostgresStore behind GameStore interface (env-selectable)
  3. Add integration tests for PostgresStore
Recommendation: Start by refactoring to MemoryStore so the GameStore interface is concrete and testable.
