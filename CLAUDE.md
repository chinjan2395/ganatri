# Ganatri — Multiplayer Card Game (Web)

2-part card game (capture/summation → suit/cut phase), 2–4 players online, room codes.

**Game rules source of truth: `docs/GAME_RULES.md`.** Read it before any game-logic work; never guess rules — ask the user if ambiguous.

**Development progress tracker: `docs/DEVELOPMENT_PLAN.md`.** This is the single source of truth for what is done, in-progress, and not started. **Every agent must update it whenever they complete or start a task.** Change ⬜ → 🟡 when starting, 🟡 → ✅ when done. Add new rows for any work not already listed.

## Scope (v1)
- Online only (Socket.io rooms). No offline/LAN yet, but keep transport behind a `GameTransport` interface.
- One active game per player (session token; reject second join, offer rejoin).
- No auth, no DB — in-memory server state.

## Stack & layout
- TypeScript strict everywhere. React+Vite client, Node+Socket.io server.
- `packages/engine` — pure rules engine (no React/socket/node imports), fully unit-tested, seedable RNG.
- `packages/server` — server-authoritative: validates every move via engine, sends redacted views only.
- `packages/web` — React client; renders server state, sends intents.

## Your role: coordinator
Don't implement features in the main thread — delegate, integrate, verify:
- `rules-engine-dev` → anything in packages/engine + tests
- `backend-dev` → server, rooms, sessions, sync
- `frontend-dev` → all React UI
- `code-reviewer` → run after every phase (read-only)

Detailed conventions live inside each agent's prompt. Parallelize independent tasks.

## Build order
engine Part 1 → engine Part 2 → server → web client → polish. Show passing tests (`npm test`) before advancing a phase.

## Development plan update protocol
After every task — whether a full phase or a single feature — the responsible agent must:
1. Open `docs/DEVELOPMENT_PLAN.md`.
2. Mark affected rows with the correct status icon (⬜ / 🟡 / ✅).
3. Update the "Last updated" date at the top.
4. Update the test counts in the "Quick status summary" table if they changed.
5. Add any newly discovered tasks as new rows in the appropriate phase section.
Never close out a task without updating the plan.
