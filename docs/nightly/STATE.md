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
- [x] Phase 6e/6g (this run, 2026-06-19) — `get_my_stats` endpoint + personal `StatsScreen` dashboard

## Sequencing Note
STATE.md was previously stale (claimed only 6a complete). It has been reconciled with
`docs/DEVELOPMENT_PLAN.md`: Phases 6a/6b(DB)/6d/6e-write-through and Phases A/B/C all shipped
in commit #11 (Google accounts) plus follow-ups. Remaining Phase 6 work is being delivered as
small full-stack vertical slices that mirror the history slice.

Phase 5.7 (multi-tab voice smoke test) requires a human with a microphone — skip in nightly runs.

## Last Run
- Date: 2026-06-19
- Outcome: ✅ Phase 6e/6g — added `get_my_stats` socket endpoint (server) + `StatsScreen` personal stats dashboard (web), mirroring the REQUEST_HISTORY/HistoryScreen slice. Reuses DB `getPlayerStats`; derived `winRate`; no schema migration. Code-review: ship it. Tests 288 → 292 (server 40 → 44, +4 in stats.test.ts); web build green.
- Branch/PR: nightly/2026-06-19-1420

## Blockers / Needs Human Input
(none)

## Notes for Next Run
Good self-contained next units within Phase 6 (each a small, low-risk vertical slice):

1. **6e: `get_leaderboard` socket endpoint + Global Leaderboard screen (6g).**
   - Needs a NEW DB method on `GamePersistence` (e.g. `getLeaderboard(limit, offset)` → top users by gamesWon / win rate, indexed sort) implemented in BOTH `PgPersistence` and `MemoryPersistence` (+ shared contract tests). The `player_stats` table already has the columns; `player_stats_user_id_idx` exists but a sort index on `games_won` may help.
   - Then mirror the history/stats slice: `EVENTS.GET_LEADERBOARD`, server handler (guest allowed? decide — leaderboard is arguably public, but keep it logged-in-gated for consistency or make it open), web `requestLeaderboard()`, provider wiring, `screen` union → add `'leaderboard'`, Lobby button, `LeaderboardScreen`.

2. **6g: Display-name unification** — use account `displayName` across RoomScreen/GameScreen/EndScreen when signed in (currently only Lobby uses it). Frontend-only, low risk.

3. **6e: Average finishing position** (derived metric) — requires a small schema migration: add a `sum_finish_positions` (or similar) column to `player_stats`, increment it in `recordGameEnd`/`upsertPlayerStats`, and surface `avgFinish` in `get_my_stats` + StatsScreen. Bigger because it touches db schema + migration + persistence write path + the stats view; do as its own unit.

Recommendation: do **#1 (leaderboard)** next — highest user value, cleanly mirrors the now-proven endpoint+screen pattern. Define a `getLeaderboard` DB method first (rules-engine-dev is NOT for db; use backend-dev for server, but the db package method is best done by an agent with db context — note packages/db has no dedicated agent, so route db work to backend-dev or general-purpose with explicit file scope `packages/db`).
