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

NOT_STARTED — Phase branch workflow is ready to start Phase 9 from `docs/DEVELOPMENT_PLAN.md`.  <!-- NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETE -->

## Current Sub-Phase Cursor

9a — Shared domain model and scoring spec

## Phase TODO Queue

If this queue has one or more unchecked `- [ ]` items, the top unchecked item is
the next phase-nightly work unit. If the queue is empty, the workflow follows
the Current Sub-Phase Cursor and the Phase 9 section in `docs/DEVELOPMENT_PLAN.md`.

<!-- PHASE_TODO:START -->
_(none)_
<!-- PHASE_TODO:END -->

## Phase Acceptance Checklist

- [ ] Every finished match produces deterministic `matchScore`, `xpEarned`, and `rankedRatingDelta` values for each player.
- [ ] Placement still exclusively determines the match winner.
- [ ] Logged-in users persist `rankedRating`, `totalXp`, and `level`.
- [ ] Guests receive end-screen match scoring without durable progression writes.
- [ ] End screen shows a scoring breakdown.
- [ ] Lobby/profile surfaces current level and rating.
- [ ] History/export surfaces stored per-match scoring without recomputing from old event logs.
- [ ] DB, server, and web tests pass.
- [ ] Owner has reviewed the final `phase/9-scoring` to `main` PR.

## Completed Sub-Phases

_(none)_

## Last Run

- Date: 2026-06-25
- Outcome: Phase-nightly lane created; no Phase 9 implementation has run yet.
- Branch/PR: _(none)_

## Blockers / Needs Human Input

_(none)_

## Notes for Next Run

Start with Phase 9a from `docs/DEVELOPMENT_PLAN.md`: define shared scoring/progression domain types, canonical scoring reasons, guest persistence behavior, and the authoritative mapping between `docs/POINTS_SYSTEM.md` formulas and server inputs.
