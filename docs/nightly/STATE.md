# Ganatri Nightly State

> Single source of truth for autonomous nightly runs.
> Claude reads this FIRST and updates it LAST every run.

## Current Phase
Phase 6 — Persistence, Accounts, Statistics & Analytics

## Status
BLOCKED   <!-- NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETE -->

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
- Date: 2026-06-16 (2026-06-16T14:25 nightly)
- Outcome: 🟥 Phase 6 blocked — awaiting architecture decisions (database engine, ORM, managed host)
- Branch/PR: nightly/2026-06-16-1425

## Blockers / Needs Human Input

**Phase 6 architecture decisions — blocking all build work**

Phase 6 is a large (~70-task) epic covering database, accounts, persistence, stats, and analytics. Before implementation can begin, three architectural decisions must be made (all in §6a "Database foundation & infrastructure"):

1. **Database engine:** Recommend PostgreSQL (relational, strong analytics queries, JSONB for event payloads). SQLite acceptable only for single-instance/dev.

2. **ORM / query layer:** Recommend Drizzle ORM (TS-first, SQL-like, fully inferred types, lightweight migrations) given "TS strict everywhere". Prisma is the batteries-included alternative (mature migrations, Studio GUI) at higher runtime/codegen cost.

3. **Managed Postgres host:** Options:
   - Railway Postgres (MCP already available here)
   - Neon (serverless, branching, generous free tier)
   - Supabase (Postgres + auth + storage bundled — attractive if we also adopt its auth)
   Server is on Render today; pick a host with low latency to Render region.

Once these three decisions are made, Phase 6a task dependencies can be unblocked and implementation can proceed. Current recommendation: PostgreSQL + Drizzle + Railway Postgres (most conservative, fewest moving parts).

## Notes for Next Run
Phase 6 is blocked pending the three architecture decisions in §6a (database engine, ORM, managed host). These are blocking — all other work in Phase 6 depends on them.

Once decisions are made, implementation can proceed: Phase 6a (foundation + migrations) → Phase 6b (data-access layer) → Phase 6c (accounts) → Phase 6d (persistence) → etc.

See "Blockers / Needs Human Input" above for the specific decision options and recommendation (PostgreSQL + Drizzle + Railway Postgres).
