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
Phase DS-R — Design System Consolidation (DS-R18–R23 remaining)

## Status
IN_PROGRESS  <!-- NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETE -->

## Completed Phases
- [x] Phase 6i/6j — Privacy, retention & compliance / Operations & hardening (2026-06-29) — All technically implementable items complete (applyGameScoring batch optimization, data export, account deletion, session management). Remaining items are operational/infrastructure/legal and require human input.
- [x] Phase DS-R (partial) — DS-R1–R17 complete (2026-06-29); DS-R18 complete (2026-06-29). DS-R19–R23 pending.
- [x] Phase 6i Data export (2026-06-25) — `download_my_data` event: server handler (getUserGameHistory + getPlayerStats in parallel, flattenHistoryEntry + mapStatsView), 4 integration tests; web DownloadMyDataAck type + downloadMyData() helper + GameProvider callback + LobbyScreen "Download My Data" button (DOM-append pattern, deferred revokeObjectURL). 458 tests pass (153 engine + 114 server + 191 db).
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
- [x] Phase 9a–9g (2026-06-26) — Full scoring system: DB schema (player_progression, score_ledger, game_players scoring columns), server scoring engine (scoring.ts), server protocol (GET_MY_PROGRESSION, GET_MY_SCORE_HISTORY, end-game MatchScoringView), web protocol mirror + socket helpers, GameProvider progression state, LobbyScreen ProfilePanel level badge + XP bar + rating, HistoryScreen per-game matchScore/xpEarned/rankedRatingDelta, StatsScreen scoring stat cards. 458 tests pass.

## Sequencing Note
STATE.md was previously stale (claimed only 6a complete). It has been reconciled with
`docs/DEVELOPMENT_PLAN.md`: Phases 6a/6b(DB)/6d/6e-write-through and Phases A/B/C all shipped
in commit #11 (Google accounts) plus follow-ups. Remaining Phase 6 work is being delivered as
small full-stack vertical slices that mirror the history slice.

Phase 5.7 (multi-tab voice smoke test) requires a human with a microphone — skip in nightly runs.

## Last Run
- Date: 2026-06-30
- Outcome: DS-R21 complete — Replaced `st__panel-title` h3, `st__muted` p, and `st__panel-muted` p in StatsScreen with DsSectionHeading/DsBodyText. Removed 3 CSS blocks. 470 tests pass (203 db + 153 engine + 114 server).
- Branch: nightly/2026-06-30-0821

## Blockers / Needs Human Input
_(none)_

## Notes for Next Run

**Phase DS-R is IN_PROGRESS** — DS-R21 done; DS-R22 is next.

DS-R22: Replace raw headings/errors in `LobbyScreen` desktop sidebar with DS components:
- `sidebar__heading` `<h2>` × 2 (TOP PLAYERS, YOUR STATS) → `DsTitleBlock size="sm"` (already imported)
- `sidebar__empty`/`lobby__profile-guest-msg` `<p>` → `DsEmptyState`/`DsBodyText`
- `lobby__error` raw `<div>` error divs → `DsAlert tone="danger"`
- Inline status `<p>` tags (blocked-empty, blocked-error, data-export-error, delete-confirm-text, delete-error) → `DsBodyText` with appropriate tone
Remove migrated CSS rules. Acceptance: build + ESLint green; 470 tests pass.

Routing reminder: packages/db has no dedicated agent — route db-package work to backend-dev.
