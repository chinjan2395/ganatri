# Ganatri Nightly State

> Single source of truth for autonomous nightly runs.
> Claude reads this FIRST and updates it LAST every run.

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
- Outcome: ✅ Phase 6e/6f — Time-windowed leaderboard (weekly/monthly filter tabs). Added `timeWindow?: 'week' | 'month'` to `GamePersistence.getLeaderboard` and `getMyLeaderboardRank` interface + both impls. `PgPersistence` windowed path uses CTE joining `game_players + games + users` filtered by `ended_at >= cutoff` and `is_abandoned = false`. `MemoryPersistence` windowed path uses `aggregateWindowed(cutoff)` helper. Server `GetLeaderboardRequest` type added; `handleGetLeaderboard` validates + passes `timeWindow` through. Web `LeaderboardScreen` gains three tabs (All Time / This Week / This Month); re-fetches on tab change with loading reset. Code review caught missing `AND g.is_abandoned = false` in Pg CTEs — fixed + covered by new contract test. 12 new db contract tests + 2 server tests. All 323 tests passing (153 engine + 120 db + 50 server); web build green.
- Branch/PR: nightly/2026-06-20-0931

## Blockers / Needs Human Input
(none)

## Notes for Next Run
Time-windowed leaderboard is now DONE. Remaining self-contained next units within Phase 6:

1. **Schema drift-guard enhancement** (minor) — The drift-guard test in `packages/db/tests/schema.test.ts` verifies table count, table names, indexes, and the `seed` column type, but doesn't assert that `player_stats.sum_finish_positions` exists with `integer NOT NULL DEFAULT 0`. A column-existence query against `information_schema.columns` would catch accidental migration omissions. Low priority but good hygiene. — **Recommended next** (small, well-scoped).

2. **6c: Guest → registered upgrade flow** — Merge a guest user's games/stats into the new account on first OAuth sign-in. Medium complexity; needs careful handling of duplicate stats.

3. **6h: Admin analytics dashboard extensions** — Live ops view + KPI charts in AdminScreen. Larger scope.

Routing reminder: packages/db has no dedicated agent — route db-package work to backend-dev.
