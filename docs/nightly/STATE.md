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
- Date: 2026-06-19
- Outcome: ✅ Phase 6g — Display-name unification. When signed in, account.displayName now shown for the local player in RoomScreen (SeatSlot nameFor), GameScreen (resolvedPlayerNames useMemo fed to Part2Board/EndScreen/nameFor/lastEvent effect), and EndScreen (nameFor helper). Part2Board trick-card labels now use the same unified override. Code-review Important fix applied: resolvedPlayerNames computed once via useMemo in GameScreen rather than scattered inline checks. All 301 tests passing; web build green.
- Branch/PR: nightly/2026-06-19-1851

## Blockers / Needs Human Input
(none)

## Notes for Next Run
Display-name unification (#1) is now DONE. Remaining self-contained next units within Phase 6:

1. **6e: Average finishing position** (derived metric) — requires a small schema migration: add a `sum_finish_positions` column to `player_stats`, increment it in `recordGameEnd`/`upsertPlayerStats` (sum of 1-based finalRank per game-end), and surface `avgFinish` in `get_my_stats` + StatsScreen. Bigger because it touches db schema + a NEW migration (0002) + the drift-guard test + persistence write path + the stats view. Do as its own unit. **Note:** adding a migration means running drizzle-kit generate, committing the SQL, and keeping `schema.test.ts` drift-guard green — verify carefully. (backend-dev for db+server, then frontend-dev) — **Recommended next**.

2. **6e: Leaderboard polish** — time-windowed boards (weekly/monthly) and/or showing the logged-in user's global rank when they're outside the top 20 (server computes rank via a count query; surface in `GetLeaderboardAck`). Builds on the shipped `getLeaderboard`.

Routing reminder: packages/db has no dedicated agent — route db-package work to backend-dev (it has Read/Write/Edit/Bash and worked cleanly combined with server endpoint work).
