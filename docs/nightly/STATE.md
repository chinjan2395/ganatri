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
NOT_STARTED — Next nightly work should resume remaining Phase 6 items, starting with user data export (6i). Auth session management (6c) shipped 2026-06-25.  <!-- NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETE -->

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
- [x] Phase 6c Active session management (2026-06-25) — DB `last_seen_at` + list/touch/revoke session methods; server `GET_AUTH_SESSIONS`/`REVOKE_AUTH_SESSION`/`REVOKE_OTHER_AUTH_SESSIONS`, sliding expiry, OAuth httpOnly cookie + `/auth/bootstrap`, `guestToken` rename; web `SessionsScreen` device management UI. 452 tests pass (153 engine + 108 server + 191 db).

## Sequencing Note
STATE.md was previously stale (claimed only 6a complete). It has been reconciled with
`docs/DEVELOPMENT_PLAN.md`: Phases 6a/6b(DB)/6d/6e-write-through and Phases A/B/C all shipped
in commit #11 (Google accounts) plus follow-ups. Remaining Phase 6 work is being delivered as
small full-stack vertical slices that mirror the history slice.

Phase 5.7 (multi-tab voice smoke test) requires a human with a microphone — skip in nightly runs.

## Last Run
- Date: 2026-06-25
- Outcome: Phase 6c active session management shipped manually (DB + server + web vertical slice).
- Branch/PR: feat/auth-session-management

## Blockers / Needs Human Input
_(none)_

## Notes for Next Run
Resume Phase 6 remaining work in this order:
1. **6i: User data export (GDPR/right to access)** — Let a logged-in user download their own account data (history, stats). Separate from the admin export already done. Server event `download_my_data`, handler that calls `getUserGameHistory` + `getPlayerStats`, returns JSON blob or acks it directly. Web: button in LobbyScreen profile panel or a new screen.
2. **6j: Ops hardening** — DB monitoring, connection-pool sizing, cost alerts.
3. **6c remaining account settings** — Avatar URL edit + OAuth link/unlink (complex; skip if tight). Active session management ✅ (2026-06-25).

Routing reminder: packages/db has no dedicated agent — route db-package work to backend-dev.
