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
Phase 6 — Remaining implementable items (auth/account hardening → persistence/stats polish → analytics/compliance → operations hardening)

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
1. **Phase 6c auth/account hardening bundle** — finish the remaining account-settings and auth-hardening work in one pass: account-profile polish, session-management UX, name-prefill flow, and any abuse-protection follow-ups.
2. **Phase 6d/6e persistence + stats polish bundle** — tackle replay scaffolding, idempotency guards, backfill/reconcile work, and any remaining stats/leaderboard polish.
3. **Phase 6f/6i analytics + compliance bundle** — cover instrumentation, event taxonomy, privacy policy/consent, and export/delete polish.
4. **Phase 6j operations hardening bundle** — complete backups/monitoring/pool-sizing/cost guardrails.
5. **Phase DS-R-D typography + enforcement pass** — if the DS-R work is still pending in a future run, finish the remaining typography and enforcement cleanup.

Phase 5.7 (multi-tab voice smoke test) requires a human with a microphone — skip in nightly runs.
Phase 4 production deployment is handled by the user (Render + Cloudflare).

## Last Run
- Date: 2026-06-30
- Outcome: Phase 7a performance — split `GameProvider` into 3 sub-contexts (`GameSessionContext`, `GameRoomContext`, `GameViewContext`); `GameScreen.tsx` updated to use narrow hooks; per-player derived props memoized in `playerSeatData`. Fixed `preview.tsx` to provide all 4 context providers. 0 TS errors; 482 tests pass.
- Branch: nightly/2026-06-30-2000

## Blockers / Needs Human Input
_(none)_

## Notes for Next Run

Phase 7a performance complete: `GameProvider` split into 3 sub-contexts; `GameScreen.tsx` uses narrow hooks; per-player seat data memoized.

**Next item: Phase 7a remaining** — consider lazy-loading heavy screens (HistoryScreen, StatsScreen, LeaderboardScreen, AdminScreen) via React `lazy()` / `Suspense` to reduce initial bundle size (currently 599 kB gzipped). Or move to Phase 6c remaining account settings (avatar/link-unlink OAuth remain).

**Known follow-up items (non-blocking) from prior code review:**
- `getClientIp` in `createApp.ts` trusts `X-Forwarded-For` unconditionally. Fix: gate on `TRUST_PROXY=1` env var.
- OAuth 429 shows bare JSON to browser (no redirect with `?login=error`). Minor UX gap.

Deferred items to consider for a future DS-R24 task:
- `DsCoPlayerRow` component for mobile `rp__rows` co-player rows in LobbyScreen
- `DsTitleBlock size="sm"` flourish suppression (pre-existing design issue)

Routing reminder: packages/db has no dedicated agent — route db-package work to backend-dev.
