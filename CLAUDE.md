# Ganatri — Multiplayer Card Game (Web)

2-part card game (capture/summation → suit/cut phase), 2–4 players online, room codes.

**Game rules source of truth: `docs/GAME_RULES.md`.** Read it before any game-logic work; never guess rules — ask the user if ambiguous.

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
