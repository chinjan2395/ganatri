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
- Date: 2026-06-17
- Outcome: 🚫 Phase 6 BLOCKED — awaiting architectural decisions (9 decision points in 6a–6f)
- Branch/PR: nightly/2026-06-17-0509

## Blockers / Needs Human Input

**Phase 6 cannot start without resolving 7 architectural decisions:**

All tasks in Phase 6a–6f depend on decisions that require human judgment. Autonomous runs cannot make these calls. Required decisions (see DEVELOPMENT_PLAN.md for details and recommendations):

1. **Database engine** (6a): PostgreSQL vs SQLite vs other?
2. **ORM/query layer** (6a): Drizzle vs Prisma vs other?
3. **Managed host** (6a): Railway vs Neon vs Supabase (or self-hosted)?
4. **Event-log granularity** (6b): Full move-by-move log (enables replay) vs summary-only (cheaper)?
5. **Account model** (6c): Guest-first with optional upgrade vs other?
6. **Auth method** (6c): Passwordless magic link vs Google OAuth vs Supabase Auth vs other?
7. **Analytics** (6f): Self-hosted (analytics_events table) vs PostHog/Plausible?
   - Also: aggregation strategy (incremental vs batch), rating system (ELO/Glicko-2/skip)

**Unblock path:** Schedule a planning session with the owner to finalize these decisions (recommendations provided in DEVELOPMENT_PLAN.md). Once decisions are locked, Phase 6a scaffolding and implementation can proceed in subsequent nightly runs.

## Notes for Next Run
**Await architectural decisions before Phase 6 begins.**

All urgent bug/security fixes shipped (Phase 7 pull-forward: 4/4 complete). No blocking gameplay issues remain. Phase 6 requires a planning session:
- Owner must choose: database engine, ORM, host, account model, auth method, analytics strategy, and 2 other architectural calls.
- Once locked, Phase 6a (scaffolding) can proceed, followed by 6b (schema) → 6c (auth) → 6d (persistence) → 6e–6j (features/ops).

Optional: Phase 5.7 (voice multi-tab smoke test) can be completed by any human with a microphone if desired before DB work starts.
