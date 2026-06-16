# Ganatri Nightly State

> Single source of truth for autonomous nightly runs.
> Claude reads this FIRST and updates it LAST every run.

## Current Phase
Phase 6 — Persistence, Accounts, Statistics & Analytics

## Status
NOT_STARTED   <!-- NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETE -->

## Completed Phases
- [x] Phase 1 — Rules Engine (153 tests passing)
- [x] Phase 2 — Server (26 tests passing)
- [x] Phase 3 — Web Client (all components functional, player names wired)
- [x] Phase 4 — Polish (animations, mobile, flat board, deployment config)
- [x] Phase 5 — Voice Chat (core + cross-browser + Perfect Negotiation + TURN; 5.7 smoke test requires human)
- [x] Phase 7 (pull-forward) — Auto-forfeit on grace expiry, TURN_TIMEOUT event, trick-reveal freeze fix, name sanitization (4/4 urgent fixes complete)

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
- Date: 2026-06-16
- Outcome: ✅ Phase 7 (pull-forward) complete — all 4 urgent fixes shipped (179 tests passing)
- Branch/PR: nightly/2026-06-16-0855

## Blockers / Needs Human Input
(none)

## Notes for Next Run
Phase 7 pull-forward is now COMPLETE. All 4 urgent fixes are shipped:
  ✅ Auto-advance/forfeit on grace period expiry (7b.1)
  ✅ Disclose auto-played move with TURN_TIMEOUT event (7b.2)
  ✅ Trick-reveal freeze duration aligned to 2200ms (7d)
  ✅ Player names sanitized server-side (7e)

Next: Start Phase 6 — Persistence, Accounts, Statistics & Analytics.
This is a large (~70-task) epic. Begin with Phase 6a (database foundation & infrastructure).
Recommendation: Start with the DECISION items (database engine, ORM, managed host) — these are blocking tasks.
