# Ganatri Nightly State

> Single source of truth for autonomous nightly runs.
> Claude reads this FIRST and updates it LAST every run.

## Current Phase
Phase 6 — Persistence, Accounts, Statistics & Analytics

## Status
IN_PROGRESS — Phase 6 (Persistence/DB): 6a/6b/6d done; 6e statistics in progress   <!-- NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETE -->

## Completed Phases
- [x] Phase 1 — Rules Engine (153 tests passing)
- [x] Phase 2 — Server (28 tests passing)
- [x] Phase 3 — Web Client (all components functional, player names wired)
- [x] Phase 4 — Polish (animations, mobile, flat board, deployment config)
- [x] Phase 5 — Voice Chat (core + cross-browser + Perfect Negotiation + TURN; 5.7 smoke test requires human)
- [x] Phase 7 (pull-forward) — Auto-forfeit on grace expiry, TURN_TIMEOUT event, trick-reveal freeze fix, name sanitization (4/4 urgent fixes complete)
- [x] Phase 6a — Database foundation (PostgreSQL + Drizzle ORM + Neon; packages/db workspace; 6 core tables; initial migration)
- [x] Phase 6b — Durable `GamePersistence` layer built & fully tested (Pg + Memory impls; PGlite contract suite)
- [x] Phase 6d — DB write-through wired into server (rooms/games/game_players/game_events; async fire-and-forget). Restart-rehydration deferred.

## Sequencing Note
Per DEVELOPMENT_PLAN.md §7 sequencing note (2026-06-16):
Before Phase 6 (DB), pull forward these urgent items from Phase 7:
  1. 7b: Auto-advance / forfeit when grace period expires during PLAYING
  2. 7b: Disclose auto-played move on turn timeout (broadcast toast "X's turn timed out")
  3. 7d: Align trick-reveal freeze duration with flash animation duration (1500ms freeze vs 2200ms flash)
  4. 7e: Sanitize player names server-side (XSS-safe trimming + 20-char limit)

Phase 5.7 (multi-tab voice smoke test) requires a human with a microphone — skip in nightly runs.
Phase 6 (Persistence/DB) is next after pull-forward items are done.

## Last Run
- Date: 2026-06-19
- Outcome: ✅ Phase 6e "Derived metrics" complete — added `getPlayerStatsView(userId)` + `PlayerStatsView` to `GamePersistence` (Pg + Memory), deriving winRate / lossRate / abandonRate (gamesPlayed===0 → 0) and averageFinishPosition (mean non-null finalRank, null when no ranked games). Computed on read, no schema/migration change. Reconciled stale STATE.md (6b/6d were already done in prior sessions but not recorded here). Code review clean. All 256 tests passing (153 engine + 28 server + 75 db; +6 db).
- Branch/PR: nightly/2026-06-19-1104

## Blockers / Needs Human Input
(none)

## Notes for Next Run
Phase 6 progress so far (per DEVELOPMENT_PLAN.md):
  ✅ 6a — DB foundation (pg Pool, Drizzle, regenerated migration)
  ✅ 6b — durable `GamePersistence` layer (Pg + Memory), 75 db tests (PGlite contract suite)
  ✅ 6d — server write-through (rooms/games/game_players/game_events, async)
  ✅ 6e — incremental stats + derived metrics (`getPlayerStatsView`)

Good NOT_STARTED / IN_PROGRESS candidates for the next run, in rough priority order
(all low-risk, additive — avoid the 6c accounts epic which has unresolved DECISION items
needing a human, e.g. auth method):
  1. 6e — Stats API socket endpoints: `get_my_stats` (reads `getPlayerStatsView`),
     later `get_leaderboard` / `get_match_history`. Redact other players' private data.
     (backend-dev; needs a leaderboard query + index — see 6e "Leaderboard queries".)
  2. 6b — Refactor server runtime `store.ts` → `MemoryStore` impl behind an interface
     (keep existing 28 server tests green). Larger/riskier — touches handlers.ts heavily.
  3. 6d — Server-restart recovery: wire `loadActiveGames` rehydration on boot
     (persistence layer already supports it). Medium complexity.

DO NOT attempt 6c (accounts/auth) without human input — auth method is an open 🔷 DECISION.
Phase 5.7 (multi-tab voice smoke test) still requires a human with a microphone — skip in nightly.
