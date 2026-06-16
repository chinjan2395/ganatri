# Ganatri — Phasewise Development Plan

Last updated: 2026-06-16 (Phase 6a database foundation: PostgreSQL + Drizzle ORM + Neon selected; packages/db workspace created with schema & migrations)  
All 179 tests passing (153 engine + 26 server).

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
| Calculations/flow/rules reference doc (single source of truth)             | ✅      | `docs/CALCULATIONS.md`         |
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
| Part 2 stalemate redistribution (Clarification #11)                        | ✅      | `game.ts` `redistributeHands` + `resolveCut` trigger; fixes multi-player non-termination |
| `legalMoves` / `legalPart2Cards` helpers                                   | ✅      | `src/game.ts`                  |
| `viewFor(state, playerId)` — redacted `PlayerView`                         | ✅      | `src/view.ts`; includes `removedCount` only |
| `applyMove(state, player, move)` — pure, returns new state + events        | ✅      | `src/game.ts`                  |
| `GameEvent` union (CAPTURED, CUT, TRICK_WON, PLAYER_SAFE, etc.)            | ✅      | `src/types.ts`                 |
| Unit tests: capture options (25 tests)                                     | ✅      | `tests/captureOptions.test.ts` |
| Unit tests: applyMove Part 1 (20 tests)                                    | ✅      | `tests/applyMove.test.ts`      |
| Unit tests: Part 2 full (56 tests)                                         | ✅      | `tests/part2.test.ts`          |
| Unit tests: createGame, viewFor, legalMoves, transitions, smoke (42 tests) | ✅      | `tests/*.test.ts`              |
| Unit tests: stalemate redistribution (12 tests)                            | ✅      | `tests/redistribution.test.ts` |


**Test count: 153 / 153 passing.**

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
| Integration tests: room lifecycle, one-game rule, full game script    | ✅      | `src/handlers.test.ts` (26 tests)   |
| TURN_TIMEOUT event (broadcast on timeout / grace expiry)             | ✅      | Both protocol.ts files; applyAutoMove helper |
| Player name sanitization (XSS protection)                            | ✅      | `sanitizePlayerName()` in handlers.ts; test added |
| Grace expiry broadcast ROOM_UPDATE for non-turn players              | ✅      | gracePeriodExpired() removes non-turn players |
| DRY refactor: applyAutoMove helper (timeout + grace-expired)         | ✅      | Reduces duplication; both paths use helper |
| Trick-reveal freeze duration alignment (2200ms for TRICK_WON)        | ✅      | GameProvider.tsx line 153; matches flash duration |


**Test count: 26 / 26 passing.**

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
| 5.11 Deterministic single-initiator negotiation (no glare) + renegotiate signal + diagnostics | ✅ | `useVoiceChat.ts`; `VOICE_RENEGOTIATE` event. Fixes "some pairs connect, others don't" / one-way audio |


**Note:** ICE config now served by the server (`voice_ice_servers` ack): STUN always, plus Cloudflare TURN when `CLOUDFLARE_TURN_KEY_ID`/`CLOUDFLARE_TURN_API_TOKEN` are set (free tier 1 TB/mo). Falls back to STUN-only when unset — symmetric/cellular NAT may then fail.

---

## Phase 6 — Persistence, Accounts, Statistics & Analytics

**Goal:** Move from purely in-memory server state to a persistent data layer so the game can store user identities, durable game records, per-player statistics, and product analytics — and survive server restarts. This is the largest architectural change since v1: it introduces a database, optional accounts, and several new screens.

This phase is a **planning backlog with embedded decisions** — items marked **🔷 DECISION** must be resolved (with the owner) before the dependent build tasks can be scoped. Recommendations are given inline. Nothing here is started; later we will split this into an executable, sequenced plan.

### Guiding architectural principles

- **Keep the DB behind an interface.** Mirror the existing `GameTransport` abstraction: introduce a `GameStore` / repository interface and make today's in-memory `store.ts` one implementation (`MemoryStore`). The Postgres-backed implementation (`PostgresStore`) plugs in behind the same interface so the engine and handlers never import the DB directly. This preserves the "server delegates, engine is pure" rule.
- **Persistence is additive, not in the hot path.** Game-move validation stays in-memory and synchronous (engine-authoritative). DB writes (game records, events, stats) happen asynchronously / write-through so a slow DB never blocks gameplay.
- **Accounts are optional first.** Guests can still play with no signup; an account only adds durable identity, stats, and history. Avoid forcing auth into the critical path of "create room → play".
- **No PII in analytics.** Analytics events reference opaque user IDs only; display names / emails live in the accounts tables with stricter access.
- **Strict TypeScript end-to-end.** Schema types must be inferred (Drizzle/Prisma) so the DB layer is as type-safe as the engine.

### 6a — Database foundation & infrastructure

| Task | Status | Notes |
| ---- | ------ | ----- |
| 🔷 DECISION: database engine | ✅ | **PostgreSQL chosen** — relational integrity, JSONB for event payloads, strong analytics queries. |
| 🔷 DECISION: ORM / query layer | ✅ | **Drizzle ORM chosen** — TS-first, fully inferred types, lightweight migrations, aligns with "TS strict everywhere". |
| 🔷 DECISION: managed Postgres host | ✅ | **Neon chosen** — serverless, free tier, branching, good latency to Render region. |
| New `packages/db` workspace package | ✅ | Created with schema, migrations, store interface. Importable by server only. |
| Connection pooling | ✅ | Vercel Postgres client handles pooling transparently; no manual config needed for v1. |
| Environment config & secrets | ✅ | `DATABASE_URL` added to `packages/server/.env.example` and `config.ts`; never committed. |
| Migration tooling & workflow | ✅ | Drizzle Kit configured; first migration generated (`0000_initial_schema.sql`). Migrations in `packages/db/drizzle/`. |
| Local dev database | ⬜ | `docker-compose.yml` optional for local dev; Neon dev branch preferred (config later). |
| Migration CI gate | ⬜ | CI/CD integration deferred to Phase 7j (operations hardening). |

### 6b — Data-access layer & schema

| Task | Status | Notes |
| ---- | ------ | ----- |
| Define `GameStore` / repository interface | ⬜ | Methods for sessions, rooms, users, games, events, stats. Mirrors `GameTransport` pattern; all handlers depend on the interface, not a concrete store. |
| Refactor in-memory `store.ts` → `MemoryStore` impl | ⬜ | Today's store becomes one implementation; keeps existing tests green and gives a fast no-DB mode for unit tests. |
| Implement `PostgresStore` | ⬜ | Real persistence behind the same interface; selected via env (`STORE=memory\|postgres`). |
| Schema: `users` | ⬜ | id (uuid), display_name, email (nullable for guests), auth fields, avatar, created_at, last_seen_at, is_guest flag. |
| Schema: `auth_sessions` | ⬜ | Persisted session/refresh tokens replacing today's purely in-memory session UUIDs; expiry, device info, revoked flag. |
| Schema: `rooms` | ⬜ | room_code, host_user_id, status (lobby/playing/done/abandoned), config snapshot, created_at, closed_at. |
| Schema: `games` | ⬜ | room_id, seed, seating order, player_count, config snapshot, started_at, ended_at, duration, outcome summary, winner, abandoned flag. |
| Schema: `game_players` (join) | ⬜ | game_id, user_id (nullable for guests), seat_index, display_name snapshot, final_rank, safe_order, was_cut, captures, result (win/loss/abandon). |
| Schema: `game_events` / move log | ⬜ | game_id, seq, ts, actor_user_id, event type + JSONB payload (mirrors engine `GameEvent`). Granularity decision below. |
| 🔷 DECISION: event-log granularity | ⬜ | Full move-by-move log (enables replay + rich analytics, larger storage) **vs** summary-only (cheaper, no replay). Recommend full log gated behind a flag so it can be disabled. |
| Schema: `player_stats` (aggregate) | ⬜ | user_id, games_played/won/lost/abandoned, sum of finish positions, captures, cuts_given/received, times_safe, total_play_time, rating, streak fields, updated_at. |
| Schema: `analytics_events` | ⬜ | If self-hosting analytics (see 6f): event name, anonymous user id, ts, JSONB props. Otherwise external sink. |
| Indexes, FKs & constraints | ⬜ | Index hot query paths (leaderboard sort, match history by user, events by game+seq); FKs with sensible `ON DELETE` for account deletion. |
| Dev seed / fixtures | ⬜ | Script to populate sample users/games/stats for local UI work. |
| Repository integration tests | ⬜ | Test `PostgresStore` against a real/ephemeral Postgres (testcontainers or Neon branch); keep `MemoryStore` unit-tested. |

### 6c — User accounts & authentication

| Task | Status | Notes |
| ---- | ------ | ----- |
| 🔷 DECISION: account model | ⬜ | **Recommend guest-first with optional upgrade**: every player gets a persistent guest user row keyed by a long-lived client token; signing up "claims" that guest and keeps its stats. Avoids gating play behind auth. |
| 🔷 DECISION: auth method | ⬜ | Options: email + password (own hashing), **passwordless magic link** (no password storage), **Google OAuth** (lowest friction, no password reset flow), or **Supabase Auth** (if Supabase chosen in 6a). Recommend Google OAuth + magic link; avoid storing passwords if possible. |
| Password hashing (if password auth chosen) | ⬜ | Use **argon2id** (or bcrypt) via a vetted library — never custom crypto. Skip entirely if OAuth/magic-link only. |
| Persisted auth sessions / token refresh | ⬜ | Replace ephemeral in-memory session token with DB-backed session + short-lived access + refresh, or signed JWT. Resolves Phase 7e "session token expiry". |
| Wire accounts into existing session flow | ⬜ | `handlers.ts` session issue/restore reads/writes `auth_sessions`; socket reconnect re-validates against DB. |
| Guest → registered upgrade flow | ⬜ | Merge guest user's games/stats into the new account on signup; handle the "already signed in elsewhere" case. |
| Account settings | ⬜ | Edit display name + avatar, link/unlink OAuth, change email, delete account (ties to 6i). |
| Auth brute-force / abuse protection | ⬜ | Rate-limit login/magic-link/OAuth callbacks per IP (extends Phase 7b rate-limiting). |
| Replace ad-hoc name input with account name | ⬜ | When signed in, prefill display name from account; keep manual entry for guests. |

### 6d — Game & event persistence

| Task | Status | Notes |
| ---- | ------ | ----- |
| Persist room lifecycle | ⬜ | Insert on `create_room`; update status on start / finish / abandon / expiry. |
| Persist completed game records | ⬜ | On `GAME_OVER`, write `games` + `game_players` rows (seed, seating, config, duration, rankings). |
| Persist outcomes & rankings | ⬜ | Winner, full finish order, safe order, who was cut, per-player capture counts. |
| Write-through engine event log | ⬜ | Stream engine `GameEvent`s to `game_events` asynchronously; never block `applyMove`. Batch/queue writes. |
| Server-restart recovery | ⬜ | Rehydrate in-progress games from DB on boot so a restart no longer silently drops active games (resolves Phase 7b "server state persistence"). |
| Replay data model & reconstruction | ⬜ | Rebuild a game from `game_events` + seed to power a replay viewer (depends on full-log decision in 6b). |
| Abandonment / forfeit recording | ⬜ | Distinguish completed vs abandoned games so stats don't punish disconnects unfairly (ties to Phase 7b auto-forfeit). |
| Aggregation/backfill job | ⬜ | Job to (re)compute stats from game records — for fixing bugs or onboarding historical data. |

### 6e — Player statistics

| Task | Status | Notes |
| ---- | ------ | ----- |
| 🔷 DECISION: aggregation strategy | ⬜ | **Incremental** (update `player_stats` in a transaction on game-end — fast reads, must be idempotent) **vs batch recompute** (cron over `games`). Recommend incremental with a periodic reconcile job. |
| Core counting stats | ⬜ | Games played/won/lost/abandoned, captures (Part 1), cuts given/received, times safe, time played. |
| Derived metrics | ⬜ | Win rate, average finishing position, longest win streak, current streak. |
| 🔷 DECISION: rating system | ⬜ | Optional skill rating: **ELO** (simple, 1v1-style adapted to multiplayer placement) or **Glicko-2** (handles uncertainty/inactivity). Skip for v1 of this phase if scope is tight. |
| Leaderboard queries | ⬜ | Global + time-windowed (weekly/monthly) + (later) friends; paginated, indexed sort. |
| Stats API endpoints / socket queries | ⬜ | `get_my_stats`, `get_leaderboard`, `get_match_history`; redact other players' private data. |
| Idempotency on replays/recompute | ⬜ | Guard against double-counting if a game-end is processed twice (use game_id uniqueness). |

### 6f — Analytics & telemetry

| Task | Status | Notes |
| ---- | ------ | ----- |
| 🔷 DECISION: self-hosted vs third-party analytics | ⬜ | Self-host in `analytics_events` (full control, no third party, more build) **vs** **PostHog / Plausible** (fast, dashboards out of the box, privacy-friendly). Recommend PostHog (self-host or cloud) for product analytics; keep game-stat aggregates in our own DB. |
| Define event taxonomy | ⬜ | `room_created`, `game_started`, `game_finished`, `game_abandoned`, `player_joined/left`, `turn_timed_out`, `voice_enabled`, `disconnect`, `reconnect`, `signup`, `guest_upgrade`. Stable names + versioned schema. |
| Instrument server-side events | ⬜ | Emit from `handlers.ts` lifecycle points; anonymous user id only, no PII. |
| Instrument key client events | ⬜ | Funnel-critical UI actions (create/join clicked, start clicked) the server can't see. |
| Funnel & product metrics | ⬜ | create → start → finish funnel; abandonment rate; average game duration; players-per-game distribution. |
| Engagement metrics | ⬜ | DAU/MAU, retention (D1/D7), peak concurrent rooms/players, voice-chat adoption rate. |
| Operational metrics | ⬜ | Reconnect rate, turn-timeout frequency, average ICE-connect time / voice failure rate. |
| Privacy-respecting collection | ⬜ | Document what is collected; no display names/emails in events; honor consent (ties to 6i). |

### 6g — Frontend: profiles, stats & leaderboards

| Task | Status | Notes |
| ---- | ------ | ----- |
| Auth screens | ⬜ | Login / signup / "continue as guest", magic-link or OAuth button, password reset (if applicable). |
| Account state in client | ⬜ | Extend `GameProvider` (or a new `AuthProvider`) with signed-in user; persist refresh token; gate account-only UI. |
| Profile page | ⬜ | Avatar, display name, edit settings, link OAuth, delete account. |
| Personal stats dashboard | ⬜ | Win rate, games played, avg finish, streaks, cuts/captures, charts. |
| Match history list + detail | ⬜ | Paginated past games with opponents, result, duration; detail view per game. |
| Replay viewer | ⬜ | Step through a finished game from the event log (depends on 6b/6d full-log decision). |
| Global leaderboard screen | ⬜ | Ranked table with time-window filter; highlight current user. |
| Display-name unification | ⬜ | Use account display name across RoomScreen/GameScreen/EndScreen when signed in. |

### 6h — Admin analytics dashboard

| Task | Status | Notes |
| ---- | ------ | ----- |
| Extend `AdminScreen` with analytics views | ⬜ | Build on existing admin auth (harden first per Phase 7e). |
| Live operations view | ⬜ | Active rooms/games, current concurrent players, in-flight voice sessions. |
| KPI charts | ⬜ | DAU/MAU, games per day, avg duration, abandonment rate, signup conversions. |
| User management | ⬜ | Search users, view stats, ban/suspend, reset/merge accounts. |
| Data export | ⬜ | CSV/JSON export of games/stats for offline analysis. |
| Secure admin data endpoints | ⬜ | All analytics/admin queries behind hardened admin auth + authorization checks. |

### 6i — Privacy, retention & compliance

| Task | Status | Notes |
| ---- | ------ | ----- |
| Privacy policy & consent | ⬜ | Publish a policy; obtain consent for analytics where required; cookie/localStorage disclosure. |
| Data export (right to access) | ⬜ | Let a user download their account data (GDPR/CCPA). |
| Account deletion (right to erasure) | ⬜ | Hard-delete or anonymize user across users/game_players/events/stats; define FK `ON DELETE` behavior. |
| Data retention policies | ⬜ | Purge/anonymize old analytics events and abandoned-room records on a schedule. |
| PII handling & encryption at rest | ⬜ | Encrypt sensitive columns / rely on host encryption; restrict access to email/auth tables. |

### 6j — Operations & hardening

| Task | Status | Notes |
| ---- | ------ | ----- |
| Automated backups & restore drills | ⬜ | Scheduled backups + a tested restore procedure before going live. |
| DB monitoring & alerting | ⬜ | Connection saturation, slow queries, disk usage, error rate. |
| Connection-pool sizing for scale | ⬜ | Coordinate pool size with Phase 7g horizontal scaling (Redis adapter + shared DB). |
| Cost & free-tier monitoring | ⬜ | Watch row/storage/egress limits on chosen host; alert before hitting caps. |
| Performance: query plans & N+1 guards | ⬜ | `EXPLAIN` hot queries (leaderboard, match history, stats); avoid per-row queries in loops. |

> **Cross-phase note:** This phase absorbs and supersedes several Phase 7 (Improvements) items — 7b "Server state persistence" (→ 6a/6d), 7e "Session token expiry" (→ 6c), and the state-store half of 7g "Horizontal scaling / external state store" (→ 6a/6j). Internal sequencing: DB foundation (6a/6b) first, then persistence (6d), then accounts (6c), then stats/analytics/UI (6e–6h), then privacy/ops (6i/6j).
>
> **Prerequisite before starting this phase:** finish the outstanding Phase 5.7 voice multi-tab smoke test, and pull forward the urgent bug/security fixes called out in Phase 7's sequencing note (they should not wait behind this ~70-task epic).

---

## Phase 7 — Improvements & Hardening

**Goal:** Address known gaps in performance, reliability, UX, security, testing, and infrastructure discovered during v1 development. Demoted below the DB phase (was Phase 6) because the database work is foundational and supersedes several items here — but a subset are urgent and should be pulled forward (see below).

> **Sequencing note (2026-06-16):** The database work was promoted ahead of this phase (now Phase 6).
>
> - **Superseded by Phase 6 — do not build standalone:** 7b "Server state persistence" (the DB *is* the persistence), 7e "Session token expiry" (Phase 6c delivers DB-backed sessions), and the external-state-store half of 7g "Horizontal scaling". Building these on the in-memory model now would be throwaway work.
> - **Pull forward — ship before/alongside Phase 6, do NOT wait behind the DB epic:** these are active gameplay/security bugs, not nice-to-haves — 7b "Auto-advance / forfeit on grace expiry" (players currently stuck indefinitely), 7b "Disclose auto-played move on timeout" (looks broken), 7d "Align trick-reveal freeze duration" (board clears before flash finishes), and 7e "Sanitize player names server-side".

### 7a — Performance

| Task | Status | Notes |
| ---- | ------ | ----- |
| Memo-guard `Part1Board` and `Part2Board` with `React.memo` | ⬜ | Re-render on every game state update even when their slice of view hasn't changed |
| Split `GameProvider` context into stable slices | ⬜ | Single `GameContextValue` invalidates all consumers on any state change; split e.g. `view` / `room` / `session` into separate contexts or `useSyncExternalStore` |
| Memoize per-player derived props in `GameScreen` player row | ⬜ | `handCount`, `captureCount`, `isTurn`, `isSafe` etc. recreated every render; prevents `React.memo` on `OpponentSeat` from bailing out on game-state changes |

### 7b — Reliability

| Task | Status | Notes |
| ---- | ------ | ----- |
| Server state persistence (Redis or flat-file snapshot) | ⬜ | **Superseded by Phase 6 (DB)** — do not build a separate snapshot; restart recovery comes from `game_events` rehydration in Phase 6d |
| Auto-advance / forfeit when grace period expires during PLAYING | ✅ | **Pull forward (urgent bug):** auto-plays first legal move on grace expiry during PLAYING; 2 new tests added |
| Disclose auto-played move to players on turn timeout | ✅ | **Pull forward (urgent bug):** TURN_TIMEOUT event broadcasts auto-play; client displays toast with player name |
| Rate-limit `create_room` and `join_room` per IP | ⬜ | Only `make_move` has a debounce; room flood is currently unprotected |
| Clean up WebRTC peer connections when a player goes safe mid-Part-2 | ⬜ | Peers remain connected and consuming resources even after a player empties their hand |

### 7c — Voice / WebRTC

| Task | Status | Notes |
| ---- | ------ | ----- |
| Visual peer-connection state indicator (connecting / connected / failed) | ⬜ | Players have no feedback when ICE negotiation is in progress or has silently failed |
| Handle mic permission revocation mid-game | ⬜ | Permission denied is only caught at startup; OS can revoke it later with no UI feedback |
| Guard TURN credential hand-out near TTL boundary | ⬜ | Cached creds shared across all clients; players joining seconds before expiry may receive already-expired credentials |

### 7d — Game UX

| Task | Status | Notes |
| ---- | ------ | ----- |
| Sound effects (card play, trick won, cut, game over) | ⬜ | Noted in Phase 4 as optional; audio cues reduce need to watch board constantly |
| Persist Part 2 hand reorder across reconnect | ⬜ | `handOrder` is local state; lost on reload / rejoin |
| Align trick-reveal freeze duration with flash animation duration | ✅ | **Pull forward:** TRICK_WON freeze updated to 2200ms to match flash animation duration |
| Prominent winner/loser reveal on end screen | ⬜ | Rankings list is shown but no celebration / commiseration animation differentiates 1st from last |
| Lobby chat or ready-check | ⬜ | Players have no way to coordinate before the host starts the game |

### 7e — Security

| Task | Status | Notes |
| ---- | ------ | ----- |
| Sanitize / validate player names server-side | ✅ | **Pull forward:** server-side sanitization with XSS check (trim, 20-char limit, HTML char strip) on create/join |
| Strengthen admin authentication | ⬜ | Email-only check; add a shared secret or signed token so any email can't spoof admin. (Do before Phase 6h admin analytics dashboard) |
| Session token expiry | ⬜ | **Superseded by Phase 6c (DB-backed sessions)** — UUIDs never expire today; the persisted-session work in Phase 6c resolves this |

### 7f — Testing

| Task | Status | Notes |
| ---- | ------ | ----- |
| Frontend component tests (React Testing Library or Playwright) | ⬜ | Zero frontend tests; React components, UI flows, and `GameProvider` socket handling all untested |
| Server-client integration tests (full socket round-trip) | ⬜ | `handlers.test.ts` mocks transport; no test exercises real socket.io + engine end-to-end |
| Expand Part 2 engine edge-case coverage | ⬜ | Cut-resolution edge cases, simultaneous safe players, and stalemate scenario have thin test coverage |

### 7g — Infrastructure & Code Quality

| Task | Status | Notes |
| ---- | ------ | ----- |
| Health-check endpoint (`/healthz`) | ⬜ | Railway / Render need liveness probe; currently no dedicated endpoint |
| Horizontal scaling path (Redis Socket.io adapter + external state store) | ⬜ | **Partially superseded:** the external state store is Phase 6 (DB); the Redis Socket.io adapter for fan-out across instances still belongs here |
| CDN / cache headers for static assets | ⬜ | Vite bundle served from Node; a CDN (Cloudflare Pages or similar) would cut latency for remote players |
| Split `handlers.ts` into focused modules | ⬜ | 850 lines covering rooms, sessions, game flow, admin, and voice signaling. (Best done as part of the Phase 6 store-interface refactor) |
| Split `useVoiceChat.ts` into composable hooks | ⬜ | 720 lines; ICE/negotiation, speaking detection, mute/PTT, and audio elements each deserve their own hook |

---

## Deferred (out of v1 scope)


| Feature              | Reason                                                                       |
| -------------------- | ---------------------------------------------------------------------------- |
| Offline / LAN mode   | Explicitly deferred; `GameTransport` interface is the hook point             |
| Persistent DB / auth | **Now planned — see Phase 6** (no longer deferred)                           |
| Spectator mode       | Not in v1 requirements                                                        |
| Replay / history     | **Now planned — see Phase 6d/6g** (depends on event-log persistence decision) |


---

## Quick status summary


| Phase                        | Status                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| Phase 1 — Engine             | ✅ Complete (153 tests)                                                                  |
| Phase 2 — Server             | ✅ Complete (26 tests; TURN_TIMEOUT + sanitization + grace expiry broadcast + DRY refactor + freeze fix) |
| Phase 3 — Web Client         | ✅ Complete (player names wired, all components functional)                              |
| Phase 4 — Polish             | ✅ Complete (animations, mobile polish; deployment user-handled via Render + Cloudflare) |
| Phase 5 — Voice Chat         | 🟡 Core + cross-browser fixes + Perfect Negotiation recovery + Cloudflare TURN; smoke test pending |
| Phase 6 — Persistence/DB     | 🟡 6a complete: packages/db + Drizzle + schema + migration; ~63 tasks remain across 6b–6j. |
| Phase 7 — Improvements       | ⬜ Backlog identified; not yet started (27 tasks across 7 sub-phases 7a–7g). Urgent bug/security items flagged "pull forward" |


