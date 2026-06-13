# Ganatri

A two-part multiplayer card game for the browser. **Part 1** is a capture/summation phase; **Part 2** is a trick-taking phase with suit rules and cuts. Two to four players join online with a room code — no accounts required.

For full rule details and edge cases, see [`docs/GAME_RULES.md`](docs/GAME_RULES.md).

---

## How it works

### Part 1 — Capture (summation)

- Standard 52-card deck. Each player starts with 5 cards; the rest form a face-down stock pile.
- On your turn, play one card face-up. Numeric cards (Ace = 1, 2–10) can capture table cards whose values **sum exactly** to the played value, using **2–3 table cards** per combination.
- Same-rank cards on the table must also be captured when you play a matching rank.
- Face cards (J, Q, K) and played Aces only capture same-rank table cards — no summation.
- Captures are mandatory when possible. Uncaptured cards stay on the table.
- After playing, draw one card from stock (while stock lasts).
- When all hands are empty, leftover table cards go to the last capturer (or are discarded if nobody captured). Each player's capture pile becomes their Part 2 hand.

### Part 2 — Tricks (suit & cut)

- The player who went first in Part 1 leads (or the next seated player with cards, if they captured nothing).
- Players must **follow suit** when they can. Highest card of the led suit wins; all trick cards are cancelled and removed.
- If you cannot follow suit, you **cut** with another suit — the trick ends immediately, and the holder of the highest led-suit card picks up all cards on the table.
- Players who empty their hand are **safe**. The last player still holding cards **loses**; everyone else is ranked by the order they went out.

---

## Architecture

This is an npm workspaces monorepo with three packages:

| Package | Role |
|---------|------|
| [`packages/engine`](packages/engine) | Pure TypeScript rules engine — shuffle, deal, moves, legality, redacted views. No React, Socket.io, or Node imports. Fully unit-tested with seedable RNG. |
| [`packages/server`](packages/server) | Node + Socket.io server. Authoritative: every move is validated through the engine. Sends redacted `PlayerView` state only. In-memory rooms; no database. |
| [`packages/web`](packages/web) | React + Vite client. Lobby, game table, Part 1 capture selection, Part 2 follow-suit highlighting. |

```
Client (React)  ──Socket.io──▶  Server  ──applyMove──▶  Engine
                                     │
                                     └── viewFor(player) ──▶ redacted state
```

**v1 scope:** online multiplayer only (room codes). Offline/LAN is not built yet, but networking is abstracted behind a `GameTransport` interface so a local transport can be added later.

**Session model:** one active game per player (browser session token). Attempting to join a second room is blocked; the client offers rejoin to the current game.

---

## Tech stack

- **Language:** TypeScript (strict) everywhere
- **Client:** React 18, Vite
- **Server:** Node.js 22+, Socket.io 4
- **Tests:** Vitest (engine + server)
- **Engine API:** documented in [`docs/ENGINE_API.md`](docs/ENGINE_API.md)

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) **22 or later**

### Install

```bash
npm install
```

### Run tests

```bash
npm test
```

Runs Vitest across all workspaces (`engine` and `server`).

### Typecheck

```bash
npm run typecheck
```

### Development

Start the server and web client in separate terminals:

```bash
# Terminal 1 — game server (default :4000)
npm run dev -w @ganatri/server

# Terminal 2 — web client (default :5173)
npm run dev -w @ganatri/web
```

Open [http://localhost:5173](http://localhost:5173). The client connects to `http://localhost:4000` by default. Override with:

```bash
VITE_SERVER_URL=http://localhost:4000 npm run dev -w @ganatri/web
```

### Production build

```bash
npm run build
```

---

## Playing online

1. **Create a room** — you become host and receive a 6-character room code.
2. **Share the code** — other players join from the lobby (2–4 players total).
3. **Start the game** — host starts when everyone is ready.
4. **Part 1** — play cards, choose capture combinations when multiple maximal sets exist, build your capture pile.
5. **Part 2** — follow suit, cut when you must, be the first to empty your hand.
6. **Game over** — rankings are shown; play again from the lobby.

---

## Project layout

```
ganatri/
├── docs/
│   ├── GAME_RULES.md      # Authoritative game rules (+ clarifications)
│   └── ENGINE_API.md      # Engine public API contract
├── packages/
│   ├── engine/            # Pure rules engine + unit tests
│   ├── server/            # Socket.io server + room/session logic
│   └── web/               # React client
├── package.json           # Workspace root scripts
└── tsconfig.base.json
```

---

## Documentation

| Document | Contents |
|----------|----------|
| [`docs/GAME_RULES.md`](docs/GAME_RULES.md) | Full rules, UI requirements, and authoritative clarifications |
| [`docs/ENGINE_API.md`](docs/ENGINE_API.md) | `createGame`, `applyMove`, `captureOptions`, `viewFor`, types, events |
| [`CLAUDE.md`](CLAUDE.md) | Contributor/agent conventions for this repo |

---

## License

Private project — all rights reserved unless otherwise specified.
