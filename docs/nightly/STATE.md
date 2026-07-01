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

Priority order for next runs:
1. **Phase 6d/6e persistence + stats polish bundle** — replay scaffolding, idempotency guards, backfill/reconcile work, and any remaining stats/leaderboard polish.
2. **Phase 6f/6i analytics + compliance bundle** — event taxonomy, instrumentation, privacy policy/consent, export/delete polish.
3. **Phase 6j operations hardening bundle** — backups, monitoring/alerts, pool sizing, cost guardrails.

Phase 5.7 (multi-tab voice smoke test) requires a human with a microphone — skip in nightly runs.
Phase 4 production deployment is handled by the user (Render + Cloudflare).

## Last Run
- Date: 2026-07-01
- Outcome: Phase 6d/6e — Stats recompute/backfill job: `recomputePlayerStats(userId?)` added to GamePersistence interface + implemented in PgPersistence (SQL aggregation + streak query) and MemoryPersistence. `ADMIN_RECOMPUTE_STATS` socket event with admin-auth gate. Non-derivable fields (cutsGiven, cutsReceived, timesSafe, ghostFinishes) explicitly preserved on ON CONFLICT UPDATE. 6 DB contract tests + 3 server integration tests. Code review MUST-FIX applied (explicit ghost_finishes preservation in ON CONFLICT SET clause). 510 tests pass (153 engine + 134 server + 223 db).
- Branch: nightly/2026-07-01-0445

## Blockers / Needs Human Input
_(none)_

## Notes for Next Run

Phase 6d/6e stats recompute backfill complete. Remaining ⬜ items in this bundle:
- **Replay data model & reconstruction** (6d ⬜) — Rebuild a game from game_events + seed; depends on full-log decision in 6b. Low priority without a replay UI.
- **Rating system decision** (6e ⬜) — ELO/Glicko-2 optional; deferred.

**Next items to consider:**
1. **Phase 6f/6i analytics + compliance bundle** (6f ⬜, 6i privacy policy ⬜) — event taxonomy, PostHog/Plausible instrumentation, privacy policy UX.
2. **Phase 6j operations hardening bundle** (6j ⬜) — backups, monitoring, pool sizing, cost guardrails.
3. **`getClientIp` fix** — gate on `TRUST_PROXY=1` env var (packages/server/src/createApp.ts); non-blocking.
4. **OAuth 429 redirect** — bare JSON shown to browser; should redirect with `?login=error`.

**Known non-blocking follow-up items:**
- `getClientIp` in `createApp.ts` trusts `X-Forwarded-For` unconditionally. Fix: gate on `TRUST_PROXY=1` env var.
- OAuth 429 shows bare JSON to browser (no redirect with `?login=error`). Minor UX gap.

Deferred items:
- Link/unlink Google OAuth (account settings — needs design for fallback auth when user has no guest token)
- `DsCoPlayerRow` component for mobile `rp__rows` co-player rows in LobbyScreen
- `DsTitleBlock size="sm"` flourish suppression (pre-existing design issue)

Routing reminder: packages/db has no dedicated agent — route db-package work to backend-dev.
