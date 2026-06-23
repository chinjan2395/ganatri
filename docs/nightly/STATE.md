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

## Sequencing Note
STATE.md was previously stale (claimed only 6a complete). It has been reconciled with
`docs/DEVELOPMENT_PLAN.md`: Phases 6a/6b(DB)/6d/6e-write-through and Phases A/B/C all shipped
in commit #11 (Google accounts) plus follow-ups. Remaining Phase 6 work is being delivered as
small full-stack vertical slices that mirror the history slice.

Phase 5.7 (multi-tab voice smoke test) requires a human with a microphone — skip in nightly runs.

## Last Run
- Date: 2026-06-23
- Outcome: ✅ Phase 6h Data Export — Full vertical slice: DB (`ExportGameRow` type + `exportGamesData(limit?)` in `GamePersistence` interface, PgPersistence (2-query: games+rooms ordered by startedAt DESC, then game_players grouped in JS), MemoryPersistence (sort+slice+lookup); 4 new contract tests. Server: `ADMIN_EXPORT_DATA='admin_export_data'` event + `handleAdminExportData` handler (admin-auth gate, limit clamped to ≤500); 3 new integration tests in `admin-export.test.ts` (Server: 91→94). Web: `ExportGameView`/`AdminExportDataAck` types in protocol.ts; `EXPORT_DATA` in `ADMIN_EVENTS`; "Export Games (JSON)" button in AdminScreen with loading state + inline error + Blob/ObjectURL download (Safari-compatible: append/remove body). Code-review: no Critical issues; Safari download fix applied. All 427 tests pass (153 engine + 94 server + 180 db). Build green.
- Branch/PR: nightly/2026-06-23-1329

## Blockers / Needs Human Input
(none)

## Notes for Next Run
Remaining Phase 6 work (pick next in order):

1. **6c remaining account settings** — Avatar URL edit + OAuth link/unlink (complex; skip for now if tight).

2. **6i: Account deletion (right to erasure)** — Hard-delete or anonymize user across users/game_players/events/stats. Server event + handler + web UI (delete button in LobbyScreen profile panel with confirmation dialog). Define FK `ON DELETE` behavior.

3. **6i: User data export (GDPR)** — Let a logged-in user download their own account data (history, stats). Separate from admin export.

4. **6j: Ops hardening** — DB monitoring, connection-pool sizing, cost alerts.

Known review items from data export (non-blocking, can be addressed later):
- Seed field is exposed in admin export (admin-only risk; document or omit)
- Server integration tests missing: limit clamping contract test + non-empty shape test

Routing reminder: packages/db has no dedicated agent — route db-package work to backend-dev.
