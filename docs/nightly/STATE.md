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
Phase 6 — Remaining implementable items (analytics/compliance → operations hardening)

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
Phase DS-R (all 23 tasks) completed as of 2026-06-30. Phase 6c auth/account hardening complete as of 2026-06-30. Phase 6d/6e stats recompute complete as of 2026-07-01. Phase 6f/6i analytics + compliance bundle complete as of 2026-07-01.

Next items:
1. **Phase 6j operations hardening bundle** — backups, monitoring/alerts, pool sizing, cost guardrails. All require human infrastructure decisions (Neon, Render, alerting providers).
2. **Remaining 6f instrumentation** — client-side funnel events (create/join/start) are ⬜; requires PostHog JS SDK in web (new npm package decision).
3. **`signup` event** — requires `upsertOAuthUser` in packages/db to return an `isNew: boolean` flag; deferred.
4. **`auth_token` in OAuth redirect URL** — PRE-EXISTING issue (not introduced in this phase). The session token is appended to the redirect URL in `createApp.ts:handleGoogleCallback` (`redirectUrl.searchParams.set('auth_token', token)`). The token already appears in the httpOnly cookie; the URL param exists for legacy `LEGACY_TOKEN_KEY` bootstrap compatibility. Should be removed or replaced with a short-lived one-time code before production launch. See packages/server/src/createApp.ts ~line 413.
5. **Consent-analytics decoupling** — Server-side PostHog tracking fires unconditionally; the `ganatri_consent_v1` localStorage value (set by CookieConsent.tsx) is not read by the server. Full GDPR compliance would require: (a) client sending consent status to server via socket handshake or dedicated event, (b) server only calling `track()` when consent='accepted'. Acceptable for development but must be resolved before EU launch.

Phase 5.7 (multi-tab voice smoke test) requires a human with a microphone — skip in nightly runs.
Phase 4 production deployment is handled by the user (Render + Cloudflare).

## Last Run
- Date: 2026-07-01
- Outcome: Phase 6f/6i — Analytics + compliance bundle complete. New `analytics.ts` (event taxonomy, AnalyticsAdapter interface, NoOpAdapter, PostHogAdapter via Node 22 fetch, env-gated on POSTHOG_API_KEY). 10 server-side track() call sites in handlers.ts. Two createApp.ts bug fixes (getClientIp TRUST_PROXY gate, OAuth 429→302 redirect). CookieConsent component in web (localStorage ganatri_consent_v1, Accept/Decline buttons). RoomState.startedAt added for game_finished durationMs. auth-rate-limit.test.ts updated for 302 behavior. 8 new server tests (analytics.test.ts). Total: 518 tests (153 engine + 142 server + 223 db).
- Branch: nightly/2026-07-01-0655

## Blockers / Needs Human Input
_(none — but see Sequencing Note for known limitations requiring human decisions before EU launch)_

## Notes for Next Run

Phase 6f/6i analytics + compliance bundle: COMPLETE (core instrumentation done). Remaining items in 6f:
- Client-side funnel events (⬜) — `create_room`/`join_room`/`start_game` clicks; needs PostHog JS SDK decision
- Privacy-respecting collection policy (⬜) — document what's collected (already anonymous UUIDs only)
- Funnel/engagement/operational metrics dashboards (⬜) — PostHog dashboard configuration, not code

**Next unit of work: Phase 6j operations hardening bundle**
- Automated backups & restore drills (requires Neon/Render setup — human needed)
- DB monitoring & alerting (requires external monitoring service — human needed)
- Connection-pool sizing (code-level: optimize pool size in packages/db)
- Cost & free-tier monitoring (requires Neon dashboard — human needed)

The only code-implementable item in 6j is connection-pool tuning. Consider doing that plus documenting the others as requiring human setup, then moving to Phase 7 improvements.

**Alternative: Phase 7g improvements**
- Health-check endpoint `/healthz` (quick server-only addition, great for Render liveness probes)
- Split handlers.ts into focused modules (larger refactor, high value)

**Known pre-existing issues (not introduced in this phase):**
- `auth_token` in OAuth redirect URL (see Sequencing Note above)
- `getClientIp` now gated on TRUST_PROXY=1 — set this env var in Render/production

Deferred items:
- Link/unlink Google OAuth (account settings — needs design for fallback auth when user has no guest token)
- `DsCoPlayerRow` component for mobile `rp__rows` co-player rows in LobbyScreen
- `DsTitleBlock size="sm"` flourish suppression (pre-existing design issue)

Routing reminder: packages/db has no dedicated agent — route db-package work to backend-dev.
