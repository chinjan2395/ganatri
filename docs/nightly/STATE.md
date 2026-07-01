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
Phase 6 — Remaining implementable items (auth/account hardening → persistence/stats polish → analytics/compliance → operations hardening)

## Status
IN_PROGRESS  <!-- NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETE -->

## Completed Phases
- [x] Phase DS-R — Design System Consolidation (DS-R1–R23 all complete) (2026-06-30)
- [x] Phase 6i/6j — Privacy, retention & compliance / Operations & hardening (2026-06-29) — All technically implementable items complete (applyGameScoring batch optimization, data export, account deletion, session management). Remaining items are operational/infrastructure/legal and require human input.
- [x] Phase 9a–9g — Scoring & progression system (2026-06-26)
- [x] Phase 6c Active session management (2026-06-25)
- [x] Phase 6i Data export (2026-06-25)
- [x] Phase 6h KPI charts + User Management (2026-06-23)
- [x] Phase 6i Account Deletion (2026-06-23)
- [x] Phase 6h Analytics dashboard shell (2026-06-23)
- [x] Phase 6c Active session management DB (2026-06-25)
- [x] Phase 6f/6g leaderboard (2026-06-19)
- [x] Phase 6c guest upgrade (2026-06-20)
- [x] Phase 6e/6g StatsScreen (2026-06-19)
- [x] Phase C — Web OAuth UI + HistoryScreen
- [x] Phase B — Server OAuth + durable identity
- [x] Phase A — Accounts/auth DB
- [x] Phase 6d/6e — write-through persistence + player_stats
- [x] Phase 6b (DB-layer) — full GamePersistence (Pg + Memory), 95 db tests
- [x] Phase 6a — Database foundation (PostgreSQL + Drizzle + Neon)
- [x] Phase 7 (pull-forward) — Auto-forfeit, TURN_TIMEOUT, trick-reveal freeze, name sanitization
- [x] Phase 5 — Voice Chat (core + cross-browser + Perfect Negotiation + TURN; 5.7 smoke test requires human)
- [x] Phase 4 — Polish (animations, mobile, flat board, deployment config)
- [x] Phase 3 — Web Client (all components functional, player names wired)
- [x] Phase 2 — Server (44 tests passing)
- [x] Phase 1 — Rules Engine (153 tests passing)

## Sequencing Note
Phase DS-R (all 23 tasks) completed as of 2026-06-30. Phase 6c auth/account hardening complete as of 2026-06-30 (avatar DB+server+web, display name, session management, abuse protection all done; only link/unlink OAuth remains but is deferred — it requires careful design to avoid locking users out).

Phase 6f/6i analytics + compliance bundle started 2026-07-01. Server-side work complete (analytics abstraction, event taxonomy, instrumentation, security fixes). Remaining in this bundle: client-side funnel events, privacy policy UX, and metrics dashboards (need analytics platform decision from user first).

Priority order for next runs:
1. **Phase 6f/6i analytics + compliance bundle (remaining)** — Client-side funnel events (create/join/start clicked), privacy policy page/consent banner, metrics dashboard. NOTE: requires user decision on analytics platform (PostHog cloud vs self-hosted) before client-side events are useful.
2. **Phase 6j operations hardening bundle** — backups, monitoring, pool sizing, cost guardrails (all require human/infrastructure action).

Phase 5.7 (multi-tab voice smoke test) requires a human with a microphone — skip in nightly runs.
Phase 4 production deployment is handled by the user (Render + Cloudflare).

## Last Run
- Date: 2026-07-01
- Outcome: `account_created` isNew fix — `upsertOAuthUser` now returns `{ user: UserRow; isNew: boolean }` across `GamePersistence` interface, `PgPersistence`, and `MemoryPersistence`. `account_created` analytics event fires correctly on first-time OAuth signup only. Also: analytics module refactored to `AnalyticsAdapter`/`track()` pattern (typed properties, cleaner API); event names updated (`player_disconnected`→`disconnect`, `player_reconnected`→`reconnect`, `guest_upgraded`→`guest_upgrade`); `guest_upgrade` tracking moved inside successful-merge block (was firing on cookie presence regardless of merge outcome). 520 tests pass (153+144+223).
- Branch: nightly/2026-07-01-2023

## Blockers / Needs Human Input
_(none)_

## Notes for Next Run

Phase 6f/6i analytics + `account_created` isNew fix complete. Remaining work in the bundle:
- **Client-side funnel events** (create/join/start clicked) — needs analytics platform decision from user. Without a PostHog API key configured, these would be no-ops. Low priority until platform is live.
- **Privacy policy & consent banner** (6i ⬜) — requires legal input; skip in nightly.

**Next runnable items:**
1. **Phase 6j operations hardening bundle** — mostly infrastructure (backups, monitoring, pool sizing, cost guardrails). All require human action to configure external services; nightly can only document what's needed. Consider generating a runbook/checklist document that the user can execute.
2. **POSTHOG_HOST consolidation (minor)** — `analytics.ts` reads `process.env['POSTHOG_HOST']` directly instead of using the constant from `config.ts`. Low-priority cleanup.

**Known non-blocking follow-up items:**
- Link/unlink Google OAuth (account settings — needs design for fallback auth when user has no guest token)
- `DsCoPlayerRow` component for mobile `rp__rows` co-player rows in LobbyScreen
- `DsTitleBlock size="sm"` flourish suppression (pre-existing design issue)
- `guest_upgrade` test: add test asserting the event fires iff the merge actually ran

Routing reminder: packages/db has no dedicated agent — route db-package work to backend-dev.
