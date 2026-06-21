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

## Sequencing Note
STATE.md was previously stale (claimed only 6a complete). It has been reconciled with
`docs/DEVELOPMENT_PLAN.md`: Phases 6a/6b(DB)/6d/6e-write-through and Phases A/B/C all shipped
in commit #11 (Google accounts) plus follow-ups. Remaining Phase 6 work is being delivered as
small full-stack vertical slices that mirror the history slice.

Phase 5.7 (multi-tab voice smoke test) requires a human with a microphone — skip in nightly runs.

## Last Run
- Date: 2026-06-20
- Outcome: ✅ Phase 6e (leaderboard polish) — User's own rank when outside top 20. Added `RankedLeaderboardEntry` type + `getMyLeaderboardRank(userId)` to `GamePersistence` (Pg: CTE + ROW_NUMBER; Memory: same tiebreak sort + findIndex). Server `handleGetLeaderboard` now accepts `session`; when logged-in user is not in the top entries, calls `getMyLeaderboardRank` and attaches result as `myEntry` in `GetLeaderboardAck`. Web `LeaderboardScreen` renders a "Your ranking" pinned section below the table when `myEntry` is present. 6 new db contract tests + 1 server test. All 309 tests passing (153 engine + 108 db + 48 server); web build green.
- Branch/PR: nightly/2026-06-20-0426

## Blockers / Needs Human Input
(none)

## Notes for Next Run
Leaderboard polish — user rank outside top 20 — is now DONE. Remaining self-contained next units within Phase 6:

1. **6e: Time-windowed leaderboard** — weekly/monthly filtered boards. The `player_stats` table is all-time aggregate; time windows require querying `game_players` + `games` filtered by `started_at`. Would need a new `getLeaderboard(timeWindow?: 'week'|'month')` path and UI tabs/toggle on `LeaderboardScreen`. Medium complexity. — **Recommended next**.

2. **Schema drift-guard enhancement** (minor) — The drift-guard test in `packages/db/tests/schema.test.ts` verifies table count, table names, indexes, and the `seed` column type, but doesn't assert that `player_stats.sum_finish_positions` exists with `integer NOT NULL DEFAULT 0`. A column-existence query against `information_schema.columns` would catch accidental migration omissions. Low priority but good hygiene.

Routing reminder: packages/db has no dedicated agent — route db-package work to backend-dev (it has Read/Write/Edit/Bash and worked cleanly combined with server endpoint work).
