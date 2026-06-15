# Ganatri — Phasewise Development Plan

Last updated: 2026-06-15 (Voice chat: Perfect Negotiation + recovery + Cloudflare TURN)  
All 163 tests passing (140 engine + 23 server).

---

## Legend

- ✅ Done — shipped and tested
- 🟡 In progress — partially built, uncommitted or not wired end-to-end
- ⬜ Not started

---

## Phase 1 — Rules Engine (`packages/engine`)

**Goal:** Pure TypeScript rules module, fully tested, no network/UI dependencies.


| Task                                                                       | Status | Notes                          |
| -------------------------------------------------------------------------- | ------ | ------------------------------ |
| Card types: `Suit`, `Rank`, `Card`, `CardId`, `summationValue`             | ✅      | `src/cards.ts`                 |
| Game state types: `GameState`, `Part1State`, `Part2State`, `Phase`         | ✅      | `src/types.ts`                 |
| Seedable RNG (`mulberry32`)                                                | ✅      | `src/rng.ts`                   |
| `createGame(seating, seed)` — shuffle, deal 5 each, pick first player      | ✅      | `src/game.ts`                  |
| Part 1 capture logic — summation up to 3 table cards                       | ✅      | `src/capture.ts`               |
| Part 1 same-rank mandatory capture (all matching ranks)                    | ✅      | `src/capture.ts`               |
| Part 1 maximal-disjoint-combinations rule (Clarification #3)               | ✅      | `src/capture.ts`               |
| `captureOptions(state, cardId)` — all legal capture sets                   | ✅      | `src/capture.ts`               |
| Part 1 played-card stays on table when no capture                          | ✅      | `src/game.ts`                  |
| Stock draw after each play; stock exhaustion handling                      | ✅      | `src/game.ts`                  |
| Part 1 → Part 2 transition; last-capturer sweeps table                     | ✅      | `src/game.ts`                  |
| No-capturer edge case: table cards discarded (Clarification #5)            | ✅      | `src/game.ts`                  |
| Part 2 follow-suit enforcement                                             | ✅      | `src/game.ts`                  |
| Part 2 trick resolution: all followed → cancelled, winner leads            | ✅      | `src/game.ts`                  |
| Part 2 cut detection: cutter leads, highest led-suit holder picks up       | ✅      | `src/game.ts`                  |
| Part 2 safe/out logic; zero-capture players immediately safe               | ✅      | `src/game.ts`                  |
| Part 2 simultaneous-finish edge cases (Clarification #10)                  | ✅      | `src/game.ts`                  |
| `legalMoves` / `legalPart2Cards` helpers                                   | ✅      | `src/game.ts`                  |
| `viewFor(state, playerId)` — redacted `PlayerView`                         | ✅      | `src/view.ts`                  |
| `applyMove(state, player, move)` — pure, returns new state + events        | ✅      | `src/game.ts`                  |
| `GameEvent` union (CAPTURED, CUT, TRICK_WON, PLAYER_SAFE, etc.)            | ✅      | `src/types.ts`                 |
| Unit tests: capture options (25 tests)                                     | ✅      | `tests/captureOptions.test.ts` |
| Unit tests: applyMove Part 1 (20 tests)                                    | ✅      | `tests/applyMove.test.ts`      |
| Unit tests: Part 2 full (56 tests)                                         | ✅      | `tests/part2.test.ts`          |
| Unit tests: createGame, viewFor, legalMoves, transitions, smoke (42 tests) | ✅      | `tests/*.test.ts`              |


**Test count: 140 / 140 passing.**

---

## Phase 2 — Server (`packages/server`)

**Goal:** Server-authoritative Socket.io backend. No game logic — delegates everything to the engine.


| Task                                                                  | Status | Notes                               |
| --------------------------------------------------------------------- | ------ | ----------------------------------- |
| Socket.io app setup, CORS, health endpoint                            | ✅      | `src/createApp.ts`                  |
| `GameTransport` interface (abstraction for LAN later)                 | ✅      | `src/transport.ts`                  |
| `SocketTransport` implementation                                      | ✅      | `src/socketTransport.ts`            |
| In-memory `store`: sessions, rooms, player index                      | ✅      | `src/store.ts`                      |
| Session tokens (UUID); issue on first connect, restore on reconnect   | ✅      | `src/handlers.ts`                   |
| `create_room` — 6-char room code (no O or 0), host assigned           | ✅      | `src/handlers.ts`                   |
| `join_room` — code validation, room capacity check (2–4)              | ✅      | `src/handlers.ts`                   |
| `leave_room` — removes from lobby, transfers host                     | ✅      | `src/handlers.ts`                   |
| One-active-game-per-player rule (reject / offer rejoin)               | ✅      | `src/handlers.ts`                   |
| `start_game` — host-only, ≥2 players, seeds `createGame`              | ✅      | `src/handlers.ts`                   |
| `make_move` — validates via `applyMove`, sends redacted views         | ✅      | `src/handlers.ts`                   |
| `request_state` — resync endpoint                                     | ✅      | `src/handlers.ts`                   |
| Typed event protocol (`EVENTS`, payload interfaces)                   | ✅      | `src/protocol.ts`                   |
| Disconnect handling: grace period timer, hold seat during PLAYING     | ✅      | `src/handlers.ts`                   |
| Reconnect: cancel grace timer, rejoin socket.io room, resend view     | ✅      | `src/handlers.ts`                   |
| `ROOM_UPDATE` broadcast (players, host, phase, disconnectedPlayers)   | ✅      | `src/handlers.ts`                   |
| Turn timer: auto-play on timeout, configurable `turnTimeoutMs`        | ✅      | `src/handlers.ts`                   |
| Move debounce (100 ms, prevents double-submit)                        | ✅      | `src/handlers.ts`                   |
| Admin auth + `get_config` / `update_config` socket events             | ✅      | `src/handlers.ts`                   |
| `GameConfig` (turnTimeoutMs, maxPlayers, gracePeriodMs, roomExpiryMs) | ✅      | `src/config.ts`                     |
| Done-room expiry: purge DONE rooms after `roomExpiryMs`               | ✅      | `src/handlers.ts`                   |
| Player name storage in `SessionState`                                 | ✅      | `src/store.ts` — in current diff    |
| Send `playerNames` map in `ROOM_UPDATE`                               | ✅      | `src/handlers.ts` — in current diff |
| Accept `name` field in `create_room` and `join_room` payloads         | ✅      | `src/handlers.ts` — in current diff |
| Integration tests: room lifecycle, one-game rule, full game script    | ✅      | `src/handlers.test.ts` (23 tests)   |


**Test count: 23 / 23 passing.**

---

## Phase 3 — Web Client (`packages/web`)

**Goal:** Playable React client. Renders server state only; sends move intents only. No hidden info leaked.

### 3a — Networking & State


| Task                                                                     | Status | Notes                                 |
| ------------------------------------------------------------------------ | ------ | ------------------------------------- |
| Socket.io client wiring (`socket.ts`)                                    | ✅      | `src/net/socket.ts`                   |
| Session token persistence in `localStorage`                              | ✅      | `src/net/socket.ts`                   |
| `GameProvider` / `GameContext` — centralised state                       | ✅      | `src/state/GameProvider.tsx`          |
| `ROOM_UPDATE` → room state sync                                          | ✅      | `GameProvider.tsx`                    |
| `STATE_UPDATE` → view + turn timer sync                                  | ✅      | `GameProvider.tsx`                    |
| `GAME_EVENT` → event log + lastEvent                                     | ✅      | `GameProvider.tsx`                    |
| `PLAYER_DISCONNECTED` / `PLAYER_RECONNECTED` → `disconnectedPlayers` set | ✅      | `GameProvider.tsx`                    |
| `playerNames` map from `ROOM_UPDATE`                                     | ✅      | `GameProvider.tsx` — in current diff  |
| `ConnectionBanner` — offline/reconnecting overlay                        | ✅      | `src/components/ConnectionBanner.tsx` |


### 3b — Screens


| Task                                                                                                                                                                                            | Status | Notes                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `LobbyScreen` — create/join with name input                                                                                                                                                     | ✅      | `src/screens/LobbyScreen.tsx`                                                                                                       |
| Lobby: rejoin prompt when `ALREADY_IN_GAME`                                                                                                                                                     | ✅      | `LobbyScreen.tsx`                                                                                                                   |
| `RoomScreen` — waiting room, player list, start button                                                                                                                                          | ✅      | `src/screens/RoomScreen.tsx`                                                                                                        |
| RoomScreen: show player names (not shortId)                                                                                                                                                     | ✅      | Uses `playerNames` from context; fallback to `shortId(pid)`                                                                         |
| `GameScreen` — top bar, table stage, sidebar                                                                                                                                                    | ✅      | `src/screens/GameScreen.tsx`                                                                                                        |
| GameScreen flat-table redesign — opponents top row (turn order), flat full-width board, own seat above hand                                                                                     | ✅      | Replaced oval `.table-felt`/rim seats with `.game__players` + `.game__board`; `Boards.css` `.table-center` → `.game__board`         |
| GameScreen full-bleed felt + floating-avatar restyle — felt on `.game`, de-framed `.game__board`, all players (you centred) as borderless floating avatars in one row, OpponentSeat status line | ✅      | `orderedOpponents` → `orderedPlayers` (you at centre); removed `.game__you-seat`; `OpponentSeat` name/avatar/status/chips, no panel |
| GameScreen: show player names in flash messages and turn indicator                                                                                                                              | ✅      | Wired `playerNames` from context; `nameFor` helper at line 140                                                                      |
| `AdminScreen` — email auth, config sliders                                                                                                                                                      | ✅      | `src/screens/AdminScreen.tsx`                                                                                                       |


### 3c — Game Components


| Task                                                                       | Status | Notes                                                                     |
| -------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| `Card` component (face-up / face-down, selected, legal highlight)          | ✅      | `src/components/Card.tsx`                                                 |
| `Hand` — player's hand with drag-reorder in Part 2                         | ✅      | `src/components/Hand.tsx`                                                 |
| `Part1Board` — table cards, stock counter, capture selection state machine | ✅      | `src/components/Part1Board.tsx`                                           |
| Part 1 capture: highlight valid combinations on card select                | ✅      | `Part1Board.tsx` + `src/game/legal.ts`                                    |
| Part 1 action bar: confirm / cycle options / cancel                        | ✅      | `GameScreen.tsx`                                                          |
| `Part2Board` — trick display, led-suit indicator, flash overlays           | ✅      | `src/components/Part2Board.tsx`                                           |
| Part 2: grey-out illegal cards (follow-suit enforcement)                   | ✅      | `Part2Board.tsx`                                                          |
| Part 2: flash on CUT, TRICK_WON, PLAYER_SAFE events                        | ✅      | `GameScreen.tsx`                                                          |
| Part 2: show player names in trick display                                 | ✅      | `Part2Board` receives `playerNames` prop; shows in trick play at line 103 |
| `OpponentSeat` — avatar, hand count, capture count, safe badge, disconnect | ✅      | `src/components/OpponentSeat.tsx`                                         |
| OpponentSeat: show player names (not shortId)                              | ✅      | Uses `displayName` prop from parent with fallback to `shortId(playerId)`  |
| `CapturedPile` — floating FAB with suit breakdown panel (Part 1)           | ✅      | Fixed bottom-left FAB (mirrors PTT mic); no hand-section layout slot        |
| `TurnTimer` — countdown bar, configurable duration                         | ✅      | `src/components/TurnTimer.tsx`                                            |
| `EndScreen` — rankings (winner → loser), play again / leave                | ✅      | `src/components/EndScreen.tsx`                                            |
| EndScreen: show player names                                               | ✅      | Receives `playerNames` prop; shows in winner spotlight and rankings       |
| `Toast` / `Chip` utility components                                        | ✅      | `src/components/Toast.tsx`, `Chip.tsx`                                    |


---

## Phase 4 — Polish

**Goal:** Names, animations, responsiveness, deployment.


| Task                                                                                                              | Status | Notes                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| **Player names end-to-end** — wire `playerNames` into RoomScreen, GameScreen, OpponentSeat, Part2Board, EndScreen | ✅      | All 5 components wired; display names with `shortId()` fallback                                            |
| Part 2 cut animation — animate card pickup flying to the holder                                                   | ✅      | Scale + brightness pulse on `isCut` with 0.65s easing; key includes `isCut` state                          |
| Card play animation — slide card from hand to table                                                               | ✅      | Framer Motion `layoutId` on Card + `layout="position"` on Hand/Part1Board/Part2Board slots                 |
| Part 1 → Part 2 transition animation / screen banner                                                              | ✅      | Full-screen overlay with spring animation (380/22); text: "PART 2 — THE CUT"; 2.5s duration                |
| Sound effects (optional)                                                                                          | ⬜      | Not in requirements; add only if desired                                                                   |
| Mobile layout testing & fine-tuning                                                                               | ✅      | Responsive breakpoints added: 375px (avatar shrinking); 44px min button height; Hand overlap reflow tested |
| Room/lobby scroll within locked viewport (Start game, Leave visible on short screens)                             | ✅      | `.center-screen` scroll + flex spacers; RoomScreen table uses real compact sizes instead of scale hack       |
| Flat play area — remove oval/rim, gap-based multi-row table cards, locked card sizes per session                  | ✅      | `GameScreen.css` flat board; `Boards.css` no overlap; `GameScreen.tsx` locks `--card-table-w` / `--card-hand-w` |
| Production deployment (server on Render, web on Cloudflare)                                                       | ⬜      | User will handle Render + Cloudflare setup; see `.env.example` files for required vars                     |
| Environment config for production URLs                                                                            | ⬜      | `.env.example` files complete; production vars to be set in Render + Cloudflare environments               |


---

## Phase 5 — Voice Chat

**Goal:** PUBG-style in-room voice (WebRTC peer mesh, signaling over Socket.io). No new npm packages.


| Task                                                                                   | Status | Notes                                                                                     |
| -------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| 5.1 Protocol: voice signaling events (offer/answer/ICE) in both packages               | ✅      | `server/src/protocol.ts`, `web/src/protocol.ts` — 6 events + payload types                |
| 5.2 Server: relay handlers for voice_offer, voice_answer, voice_ice_candidate          | ✅      | `server/src/handlers.ts` — `registerSocketEvents` gets `io` param; 3 relay handlers added |
| 5.3 Client: `useVoiceChat` hook (peer connections, PTT, mute, speaking detection)      | ✅      | `web/src/hooks/useVoiceChat.ts` — AudioContext analyser, 100ms poll, −50 dB threshold     |
| 5.4 Client: `VoiceChatProvider` context + `App.tsx` wiring                             | ✅      | `web/src/state/VoiceChatProvider.tsx`; wraps both RoomScreen and GameScreen               |
| 5.5 Client: RoomScreen voice UI (mic button, mode toggle, per-seat speaking ring)      | ✅      | `RoomScreen.tsx` + `RoomScreen.css` — PTT/open modes, green speaking ring                 |
| 5.6 Client: GameScreen voice indicators (mute button in HUD, speaking ring on avatars) | ✅      | `GameScreen.tsx` + `GameScreen.css` — `.game__voice-btn`, `.game__player-wrap--speaking`  |
| 5.7 Testing: manual multi-tab smoke test                                               | ⬜      | Requires microphone; open two tabs, join same room, verify audio + speaking indicators    |
| 5.8 Cross-browser/mobile fixes (iOS autoplay+AudioContext, sampleRate ideal, ICE order) | ✅      | `useVoiceChat.ts` — gesture-based audio unlock, `sampleRate:{ideal}`, ICE queue            |
| 5.9 Robust signaling: Perfect Negotiation + failure recovery (restartIce, watchdog, reconnect rebuild) | ✅ | `useVoiceChat.ts` — fixes intermittent "works sometimes" connects                  |
| 5.10 TURN: Cloudflare Realtime TURN, server-minted short-lived creds via socket ack     | ✅      | `server/src/iceConfig.ts`, `VOICE_ICE_SERVERS` event; env-gated, STUN fallback             |


**Note:** ICE config now served by the server (`voice_ice_servers` ack): STUN always, plus Cloudflare TURN when `CLOUDFLARE_TURN_KEY_ID`/`CLOUDFLARE_TURN_API_TOKEN` are set (free tier 1 TB/mo). Falls back to STUN-only when unset — symmetric/cellular NAT may then fail.

---

## Deferred (out of v1 scope)


| Feature              | Reason                                                           |
| -------------------- | ---------------------------------------------------------------- |
| Offline / LAN mode   | Explicitly deferred; `GameTransport` interface is the hook point |
| Persistent DB / auth | In-memory only for v1                                            |
| Spectator mode       | Not in v1 requirements                                           |
| Replay / history     | Not in v1 requirements                                           |


---

## Quick status summary


| Phase                | Status                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------- |
| Phase 1 — Engine     | ✅ Complete (140 tests)                                                                  |
| Phase 2 — Server     | ✅ Complete (23 tests)                                                                   |
| Phase 3 — Web Client | ✅ Complete (player names wired, all components functional)                              |
| Phase 4 — Polish     | ✅ Complete (animations, mobile polish; deployment user-handled via Render + Cloudflare) |
| Phase 5 — Voice Chat | 🟡 Core + cross-browser fixes + Perfect Negotiation recovery + Cloudflare TURN; smoke test pending |


