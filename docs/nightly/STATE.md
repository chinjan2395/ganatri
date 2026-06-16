# Ganatri Nightly State

> Single source of truth for autonomous nightly runs.
> Claude reads this FIRST and updates it LAST every run.

## Current Phase
Phase 6 — Persistence, Accounts, Statistics & Analytics

## Status
NOT_STARTED   <!-- NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETE -->

## Completed Phases
- [x] Phase 1 — Rules Engine (153 tests passing)
- [x] Phase 2 — Server (28 tests passing)
- [x] Phase 3 — Web Client (all components functional, player names wired)
- [x] Phase 4 — Polish (animations, mobile, flat board, deployment config)
- [x] Phase 5 — Voice Chat (core + cross-browser + Perfect Negotiation + TURN; 5.7 smoke test requires human)
- [x] Phase 7 (pull-forward) — All 4 urgent fixes complete (auto-advance grace expiry, turn timeout toast, trick freeze alignment, player name XSS sanitization)

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
- Outcome: Phase 7 pull-forward — All 4 items complete (181 tests: 153 engine + 28 server)
  - 7b: Auto-advance on grace period expiry during PLAYING
  - 7b: Disclose turn timeout with toast notification
  - 7d: Align trick freeze (1500→2200ms) with flash animation
  - 7e: Server-side XSS-safe player name sanitization
- Branch/PR: nightly/2026-06-16

## Blockers / Needs Human Input
(none)

## Notes for Next Run
Phase 7 pull-forward items are complete. Next: Phase 6 (Persistence/DB/Accounts).
Phase 6 is a large ~70-task epic across 10 sub-phases (6a–6j), structured as a planning backlog with embedded decisions.
See docs/DEVELOPMENT_PLAN.md §6 for the full roadmap. Start with 6a (database foundation & infrastructure):
  - Decision: database engine (recommend PostgreSQL)
  - Decision: ORM / query layer (recommend Drizzle ORM)
  - Decision: managed Postgres host (recommend Railway, Neon, or Supabase)
  - Set up connection pooling, environment config, migration tooling, local dev database
