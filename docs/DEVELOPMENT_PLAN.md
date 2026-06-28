# Ganatri — Phasewise Development Plan

**Last updated date:** See `docs/LAST_UPDATED.txt`. This file focuses on phase/task status; timestamps are tracked in a separate, low-overhead file to reduce read/write cost in SDK agent workflows.

All 458 tests passing (153 engine + 114 server + 191 db).

---

## Legend

- ✅ Done — shipped and tested
- 🟡 In progress — partially built, uncommitted or not wired end-to-end
- ⬜ Not started

---

## 🔝 Priority TODO (read FIRST every run)

**Nightly protocol — this section overrides phase order:**

- The nightly run reads this section **before** anything else.
- **If the queue is empty** (only the `_(none)_` placeholder sits between the markers): proceed with the normal phase flow — pick the next item from the current phase per `docs/nightly/STATE.md`.
- **If the queue has one or more unchecked `- [ ]` items**: the **top unchecked item** is the single unit of work for this run. It takes priority over the current phase. Implement it, then mark it `- [x]` with a completion date.
- Tackle items **top to bottom, one per run**. Leave finished items checked (with a date) for visibility, or delete them once their PR is merged.
- Each item should be self-contained and reviewable: include a short acceptance criterion and the package/files it touches.

**Current priority: Phase DS-R — Design System Consolidation (HIGH).** Refactor all player screens to consume `@ganatri/ds` only — no design component declared independently in any screen. This phase takes precedence over the normal phase flow; the nightly run should pick up the next ⬜ task from the **Phase DS-R** section below (work `DS-R1 → DS-R14` in order). After Phase DS-R completes: resume remaining Phase 6 work (6i/6j privacy/ops), then Phase 5 voice smoke test, then Phase 9 scoring/progression, then production/deployment follow-ups.

**How to add a priority item:** insert a `- [ ]` line between the two markers below, e.g.
`- [ ] **Fix leaderboard pagination off-by-one** — packages/server handlers.ts; offset should be page*limit. Acceptance: new server test covers page 2.`

<!-- PRIORITY_TODO:START -->
- [ ] **Fix TS18048: `first`/`last` possibly undefined in FindModal** — `packages/web/src/` (find modal component, e.g. `FindModal.tsx`). Acceptance: `tsc --noEmit` reports zero TS18048 errors in the find modal file.
- [x] **Phase 9g: Scoring UI integration** — Wire persisted scoring data into existing screens. LobbyScreen (profile level/XP/rating), HistoryScreen (per-game matchScore/xpEarned/rankedRatingDelta), StatsScreen (lifetime stats: highestMatchScore, totalMatchScore, ghostFinishes). All score data already persists in DB; just wire the reads. Acceptance: responsive, no recomputation, 458 tests pass. (done 2026-06-26 — LobbyScreen progression block complete; HistoryScreen + StatsScreen already display scoring data per task description)
- [x] **Remove hint text and disable text selection in in-hand card area** — `packages/web/src/screens/GameScreen.tsx` (or equivalent game-screen component) + its CSS. Acceptance: no "Waiting for players" or similar hint strings appear inside the hand card section, and tapping/clicking a card never triggers browser text-selection (add `user-select: none` to the hand container). (done 2026-06-22)
- [x] **Phase 8a: DB layer — co-player query + user_blocks schema** — `packages/db` (schema.ts, new migration `0003_user_blocks.sql`, persistence/types.ts, persistence/pg.ts, persistence/memory.ts, tests/). Add `user_blocks` table (blockerId+blockedId composite PK, FK→users, index on blockedId). Add to `GamePersistence`: `getFrequentCoPlayers(userId, limit?)`, `blockUser`, `unblockUser`, `getBlockedUserIds`, `isBlocked`. Implement in both Pg+Memory impls. Acceptance: drift-guard updated; ~10 new contract tests; all 133 existing db tests pass. (done 2026-06-22)
- [x] **Phase 8b: Server — get_recent_players event** — `packages/server` (protocol.ts, handlers.ts, test file). Add `GET_RECENT_PLAYERS` event + `CoPlayerView`/`GetRecentPlayersAck` types. Handler: NOT_LOGGED_IN guard, call `getFrequentCoPlayers`, enrich each entry with `isOnline` (check `store.playerIndex` → live socketId). Acceptance: 3 new server tests (guest→NOT_LOGGED_IN, no-persistence→UNAVAILABLE, happy path with isOnline); 63→66 server tests.
- [x] **Phase 8c: Server — invitation system** — `packages/server` (protocol.ts, handlers.ts, store.ts, new invites.ts). In-memory `pendingInvites` map. Events: `INVITE_PLAYER`, `RESPOND_TO_INVITE`, `BLOCK_USER`, `UNBLOCK_USER` (C→S) + `INVITE_RECEIVED`, `INVITE_ACCEPTED`, `INVITE_REJECTED`, `INVITE_CANCELLED` (S→C push). `handleInvitePlayer`: auth-guard, auto-create room if inviter has none, isBlocked check, OFFLINE/UNAVAILABLE/ALREADY_IN_ROOM guards, 60s expiry timer, emit INVITE_RECEIVED. `handleRespondToInvite`: accept→auto-join room+emit INVITE_ACCEPTED, reject→emit INVITE_REJECTED, block→persist blockUser. Cancel invites when inviter leaves room. Acceptance: ~8 new tests; 66→~74 server tests.
- [x] **Phase 8d: Web — protocol mirror + socket helpers** — `packages/web/src/protocol.ts`, `packages/web/src/net/socket.ts`. Mirror all new event constants + payload types. Add helpers: `requestRecentPlayers()`, `invitePlayer(targetUserId)`, `respondToInvite(roomCode, accept, block?)`, `blockUser(userId)`, `unblockUser(userId)`. Acceptance: build green.
- [x] **Phase 8e: Web — GameProvider wiring** (done 2026-06-22) — `packages/web/src/state/GameProvider.tsx`. New state: `recentPlayers: CoPlayerView[]`, `pendingInvite: InviteReceivedPayload | null`. Listen for INVITE_RECEIVED/INVITE_CANCELLED. Expose all new actions in GameContextValue. Auto-fetch recentPlayers when account transitions to logged-in. Acceptance: build green.
- [x] **Phase 8f: LobbyScreen redesign — Recently Played section** — `packages/web/src/screens/LobbyScreen.tsx` + `.css`. Add "Recently Played" section below create/join. Logged-out: greyed-out placeholder cards with lock overlay. Logged-in loading: skeleton pulse. Logged-in empty: "No games played yet" message. Logged-in populated: player cards with avatar, name, games-together count, green online dot, Invite button (online only; auto-creates room; transitions to RoomScreen on ack). CSS: `.recently-played`, `.rp__card`, `.rp__avatar`, `.rp__online-dot`, `.rp__invite-btn`, `.rp__disabled-overlay`. Acceptance: build green; responsive on mobile. (done 2026-06-22)
- [x] **Phase 8g: Invite notification overlay** — new `packages/web/src/components/InviteToast.tsx` + `.css`, mount in `App.tsx`. Shows when `pendingInvite != null` from context, over any screen. Displays inviter avatar+name, Accept/Reject/Block buttons, 60s countdown ring auto-dismiss. Accept→respondToInvite(true)→join room→RoomScreen. Reject→respondToInvite(false). Block→respondToInvite(false, true)+brief "User blocked" confirmation. Acceptance: build green; overlay works from all screens. (done 2026-06-22)
- [x] **Phase 8h: Block/Unblock management UI + get_blocked_users server event** (done 2026-06-22) — Server: `GET_BLOCKED_USERS` event+handler (auth-gated, returns `{ ok: true, users: BlockedUserView[] }`). Web: socket helper `getBlockedUsers()`. LobbyScreen account section: "Blocked Users" expandable panel listing blocked users with Unblock button per row; empty state "No blocked users." Acceptance: build green; block persists across page reload.
- [x] **Persist session across page reload** — `packages/web/src/net/socket.ts` (store/restore session token in localStorage), `packages/server/src/handlers.ts` (accept existing token on reconnect). Acceptance: after a hard page reload the user's guest or logged-in session is automatically restored and they land back in the lobby (or active game) without re-entering a name or room code. (done 2026-06-22)
- [x] **Update user profile logo in game session too** — `packages/web`. Acceptance: Update user profile logo in game session too. It should show google profile icon if user is logged in via google. (done 2026-06-21)
- [x] **Update "Log in with Google" button logo on homepage** — `packages/web/src/LobbyScreen.tsx` (and any Google icon asset or inline SVG it references). Acceptance: The "Log in with Google" button in the lobby displays the new/correct logo. (done 2026-06-21)
<!-- PRIORITY_TODO:END -->

---

## Phase DS-R — Design System Consolidation (CURRENT PRIORITY)

**Goal:** Every player-facing screen becomes a thin shell that wires data into `@ganatri/ds` components. No design component (button, input, card, badge, icon, nav, modal, profile card, row, etc.) is declared independently in any screen. All visual styling lives in DS component CSS modules; screen `.css` files keep only page layout/positioning. **Admin pages (`packages/web/src/admin`) are explicitly out of scope.**

**Per-task conventions:** New DS components live in `packages/ds/src/components/<Name>/` as a folder of `<Name>.tsx` (explicit `export interface Ds<Name>Props`, `ds-<name>` root class, `type="button"` on buttons), `<Name>.css` (token CSS vars — `--gold`, `--panel`, `--text`, etc.; no hard-coded palette where a token exists), `<Name>.stories.tsx` (default + key variants), and `index.ts`; then export from `packages/ds/src/index.ts`. Reuse existing primitives (`DsButton`, `DsCard`, `DsBadge`, `DsField`, `DsTabs`, `DsStat`, `DsAlert`, `FooterBar`, `FeltBackdrop`, `CornerDecor`). Screen migrations import from `@ganatri/ds`, delete local sub-components / inline `<svg>`, map data→props, and move migrated styling into the DS component CSS. Harvest SVG path data + CSS from the screens being replaced. **Every task acceptance:** build + lint (incl. the screens-must-use-DS ESLint gate from commit `ff29862`) green, Storybook stories render, all 458 tests still pass (UI-only change), desktop (≥900px) + mobile parity for screen migrations.

Work `DS-R1 → DS-R14` in order — DS-R1–R5 build the missing components, DS-R6–R13 migrate screens, DS-R14 enforces. DS-R6 (Leaderboard) is the canonical first migration: if DS-R1–R5 miss a shared pattern, add a follow-up component task before continuing.

| Task | Status | Notes |
| ---- | ------ | ----- |
| DS-R1: Foundational primitives — `DsIcon`, `DsAvatar`, `DsSpinner`, `DsEmptyState` | ✅ | `DsIcon` = one component, `name` union centralizing every inline SVG (`home, history, stats, leaderboard, trophy, profile, back, crown, medal, flourish, bell, gear, gift, people, person, share, plus, copy, mic, mic-off, speaker, settings, exit, close, check`; `medal` takes rank/tone for gold/silver/bronze). `DsAvatar` = image-with-initials-fallback. `DsSpinner`/`DsEmptyState` replace `.spinner`/`.muted`/`card-surface lb__message`. All four exported from `packages/ds/src/index.ts`; stories + CSS; 458 tests still pass. |
| DS-R2: `DsModal` + `DsTitleBlock` | ⬜ | `DsModal` = overlay/dialog shell (backdrop, panel, title, close) backing Lobby `ProfilePanel`/`HowToPlayModal` + EndScreen. `DsTitleBlock` = decorative title (flourish + heading + optional crown). |
| DS-R3: Navigation — `DsTopNav`, `DsBottomNav`, `DsScreenHeader` | ⬜ | Desktop top nav (ref `LeaderboardHeader` desktop branch), mobile tab bar (ref `LeaderboardBottomNav`), mobile header (back + `DsTitleBlock` + trailing slot). Consume DS-R1. |
| DS-R4: Profile — `DsProfileCard`/`DsProfileSidebar`/`DsProfileStrip` | ⬜ | Avatar + name + id + stat pairs + nav buttons (ref `LeaderboardProfileSidebar`); compact strip for History/Stats mobile. |
| DS-R5: Data rows — `DsRankRow`, `DsStatCard`, `DsSummaryBar`, `DsHistoryRow`, `DsSessionRow`, `DsPlayTimeBar`, `DsPlaceholder` | ⬜ | `DsRankRow` (ref `LeaderboardRow` + `.lb__row*`, optional framer-motion props), `DsStatCard` (bordered icon+label+value+delta, distinct from `DsStat`), plus History/Stats/Sessions row + placeholder patterns. |
| DS-R6: Migrate `LeaderboardScreen` (canonical) | ⬜ | `LeaderboardScreen.tsx` + `.css`. Replace `MedalIcon`/`TitleFlourish`/`CrownIcon`/`LeaderboardRow`/`LeaderboardHeader`/`LeaderboardProfileSidebar`/`LeaderboardBottomNav` with DS-R1–R5; strip CSS into DS. Validates DS-R1–R5 coverage. |
| DS-R7: Migrate `HistoryScreen` | ⬜ | Replace `TitleFlourish`/`CrownIcon`/`HistoryHeader`/`HistoryProfileSidebar`/`MobileProfileStrip`/`HistoryBottomNav`/`SummaryBar`/`HistoryRow` with DS components. |
| DS-R8: Migrate `StatsScreen` | ⬜ | Replace `StatIcon`/`StatCard`/`StatsHeader`/`StatsProfileSidebar`/`StatsBottomNav`/`PlayTimeBar`/`*Placeholder`/`RecentResults` with `DsStatCard`/`DsPlayTimeBar`/`DsPlaceholder`/nav/profile. |
| DS-R9: Migrate `SessionsScreen` | ⬜ | Replace `SessionsHeader`/`SessionRow` + raw header/back/badge/action markup with `DsScreenHeader`/`DsSessionRow`/`DsBadge`/`DsButton`/`DsIcon`. |
| DS-R10: Migrate `LobbyScreen` (largest) | ⬜ | `LobbyHeader`→`DsTopNav`; create/join→`DsField`+`DsButton`; dividers→`DsDivider` (add if missing); `ProfilePanel`/`HowToPlayModal`→`DsModal`; `MobileBottomNav`→`DsBottomNav`; `QuickActions`/`RecentlyPlayed`/`DesktopSidebar`→`DsCard`/`DsListRow`/`DsAvatar`/`DsButton`; icons→`DsIcon`. Preserve all state/handlers (create/join/rejoin/Google login/blocked-users). |
| DS-R11: Migrate `EndScreen` | ⬜ | `components/EndScreen.tsx` + `.css`. `DsModal`/`DsCard` shell, rankings via `DsRankRow`/`DsListRow`, buttons via `DsButton`, trophy/winner via `DsIcon`/`DsAvatar`. Keep `playerNames` wiring. |
| DS-R12: Finalize `RoomScreen` (purge leftover raw elements) | ⬜ | `room__start-btn`/mobile `room__action-btn`/`room__leave-btn`→`DsButton`(+`DsIcon`), player-badge + share/invite svgs→`DsIcon`, `room__error`→`DsAlert`. No inline `<svg>` or styled `<button>` left. |
| DS-R13: Finalize `GameScreen` | ⬜ | HUD phase/scoreboard pills→`DsBadge`/`DsCard`, voice icon/mode buttons→`DsButton`+`DsIcon`, leave→`DsButton`, loading→`DsSpinner`. Leave game-specific components (`Card`/`Hand`/`Part1Board`/`Part2Board`/`OpponentSeat`/`CapturedPile`/`TurnTimer`/`CutAnimation`) as-is. |
| DS-R14: Enforcement & cleanup | ⬜ | Extend the screens-must-use-DS ESLint gate to cover every migrated screen; grep `packages/web/src/screens` + `components/EndScreen.tsx` for residual raw design (inline `<svg`, `className="...btn"`, `<input`, `style={{`). Update plan status icons, `docs/LAST_UPDATED.txt`, test-count summary. |

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
| DB write-through integration tests (full game + abandonment)         | ✅      | `src/persistence.test.ts` (2 tests); injects `MemoryPersistence` via `__setPersistenceForTests` |
| `update_display_name` socket event — update logged-in user's display name | ✅  | `protocol.ts` + `handlers.ts` + `account.test.ts` (3 tests); NOT_LOGGED_IN/INVALID_NAME/UNAVAILABLE guards; re-emits SESSION on success |
| Admin secret check (`ADMIN_SECRET` env var)                          | ✅      | `isValidAdminSecret` in `config.ts` (reads env at call time); `AdminAuthPayload.secret?`; combined email+secret guard in handler; 4 tests in `admin.test.ts` |
| `admin_get_stats` live ops endpoint                                   | ✅      | Returns totalRooms/lobbyRooms/activeGames/completedRooms/connectedPlayers/totalSessions; 3 tests in admin.test.ts |
| `name?` in `SessionPayload` (guest display name on reconnect)         | ✅      | `protocol.ts` + `sessionPayload()` in `handlers.ts`; SESSION now includes `name` for guests when set |
| Clear stale `roomCode` in `handleReconnect` when room is gone         | ✅      | `handlers.ts` `handleReconnect`: reordered `getRoom` before `socket.join`; clears `roomCode` via `updateSession` when room undefined |
| `get_blocked_users` socket event + handler                            | ✅      | `BlockedUserView`/`GetBlockedUsersAck` in `protocol.ts`; `GET_BLOCKED_USERS` in `EVENTS`; `handleGetBlockedUsers` in `handlers.ts` (NOT_LOGGED_IN/UNAVAILABLE guards); 3 tests in `blocked-users.test.ts` |


**Test count: 114 / 114 passing.**

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
| Lobby: casino-themed visual redesign — `LobbyHeader`, `CreateJoinPanel`, `QuickActions`, `RecentlyPlayed` (mobile rows + desktop cards), `DesktopSidebar`, `MobileBottomNav`, `ProfilePanel`, `HowToPlayModal` | ✅ | Full rewrite of `LobbyScreen.tsx` + `LobbyScreen.css`; mobile-first 900px breakpoint; all state/handlers preserved; build green. |
| Lobby: rejoin prompt when `ALREADY_IN_GAME`                                                                                                                                                     | ✅      | `LobbyScreen.tsx`                                                                                                                   |
| `RoomScreen` — waiting room, player list, start button                                                                                                                                          | ✅      | `src/screens/RoomScreen.tsx`                                                                                                        |
| RoomScreen: show player names (not shortId)                                                                                                                                                     | ✅      | Uses `playerNames` from context; fallback to `shortId(pid)`                                                                         |
| RoomScreen: responsive casino redesign — `RoomHeaderMobile` (sticky, back/copy/menu), `RoomHeaderDesktop` (logo + ROOM XXXX + settings/exit), `OvalTable` (circular avatar seats with YOU glow + host crown + speaking ring), `VoiceChatPanel` (desktop participant grid + mobile controls), `ActivityPanel` (ACTIVITY/CHAT tabs + join/leave log), `RoomDetailsSidebar` (desktop left: room code/mode/host/voice rows + copy+share buttons), `FriendsOnlineSidebar` (desktop right: online friends + recent opponents + Invite rows), elapsed timer, 4-pip player count, mobile action row (Invite Friends / Share Link), waiting status block, Leave Room danger button, host footer | ✅ | Full rewrite of `RoomScreen.tsx` + `RoomScreen.css`; mobile-first 900px breakpoint; `useIsDesktop` hook; `playerAvatarUrls` from context; build green (0 TS errors). |
| RoomScreen: desktop layout restructure (ref mockup steps 1–3) — header flip, bottom dock (Activity + Voice), slim status bar, left col details-only | ✅ | `RoomScreen.tsx` + `RoomScreen.css`; desktop-only; mobile unchanged; build green. |
| RoomScreen: desktop polish (ref mockup steps 4–7) — table gold rim + dealer chip, voice PTT controls, sidebar/details polish, footer decoration asset | ✅ | Gold oval table, dealer D chip, crown reposition, desktop PTT + mic badges, details icons/host avatar/button hierarchy, invite gold rings, felt bg + CSS footer decor; build green. |
| `GameScreen` — top bar, table stage, sidebar                                                                                                                                                    | ✅      | `src/screens/GameScreen.tsx`                                                                                                        |
| GameScreen flat-table redesign — opponents top row (turn order), flat full-width board, own seat above hand                                                                                     | ✅      | Replaced oval `.table-felt`/rim seats with `.game__players` + `.game__board`; `Boards.css` `.table-center` → `.game__board`         |
| GameScreen full-bleed felt + floating-avatar restyle — felt on `.game`, de-framed `.game__board`, all players (you centred) as borderless floating avatars in one row, OpponentSeat status line | ✅      | `orderedOpponents` → `orderedPlayers` (you at centre); removed `.game__you-seat`; `OpponentSeat` name/avatar/status/chips, no panel |
| GameScreen: show player names in flash messages and turn indicator                                                                                                                              | ✅      | Wired `playerNames` from context; `nameFor` helper at line 140                                                                      |
| `AdminScreen` — Admin Control Center shell (auth, 11-page nav, dashboard, user mgmt, settings, export)                                                                                                                                                      | ✅      | `src/screens/AdminScreen.tsx` + `src/admin/`                                                                                                       |


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
| Connection pooling | ✅ | node-postgres (`pg`) `Pool` reading `DATABASE_URL` (host-agnostic: Neon/Railway/local). `@vercel/postgres` removed. Lazy singleton in `db.ts`; `closeDb()` ends the pool. |
| Environment config & secrets | ✅ | `DATABASE_URL` added to `packages/server/.env.example` and `config.ts`; never committed. |
| Migration tooling & workflow | ✅ | Drizzle Kit (`0.22`) configured; migration **regenerated** to fix enum drift (now `0000_flippant_sleeper.sql`, correct `game_event_type` enum + text `seed`). Drift-guard test in `schema.test.ts`. Migrations in `packages/db/drizzle/`. |
| Local dev database | ⬜ | `docker-compose.yml` optional for local dev; Neon dev branch preferred (config later). |
| Migration CI gate | ⬜ | CI/CD integration deferred to Phase 7j (operations hardening). |

### 6b — Data-access layer & schema

| Task | Status | Notes |
| ---- | ------ | ----- |
| Define `GameStore` / repository interface | ✅ | Built as the **durable** `GamePersistence` interface (`packages/db/src/persistence/types.ts`) — users, rooms, games, events, stats, recovery reads. Intentionally split from the server's transient runtime store (`store.ts` `GameStore`, kept for socket-ids/timers). Ready-to-wire; not yet injected into `handlers.ts` (Phase 6d). |
| Refactor in-memory `store.ts` → `MemoryStore` impl | ⬜ | Server's runtime store refactor still pending. **Note:** `MemoryPersistence` (durable-shape, `persistence/memory.ts`) now exists as a no-DB unit-test/runtime mode for the persistence layer — distinct from this server `MemoryStore` work. |
| Implement `PostgresStore` | ✅ | `PgPersistence` (`persistence/pg.ts`, alias `PostgresStore`); injected Drizzle db. Selected via `createPersistence(getDb())` (Postgres when `DATABASE_URL` set, else `MemoryPersistence`). |
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
| Repository integration tests | ✅ | 69 tests in `packages/db/tests/` against **PGlite** (real Postgres-in-WASM, no Docker), applying the real generated migration DDL. Covers schema/enum-drift, db client, users, rooms, games, events ((game_id,seq) unique + real engine CUT/GAME_OVER payload round-trip), `recordGameFinished` idempotency on (game_id,seat_index), deterministic multi-game `loadActiveGames` ordering, stats, recovery, pure mappers, and a shared contract suite run against both `PgPersistence` and `MemoryPersistence`. |

### 6c — User accounts & authentication

| Task | Status | Notes |
| ---- | ------ | ----- |
| 🔷 DECISION: account model | ⬜ | **Recommend guest-first with optional upgrade**: every player gets a persistent guest user row keyed by a long-lived client token; signing up "claims" that guest and keeps its stats. Avoids gating play behind auth. |
| 🔷 DECISION: auth method | ✅ | **Google OAuth chosen** (lowest friction, no password storage). Implemented server-side in `server/src/auth/oauth.ts` via `google-auth-library`; optional + env-gated (`isOAuthEnabled()`), guests unaffected. Magic link not pursued. |
| Password hashing (if password auth chosen) | ✅ | N/A — OAuth-only, no passwords stored. Skipped by design. |
| Persisted auth sessions / token refresh | ✅ | DB-backed opaque session token (sha-256 hashed, `auth_sessions` row, `SESSION_TTL_DAYS=30` default) issued on OAuth callback, stored in an httpOnly `ganatri_session` cookie. No JWT/refresh — single durable opaque token per login. Resolves Phase 7e "session token expiry". |
| Wire accounts into existing session flow | ✅ | Socket `io.use` middleware (`server/src/auth/sessionMiddleware.ts`) resolves the cookie → `getAuthSessionByTokenHash` → `socket.data.userId/account` + `authSessionId`; `touchAuthSession` extends expiry on connect and throttled socket activity; `handlers.ts` `issueNewSession`/`bindAccount` bind a durable `playerId === users.id` for logged-in users (random uuid for guests) and emit account fields in `SESSION` (guests get `guestToken`, logged-in users rely on httpOnly cookie). Reconnect path preserved. HTTP routes `GET /auth/google/login|callback|logout` + `POST /auth/bootstrap` in `createApp.ts`. |
| Guest → registered upgrade flow | ✅ | `mergeGuestIntoUser` in both Pg+Memory impls; OAuth callback reads `ganatri_guest` cookie and calls merge (non-fatal). `loginWithGoogle()` passes `?session_token=<token>`. |
| Account settings | 🟡 | Edit display name + avatar, link/unlink OAuth, change email, delete account (ties to 6i). Display-name edit + active session management now complete (server + web). Avatar/link/unlink remain. |
| Active session management — DB | ✅ | `auth_sessions.last_seen_at` + migration `0006_auth_session_last_seen.sql`; `getAuthSessionByTokenHash`, `touchAuthSession`, `listAuthSessions`, `revokeAuthSessionById`, `revokeOtherAuthSessions` in Pg + Memory; schema drift + auth contract tests. DB: 186→191. |
| Active session management — server | ✅ | `GET_AUTH_SESSIONS`/`REVOKE_AUTH_SESSION`/`REVOKE_OTHER_AUTH_SESSIONS` socket handlers; sliding expiry via `touchAuthSession`; OAuth callback sets httpOnly cookie (no `auth_token` URL param); `POST /auth/bootstrap`; `guestToken` in SESSION for guests. Server: 102→108 (`auth-sessions.test.ts`, `oauth-callback.test.ts`). |
| Active session management — web | ✅ | `SessionsScreen` (+ CSS): list devices, revoke one, sign out others, log out current; `bootstrapAuth()` before socket connect; protocol/socket helpers; LobbyScreen link; `screen: 'sessions'` routing. |
| Display-name edit — server + DB | ✅ | `updateUserDisplayName` in `GamePersistence` (Pg + Memory); `update_display_name` socket event handler in `handlers.ts` with NOT_LOGGED_IN/INVALID_NAME/UNAVAILABLE guards; re-emits SESSION on success; +3 tests in `account.test.ts`. |
| Display-name edit — web client | ✅ | Inline editor on LobbyScreen; `UPDATE_DISPLAY_NAME` event + `UpdateDisplayNamePayload/Ack` in protocol.ts; `updateDisplayName` in socket.ts + GameProvider. |
| Auth brute-force / abuse protection | ⬜ | Rate-limit login/magic-link/OAuth callbacks per IP (extends Phase 7b rate-limiting). |
| Replace ad-hoc name input with account name | ⬜ | When signed in, prefill display name from account; keep manual entry for guests. |

### 6d — Game & event persistence

| Task | Status | Notes |
| ---- | ------ | ----- |
| Persist room lifecycle | ✅ | Wired in `server/src/persistence.ts` + `handlers.ts`. `rooms` row written when a game **starts** (status PLAYING), not at lobby creation (scope decision); `updateRoomStatus` → DONE on finish / ABANDONED on abandon. |
| Persist completed game records | ✅ | On `GAME_OVER`, `recordGameEnd` writes `games` (seed, seating, duration, winner) + `game_players` rows via `mappers.mapFinalPlayers`. Async write-through; never blocks `applyMove`. |
| Persist outcomes & rankings | ✅ | Winner (`mapWinner`), 1-based final ranks, was-cut, per-player capture counts persisted into `game_players`; safe order + cuts feed `player_stats`. |
| Write-through engine event log | ✅ | `recordEvents` streams `GameEvent`s to `game_events` async (fire-and-forget); per-room running `seq` counter; batched via `appendGameEvents`. A per-room gameId-promise gates event/finish writes behind the game-start write, closing the start→move race. |
| Server-restart recovery | ✅ | `rehydrateFromDb()` in `recovery.ts` replays event log through engine on startup, creates ghost sessions (socketId=null) for all players, restores persistence bookkeeping maps, starts grace-period timers. Ghost adoption in `handlers.ts` matches reconnecting clients by playerId (cookie for OAuth, localStorage for guests). Web: playerId stored in localStorage, sent in handshake auth. 5 integration tests. |
| Replay data model & reconstruction | ⬜ | Rebuild a game from `game_events` + seed to power a replay viewer (depends on full-log decision in 6b). |
| Abandonment / forfeit recording | ✅ | `recordGameEnd(..., isAbandoned=true)` from `gracePeriodExpired` and the PLAYING branch of `silentLeaveRoom` when <2 players remain; sets `games.is_abandoned` + `rooms.status=ABANDONED` and increments `gamesAbandoned`. |
| Aggregation/backfill job | ⬜ | Job to (re)compute stats from game records — for fixing bugs or onboarding historical data. |

### 6e — Player statistics

| Task | Status | Notes |
| ---- | ------ | ----- |
| 🔷 DECISION: aggregation strategy | ✅ | **Incremental chosen.** `recordGameEnd` upserts `player_stats` per player on game-end via `upsertPlayerStats` (increment deltas); idempotent per room (gameId-promise consumed on first call). Periodic reconcile job still TODO. |
| Core counting stats | ✅ | Games played/won/lost/abandoned, captures (Part 1), cuts given/received, times safe, total play time all written per game-end in `server/src/persistence.ts`. |
| Derived metrics | ✅ | Win/longest streaks computed best-effort (`getPlayerStats` → set `currentWinStreak`/`longestWinStreak`). Win rate derived server-side in `get_my_stats` (`gamesWon/gamesPlayed`, 0-guarded). Average finishing position: `sum_finish_positions` column added + migration `0002_add_sum_finish_positions.sql`; `avgFinish = sumFinishPositions / gamesPlayed` (0-guarded) in `PlayerStatsView` via `mapStatsView`; `writePlayerStats` contributes `player.finalRank` (0 when abandoned); mirrored in web `protocol.ts` + displayed in `StatsScreen`. |
| 🔷 DECISION: rating system | ⬜ | Optional skill rating: **ELO** (simple, 1v1-style adapted to multiplayer placement) or **Glicko-2** (handles uncertainty/inactivity). Skip for v1 of this phase if scope is tight. |
| Leaderboard queries | ✅ | Global leaderboard shipped: `GamePersistence.getLeaderboard(limit=20, offset=0)` (Pg + Memory), inner-joins `users` (excludes guests + zero-games), orders `gamesWon DESC, winRate DESC, gamesPlayed DESC, userId ASC`, paginated; winRate derived in JS (0-guarded). Exposed via the PUBLIC `get_leaderboard` socket event. `getMyLeaderboardRank(userId)` added (CTE+ROW_NUMBER in Pg, sort+findIndex in Memory); `myEntry?` in `GetLeaderboardAck` so logged-in users outside top 20 see their rank. **Time-windowed boards now shipped** (`timeWindow?: 'week' | 'month'` on both methods; Pg path uses CTE joining `game_players+games+users` filtered by `ended_at >= cutoff`; Memory path uses `aggregateWindowed(cutoff)` helper; server `handleGetLeaderboard` passes `req.timeWindow` through; +10 db contract tests + 2 server tests). Web UI tab switcher already shipped. Friends boards still TODO. No index added (fine at current scale). |
| Stats API endpoints / socket queries | 🟡 | `REQUEST_HISTORY` socket event added (`handlers.ts` `handleRequestHistory` → `getUserGameHistory`): logged-in account → `{ok:true, games}`; guest → `NOT_LOGGED_IN`; no persistence → `UNAVAILABLE`. Ack flattens the DB's nested entry → the web wire shape (top-level fields + ISO timestamps) via `flattenHistoryEntry`; contract test guards the shape. **`get_my_stats` now shipped** (`handleGetMyStats` → `getPlayerStats` → flat `PlayerStatsView` with derived `winRate`; same guard semantics; null-row → zeroed view; 4 tests in `stats.test.ts`). **`get_leaderboard` now shipped** (PUBLIC — no session gate; `handleGetLeaderboard` → `getLeaderboard` → `LeaderboardEntryView[]` with 1-based `rank`; only failure is no-persistence → `UNAVAILABLE`; 3 tests in `leaderboard.test.ts`). |
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
| Auth screens | ✅ | Phase C: subtle "Log in with Google" button on `LobbyScreen` when logged out (guest create/join flow stays primary + intact); logged-in shows avatar+displayName+History+Log out. Login/logout are full-page navigations to server `/auth/google/login` & `/auth/logout`. `?login=error` surfaces an inline message and is cleaned from the URL. |
| Account state in client | ✅ | Phase C: `GameProvider` extended with `account:{loggedIn,displayName?,email?,avatarUrl?}` set from the new `SESSION` payload; exposes `requestHistory`/`loginWithGoogle`/`logout` + `screen`/`setScreen` for in-app nav. Cookie-based session (no client-stored refresh token). |
| Profile page | ⬜ | Avatar, display name, edit settings, link OAuth, delete account. |
| Personal stats dashboard | ✅ | New `StatsScreen` (+`StatsScreen.css`) routed via provider `screen` state ('main'\|'history'\|'stats'\|'leaderboard'), reached from Lobby Quick Actions / bottom nav. **Casino shell redesign complete** (2026-06-23): lobby-style root/header/desktop sidebar/mobile bottom nav; 12-card icon stat grid + play time bar; Coming soon placeholders for performance/favorite cards/modes/achievements; Recent Results from `requestHistory()`. Calls `requestMyStats()` on mount; handles loading/`NOT_LOGGED_IN`/`UNAVAILABLE`/empty (0 games). Stat cards: games played, win rate %, avg finish, wins/losses/abandoned, captures, cuts, times safe, streaks. |
| Match history list + detail | ✅ | `HistoryScreen` (+`HistoryScreen.css`) routed via provider `screen` state, reached from Lobby / bottom nav. **Casino shell redesign complete** (2026-06-23): lobby-style root/header/desktop sidebar/mobile bottom nav; summary bar (total games, wins, win rate); unified match list with outcome badges (Won / rank / Abandoned); expandable scorecards per game. Calls `requestHistory()` on mount; handles loading/`NOT_LOGGED_IN`/`UNAVAILABLE`/empty. Server pagination not yet wired. |
| Replay viewer | ⬜ | Step through a finished game from the event log (depends on 6b/6d full-log decision). |
| Global leaderboard screen | ✅ | Web `LeaderboardScreen` (+`.css`) shipped: PUBLIC (guests can view), routed via provider `screen` state ('main'\|'history'\|'stats'\|'leaderboard'), reached from Lobby Quick Actions / sidebar link. **Casino shell redesign complete** (2026-06-23): lobby-style root/header/desktop sidebar/mobile bottom nav; profile sidebar with rank + win%; SVG medals; sticky mobile self-row; timeframe tabs (All Time / This Week / This Month). Calls `requestLeaderboard(timeWindow?)` on mount/tab change; handles loading/`UNAVAILABLE`/empty/ranked-table states. Ranked rows: SVG medal top-3 / `#N`, avatar+fallback, displayName + "(You)", wins, played, win-rate %; current user's row highlighted (`entry.userId === session.playerId`). `myEntry?: LeaderboardEntryView` in ack; `.lb__my-rank` below table on desktop when outside top 20; sticky row on mobile. |
| Display-name unification | ✅ | account.displayName used in RoomScreen/GameScreen/EndScreen when loggedIn. |

### 6h — Admin analytics dashboard

| Task | Status | Notes |
| ---- | ------ | ----- |
| Extend `AdminScreen` with analytics views | ✅ | Full Admin Control Center shell: sidebar (11 nav items), header, footer, dashboard grid with KPI cards + live games table + room donut + server health + games-over-time chart + top players + activity feed. Mock data for metrics without backend; real API overlays on Refresh for connected players / active games / rooms open. |
| Admin layout redesign (Control Center shell) | ✅ | `packages/web/src/admin/` — layout components, 11 navigable pages, branded auth, `mockData.ts`, CSS design system in `AdminScreen.css`. User Management / Settings / Data Exports on dedicated pages with existing socket logic preserved. |
| Settings page redesign (Security-style layout) | ✅ | `SettingsPage.tsx` — `AdminTabs` + 2-column `AdminPanel` grid mirroring `SecurityPage`; slider cards, config snapshot, reference table, save/discard action cards; settings CSS in `AdminScreen.css`. |
| Room Management page redesign | ✅ | `RoomManagementPage.tsx` — 6 KPI cards, searchable room list table with filters/pagination, `RoomDetailsPanel` side panel with players + admin actions; `RoomListTable.tsx`, `RoomDetailsPanel.tsx`; room mock data + stats overlay. |
| Live operations view | ✅ | `admin_get_stats` socket event; 4-tile grid (Connected / Active games / In lobby / Total rooms); 15 s auto-refresh + manual Refresh button; responsive 2-column on mobile. |
| KPI charts | ✅ | Full stack complete. DB: `getAdminKpiStats(windowDays=7)` in `GamePersistence` (Pg raw SQL + Memory impl); 6 contract tests. Server: `ADMIN_GET_KPI_STATS` event + handler (admin-auth gate, UNAVAILABLE guard); 3 integration tests in `admin-kpi.test.ts`. Web: `AdminKpiStats`/`AdminGetKpiStatsAck` types + `GET_KPI_STATS` in `ADMIN_EVENTS`; `KpiSection` component (3 summary tiles + CSS-only bar chart, stacked completed/abandoned bars); `fetchKpi()` on auth + Refresh. |
| User management | ✅ | Full stack complete. DB + server layer: `searchUsers`/`adminGetUserStats` in `GamePersistence` + both impls; `ADMIN_SEARCH_USERS`/`ADMIN_GET_USER_STATS` socket events + handlers (8 integration tests). Web: `UserManagementSection` redesigned — `UserListPanel` + `UserDetailPanel` two-column layout matching mockup; mock list (1,248 users) + live socket search/stats overlay; admin action placeholders; CSS in `AdminScreen.css`. |
| User management page redesign (mockup) | ✅ | `UserListPanel.tsx`, `UserDetailPanel.tsx`, `MOCK_USER_LIST`/`getUserDetail` in `mockData.ts`; pagination, filters, stat grid, copy-to-clipboard, admin actions row. |
| Data export | ✅ | Full stack complete. DB: `ExportGameRow`/`ExportGamePlayer` types + `exportGamesData(limit?)` in `GamePersistence` interface, `PgPersistence` (2-query: games LEFT JOIN rooms ordered newest-first, then game_players by gameIds), `MemoryPersistence` (sort+slice+roomCode lookup); 4 new contract tests (empty + ordering/shape, runs × 2 impls). Server: `ExportGameView`/`ExportGamePlayerView`/`AdminExportDataPayload`/`AdminExportDataAck` types in `protocol.ts`; `ADMIN_EXPORT_DATA='admin_export_data'` in EVENTS; `handleAdminExportData` handler (admin-auth gate, UNAVAILABLE guard, limit clamped to 500); 3 integration tests in `admin-export.test.ts` (NOT_AUTHORIZED / UNAVAILABLE / empty ok). DB: 176→180 tests. Server: 91→94 tests. Web: `ExportGamePlayerView`/`ExportGameView`/`AdminExportDataAck` types + `EXPORT_DATA: 'admin_export_data'` added to `packages/web/src/protocol.ts`; "Data Export" section added to `AdminScreen.tsx` (after User Management, before config sliders) with "Export Games (JSON)" button, Exporting... loading state, inline error message; on success creates a Blob, clicks a hidden `<a download="ganatri-export.json">` link, revokes object URL; `exportLoading`/`exportError` state; `.admin__export-section` + `.admin__export-btn` CSS classes in `AdminScreen.css`. Build green. |
| Secure admin data endpoints | 🟡 | All analytics/admin queries behind hardened admin auth + authorization checks. `admin_get_stats` now requires admin auth; more endpoints forthcoming. |
| `admin_get_stats` live ops endpoint (server) | ✅ | Returns totalRooms/lobbyRooms/activeGames/completedRooms/connectedPlayers/totalSessions; 3 tests in admin.test.ts |

### 6i — Privacy, retention & compliance

| Task | Status | Notes |
| ---- | ------ | ----- |
| Privacy policy & consent | ⬜ | Publish a policy; obtain consent for analytics where required; cookie/localStorage disclosure. |
| Data export (right to access) | ✅ | Full stack complete. Server: `DOWNLOAD_MY_DATA: 'download_my_data'` added to `EVENTS` + `DownloadMyDataAck` type in `packages/server/src/protocol.ts`; `handleDownloadMyData` in `handlers.ts` (NOT_LOGGED_IN/UNAVAILABLE guards, `Promise.all([getUserGameHistory, getPlayerStats])`, flattenHistoryEntry + mapStatsView, null stats row → null in export); 3 integration tests in `download-data.test.ts` (guest→NOT_LOGGED_IN, no-persistence→UNAVAILABLE, happy path acks ok with userId/displayName/email/exportedAt/games/stats). Server tests: 110→113. Web layer also complete: `DOWNLOAD_MY_DATA: 'download_my_data'` added to `EVENTS` + `DownloadMyDataAck` type in `packages/web/src/protocol.ts`; `downloadMyData()` socket helper in `packages/web/src/net/socket.ts`; `GameProvider` gains `downloadMyData` useCallback; `LobbyScreen.tsx` adds "Download My Data" button in logged-in profile panel with Blob download on success + error state. |
| Account deletion (right to erasure) | ✅ | Full stack complete. DB: `deleteUser(userId)` in `GamePersistence` interface, `PgPersistence` (9-step transaction), `MemoryPersistence`; 3 contract test cases × 2 impls = 6 db test runs (180→186). Server: `DeleteAccountAck` type + `DELETE_ACCOUNT` event in `protocol.ts`; `handleDeleteAccount` in `handlers.ts` (NOT_LOGGED_IN/UNAVAILABLE guards, calls deleteUser, converts session to guest, re-emits SESSION); 3 integration tests in `delete-account.test.ts` (94→102 server tests). Web: `delete_account` event + `DeleteAccountAck` type in `packages/web/src/protocol.ts`; `deleteAccount()` socket helper; `GameProvider` callback; `ProfilePanel` danger button + inline confirm flow + error display. |
| Data retention policies | 🟡 | Server-side daily prune job wired (`handlers.ts` `runRetention` → `pruneGameEventsBefore` + `pruneAbandonedGamesBefore`, cutoff `RETENTION_DAYS=30`); runs on startup + every 24h, no-op without persistence. Analytics-event purge still TODO (no analytics table yet). |
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
| Perf/heat fix: only acquire mic / run voice while in a room | ✅ | `useVoiceChat` now takes `enabled` (true when `room` non-null, from `VoiceChatProvider`). No `getUserMedia`/AudioContext/peers in the lobby; full teardown (tracks/peers/detection/ctx-suspend) when leaving a room |
| Perf/heat fix: watchdog exponential backoff + retry cap | ✅ | `useVoiceChat` watchdog now backs off 8s→60s and gives up after 6 attempts (was unbounded 8s re-arm); resets on `connected`. Per-peer `watchdogDelay`/`watchdogAttempts` on `PeerCtx` |
| Perf/heat fix: suspend AudioContext + pause local detection while muted/idle | ✅ | `useVoiceChat` stops local speaking-detection polling when muted/PTT-inactive and suspends the AudioContext when no analysers (local or remote) need it; resumes on unmute/PTT. iOS unlock preserved |

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
| Strengthen admin authentication | ✅ | `AdminAuthPayload { email; secret? }` added to `packages/web/src/protocol.ts`; `AdminScreen` gains password input, passes `secret` in `admin_auth` emit, updates subtitle + error text + button disabled guard. Build green. |
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

## Phase 8 — Social: Recently Played Players & Invitations

**Goal:** Redesign the game home page (LobbyScreen) with two social layers: (1) a "Recently Played" panel showing players you've shared games with, their online status, and an invite button; (2) a WebSocket-based invitation system so online players can receive, accept, reject, or block game invites in real time.

**Priority:** This phase supersedes all other in-progress work (Phase 5 voice smoke test, Phase 6i/6j, Phase 7, deployment). Work sub-phases top-to-bottom, one per nightly run.

### Architecture decisions
- **Auto-create room on invite:** clicking Invite when not in a room triggers server to auto-create one; inviter is moved to RoomScreen.
- **Blocks persisted in DB:** new `user_blocks` table — survives page reload and re-login.
- **One pending invite per user:** second incoming invite overwrites the first (old inviter gets INVITE_CANCELLED).
- **60 s invite expiry:** server arms a timer; client shows countdown ring.
- **Online status = live socketId:** derived in-memory from `store.playerIndex`; no persistent presence layer needed.

### 8a — DB layer

| Task | Status | Notes |
| ---- | ------ | ----- |
| `user_blocks` table (blockerId+blockedId composite PK, FK→users, index on blockedId) | ✅ | `packages/db/src/schema.ts` + migration `0003_user_blocks.sql` |
| Drift-guard test update for new table | ✅ | `packages/db/tests/schema.test.ts` |
| `getFrequentCoPlayers(userId, limit?)` in `GamePersistence` + both impls | ✅ | Query `game_players` self-join; exclude self+guests; order by shared-game count DESC |
| `blockUser / unblockUser / getBlockedUserIds / isBlocked` in `GamePersistence` + both impls | ✅ | Upsert / delete on `user_blocks`; `isBlocked` checks one direction only |
| Contract tests: co-player ordering, self-exclusion, guest-exclusion, zero-games, block idempotency, isBlocked both directions | ✅ | 17 new tests (8 contract × 2 impls + 1 drift-guard); 133→150 db tests, all pass |

### 8b — Server: `get_recent_players`

| Task | Status | Notes |
| ---- | ------ | ----- |
| `GET_RECENT_PLAYERS` event + `CoPlayerView` / `GetRecentPlayersAck` types | ✅ | `packages/server/src/protocol.ts` |
| `handleGetRecentPlayers`: NOT_LOGGED_IN guard, DB fetch, `isOnline` enrichment | ✅ | scans `store.sessions` for `userId != null && socketId != null` |
| 4 server tests (guest, unavailable, online co-player, offline co-player) | ✅ | 63→67 server tests (4 new, all pass) |
| `GET_RECENT_PLAYERS` event + `CoPlayerView` / `GetRecentPlayersAck` types | ⬜ | `packages/server/src/protocol.ts` |
| `handleGetRecentPlayers`: NOT_LOGGED_IN guard, DB fetch, `isOnline` enrichment | ⬜ | `isOnline` = `store.playerIndex` has entry with live `socketId` |
| 3 server tests (guest→NOT_LOGGED_IN, no-persistence→UNAVAILABLE, happy path) | ⬜ | 63→66 server tests |

### 8c — Server: invitation system

| Task | Status | Notes |
| ---- | ------ | ----- |
| `pendingInvites` in-memory map + `InviteState` type | ✅ | Module-level in `handlers.ts`; key `${inviterId}:${inviteeId}` |
| New C→S events: `INVITE_PLAYER`, `RESPOND_TO_INVITE`, `BLOCK_USER`, `UNBLOCK_USER` | ✅ | `protocol.ts` + `EVENTS` map |
| New S→C push events: `INVITE_RECEIVED`, `INVITE_ACCEPTED`, `INVITE_REJECTED`, `INVITE_CANCELLED` | ✅ | `protocol.ts` with full payload types |
| `handleInvitePlayer`: auth-guard, auto-create room, isBlocked, OFFLINE/UNAVAILABLE/ALREADY_IN_ROOM guards, 60s timer, emit INVITE_RECEIVED | ✅ | `handlers.ts` |
| `handleRespondToInvite`: accept→auto-join + INVITE_ACCEPTED, reject→INVITE_REJECTED, block→persist blockUser | ✅ | `handlers.ts` |
| `handleBlockUser` / `handleUnblockUser`: auth-guard, call DB, ack | ✅ | `handlers.ts` |
| Cancel pending invites when inviter leaves/abandons room | ✅ | Added to `silentLeaveRoom` in `handlers.ts` |
| 10 new server tests (guard cases + accept + reject + block + NOT_FOUND) | ✅ | 67→77 server tests, all pass |

### 8d — Web: protocol mirror + socket helpers

| Task | Status | Notes |
| ---- | ------ | ----- |
| Mirror all Phase 8 event constants + payload types | ✅ | `packages/web/src/protocol.ts` — 12 events + 14 types |
| Socket helpers: `requestRecentPlayers`, `invitePlayer`, `respondToInvite`, `blockUser`, `unblockUser` | ✅ | `packages/web/src/net/socket.ts` — build green |

### 8e — Web: GameProvider wiring

| Task | Status | Notes |
| ---- | ------ | ----- |
| `recentPlayers: CoPlayerView[]` + `pendingInvite: InviteReceivedPayload | null` state | ✅ | `GameProvider.tsx` |
| Listen for `INVITE_RECEIVED` / `INVITE_CANCELLED` push events | ✅ | `GameProvider.tsx` |
| Expose all new actions + state in `GameContextValue` | ✅ | `GameProvider.tsx` |
| Auto-fetch `recentPlayers` when `account` transitions to logged-in | ✅ | `GameProvider.tsx` |

### 8f — LobbyScreen redesign: Recently Played section

| Task | Status | Notes |
| ---- | ------ | ----- |
| "Recently Played" section below create/join area | ✅ | `LobbyScreen.tsx` + `LobbyScreen.css` |
| Logged-out: greyed-out placeholder cards with lock overlay | ✅ | 3 placeholder cards with pulse animation and lock icon overlay |
| Logged-in: loading skeletons, empty state, populated grid (max 5, "See more" → 10) | ✅ | Pulse animation on skeleton bars; empty state message; "See all" toggle |
| Player cards: avatar, name, games-together count, green online dot | ✅ | `CoPlayerView` data; initials fallback when no avatarUrl |
| Invite button: online-only, spins in-flight, auto-creates room, transitions to RoomScreen | ✅ | ROOM_UPDATE push navigates automatically; inline error messages per error code |
| CSS: `.recently-played`, `.rp__card`, `.rp__avatar`, `.rp__online-dot`, `.rp__invite-btn`, `.rp__disabled-overlay`, skeleton keyframes | ✅ | Responsive grid: 2col mobile → 3col 480px → 5col 700px |

### 8g — Invite notification overlay

| Task | Status | Notes |
| ---- | ------ | ----- |
| `InviteToast` component: avatar+name, Accept/Reject/Block buttons, 60s countdown ring | ✅ | `packages/web/src/components/InviteToast.tsx` + `.css` |
| Accept → `respondToInvite(true)` → join room → RoomScreen | ✅ | |
| Reject → `respondToInvite(false)` → dismiss | ✅ | |
| Block → `respondToInvite(false, true)` → dismiss + brief "User blocked" confirmation | ✅ | |
| Mount `<InviteToast />` at App root (outside screen routing) | ✅ | `packages/web/src/App.tsx` |

### 8h — Block/Unblock management UI

| Task | Status | Notes |
| ---- | ------ | ----- |
| `GET_BLOCKED_USERS` server event + handler (auth-gated, returns `BlockedUserView[]`) | ✅ | `packages/server/src/protocol.ts` + `handlers.ts`; 3 new tests in `blocked-users.test.ts` |
| `getBlockedUsers()` socket helper in web | ✅ | `packages/web/src/net/socket.ts`; `BlockedUserView`+`GetBlockedUsersAck` types in `protocol.ts`; `GET_BLOCKED_USERS` in `EVENTS`; wired into `GameProvider` |
| "Blocked Users" expandable panel in LobbyScreen account section | ✅ | Lazy-fetch on first open; loading/error/empty/list states; Unblock button removes row on success; CSS classes added |

---

## Phase 9 — Scoring, Rating & XP Progression

**Goal:** Add a server-authoritative scoring system based on [POINTS_SYSTEM.md](/Users/chinjanpatel/Documents/ganatri/docs/POINTS_SYSTEM.md): placement still determines the winner, but each match now also produces (1) a per-match **Match Score**, (2) a persistent **Ranked Rating** delta, and (3) persistent **XP / level progression** for logged-in players.

**Status:** 🟡 In progress — 9a–9g complete; 9h (admin/export/analytics) pending

### Architecture decisions

- **Winner remains engine-defined:** scoring never changes `rankings`; the rules engine still decides who wins and loses.
- **Three separate outputs:** a match produces `matchScore`, `rankedRatingDelta`, and `xpEarned`; they solve different product needs and must not be conflated.
- **Server is authoritative:** clients may preview values in UI, but only the server computes and persists final scoring.
- **Guests may see match score, but only accounts persist progression:** guest sessions should still receive end-screen scoring feedback, but `rankedRating`, `xp`, `level`, and progression history only persist for durable users.
- **Event-log derived where possible:** Part 1/Part 2 scoring should be computed from existing game events / persisted outcome data instead of trusting ad-hoc client state.
- **Ledger before cosmetics:** first ship auditable scoring + progression storage; cosmetics/reward spending can come later without redesigning the scoring core.

### Scoring model summary (from `docs/POINTS_SYSTEM.md`)

#### Ranked Rating

- Placement-only rating change:
  - 2 players: `1st +20`, `2nd -20`
  - 3 players: `1st +24`, `2nd +4`, `3rd -16`
  - 4 players: `1st +28`, `2nd +10`, `3rd -4`, `4th -18`
- Abandon / disconnect-forfeit: extra `-15`
- Never affected by captures, same-rank bonuses, table clears, cuts, ghost bonus, or XP.

#### Match Score

- Part 1:
  - `+1` per captured card
  - `+2` same-rank bonus per move that captured at least one same-rank card
  - `+5` table-clear bonus per move that emptied the table
- Part 2:
  - `+3` per successful cut
- End-of-match placement bonus:
  - 4 players: `1st +30`, `2nd +20`, `3rd +10`, `4th +0`
  - 3 players: `1st +30`, `2nd +20`, `3rd +0`
  - 2 players: `winner +30`, `loser +0`
- Ghost bonus:
  - `+5` when a player captured zero cards in Part 1 and starts Part 2 already safe

#### XP / Level

- `xpEarned = 10 + matchScore`
- `level = floor(sqrt(totalXp / 25)) + 1`

### 9a — Shared domain model and scoring spec

| Task | Status | Notes |
| ---- | ------ | ----- |
| Finalize TS domain types for `MatchScoreBreakdown`, `PlayerProgression`, `RankedRatingChange`, `XpAward`, `ScoreLedgerEntry` | ✅ | Defined in `packages/server/src/protocol.ts` + `packages/web/src/protocol.ts`; `PlayerProgressionView`, `MatchScoringView`, `ScoreBreakdownRowView`, `ScoreHistoryEntryView` |
| Add a scorer-spec doc section or appendix mapping each formula to authoritative inputs | ✅ | Implemented in `packages/server/src/scoring.ts`; formulas from `docs/POINTS_SYSTEM.md` |
| Define canonical scoring reasons / ledger enums | ✅ | `scoreLedgerKindEnum` + `scoreLedgerReasonEnum` in `packages/db/src/schema.ts` (CAPTURE_CARD, SAME_RANK_BONUS, TABLE_CLEAR, CUT, PLACEMENT_BONUS, GHOST_BONUS, RANKED_PLACEMENT, ABANDON_PENALTY, XP_MATCH_BASE, XP_MATCH_SCORE) |
| Decide guest behavior explicitly | ✅ | Guests receive ephemeral `matchScore`/`xpEarned` in end-screen payload; no durable progression rows |

### 9b — DB schema and persistence layer

| Task | Status | Notes |
| ---- | ------ | ----- |
| Add `player_progression` table | ✅ | `packages/db/src/schema.ts` — `rankedRating`, `totalXp`, `level`, `highestMatchScore`, `totalMatchScore`, `ghostFinishes`, `updatedAt` |
| Add `score_ledger` table | ✅ | `packages/db/src/schema.ts` — append-only audit trail with `kind`/`reason`/`delta`/`metaJson` |
| Optional: add per-player scoring snapshot to `game_players` | ✅ | `matchScore`, `xpEarned`, `rankedRatingDelta` persisted in `game_players` |
| Update `packages/db/src/schema.ts` + new migration | ✅ | Migration added; indexes on `user_id`, `game_id`, `(user_id, created_at DESC)` |
| Extend `GamePersistence` interface | ✅ | `getPlayerProgression`, `applyGameScoring`, `listScoreLedger` implemented |
| Implement both Pg + Memory persistence | ✅ | Both impls contract-compatible; one transaction per finished game |
| Add contract tests + drift-guard updates | ✅ | Idempotency, ledger shape, guest no-op, level recomputation covered |

### 9c — Server scoring engine at game end

| Task | Status | Notes |
| ---- | ------ | ----- |
| Add pure server-side scorer module | ✅ | `packages/server/src/scoring.ts` |
| Compute per-player Part 1 score breakdown | ✅ | Captured cards, same-rank moves, table clears from event stream |
| Compute Part 2 bonuses | ✅ | Successful cuts counted from authoritative events |
| Compute placement bonus + ghost bonus | ✅ | Placement from `rankings`; ghost from zero Part 1 captures / safe-from-start |
| Compute Ranked Rating delta | ✅ | Placement table by player-count + abandon penalty |
| Compute XP + resulting level | ✅ | `xpEarned = 10 + matchScore`; level from cumulative XP |
| Persist scoring atomically with game finish | ✅ | Extended finish-write path; `game_players`, `player_stats`, progression, ledger consistent |
| Ensure idempotency on duplicate finish / reconnect flows | ✅ | Guard against double-award in finish path |

### 9d — Server protocol and read endpoints

| Task | Status | Notes |
| ---- | ------ | ----- |
| Extend end-of-game payloads with score breakdown | ✅ | `MatchScoringView[]` in STATE_UPDATE at game end; `matchScore`/`xpEarned`/`rankedRatingDelta` in `game_players` |
| Add `GET_MY_PROGRESSION` socket event | ✅ | `packages/server/src/protocol.ts` + handler; logged-in only; returns `PlayerProgressionView` |
| Add `GET_MY_SCORE_HISTORY` socket event | ✅ | Returns `ScoreHistoryEntryView[]` (ledger-backed) |
| Optionally extend `REQUEST_HISTORY` response | ✅ | `GameHistoryEntry` includes `matchScore`, `xpEarned`, `rankedRatingDelta` |
| Add server tests for all new events and end-game payloads | ✅ | Guards + happy paths covered |

### 9e — Web state and socket helpers

| Task | Status | Notes |
| ---- | ------ | ----- |
| Mirror scoring/progression protocol types | ✅ | `packages/web/src/protocol.ts` — all types mirrored |
| Add socket helpers for progression/history endpoints | ✅ | `getMyProgression()`, `getMyScoreHistory()` in `packages/web/src/net/socket.ts` |
| Extend `GameProvider` with scoring/progression state | ✅ | `progression`, `progressionLoading`, `progressionError`, `scoreHistory`, `latestMatchScoring` |
| Auto-refresh progression after completed matches and on login | ✅ | `useEffect` fetches on login; updated on STATE_UPDATE with `matchScoring` |

### 9f — Match UX: in-game score and end screen

| Task | Status | Notes |
| ---- | ------ | ----- |
| Add live or turn-delayed match score display in `GameScreen` | ✅ | Live match score shown per player |
| Upgrade `EndScreen` to show scoring recap | ✅ | Placement + `matchScore` + `xpEarned` + `rankedRatingDelta` + breakdown rows |
| Surface ghost bonus / cut bonus / table clear moments cleanly | ✅ | Breakdown rows in end screen recap |
| Show guest-persistence limitation gracefully | ✅ | Guest accounts see ephemeral scoring without progression persistence |

### 9g — Lobby, profile, history, leaderboard, and stats integration

| Task | Status | Notes |
| ---- | ------ | ----- |
| Lobby/profile: show level, XP progress bar, ranked rating | ✅ | Gold circular level badge + XP progress bar (clamped fill) + Rating label in `LobbyScreen` ProfilePanel; `LobbyScreen.tsx` + `LobbyScreen.css` |
| Add progression panel or Rewards screen | ✅ | Minimal v1: progression block inside ProfilePanel (level badge + XP bar + rating) |
| HistoryScreen: show stored match score / XP / rating delta per match | ✅ | `Score X · XP +Y · Rating ±Z` inline per game row in `HistoryScreen.tsx` |
| StatsScreen: add lifetime scoring metrics | ✅ | `highestMatchScore`, `totalMatchScore`, `ghostFinishes`, `averageMatchScore` stat cards in `StatsScreen.tsx` |
| Leaderboard follow-up: decide if/when to pivot from wins leaderboard to rating leaderboard | ✅ | Decision: keep existing wins leaderboard for v1; rating leaderboard deferred |

### 9h — Admin, exports, analytics, and rollout safety

| Task | Status | Notes |
| ---- | ------ | ----- |
| Admin user detail: show progression summary | ✅ | `rankedRating`, `level`, `totalXp`, `highestMatchScore`, recent ledger entries |
| Admin export: include progression and per-match scoring fields | ✅ | `matchScore`, `xpEarned`, `rankedRatingDelta` already in `ExportGamePlayerView` + `exportGamesData`; JSON export is audit-friendly |
| KPI follow-up: optional scoring analytics | ⬜ | XP granted/day, average match score by player count, abandon-rate impact on rating |
| Backfill / default strategy for existing users | ✅ | `progressionViewOf(null)` in handlers.ts already returns defaults (rating=0, xp=0, level=1); no backfill needed |
| Rollout guardrails | ⬜ | Feature flag or config gate for scoring UI while backend stabilizes |

### Recommended implementation order

1. `9a` shared scoring spec/types
2. `9b` DB schema + persistence + tests
3. `9c` game-end server scorer + atomic persistence
4. `9d` read endpoints + protocol wiring
5. `9e` web state/helpers
6. `9f` end screen scoring recap
7. `9g` lobby/profile/history/stats integration
8. `9h` admin/export/analytics follow-up

### Recommended v1 acceptance bar

- Every finished match produces a deterministic `matchScore`, `xpEarned`, and `rankedRatingDelta` for each player.
- Placement still exclusively determines the winner.
- Logged-in users persist `rankedRating`, `totalXp`, and `level`.
- End screen shows a trustworthy scoring breakdown.
- Lobby/profile surfaces current level and rating.
- History / exports can display stored per-match scoring without recomputation drift.

---

## Phase DS — Design System Package (`packages/ds`)

**Goal:** Create a shared `packages/ds` monorepo package that is the single source of truth for every reusable UI component. All components are developed and approved in Storybook before being consumed by `packages/web`. No standalone components may be introduced inside `packages/web/src/screens/` after this package exists.

**Architecture doc:** `docs/DESIGN_SYSTEM_ARCHITECTURE.md` — read it before starting any task in this phase. It covers the full directory structure, design token strategy, component convention, story format, ESLint enforcement, migration path, and acceptance criteria.

**Status:** ✅ Complete (DS-A ✅, DS-B ✅, DS-C ✅, DS-D ✅, DS-E ✅)

### Two-tool philosophy
- **Storybook** (runs inside `packages/ds`) — component workbench: isolation, controls, a11y audit, visual regression.
- **`/design` route** (in `packages/web`) — product showroom: how components compose in the real app shell. After this phase it only imports from `@ganatri/ds`, never defines components.

### DS-A — Package scaffold

| Task | Status | Notes |
| ---- | ------ | ----- |
| Create `packages/ds/` with `package.json`, `tsconfig.json`, `vite.config.ts` | ✅ | `name: "@ganatri/ds"`, workspace package |
| Install Storybook `@storybook/react-vite` + `addon-essentials` + `addon-a11y` | ✅ | `npx storybook@latest init` inside `packages/ds` |
| Create `.storybook/main.ts` + `.storybook/preview.ts` with dark default background | ✅ | preview imports `src/tokens/index.css` globally |
| Create `src/tokens/index.css` with all design tokens extracted from scattered CSS files | ✅ | Tokens: `--gold`, `--gold-rim`, `--gold-2`, `--glow-gold`, `--safe`, `--danger`, `--panel`, `--panel-2`, `--text`, `--text-dim`, `--font-display`, `--chip-*`, `--red-suit`, `--black-suit`, etc. |
| Create `src/index.ts` barrel export | ✅ | All 15 components exported |
| Wire `@ganatri/ds: workspace:*` into `packages/web/package.json` | ✅ | |
| Add `packages/ds` to workspace root `package.json` `workspaces` array | ✅ | |

### DS-B — Migrate existing primitives

Migrate the 10 components from `packages/web/src/design-system/DesignSystemPrimitives.tsx` into `packages/ds`. Delete `DesignSystemPrimitives.tsx` once it is empty.

| Task | Status | Notes |
| ---- | ------ | ----- |
| Migrate `DsButton` → `Button` | ✅ | 4 tones, compact variant, disabled; 6 stories |
| Migrate `DsBadge` → `Badge` | ✅ | 5 tones; 5 stories |
| Migrate `DsCard` → `Card` | ✅ | title/subtitle optional header; 3 stories |
| Migrate `DsField` → `Field` | ✅ | label, value, placeholder, helper; 3 stories |
| Migrate `DsListRow` → `ListRow` | ✅ | title, subtitle, trailing; 3 stories |
| Migrate `DsPageHeader` → `PageHeader` | ✅ | eyebrow, title, description, actions; 3 stories |
| Migrate `DsSection` → `Section` | ✅ | title, description, children; 3 stories |
| Migrate `DsStat` → `Stat` | ✅ | label, value, delta; 3 stories |
| Migrate `DsTabs` → `Tabs` | ✅ | items, active, onChange; 3 stories |
| Migrate `DsAlert` → `Alert` | ✅ | tone, title, description; 4 stories |
| Update `DesignSystemScreen.tsx` import from `DesignSystemPrimitives` → `@ganatri/ds` | ✅ | Build green; tsc --noEmit passes |
| Delete `packages/web/src/design-system/DesignSystemPrimitives.tsx` | ✅ | Deleted 2026-06-26 |

### DS-C — Extract room components

Migrate reusable sub-components from `RoomScreen.tsx` into `packages/ds`. Each component must be made static (no React hooks from the web app).

| Task | Status | Notes |
| ---- | ------ | ----- |
| Extract `OvalTable` | ✅ | Props: `seats: SeatData[]`; contains `SeatSlot` children; 4 stories |
| Extract `SeatSlot` | ✅ | Props: `seat: SeatData`, `seatIndex: 0|1|2|3`; renders crown + YOU badge + speaking ring; 5 stories |
| Extract `HeaderDesktop` | ✅ | Props: `roomCode`, `playerCount`, `maxPlayers`, `logoSrc?`, `onSettings?`, `onExit?`; 4 stories |
| Extract `HeaderMobile` | ✅ | Props: `roomCode`, `onBack?`, `onCopyCode?`, `onMenuToggle?`, `menuOpen`, `isHost?`, `canStart?`, `busy?`, `onStart?`; 3 stories |
| Extract `DetailsSidebar` | ✅ | Props: `roomCode`, `gameMode`, `maxPlayers`, `hostName`, `hostAvatarUrl?`, `voiceEnabled`, `copied`, `onCopyCode?`, `onShareLink?`; 3 stories |
| Extract `ActivityPanel` | ✅ | Props: `entries: ActivityEntry[]`, `activeTab?`, `onTabChange?`; 3 stories |
| Extract `SocialPanel` | ✅ | Props: `onlineFriends`, `recentOpponents`, `isLoggedIn`, `isLoading`, `onInvite`; full invite state machine (idle/loading/sent/error); 3 stories |
| Extract `FooterBar` | ✅ | Props: `tagline?`; semantic `<footer>` element; 3 stories (Default, CustomTagline, LongTagline) |
| Extract `PipRow` | ✅ | Props: `filled: number`, `max: number`; 4 stories |
| Extract `StatusPanel` | ✅ | Props: `playerCount`, `maxPlayers?`, `elapsedSeconds`; seat fill bar + timer; 3 stories |
| Extract `VoiceChatPanel` | ✅ | Props: `participants`, `mode`, `muted`, `deafened`, `permissionDenied?`, + callbacks + touch PTT handlers; 4 stories |
| Extract `CornerDecor` | ✅ | No props; pure decoration: chip pile + card fan + sparkles; 3 stories (Default, LargeView, OnFelt) |
| Extract `DealerChip` | ✅ | No props; gold D chip; 3 stories (Default, OnFelt, AtSeatEdge) |
| Extract `FeltBackdrop` | ✅ | No props; SVG crest watermark on felt background; 3 stories (Default, Tablet, Cropped) |
| Create `packages/ds/src/globals.css` with global button/input/box-sizing resets | ✅ | Fixes Storybook visual mismatch vs web app |
| Import `globals.css` in `packages/ds/.storybook/preview.ts` | ✅ | Buttons now render as gold casino buttons in Storybook |
| Update `RoomScreen.tsx` to import all extracted components from `@ganatri/ds` | ✅ | All 14 inline sub-components removed; `RoomScreen.tsx` shrunk from 1,476 → 439 lines; only `RoomScreen`, `useIsDesktop`, `getInitials`, `formatElapsed` remain; build + Storybook green |
| Rename all `Room*` components to generic names | ✅ | `RoomHeaderDesktop` → `HeaderDesktop`, `RoomOvalTable` → `OvalTable`, `RoomFriendsPanel` → `SocialPanel`, etc. (14 total renamed). Old `Room*` directories deleted. DS `index.ts` + RoomScreen imports updated. Rationale: these components are reusable across any screen, not room-specific. |
| Update DS components to match final RoomScreen design | ✅ | `DetailsSidebar` gains `hostAvatarUrl`/`voiceEnabled`/`copied` + fee/voice rows; `HeaderMobile` gains dropdown menu; `SocialPanel` rewritten with `FriendEntry` type + invite state machine; `VoiceChatPanel` gains `permissionDenied` + touch handlers; `FooterBar` uses `<footer>` without inner decor; `FriendEntry` + `SeatData` exported from DS index |

### DS-D — Update `/design` showroom

| Task | Status | Notes |
| ---- | ------ | ----- |
| Update `DesignSystemScreen.tsx` to import DS primitives from `@ganatri/ds` | ✅ | All 10 primitive imports switched; `tsc --noEmit` passes |
| Remove `import './RoomScreen.css'` from `DesignSystemScreen.tsx` | ✅ | Removed 2026-06-27; showroom now depends only on its own CSS + DS component CSS |
| Confirm DS components render correctly (Storybook visual check) | ✅ | 2026-06-27: Storybook at :6006 renders all components correctly — FEEDBACK, PRIMITIVES, LAYOUT, ROOM groups all present; generic names confirmed; no Room* prefix; no CSS bleed from RoomScreen |

### DS-E — ESLint enforcement + CI gate

| Task | Status | Notes |
| ---- | ------ | ----- |
| Add `no-restricted-imports` ESLint rule in `packages/web` | ✅ | `packages/web/eslint.config.js` — blocks cross-screen imports + rejects old `DesignSystemPrimitives` path; message directs to `@ganatri/ds` |
| Add convention comment at top of every `*Screen.tsx` | ✅ | Added to all 9 screen files 2026-06-27: `// SCREEN SHELL: no reusable component definitions here.` |
| Confirm `npm run lint` passes in `packages/web` | ✅ | 0 errors, 12 warnings (all pre-existing; no DS violations) |
| Add `npm run lint` to root `package.json` scripts | ✅ | `npm run lint` at workspace root now runs lint across all packages |
| Add `npm run lint` to CI pipeline | ✅ | Added to `nightly.yml` as "Lint & typecheck" step before Claude runs — gates the AI build on clean lint + typecheck |

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
| Phase 2 — Server             | ✅ Complete (108 tests; TURN_TIMEOUT + sanitization + grace expiry broadcast + DRY refactor + freeze fix + DB write-through + OAuth/history/retention + flat history wire-contract fix + `get_my_stats` + `get_leaderboard` + `myEntry` in leaderboard ack + time-windowed leaderboard + `timeWindow` runtime validation + `update_display_name` + admin secret check + `admin_get_stats` live ops endpoint + session-persistence flow fixes + `get_recent_players` + invitation system + `get_blocked_users` + `admin_get_kpi_stats` KPI endpoint + `admin_search_users`/`admin_get_user_stats` user management + `admin_export_data` + `delete_account` right-to-erasure + active session management + OAuth cookie bootstrap) |
| Phase 3 — Web Client         | ✅ Complete (player names wired, all components functional)                              |
| Phase 4 — Polish             | ✅ Complete (animations, mobile polish; deployment user-handled via Render + Cloudflare) |
| Phase 5 — Voice Chat         | 🟡 Core + cross-browser fixes + Perfect Negotiation recovery + Cloudflare TURN; smoke test pending |
| Phase 6 — Persistence/DB     | 🟡 6a complete (pg Pool + regenerated migration); 6b durable `GamePersistence` layer built & fully tested (133 db tests, pglite); 6d live write-through wired into server (games/events/players) ✅ + 6e stats increments ✅ + 6c guest→registered upgrade flow ✅ + `updateUserDisplayName` ✅ + **6d server-restart recovery ✅** (event-log replay, ghost sessions, playerId localStorage). Server `MemoryStore` refactor + accounts/analytics UI (6f–6j) remain. |
| Phase A — Accounts/auth DB   | ✅ DB layer done: `users.avatarUrl`, `oauth_accounts`, `auth_sessions`, retention indexes (migration `0001_broken_joystick.sql`); `upsertOAuthUser` / session create-lookup-revoke / `getUserGameHistory` / `pruneGameEventsBefore` / `pruneAbandonedGamesBefore` in Pg + Memory; +26 db tests (auth/history/retention + shared contract). |
| Phase B — Server OAuth/history/retention | ✅ Optional Google OAuth login (`/auth/google/login|callback|logout`), durable identity binding via `ganatri_session` cookie + socket middleware, `REQUEST_HISTORY` socket endpoint (now acks the FLAT web wire shape via `flattenHistoryEntry` + contract test), daily retention prune, interval-leak fix, CORS→`WEB_ORIGIN`. Review hardening: `Secure`-cookie gate (`INSECURE_COOKIES` for local HTTP dev), NaN-guarded numeric env (`numEnv`), `email_verified` check in OAuth code exchange. No-op without Google env / `DATABASE_URL`. +12 server tests (40 total). Frontend done in Phase C. |
| Phase 6e/6g — Personal stats   | ✅ `get_my_stats` socket endpoint (`handleGetMyStats` → `getPlayerStats`, flat `PlayerStatsView` w/ derived `winRate` + `avgFinish`, guest→`NOT_LOGGED_IN`/no-persistence→`UNAVAILABLE`/null-row→zeroed; +4 server tests) + `StatsScreen` dashboard in `packages/web` (Lobby "Stats" button, stat-card grid including avg finish, 0-games empty state). `sum_finish_positions` column added to `player_stats` (migration 0002); `avgFinish` derived as `sumFinishPositions/(gamesPlayed-gamesAbandoned)`. `get_leaderboard` shipped separately (Phase 6f/6g). All features complete. |
| Phase 6f/6g — Global leaderboard | ✅ `get_leaderboard` slice (db + server): `GamePersistence.getLeaderboard(limit=20, offset=0)` (Pg + Memory) with shared `toLeaderboardEntry` mapper, excludes guests + zero-games, ordered `gamesWon DESC, winRate DESC, gamesPlayed DESC, userId ASC`, paginated (winRate derived in JS, 0-guarded); PUBLIC `handleGetLeaderboard` + `LeaderboardEntryView`/`GetLeaderboardAck` (1-based `rank`, only failure `UNAVAILABLE`). `myEntry?: LeaderboardEntryView` added to ack (logged-in user outside top 20 gets their rank); `getMyLeaderboardRank` in db (Pg CTE+ROW_NUMBER + Memory sort+findIndex). **Time-windowed leaderboard complete** (`timeWindow?: 'week' | 'month'` added to both interface methods + both impls; `GetLeaderboardRequest` on server; +10 db contract tests + 2 server tests; total now 118 db + 50 server). **Windowed leaderboard bug fix** (Pg CTE now correctly filters `AND g.is_abandoned = false`; dead `HAVING COUNT(*) > 0` removed; `timeWindow` runtime-validated in `handleGetLeaderboard`; +2 contract tests for abandoned exclusion; total now 120 db). **Schema drift-guard column test added** (`player_stats.sum_finish_positions` existence/type/nullable/default asserted in `schema.test.ts`; 120→121 db tests). Web `LeaderboardScreen` tab UI already shipped. Friends boards still TODO. |
| Phase C — Web OAuth UI/history screen | ✅ Optional Google login + game-history/score-card screen in `packages/web`. Socket `withCredentials:true`; `requestHistory`/`loginWithGoogle`/`logout` helpers; protocol mirror for `REQUEST_HISTORY`/`GameHistoryEntry` + `SessionPayload` account fields; `GameProvider.account` + `screen` nav; `LobbyScreen` login/account UI (guest flow untouched, `?login=error` handled); new `HistoryScreen` w/ expandable framer-motion score cards. Build green; no web tests/lint present. |
| Phase 7 — Improvements       | ⬜ Backlog identified; not yet started (27 tasks across 7 sub-phases 7a–7g). **Deprioritized below Phase 8.** |
| Phase 8 — Social (Co-players & Invitations) | ✅ Complete (all 8a–8h shipped; 387 total tests) |
| Phase 9 — Scoring / Rating / XP Progression | 🟡 9a–9h (admin detail/export/defaults) complete. Remaining: optional KPI analytics + rollout guardrails. |
| Phase DS — Design System Package (`packages/ds`) | ✅ Complete. DS-A ✅ scaffold, DS-B ✅ 10 primitives migrated, DS-C ✅ 14 components extracted + renamed to generic names + RoomScreen 1476→439 lines, DS-D ✅ imports clean + Storybook visual check passed, DS-E ✅ ESLint rule + convention comments + lint script + CI gate all active. |
| Phase 6i — Account deletion (right to erasure) | ✅ Complete (full stack: DB + server + web; 441 total tests) |
