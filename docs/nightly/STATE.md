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
- [x] Phase 6c (2026-06-20) — Guest → registered upgrade flow: `mergeGuestIntoUser` in DB (Pg+Memory, 4 contract tests each = 8 runs), guest cookie relay through OAuth state, server merge call in callback (non-fatal), `loginWithGoogle()` passes `?session_token=`

## Sequencing Note
STATE.md was previously stale (claimed only 6a complete). It has been reconciled with
`docs/DEVELOPMENT_PLAN.md`: Phases 6a/6b(DB)/6d/6e-write-through and Phases A/B/C all shipped
in commit #11 (Google accounts) plus follow-ups. Remaining Phase 6 work is being delivered as
small full-stack vertical slices that mirror the history slice.

Phase 5.7 (multi-tab voice smoke test) requires a human with a microphone — skip in nightly runs.

## Last Run
- Date: 2026-06-20
- Outcome: ✅ Phase 6c — Guest → registered upgrade flow complete: `mergeGuestIntoUser` DB method (Pg+Memory), guest session token relay via `ganatri_guest` httpOnly cookie through OAuth flow, server merge call in callback (non-fatal), web `loginWithGoogle()` passes `?session_token=`. DB tests 121→129. All 332 tests passing (153 engine + 129 db + 50 server).
- Branch/PR: nightly/2026-06-20-1641

## Blockers / Needs Human Input
(none)

## Notes for Next Run
Phase 6c (guest→registered upgrade) is now DONE. Remaining self-contained next units within Phase 6:

1. **6h: Admin analytics dashboard extensions** — Live ops view + KPI charts in AdminScreen. Larger scope. Route to frontend-dev (AdminScreen UI) + backend-dev (admin data endpoints). Consider sequencing: harden admin auth (Phase 7e "Strengthen admin authentication") before building the analytics views.

2. **6c account settings** — Edit display name + avatar, link/unlink OAuth (still ⬜ in plan).

Routing reminder: packages/db has no dedicated agent — route db-package work to backend-dev.
