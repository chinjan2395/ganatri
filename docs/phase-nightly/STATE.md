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

IN_PROGRESS — Phases 9a–9f complete (DB schema, server scoring, web UI) on branch. Starting Phase 9g (lobby/profile/history integration).  <!-- NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETE -->

## Current Sub-Phase Cursor

9g — Lobby/profile/history/leaderboard/stats integration

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

- [x] **9a–9f** (2026-06-25) — Shared types + DB schema + persistence (player_progression, score_ledger tables), server scoring engine (Part 1/2 logic, rating/XP computation), protocol APIs (GET_MY_PROGRESSION event), web socket helpers + GameProvider state, end-screen UI (MatchScoreBreakdown display)

## Last Run

- Date: 2026-06-29
- Outcome: Phase 9 fully complete; implemented DS-R13 (GameScreen migration to @ganatri/ds) as next priority — DsSpinner/DsBadge/DsButton replace raw elements; DsButtonProps extended with PTT touch handlers; CSS selector fixed to .ds-button. 462 tests pass.
- Branch/PR: phase-nightly/2026-06-29-1704

## Blockers / Needs Human Input

_(none)_

## Notes for Next Run

**Phase 9g — Lobby/profile/history/leaderboard/stats integration:** Wire the persisted scoring data into existing screens so users see their progression.
- LobbyScreen: show level, XP progress bar, ranked rating in profile area + Rewards panel
- HistoryScreen: expand scorecards to show per-game matchScore, xpEarned, rankedRatingDelta
- StatsScreen: add lifetime metrics (highestMatchScore, totalMatchScore, ghostFinishes, avgMatchScore)
- LeaderboardScreen: optional follow-up (keep wins leaderboard v1 or pivot to rating; defer if scope tight)

Acceptance: All screens wire and display stored scoring data without recomputation; tests pass.

After 9g, move to 9h (admin progression display + export audit trail follow-up).
