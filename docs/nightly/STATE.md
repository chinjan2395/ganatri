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
- [x] Phase 6f/6g (2026-06-19) — `get_leaderboard` slice: db `getLeaderboard` (Pg+Memory) + PUBLIC server endpoint + web `LeaderboardScreen`
- [x] Phase 6c (2026-06-20) — Guest → registered upgrade flow: `mergeGuestIntoUser` in DB (Pg+Memory), guest cookie relay through OAuth, server merge call in callback
- [x] Phase 6h KPI charts (2026-06-23) — `getAdminKpiStats` DB + server + web `KpiSection` bar chart
- [x] Phase 6h User Management (2026-06-23) — `searchUsers`/`adminGetUserStats` DB + server (`ADMIN_SEARCH_USERS`/`ADMIN_GET_USER_STATS` events) + web `UserManagementSection` in AdminScreen
- [x] Phase 6i Account Deletion (2026-06-23) — `deleteUser(userId)` in GamePersistence (DB + 6 contract tests); `DELETE_ACCOUNT` event + `handleDeleteAccount` handler (silentLeaveRoom + DB delete + session→guest + SESSION re-emit, 3 integration tests); web `deleteAccount()` helper + ProfilePanel danger button + inline confirm flow. Schema: `rooms.hostUserId` made nullable + migration `0004_nullable_room_host.sql`. 441 tests pass (153 engine + 102 server + 186 db).

## Sequencing Note
STATE.md was previously stale (claimed only 6a complete). It has been reconciled with
`docs/DEVELOPMENT_PLAN.md`: Phases 6a/6b(DB)/6d/6e-write-through and Phases A/B/C all shipped
in commit #11 (Google accounts) plus follow-ups. Remaining Phase 6 work is being delivered as
small full-stack vertical slices that mirror the history slice.

Phase 5.7 (multi-tab voice smoke test) requires a human with a microphone — skip in nightly runs.

## Last Run
- Date: 2026-06-23
- Outcome: ✅ Phase 6i Account Deletion — Full vertical slice: DB `deleteUser(userId)` in GamePersistence interface + PgPersistence (9-step transaction: null FK refs in game_players/game_events/games/rooms, delete player_stats/auth_sessions/oauth_accounts/user_blocks/users) + MemoryPersistence; 6 new contract test runs (180→186 db). Schema: `rooms.hostUserId` made nullable + migration `0004_nullable_room_host.sql`. Server: `DELETE_ACCOUNT` event + `handleDeleteAccount` (silentLeaveRoom cleanup → deleteUser → session→guest → SESSION re-emit); 3 integration tests (94→102 server). Web: `deleteAccount()` socket helper + GameProvider wiring + ProfilePanel danger "Delete account" button with inline confirm dialog + error handling; web build green. Code-review critical bugs fixed: rooms.hostUserId NOT NULL constraint + web emitAck spurious `{}` payload. All 441 tests pass (153 engine + 102 server + 186 db).
- Branch/PR: nightly/2026-06-23-1826

## Blockers / Needs Human Input
(none)

## Notes for Next Run
Remaining Phase 6 work (pick next in order):

1. **6c remaining account settings** — Avatar URL edit + OAuth link/unlink (complex; skip for now if tight).

2. **6i: User data export (GDPR/right to access)** — Let a logged-in user download their own account data (history, stats). Separate from the admin export already done. Server event `download_my_data`, handler that calls `getUserGameHistory` + `getPlayerStats`, returns JSON blob or acks it directly. Web: button in LobbyScreen profile panel or a new screen.

3. **6j: Ops hardening** — DB monitoring, connection-pool sizing, cost alerts.

Routing reminder: packages/db has no dedicated agent — route db-package work to backend-dev.
