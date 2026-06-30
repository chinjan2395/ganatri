# Ganatri Nightly State

> Single source of truth for autonomous nightly runs.
> Claude reads this FIRST and updates it LAST every run.
>
> **Priority override:** Before using the Current Phase below, check the
> "🔝 Priority TODO" section in `docs/DEVELOPMENT_PLAN.md`. If that queue has any
> unchecked `- [ ]` items, the top one is this run's work and it overrides the
> current phase. Only when the priority queue is empty does the normal phase flow
> (Current Phase → next NOT_STARTED/IN_PROGRESS item) apply.

## Current Phase
Phase 6 — Remaining implementable items (6c auth hardening → 7a/7b quality)

## Status
IN_PROGRESS  <!-- NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETE -->

## Completed Phases
- [x] Phase DS-R — Design System Consolidation (DS-R1–R23 all complete) (2026-06-30)
- [x] Phase 6i/6j — Privacy, retention & compliance / Operations & hardening (2026-06-29) — All technically implementable items complete (applyGameScoring batch optimization, data export, account deletion, session management). Remaining items are operational/infrastructure/legal and require human input.
- [x] Phase 9a–9g — Scoring & progression system (2026-06-26)
- [x] Phase 6c Active session management (2026-06-25)
- [x] Phase 6i Data export (2026-06-25)
- [x] Phase 6h KPI charts + User Management (2026-06-23)
- [x] Phase 6i Account Deletion (2026-06-23)
- [x] Phase 6h Analytics dashboard shell (2026-06-23)
- [x] Phase 6c Active session management DB (2026-06-25)
- [x] Phase 6f/6g leaderboard (2026-06-19)
- [x] Phase 6c guest upgrade (2026-06-20)
- [x] Phase 6e/6g StatsScreen (2026-06-19)
- [x] Phase C — Web OAuth UI + HistoryScreen
- [x] Phase B — Server OAuth + durable identity
- [x] Phase A — Accounts/auth DB
- [x] Phase 6d/6e — write-through persistence + player_stats
- [x] Phase 6b (DB-layer) — full GamePersistence (Pg + Memory), 95 db tests
- [x] Phase 6a — Database foundation (PostgreSQL + Drizzle + Neon)
- [x] Phase 7 (pull-forward) — Auto-forfeit, TURN_TIMEOUT, trick-reveal freeze, name sanitization
- [x] Phase 5 — Voice Chat (core + cross-browser + Perfect Negotiation + TURN; 5.7 smoke test requires human)
- [x] Phase 4 — Polish (animations, mobile, flat board, deployment config)
- [x] Phase 3 — Web Client (all components functional, player names wired)
- [x] Phase 2 — Server (44 tests passing)
- [x] Phase 1 — Rules Engine (153 tests passing)

## Sequencing Note
Phase DS-R (all 23 tasks) completed as of 2026-06-30. The next run should pick up
remaining Phase 6 items that are technically implementable (not operational/infra):

Priority order for next runs:
1. **Phase 6c: Replace ad-hoc name input** — when logged in, prefill create/join name from account; keep manual entry for guests. File: `packages/web/src/screens/LobbyScreen.tsx` (CreateJoinPanel name field).
2. **Phase 7b: Rate-limit `create_room` and `join_room` per IP** — `packages/server/src/handlers.ts`. Simple in-memory rate-limiter per IP address (e.g. 10 rooms per IP per minute).
3. **Phase 7a: `React.memo` on `Part1Board` and `Part2Board`** — `packages/web/src/components/`.
4. **Phase 6c: Auth brute-force protection** — rate-limit login/OAuth callbacks per IP.

Phase 5.7 (multi-tab voice smoke test) requires a human with a microphone — skip in nightly runs.
Phase 4 production deployment is handled by the user (Render + Cloudflare).

## Last Run
- Date: 2026-06-30
- Outcome: Phase 6c complete — Replace ad-hoc name input with account name. `validateName()` bypasses for logged-in users; `handleCreate`/`handleJoin` use effectiveName (account.displayName ?? name); "Playing as <name>" shown in CreateJoinPanel when logged in. 470 tests pass.
- Branch: nightly/2026-06-30-1234

## Blockers / Needs Human Input
_(none)_

## Notes for Next Run

Phase DS-R is COMPLETE and Phase 6c name-input task is done. Next run picks up:

**Next item: Phase 7b — Rate-limit `create_room` and `join_room` per IP.**
`packages/server/src/handlers.ts`. Simple in-memory rate-limiter per IP (e.g. 10 requests per IP per minute for create_room; similar for join_room). No external deps — just a Map<ip, {count, resetAt}>. Acceptance: rate-limited requests get an error response, existing tests still pass, 2–3 new server tests cover the rate-limit path.

Deferred items to consider for a future DS-R24 task:
- `DsCoPlayerRow` component for mobile `rp__rows` co-player rows in LobbyScreen
- `DsTitleBlock size="sm"` flourish suppression (pre-existing design issue)

Routing reminder: packages/db has no dedicated agent — route db-package work to backend-dev.
