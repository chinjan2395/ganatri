# Ganatri Phase Nightly State

> Source of truth for autonomous full-phase development runs.
> This file is separate from `docs/nightly/STATE.md` on purpose: normal nightly
> work can still ship small PRs to `main`, while phase-nightly work accumulates
> on a long-lived phase branch until the whole phase is complete.

## Operating Mode

- Slack command: `/ganatri-phase <text>`
- Queue target: this file, between the `PHASE_TODO` markers below.
- Workflow: `.github/workflows/phase-nightly.yml`
- Target phase branch: `phase/9-scoring`
- Per-run branch prefix: `phase-nightly/`
- Sub-phase PR base: `phase/9-scoring`
- Final production PR base: `main`

Sub-phase PRs must merge into `phase/9-scoring`, not `main`. The phase branch may
merge into `main` only after the full phase acceptance checklist is complete and
this file marks the phase `COMPLETE`.

## Current Phase

Phase 9 — Scoring, Rating & XP Progression

## Status

IN_PROGRESS — Phase 9 sub-phases 9a–9g fully complete; 9h partially complete (admin detail/export/defaults done; KPI analytics + rollout guardrails remain). All 458 tests pass.  <!-- NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETE -->

## Current Sub-Phase Cursor

9h — Admin, exports, analytics, and rollout safety (remaining: KPI scoring analytics + rollout guardrails)

## Phase TODO Queue

If this queue has one or more unchecked `- [ ]` items, the top unchecked item is
the next phase-nightly work unit. If the queue is empty, the workflow follows
the Current Sub-Phase Cursor and the Phase 9 section in `docs/DEVELOPMENT_PLAN.md`.

<!-- PHASE_TODO:START -->
- [x] **add todo that goes to phase 9** - `Phase 9 - review during phase-nightly`. Acceptance: add todo that goes to phase 9 (done 2026-06-29 — Phase 9 reviewed: 9a–9g complete, 9h partially done; 458 tests passing)
<!-- PHASE_TODO:END -->

## Phase Acceptance Checklist

- [x] Every finished match produces deterministic `matchScore`, `xpEarned`, and `rankedRatingDelta` values for each player.
- [x] Placement still exclusively determines the match winner.
- [x] Logged-in users persist `rankedRating`, `totalXp`, and `level`.
- [x] Guests receive end-screen match scoring without durable progression writes.
- [x] End screen shows a scoring breakdown.
- [x] Lobby/profile surfaces current level and rating.
- [x] History/export surfaces stored per-match scoring without recomputing from old event logs.
- [x] DB, server, and web tests pass. (153 engine + 114 server + 191 db = 458 total)
- [ ] Owner has reviewed the final `phase/9-scoring` to `main` PR.

## Completed Sub-Phases

- 9a — Shared domain model and scoring spec
- 9b — DB schema and persistence layer
- 9c — Server scoring engine at game end
- 9d — Server protocol and read endpoints
- 9e — Web state and socket helpers
- 9f — Match UX: in-game score and end screen
- 9g — Lobby, profile, history, leaderboard, and stats integration
- 9h (partial) — Admin user detail + export + backfill defaults done; KPI analytics + rollout guardrails remain

## Last Run

- Date: 2026-06-29
- Outcome: Phase 9 reviewed — 9a–9g fully complete, 9h partially done (KPI analytics + rollout guardrails remain). Meta-TODO processed. 458 tests pass.
- Branch/PR: phase-nightly/2026-06-29-1146

## Blockers / Needs Human Input

_(none)_

## Notes for Next Run

Phase 9 implementation is substantially complete (9a–9g done via regular nightly). Remaining work in 9h:
- **KPI scoring analytics** (optional): XP granted/day, average match score by player count, abandon-rate impact on rating. Requires `getAdminKpiStats` extension in `packages/db` + `ADMIN_GET_KPI_STATS` handler + admin UI.
- **Rollout guardrails**: feature flag or config gate for scoring UI while backend stabilizes. Low priority — scoring is already live.
- Once both are done (or decided not to build), mark `STATUS = COMPLETE` and open the final `phase/9-scoring → main` PR for owner review.
