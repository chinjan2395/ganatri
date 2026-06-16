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
- Date: 2026-06-16
- Outcome: ⏸️ BLOCKED — awaiting Phase 6 architectural decisions
- Branch/PR: nightly/2026-06-16-1845

## Blockers / Needs Human Input
**Phase 6 cannot proceed without resolving these blocking architectural decisions:**

1. **Database engine selection** (6a, DECISION item)
   - Options: PostgreSQL (recommended), SQLite (dev-only)
   - Impact: determines schema design, ORM choice, host selection
   - File: docs/DEVELOPMENT_PLAN.md line 224

2. **ORM / query layer selection** (6a, DECISION item)
   - Options: Drizzle ORM (recommended), Prisma (batteries-included alternative)
   - Impact: determines migration tooling, type inference, dev workflow
   - File: docs/DEVELOPMENT_PLAN.md line 225

3. **Managed Postgres host selection** (6a, DECISION item)
   - Options: Railway Postgres (recommended, MCP available), Neon (serverless), Supabase (bundled auth)
   - Impact: determines latency, free tier limits, integration choices
   - File: docs/DEVELOPMENT_PLAN.md line 226

**Why this blocks the entire phase:**
Phase 6 has ~70 tasks across 10 sub-phases (6a–6j). The first sub-phase (6a) is "Database foundation & infrastructure," which consists almost entirely of DECISION items and their dependent tasks. All downstream work (schema design, store interface, auth, persistence, analytics) depends on these three choices. Attempting to implement without decisions would result in wasted work.

**Recommendation for next human run:**
1. Make and document the three choices above
2. Add them to docs/DEVELOPMENT_PLAN.md or a new `docs/PHASE_6_DECISIONS.md` file
3. Update this STATE.md and kick off Phase 6 with those decisions documented
4. Then Phase 6a can proceed with implementation of: schema/migrations, repository interface, store implementations, etc.

## Notes for Next Run
Phase 7 pull-forward is COMPLETE. Awaiting owner decision on Phase 6 architecture (DB engine, ORM, host).
Phase 6a cannot progress until the three DECISION items are resolved by the team.
