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

IN_PROGRESS — Phase 9 sub-phases 9a–9h fully complete. All 462 tests pass. Awaiting owner review of final phase/9-scoring → main PR.  <!-- NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETE -->

## Current Sub-Phase Cursor

9h — Admin, exports, analytics, and rollout safety (COMPLETE)

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
- [x] DB, server, and web tests pass. (153 engine + 114 server + 195 db = 462 total)
- [ ] Owner has reviewed the final `phase/9-scoring` to `main` PR.

## Completed Sub-Phases

- 9a — Shared domain model and scoring spec
- 9b — DB schema and persistence layer
- 9c — Server scoring engine at game end
- 9d — Server protocol and read endpoints
- 9e — Web state and socket helpers
- 9f — Match UX: in-game score and end screen
- 9g — Lobby, profile, history, leaderboard, and stats integration
- 9h — Admin user detail + export + backfill defaults + KPI scoring analytics + rollout guardrails (complete)

## Last Run

- Date: 2026-06-29
- Outcome: Phase 9 fully complete; implemented DS-R13 (GameScreen migration to @ganatri/ds) as next priority — DsSpinner/DsBadge/DsButton replace raw elements; DsButtonProps extended with PTT touch handlers; CSS selector fixed to .ds-button. 462 tests pass.
- Branch/PR: phase-nightly/2026-06-29-1704

## Blockers / Needs Human Input

_(none)_

## Notes for Next Run

Phase 9 implementation is fully complete (9a–9h done). The only remaining acceptance item is owner review of the final `phase/9-scoring → main` PR. Once the owner approves, set `STATUS = COMPLETE` and merge.
