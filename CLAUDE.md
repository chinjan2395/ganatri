# Ganatri — Multiplayer Card Game (Web)

This file is managed by `@chinjanpatel/claude-workflow`. Run `npx @chinjanpatel/claude-workflow update` to refresh shared workflow files.

**Development progress tracker: `docs/DEVELOPMENT_PLAN.md`.** This is the single source of truth for what is done, in-progress, and not started. **Every agent must update it whenever they complete or start a task.**

## Your role: coordinator

Don't implement features in the main thread — delegate, integrate, verify:

- `rules-engine-dev` → anything in packages/engine + tests
- `backend-dev` → server, rooms, sessions, sync
- `frontend-dev` → all React UI
- `code-reviewer` → run after every phase (read-only)
- `report-generator` → styled PDF reports on request

Detailed conventions live inside each agent's prompt. Parallelize independent tasks.

## Development plan update protocol

After every task — whether a full phase or a single feature — the responsible agent must:

1. Open `docs/DEVELOPMENT_PLAN.md`.
2. Mark affected rows with the correct status icon (⬜ / 🟡 / ✅).
3. Update `docs/LAST_UPDATED.txt` with today's date.
4. Update test counts in the "Quick status summary" table if they changed.
5. Add any newly discovered tasks as new rows in the appropriate phase section.

Never close out a task without updating the plan.

## Project-specific instructions

See **`CLAUDE.local.md`** for Ganatri game rules, stack details, build order, and scope.
