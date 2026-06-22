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
Phase 6 — Persistence, Accounts, Statistics & Analytics

## Status
IN_PROGRESS — Phase 6 stats/accounts vertical slices landing incrementally.  <!-- NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETE -->

## Completed Phases
- [x] Phase 1 — Rules Engine (153 tests passing)
- [x] Phase 2 — Server (44 tests passing)
- [x] Phase 3 — Web Client (all components functional, player names wired)
- [x] Phase 4 — Polish (animations, mobile, flat board, deployment config)
- [x] Phase 5 — Voice Chat (core + cross-browser + Perfect Negotiation + TURN; 5.7 smoke test requires human)
- [x] Phase 7 (pull-forward) — Auto-forfeit on grace expiry, TURN_TIMEOUT event, trick-reveal freeze fix, name sanitization
- [x] Phase 6a — Database foundation (PostgreSQL + Drizzle + Neon; packages/db; 6 core tables; GamePersistence interface; migrations)
- [x] Phase 6b (DB-layer) — durable `GamePersistence` (Pg + Memory) built & fully tested (95 db tests, pglite)
- [x] Phase 6d/6e (write-through) — server persists games/events/players + incremental player_stats
- [x] Phase A — Accounts/auth DB (users.avatarUrl, oauth_accounts, auth_sessions, retention indexes; migration 0001)
- [x] Phase B — Server OAuth (`/auth/google/*`), durable identity via `ganatri_session` cookie, `REQUEST_HISTORY`, daily retention prune
- [x] Phase C — Web OAuth UI + game-history/score-card `HistoryScreen`
- [x] Phase 6e/6g — `get_my_stats` endpoint + personal `StatsScreen` dashboard
- [x] Phase 6f/6g (this run, 2026-06-19) — `get_leaderboard` slice: db `getLeaderboard` (Pg+Memory) + PUBLIC server endpoint + web `LeaderboardScreen`
- [x] Phase 6c (2026-06-20) — Guest → registered upgrade flow: `mergeGuestIntoUser` in DB (Pg+Memory, 4 contract tests each = 8 runs), guest cookie relay through OAuth state, server merge call in callback (non-fatal), `loginWithGoogle()` passes `?session_token=`

## Sequencing Note
STATE.md was previously stale (claimed only 6a complete). It has been reconciled with
`docs/DEVELOPMENT_PLAN.md`: Phases 6a/6b(DB)/6d/6e-write-through and Phases A/B/C all shipped
in commit #11 (Google accounts) plus follow-ups. Remaining Phase 6 work is being delivered as
small full-stack vertical slices that mirror the history slice.

Phase 5.7 (multi-tab voice smoke test) requires a human with a microphone — skip in nightly runs.

## Last Run
- Date: 2026-06-22
- Outcome: ✅ Priority TODO — Remove hint text and disable text selection in hand card area: deleted `game__hint` div render from GameScreen.tsx, removed `.game__hint` CSS rule + landscape override from GameScreen.css, added `user-select: none` / `-webkit-user-select: none` to `.game__hand-area`. All 387 tests pass (153 engine + 80 server + 154 db). Build green.
- Branch/PR: nightly/2026-06-22-2143

## Blockers / Needs Human Input
(none)

## Notes for Next Run
Priority TODO queue is now fully checked (all items done). Resuming normal Phase 6 flow. Remaining self-contained next units:

1. **6h continued: KPI charts** — Games/day, abandonment rate, avg duration from the DB (requires `getPersistence()` in the handler). Endpoint: `admin_get_kpi_stats`; no aggregation job yet — compute inline from DB queries (acceptably slow for admin dashboard). Requires persistence; returns `UNAVAILABLE` when none.

2. **6c remaining account settings** — Avatar URL edit + OAuth link/unlink (more complex).

3. **6h: User management** — Search users, view stats, ban/suspend. Requires new DB queries.

Routing reminder: packages/db has no dedicated agent — route db-package work to backend-dev.
