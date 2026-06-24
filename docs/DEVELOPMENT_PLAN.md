# Ganatri — Phasewise Development Plan

Last updated: 2026-06-23 (Phase 6i account deletion — bug fixes: (1) `rooms.hostUserId` `.notNull()` removed from `packages/db/src/schema.ts`; migration `packages/db/drizzle/0004_nullable_room_host.sql` created (`ALTER TABLE rooms ALTER COLUMN host_user_id DROP NOT NULL`); `GameWithPlayers.hostUserId` type in `packages/db/src/persistence/types.ts` widened to `string | null | undefined`; `rehydrateGame` signature in `packages/server/src/recovery.ts` widened to `string | null | undefined`. (2) `handleDeleteAccount` in `packages/server/src/handlers.ts` now calls `silentLeaveRoom(socket, session)` before `p.deleteUser(userId)` so the user's room seat is cleaned up before the DB record is erased. All 441 tests still pass (153 engine + 102 server + 186 db). Build green.)

Last updated: 2026-06-23 (Phase 6i account deletion DB+server layer complete: `deleteUser(userId)` added to `GamePersistence` interface (`packages/db/src/persistence/types.ts`); implemented in `PgPersistence` (9-step transaction: anonymize game_players/game_events/games/rooms, delete player_stats/auth_sessions/oauth_accounts/user_blocks (both sides), delete users — uses `or()` from drizzle-orm for userBlocks condition) and `MemoryPersistence` (same steps iterating Maps/Sets); 3 new contract test cases in `memory.test.ts` (removes user+stats, nulls game_player userId, no-op for unknown userId — runs against both Pg+Memory = 6 new db test runs). Server: `DeleteAccountAck` union type + `DELETE_ACCOUNT: 'delete_account'` added to `packages/server/src/protocol.ts`; `handleDeleteAccount` handler added to `handlers.ts` (NOT_LOGGED_IN guard, UNAVAILABLE guard, calls `p.deleteUser`, converts session to guest: sets userId+account=null+name='', re-emits SESSION as guest, acks ok); wired in `registerSocketEvents`; 3 integration tests in new `delete-account.test.ts` (guest→NOT_LOGGED_IN, no-persistence→UNAVAILABLE, happy path acks ok and SESSION re-emits with loggedIn:false). DB: 180→186 tests. Server: 94→102 tests. All 441 tests pass (153 engine + 102 server + 186 db). Build green.)

Last updated: 2026-06-23 (Phase 6i account deletion web layer complete: `DELETE_ACCOUNT: 'delete_account'` added to `EVENTS` in `packages/web/src/protocol.ts`; `DeleteAccountAck` union type added; `deleteAccount()` helper using `emitAck` added to `packages/web/src/net/socket.ts`; `deleteAccount` imported + `useCallback` impl added to `GameProvider.tsx`, exposed in `GameContextValue`, `useMemo` value, and deps array; `LobbyScreen.tsx` gains `showDeleteConfirm`/`deleteLoading`/`deleteError` state, `handleDeleteAccount` async handler, three new `ProfilePanelProps` fields (`showDeleteConfirm`, `deleteLoading`, `deleteError`) + three new callbacks (`onDeleteAccountClick`, `onDeleteAccountConfirm`, `onDeleteAccountCancel`); delete account danger link button + inline confirmation panel (warning text + Yes/Cancel actions + error display) added inside the `ProfilePanel` logged-in branch after the blocked-users section; 7 new CSS classes in `LobbyScreen.css` (`.lobby__delete-section`, `.lobby__delete-btn`, `.lobby__delete-confirm`, `.lobby__delete-confirm-text`, `.lobby__delete-confirm-actions`, `.lobby__confirm-yes-btn`, `.lobby__confirm-cancel-btn`, `.lobby__delete-error`). Build green, zero TS errors. Backend agent implementing server/DB layer in parallel.)

Last updated: 2026-06-23 (Phase 6h Data Export web layer complete: `ExportGamePlayerView`/`ExportGameView`/`AdminExportDataAck` types + `EXPORT_DATA: 'admin_export_data'` added to `packages/web/src/protocol.ts`; "Data Export" section added to `AdminScreen.tsx` (after User Management, before config sliders) with "Export Games (JSON)" button, loading/error states, and Blob download trigger; `exportLoading`/`exportError` state; `.admin__export-section` + `.admin__export-btn` CSS in `AdminScreen.css`. Build green, zero TS errors.)

Last updated: 2026-06-23 (Phase 6h Data Export complete (DB+server layer): `ExportGamePlayer`/`ExportGameRow` types added to `packages/db/src/persistence/types.ts`; `exportGamesData(limit=500)` added to `GamePersistence` interface; implemented in `PgPersistence` (2-query: games LEFT JOIN rooms ordered by startedAt DESC, then game_players for returned gameIds, grouped in JS) and `MemoryPersistence` (sort all games, slice to limit, look up roomCode from rooms Map); both exported from `packages/db/src/index.ts`. 4 contract tests added to `memory.test.ts` (empty array + ordering/shape/roomCode, run against both Pg+Memory impls). DB: 176→180. Server: `ExportGamePlayerView`/`ExportGameView`/`AdminExportDataPayload`/`AdminExportDataAck` types added to `packages/server/src/protocol.ts`; `ADMIN_EXPORT_DATA='admin_export_data'` added to EVENTS; `handleAdminExportData` handler (admin-auth gate, UNAVAILABLE guard, limit clamped to ≤500) added to `handlers.ts` and wired in `registerSocketEvents`; 3 integration tests in new `admin-export.test.ts` (NOT_AUTHORIZED / UNAVAILABLE / empty ok). Server: 91→94. All 427 tests pass (153 engine + 94 server + 180 db).)

Last updated: 2026-06-23 (Phase 6h User Management complete: full vertical slice (DB + server + web). DB: `UserSearchResult`/`AdminUserStats` types; `searchUsers`/`adminGetUserStats` in `GamePersistence` interface, `PgPersistence` (ILIKE left-join with wildcard escaping, UUID guard), `MemoryPersistence`; 14 new contract test runs (DB: 162→176). Server: `AdminSearchUsersPayload`/`AdminUserView`/`AdminSearchUsersAck`/`AdminGetUserStatsPayload`/`AdminUserStatsView`/`AdminGetUserStatsAck` types in `protocol.ts`; `ADMIN_SEARCH_USERS`/`ADMIN_GET_USER_STATS` events; `handleAdminSearchUsers` (admin-auth gate, empty-query guard, limit clamped to ≤100) + `handleAdminGetUserStats` (admin-auth gate, NOT_FOUND); 8 new tests in `admin-users.test.ts` (Server: 83→91). Code-review fixes applied: PgPersistence ILIKE wildcards escaped + server-side limit clamped to 100. Web: `AdminUserView`/`AdminUserStatsView`/`AdminSearchUsersAck`/`AdminGetUserStatsAck` types + `SEARCH_USERS`/`GET_USER_STATS` in `ADMIN_EVENTS`; `UserManagementSection` in `AdminScreen.tsx` (search bar, results list with avatar/initials/guest badge, user detail panel with 12-stat grid + avg duration + updatedAt); CSS added to `AdminScreen.css`. All 420 tests pass (153 engine + 91 server + 176 db). Build green.)

Last updated: 2026-06-23 (Phase 6d server-restart recovery complete: `packages/server/src/recovery.ts` (NEW) — `rehydrateFromDb()` loads active games from DB on startup, replays the event log through the engine (`replayGameState`: groups events by CARD_PLAYED, derives Part 1 `PLAY_CAPTURE` captures from `CAPTURED.cards`, Part 2 `PLAY_TRICK` trivially) to reconstruct the live `GameState`, creates ghost sessions (`socketId=null`, roomCode set) for every player, wires per-room persistence bookkeeping (`restoreGamePersistenceState`), and starts grace-period timers so the game auto-resolves if nobody reconnects. Ghost session adoption added to `handlers.ts` (`tryAdoptGhostSession`): when an incoming token is unknown, the server matches the player by their playerId (from the OAuth cookie for logged-in users; from `handshake.auth.playerId` sent from localStorage for guests) and adopts the ghost session, then routes to `handleReconnect` for seamless game resumption. `createSession` updated to accept `socketId: string | null`. DB layer: `GameWithPlayers` extended with `roomCode?` + `hostUserId?`; `loadActiveGames()` updated in both `PgPersistence` and `MemoryPersistence` to include room data. Web client: `setPlayerId`/`getPlayerId` helpers added to `socket.ts`; playerId stored in localStorage and sent in handshake auth on reconnect. `GameProvider.onSession` calls `setPlayerId`. 5 new integration tests in `recovery.test.ts`; 80→85 server tests. All 392 tests pass: 153 engine + 85 server + 154 db.)

Last updated: 2026-06-23 (Phase 6h KPI charts — code-review fix: `PgPersistence.getAdminKpiStats` weighted-average bug corrected. Added `COUNT(*) FILTER (WHERE is_abandoned = false AND duration_ms IS NOT NULL)::int AS completed_with_duration` SQL column; weighted-average now uses `completed_with_duration` as the weight instead of `completed`, preventing null-duration games from inflating the count. New contract test "avgDurationMs only counts completed games that have durationMs" added to `memory.test.ts` (run vs both PgPersistence + MemoryPersistence = 2 new test runs). DB tests: 160→162. All 398 tests pass (153 engine + 83 server + 162 db). Build green.)

Last updated: 2026-06-22 (GameScreen polish: removed `game__hint` render from hand section and deleted its CSS rule + landscape override; added `user-select: none` / `-webkit-user-select: none` to `.game__hand-area` to prevent accidental text selection on card tap. Build green, zero TS errors.)

Last updated: 2026-06-23 (Phase 6h KPI charts server+db complete: `AdminKpiStats` type + `getAdminKpiStats(windowDays=7)` added to `GamePersistence` interface (`packages/db/src/persistence/types.ts`), implemented in `PgPersistence` (raw SQL GROUP BY UTC date, weighted avg durationMs) and `MemoryPersistence` (iterates games map). Exported from `packages/db/src/index.ts`. 3 new contract test cases (zeroed window, completed-vs-abandoned counts, null avgDurationMs) run against both impls = 6 new db tests (154→160). Server: `AdminKpiStats`/`AdminGetKpiStatsAck` types added to `packages/server/src/protocol.ts`; `ADMIN_GET_KPI_STATS='admin_get_kpi_stats'` added to `EVENTS`; handler added to `handlers.ts` (admin-auth gate, no-persistence UNAVAILABLE guard, calls `p.getAdminKpiStats(7)`); 3 new integration tests in `admin-kpi.test.ts` (unauthenticated→NOT_AUTHORIZED, no-persistence→UNAVAILABLE, happy path shape check). Server: 80→83 tests. Total: 153 engine + 83 server + 160 db = 396.)

Last updated: 2026-06-23 (Phase 6h KPI charts web-side complete: `AdminKpiStats`+`AdminGetKpiStatsAck` types added to `packages/web/src/protocol.ts`; `GET_KPI_STATS: 'admin_get_kpi_stats'` added to `ADMIN_EVENTS`; `AdminScreen.tsx` gains `kpiStats`/`kpiLoading`/`kpiError` state, `fetchKpi()` (mirrors `fetchStats` pattern), called on auth success + wired to existing Refresh button; `KpiSection` sub-component (pure CSS bar chart, no libs): 3 summary tiles (Total Games / Abandonment Rate / Avg Duration), daily bar chart with completed (green) + abandoned (orange) stacked bars, date labels, count labels, empty state; `formatDuration`/`formatDate` helpers; `AdminScreen.css` adds 10 KPI classes (`.admin__kpi-section`, `.admin__kpi-tiles`, `.admin__kpi-chart`, `.admin__kpi-bar-row`, `.admin__kpi-bar-group`, `.admin__kpi-bar-count`, `.admin__kpi-bar`, `.admin__kpi-bar-completed`, `.admin__kpi-bar-abandoned`, `.admin__kpi-bar-label`, `.admin__kpi-empty`). Build green, zero TS errors.)

Last updated: 2026-06-23 (HistoryScreen casino redesign complete: full rewrite of `packages/web/src/screens/HistoryScreen.tsx` + `HistoryScreen.css`. Mirrors Leaderboard/Stats shell: `hist__root` layout, sticky header (mobile: back + GAME HISTORY + profile icon; desktop: logo + top nav with History active + avatar), desktop 280px profile sidebar left, 5-tab mobile bottom nav (History active), mobile profile strip. Main content: summary bar (games/wins/win rate from history), unified bordered match list with outcome badges, expandable scorecards preserved. Build green.)

Last updated: 2026-06-23 (StatsScreen casino redesign complete: full rewrite of `packages/web/src/screens/StatsScreen.tsx` + `StatsScreen.css`. Mirrors LeaderboardScreen shell: `st__root` layout, sticky header (mobile: back + YOUR STATS + profile icon; desktop: logo + top nav with Stats active + avatar), desktop 280px profile sidebar left, 5-tab mobile bottom nav (Stats active), mobile profile strip. Main content: 12-card icon stat grid (3 cols), separate total play time bar, Coming soon placeholders (performance graph, favorite cards, game modes, achievements), Recent Results panel wired to `requestHistory()` with View All History link. All existing `requestMyStats()` logic preserved. Build green.)

Last updated: 2026-06-23 (LeaderboardScreen casino redesign complete: full rewrite of `packages/web/src/screens/LeaderboardScreen.tsx` + `LeaderboardScreen.css`. Mirrors LobbyScreen shell: `lb__root` full-height layout, sticky header (mobile: back chevron + flourished LEADERBOARD title + crown; desktop: logo + top nav Home/History/Stats/Leaderboard/Profile + avatar), desktop two-column grid (280px profile sidebar left | main right), 5-tab mobile bottom nav (Leaderboard active). New sub-components: `LeaderboardHeader`, `LeaderboardProfileSidebar` (avatar, name, player ID, rank + win% from `myEntry`/`requestMyStats`, nav to History/Stats), `LeaderboardBottomNav`, SVG medal icons for top 3, "(You)" name suffix, unified bordered table container, sticky mobile user row above nav, desktop footer tagline bar. Shared `useIsDesktop` hook extracted to `packages/web/src/hooks/useIsDesktop.ts`. All existing data logic preserved (time-window tabs, loading/error/empty, `myEntry` desktop section). Build green.)

Last updated: 2026-06-22 (RoomScreen responsive casino redesign complete: full rewrite of `packages/web/src/screens/RoomScreen.tsx` + `RoomScreen.css`. New sub-components: `useIsDesktop` hook (900px MQ), `RoomHeaderMobile` (sticky header: back/copy/menu with dropdown for Start Game + Leave Room), `RoomHeaderDesktop` (logo left + ROOM XXXX center in Cinzel gold + settings/exit buttons right), `OvalTable` (circular 72px avatar seats — occupied shows photo/initials + name + YOU badge + host crown + gold glow ring for current player + green speaking ring; empty shows dashed pulse + waiting label), `VoiceChatPanel` (desktop shows participant avatar grid; controls: mic/deafen/mode buttons), `ActivityPanel` (ACTIVITY/CHAT tabs, join/leave log auto-populated by player list diff), `RoomDetailsSidebar` (desktop left col: room code with copy icon, game mode, max players, entry fee, host name, voice status; copy + share buttons), `FriendsOnlineSidebar` (desktop right col: online friends + recent opponents with invite rows preserving all invite states). New state: elapsed timer, activityLog, activeTab, menuOpen, prevPlayersRef. Mobile layout: logo → badge → oval table → status row → pips → voice → action row (Invite/Share) → waiting block → error → Leave danger button → host footer. Desktop layout: 3-column grid (280px sidebar | 1fr center | 280px friends); footer bar with suits + tagline. `playerAvatarUrls` now destructured from `useGame()`. Build green (0 TS errors).)

Last updated: 2026-06-22 (LobbyScreen casino redesign complete: full visual rewrite of `packages/web/src/screens/LobbyScreen.tsx` and `LobbyScreen.css`. New sub-components: `useIsDesktop` hook (900px MQ), `LobbyHeader` (sticky gold-bordered header with avatar, name, notification bell; desktop adds Rewards+gear buttons), `CreateJoinPanel` (mobile stacked / desktop two-column with gold divider; guest name input; CREATE ROOM button; code input + JOIN row), `QuickActions` (3-tile mobile grid / 4-tile desktop with LEADERBOARD, INVITE FRIENDS, HOW TO PLAY, DAILY BONUS disabled), `RecentlyPlayed` (mobile: `<ul>` rows with avatar+name+status+INV button; desktop: horizontal scrollable cards 120px wide; preserves all invite logic + placeholder/empty states), `DesktopSidebar` (TOP PLAYERS leaderboard + YOUR STATS panel, skeleton loading, cancelled-ref data fetching, hidden on mobile via CSS), `MobileBottomNav` (fixed bottom, 4 tabs HOME/HISTORY/STATS/PROFILE, gold active color, safe-area-inset), `ProfilePanel` (bottom sheet mobile / side panel desktop; contains name editor, logout, blocked users, Google login for guests), `HowToPlayModal` (centered overlay, Part 1 + Part 2 rules). Layout: `.lobby__root` with 100dvh scroll + mobile nav padding; `.lobby__desktop-layout` → 1fr + 300px grid at 900px. All existing state/handlers/effects/rejoin early-return preserved verbatim. Build green (no TS errors).)

Last updated: 2026-06-22 (Phase 8 COMPLETE: All sub-phases 8a–8h shipped. Final counts: 153 engine + 80 server + 154 db = 387 tests. Social features: recently played co-player panel with invite flow, incoming invite toast overlay, block/unblock system with management UI, all backed by user_blocks DB table and real-time socket events.)

Last updated: 2026-06-22 (Phase 8h server-side complete: `BlockedUserEntry` type added to `packages/db/src/persistence/types.ts`; `getBlockedUsers(userId)` method added to `GamePersistence` interface, `PgPersistence` (Drizzle innerJoin `userBlocks`+`users`), and `MemoryPersistence` (iterates `blocks` Set, looks up user Map); `BlockedUserEntry` exported from `packages/db/src/index.ts`; 2 new contract tests in `memory.test.ts` (`getBlockedUsers returns blocked user details`, `getBlockedUsers returns empty array when no blocks`) — run against both Pg+Memory = 4 test runs; 150→154 db tests. Server: `BlockedUserView`/`GetBlockedUsersAck` types added to `packages/server/src/protocol.ts`; `GET_BLOCKED_USERS: 'get_blocked_users'` added to `EVENTS`; `handleGetBlockedUsers` added to `handlers.ts` (NOT_LOGGED_IN/UNAVAILABLE guards, calls `persistence.getBlockedUsers`, acks `{ok:true,users}`); wired in `registerSocketEvents`; 3 new integration tests in `blocked-users.test.ts` (guest→NOT_LOGGED_IN, no-persistence→UNAVAILABLE, happy path returns blocked list); 77→80 server tests. Build green. Total: 153 engine + 80 server + 154 db = 387.)

Last updated: 2026-06-22 (Phase 8h web-side complete: `BlockedUserView` + `GetBlockedUsersAck` types added to `packages/web/src/protocol.ts`; `GET_BLOCKED_USERS: 'get_blocked_users'` added to `EVENTS` constant; `getBlockedUsers()` helper added to `packages/web/src/net/socket.ts`; `GameProvider` gains `getBlockedUsers` useCallback + exposed in `GameContextValue` interface, useMemo value, and deps array; `LobbyScreen` pulls `getBlockedUsers` + `unblockUser` from `useGame()`; "Blocked Users" expandable panel added to the logged-in account section — toggle button with chevron flip, lazy-fetch on first open (loading/error/empty/"No blocked users." states), populated list shows displayName + Unblock button per row (clicking removes row on success); CSS classes added to `LobbyScreen.css`: `.lobby__blocked-section`, `.lobby__blocked-toggle`, `.lobby__blocked-panel`, `.lobby__blocked-list`, `.lobby__blocked-row`, `.lobby__blocked-name`, `.lobby__unblock-btn`, `.lobby__blocked-empty`, `.lobby__blocked-error`. Build green. Server-side GET_BLOCKED_USERS handler still pending.)

Last updated: 2026-06-22 (Phase 8g complete: `InviteToast` component built and mounted in App.tsx. New `packages/web/src/components/InviteToast.tsx`: renders when `pendingInvite !== null` from GameContext; shows inviter avatar (img or initials fallback), display name, "wants to play with you!" subtitle, 60s countdown timer (resets on new invite via `inviterUserId` key), Accept/Decline/Block buttons. Accept shows spinner while in-flight; on success App routes to RoomScreen automatically via ROOM_UPDATE. Block calls `respondToInvite(id, false, true)` and shows "User blocked" confirmation text. Error messages inline: UNAVAILABLE→"Unavailable, try again", NOT_FOUND→"Invite expired". CSS in `InviteToast.css`: `position:fixed top:80px left:50% translateX(-50%) z-index:1000`; dark card panel; responsive mobile layout (stacks buttons vertically on ≤400px). `<InviteToast />` mounted inside `VoiceChatProvider` / `app-shell` in App.tsx, outside screen routing, so it floats above all screens. Build green.)

Last updated: 2026-06-22 (Phase 8f complete: "Recently Played" section added to LobbyScreen. New `RecentlyPlayed` sub-component renders three states — logged-out (3 greyed placeholder cards with lock overlay + pulse skeleton bars), logged-in empty ("No games played yet" message), logged-in populated (player cards with avatar/initials, green online dot, display name, games-together count, Invite button for online players). Invite button spins in-flight, shows inline error messages (OFFLINE/BLOCKED/ALREADY_IN_ROOM/ALREADY_IN_GAME/UNAVAILABLE) below the card. "See all" toggle expands up to 10 when more than 5 exist. CSS added: `.recently-played`, `.rp__heading`, `.rp__cards` (responsive grid: 2col mobile → 3col 480px → 5col 700px), `.rp__card`, `.rp__card--placeholder`, `.rp__avatar-wrap`, `.rp__avatar`, `.rp__avatar-initials`, `.rp__online-dot`, `.rp__name`, `.rp__games-count`, `.rp__invite-btn`, `.rp__invite-btn--loading`, `.rp__invite-error`, `.rp__placeholder-bar`, `.rp__locked-overlay`, `.rp__see-all-btn`, `@keyframes rp-pulse`, `@keyframes rp-spin`. Build green.)

Last updated: 2026-06-22 (Phase 8e complete: GameProvider social wiring — `recentPlayers: CoPlayerView[]` + `pendingInvite: InviteReceivedPayload | null` state added; `INVITE_RECEIVED`/`INVITE_CANCELLED`/`INVITE_ACCEPTED` push listeners registered; auto-fetch effect fires when `account.loggedIn` transitions to true; `invitePlayer`, `respondToInvite`, `blockUser`, `unblockUser`, `refreshRecentPlayers` useCallback actions added and exposed in `GameContextValue` + useMemo. Build green.)

Last updated: 2026-06-22 (Phase 8d complete: web protocol mirror + socket helpers. `packages/web/src/protocol.ts` gains `GET_RECENT_PLAYERS` + 4 social C→S events + 4 S→C push events in EVENTS; `CoPlayerView`, `GetRecentPlayersAck`, `InvitePlayerPayload/Ack`, `RespondToInvitePayload/Ack`, `BlockUserPayload/Ack`, `UnblockUserPayload/Ack`, `InviteReceivedPayload`, `InviteAcceptedPayload`, `InviteRejectedPayload`, `InviteCancelledPayload` types added. `packages/web/src/net/socket.ts` gains `requestRecentPlayers`, `invitePlayer`, `respondToInvite`, `blockUser`, `unblockUser` helpers. Build green.)

Last updated: 2026-06-22 (Phase 8c complete: invitation system. `pendingInvites Map<string,InviteState>` + `INVITE_TIMEOUT_MS=60s` + `__resetPendingInvitesForTests()` added to `handlers.ts`. `EVENTS`: 4 C→S (`INVITE_PLAYER`,`RESPOND_TO_INVITE`,`BLOCK_USER`,`UNBLOCK_USER`) + 4 S→C push (`INVITE_RECEIVED`,`INVITE_ACCEPTED`,`INVITE_REJECTED`,`INVITE_CANCELLED`) added to `protocol.ts` with full payload+ack types. `handleInvitePlayer`: NOT_LOGGED_IN, UNAVAILABLE, SELF_INVITE, OFFLINE, ALREADY_IN_ROOM, BLOCKED, ALREADY_IN_GAME guards; auto-create LOBBY room; 60s expiry timer emits INVITE_CANCELLED; sends INVITE_RECEIVED push. `handleRespondToInvite`: NOT_LOGGED_IN+NOT_FOUND guards; accept→auto-join room+INVITE_ACCEPTED push; reject→INVITE_REJECTED push; block=true→`blockUser` persist. `handleBlockUser`/`handleUnblockUser`: auth+persistence guards, call DB. `silentLeaveRoom` cancels all pending invites sent by departing player. 10 new integration tests in `invites.test.ts`: 67→77 server tests, all pass. Total: 153 engine + 77 server + 150 db = 380.)

Last updated: 2026-06-22 (Phase 8b complete: `GET_RECENT_PLAYERS` event + `CoPlayerView`/`GetRecentPlayersAck` types in `packages/server/src/protocol.ts`; `handleGetRecentPlayers` handler in `handlers.ts` (NOT_LOGGED_IN guard, `getFrequentCoPlayers` call, `isOnline` enrichment by scanning `store.sessions` for live socketId + non-null userId); socket.on registration added; 4 new integration tests in `recent-players.test.ts` (guest→NOT_LOGGED_IN, persistence-drops→UNAVAILABLE, co-player online→isOnline:true, co-player offline→isOnline:false); 63→67 server tests. Total: 153 engine + 67 server + 150 db = 370.)

Last updated: 2026-06-22 (Phase 8a complete: `user_blocks` schema + migration `0003_user_blocks.sql`; `getFrequentCoPlayers`/`blockUser`/`unblockUser`/`getBlockedUserIds`/`isBlocked` in `GamePersistence` interface + both `PgPersistence` and `MemoryPersistence`; `CoPlayerEntry`/`UserBlockRow` types exported; 17 new tests (8 contract × 2 impls + 1 drift-guard); 133→150 db tests, all pass. Phase 8 roadmap added: Social home-page redesign — Recently Played Players + Player Invitations. 8 sub-tasks queued in Priority TODO. review fixes: `sessionPayload()` return type annotation in `handlers.ts` gains `name?: string`; `GameProvider.onSession` resets `guestName` to null when `payload.loggedIn` is true — prevents stale guest name leaking after logout. All 349 tests pass. Build green.)

Last updated: 2026-06-22 (wire guest name into LobbyScreen: `SessionPayload` in `packages/web/src/protocol.ts` gains `name?: string`; `GameProvider` adds `guestName: string | null` state, set from `onSession` when `!payload.loggedIn && payload.name`; `guestName` added to `GameContextValue` interface, `useMemo` value, and deps array; `LobbyScreen` reads `guestName` from context, updates `name` useState initializer to use `guestName ?? ''` for guests, and adds a `useEffect` to update `name` once the SESSION payload arrives asynchronously. Build green.)

Last updated: 2026-06-22 (session-persistence flow fixes: `SessionPayload` in `packages/server/src/protocol.ts` gains `name?: string` for guest display name; `sessionPayload()` in `handlers.ts` now spreads `session.name` into the payload for guests (so name survives page reload); `handleReconnect()` reordered so `getRoom(roomCode)` is checked BEFORE `socket.join`, and the stale `roomCode` is cleared via `updateSession` when the room no longer exists. 2 new tests in `handlers.test.ts`: "SESSION payload includes guest name when session.name is set" and "handleReconnect clears stale roomCode when room no longer exists". Server test count: 61→63.)

Last updated: 2026-06-21 (Google avatars in game session: `RoomUpdatePayload` in `packages/web/src/protocol.ts` gains `playerAvatarUrls: Record<string, string | null>`; `GameProvider` adds `playerAvatarUrls` state (extracted from `onRoomUpdate`, reset in `leaveRoom`, exposed in useMemo + deps); `GameContextValue` adds `playerAvatarUrls` field; `OpponentSeat` gains `avatarUrl?: string | null` prop — renders `<img>` when truthy, falls back to initials span; `.seat__avatar-img` CSS added (100% width/height, border-radius 50%, object-fit cover); `GameScreen` pulls `playerAvatarUrls` from context and passes `avatarUrl={isYou ? account?.avatarUrl : playerAvatarUrls[pid]}` to each `OpponentSeat`. `referrerPolicy="no-referrer"` on the img. Build green.)

Last updated: 2026-06-21 (playerAvatarUrls in ROOM_UPDATE: `RoomUpdatePayload` in `packages/server/src/protocol.ts` gains `playerAvatarUrls: Record<string, string | null>`; `broadcastRoomUpdate()` in `packages/server/src/handlers.ts` populates the map from `s?.account?.avatarUrl ?? null` for each player. All 61 server tests pass. Build green.)

Last updated: 2026-06-21 (Phase 6h — admin_get_stats live ops endpoint (server + web): `AdminServerStats`/`AdminGetStatsAck` types added to `packages/server/src/protocol.ts`; `ADMIN_GET_STATS='admin_get_stats'` added to `EVENTS`; `admin_get_stats` handler added to `handlers.ts` (admin-auth gate, iterates `store.rooms` by phase, counts connected sessions); 3 new tests in `admin.test.ts` (58→61 server tests). Web: `AdminServerStats`+`AdminGetStatsAck` mirrored in `packages/web/src/protocol.ts`; `GET_STATS` added to `ADMIN_EVENTS`; `AdminScreen.tsx` gains `fetchStats()`, 15-second auto-refresh, manual Refresh button, and Live Ops section (4 stat tiles: Connected/Active games/In lobby/Total rooms); `AdminScreen.css` adds stats grid + responsive 2-column breakpoint. Build green. Total: 153 engine + 133 db + 61 server = 347.)

Last updated: 2026-06-21 (Phase 7e admin auth hardening — server: `isValidAdminSecret(secret)` added to `config.ts` (reads `ADMIN_SECRET` from `process.env` at call time; returns true when unset for backward compat); `isAdminEmail` also switched to read-at-call-time for test isolation; `AdminAuthPayload` gains optional `secret?` field in `protocol.ts`; `admin_auth` handler uses combined `isAdminEmail && isValidAdminSecret(payload.secret ?? '')` check; `ADMIN_SECRET=` added to `.env.example`; 4 new tests in `admin.test.ts` (54→58 server tests). Web: `AdminAuthPayload { email; secret? }` in `protocol.ts`; `AdminScreen` adds password input (placeholder "leave blank if not configured"), emits `{ email, secret }`, updates subtitle + `not_authorized` error text; button disabled guard requires only `email.trim()` (not secret, since server accepts empty secret when `ADMIN_SECRET` unset). Build green. Total: 153 engine + 133 db + 58 server = 344.)

Last updated: 2026-06-20 (update_display_name web client: `UpdateDisplayNamePayload`/`UpdateDisplayNameAck` added to `packages/web/src/protocol.ts`; `UPDATE_DISPLAY_NAME` event constant added; `updateDisplayName(newDisplayName)` helper added to `net/socket.ts`; `GameContextValue` gains `updateDisplayName: (newName: string) => Promise<UpdateDisplayNameAck>` exposed via `GameProvider` useMemo; `LobbyScreen` gains inline display-name editor (Edit button next to name → text input + Save/Cancel; INVALID_NAME → "Name cannot be empty.", UNAVAILABLE → "Unavailable, try again."; SESSION re-emit auto-updates displayed name; same-name no-ops; Save disabled while in-flight). `LobbyScreen.css` adds `.lobby__name-row`, `.lobby__name-edit-btn`, `.lobby__name-edit`, `.lobby__name-input`, `.lobby__name-edit-actions`, `.lobby__name-save-btn`, `.lobby__name-cancel-btn`, `.lobby__name-edit-error`. Build green.)

Last updated: 2026-06-20 (update_display_name — DB + server + web + review fixes: `updateUserDisplayName(userId, newDisplayName)` added to `GamePersistence` interface, `PgPersistence` (Drizzle `.update(users).set({ displayName })`), and `MemoryPersistence` (Map update in-place); +2 contract test cases run against both impls = 4 test runs (DB: 129→133). Server: `UpdateDisplayNamePayload`/`UpdateDisplayNameAck` + `EVENTS.UPDATE_DISPLAY_NAME='update_display_name'` in `protocol.ts`; `handleUpdateDisplayName` in `handlers.ts` (combined NOT_LOGGED_IN+account-null guard, sanitize→INVALID_NAME, no-persistence→UNAVAILABLE, DB error→UNAVAILABLE; on success mutates `session.account.displayName` + calls `updateSession({name})` + re-emits SESSION + acks `{ok:true,displayName}`); wired in `registerSocketEvents`. +4 integration tests in `account.test.ts` (guest→NOT_LOGGED_IN, persistence-drops-out→UNAVAILABLE, blank name→INVALID_NAME, happy path verifies ack+SESSION re-emit+persistence). Web: inline editor in LobbyScreen (aria-label on input+button, save/cancel/busy/error states); `updateDisplayName` uses `emitAck` helper. Server: 50→54 tests. Total: 153 engine + 133 db + 54 server = 340.)

Last updated: 2026-06-20 (Phase 6c guest→registered upgrade — server+DB complete: `mergeGuestIntoUser(guestUserId, registeredUserId)` added to `GamePersistence` interface and implemented in both `PgPersistence` (transaction: re-points game_players/games.winner_id/game_events.actor_user_id/rooms.host_user_id, sums player_stats, deletes guest user; UUID-format guard prevents invalid UUID errors) and `MemoryPersistence` (same logic on Maps). `GUEST_COOKIE_NAME/buildGuestCookie/buildClearGuestCookie` added to `packages/server/src/auth/session.ts`. `/auth/google/login` handler captures `?session_token=` and sets a short-lived httpOnly `ganatri_guest` cookie. OAuth callback reads the cookie, looks up the in-memory session, calls `mergeGuestIntoUser` (non-fatal if it fails), then clears the guest cookie on both success and error paths. +4 contract tests in `packages/db/tests/memory.test.ts` (merge with no prior stats, merge with existing stats, no-op same-id, no-op guest not found; run against both PgPersistence+MemoryPersistence = 8 test runs). DB: 121→129 tests, server: 50 unchanged.)

Last updated: 2026-06-20 (schema drift-guard: added `player_stats.sum_finish_positions` column-existence test to `packages/db/tests/schema.test.ts` — asserts integer type, NOT NULL, and DEFAULT 0; db test count 120→121.)

Last updated: 2026-06-20 (windowed leaderboard bug fix: `PgPersistence.getLeaderboard` and `PgPersistence.getMyLeaderboardRank` both had a missing `AND g.is_abandoned = false` in their windowed CTE WHERE clauses, causing divergent results vs `MemoryPersistence` when abandoned games exist. Fixed both CTEs; also removed dead `HAVING COUNT(*) > 0` from both. `handleGetLeaderboard` in `handlers.ts` now validates `timeWindow` at runtime (strips non-`'week'|'month'` values to `undefined`). New contract test `'week window excludes abandoned games'` added to `memory.test.ts` (runs against both Pg+Memory = 2 new tests). DB: 118→120, server: 50 unchanged. Total: 153 engine + 120 db + 50 server = 323.)

Last updated: 2026-06-20 (time-windowed leaderboard UI: `GetLeaderboardRequest { timeWindow?: 'week' | 'month' }` added to `packages/web/src/protocol.ts`. `requestLeaderboard(timeWindow?)` in `net/socket.ts` now always sends a payload object `{ timeWindow }` (previously no payload). `GameProvider` `requestLeaderboard` callback and `GameContextValue` type signature both updated to accept optional `timeWindow`. `LeaderboardScreen.tsx` gains a three-tab switcher ("All Time" / "This Week" / "This Month") above the table; `timeWindow` state drives re-fetches via `useEffect` dep; switching tabs resets to loading state; empty-state message is time-window-aware. `LeaderboardScreen.css` adds `.lb__tabs`, `.lb__tab`, `.lb__tab--active` (flex row, border/background highlight using `--accent` gold). `myEntry` section and `isMe` row highlight continue to work for all time windows. Build green.)

Last updated: 2026-06-20 (leaderboard myEntry — server+db: `RankedLeaderboardEntry` interface added to `packages/db/src/persistence/types.ts` (extends `LeaderboardEntry` with `rank: number`); `getMyLeaderboardRank(userId)` added to `GamePersistence` interface and implemented in both `PgPersistence` (CTE + ROW_NUMBER window fn via raw `execute`) and `MemoryPersistence` (sort+findIndex, same tiebreak as `getLeaderboard`). Exported from `packages/db/src/index.ts`. `GetLeaderboardAck` in `packages/server/src/protocol.ts` gains `myEntry?: LeaderboardEntryView` on the ok branch. `handleGetLeaderboard` in `handlers.ts` now takes `session: SessionState`; when `session.userId !== null` and the user is not already in the top entries, calls `getMyLeaderboardRank` and attaches the result as `myEntry` (guest connections and users inside the top page get no `myEntry`). +3 db contract tests (guest null, zero-games null, correct rank) + 1 server test (guest gets no myEntry). DB: 101→108 (3 new run against both Pg+Memory impls), server: 47→48. Total: 153 engine + 108 db + 48 server = 309.)

Last updated: 2026-06-20 (leaderboard myEntry: `GetLeaderboardAck` in `packages/web/src/protocol.ts` gains `myEntry?: LeaderboardEntryView` on the ok branch. `LeaderboardScreen.tsx` `LoadState` ready variant gains `myEntry?`; `useEffect` passes `ack.myEntry` to state; render wraps existing table in a fragment and appends a `.lb__my-rank` section (with `.lb__my-rank-label` header and a highlighted `LeaderboardRow isMe={true}`) when `state.myEntry` is set — appears only for logged-in users ranked outside the top 20. `LeaderboardScreen.css` adds `.lb__my-rank` (margin/padding/border-top separator, full width) and `.lb__my-rank-label` (small uppercase muted label). Build green.)

Last updated: 2026-06-19 (avgFinish denominator fix: `mapStatsView` in `handlers.ts` now uses `(gamesPlayed - gamesAbandoned)` as the denominator for `avgFinish` instead of `gamesPlayed`, preventing abandoned games from biasing the average downward. Updated `stats.test.ts` to seed `sumFinishPositions: 6` in the "returns seeded aggregate stats" test and assert `avgFinish === 1.5`; added `expect(ack.stats.avgFinish).toBe(0)` to the zero-stats test. Phase 2 test count footer corrected to 47/47. All 302 tests pass: 153 engine + 102 db + 47 server.)

Last updated: 2026-06-19 (avgFinish web mirror: added `avgFinish: number` to `PlayerStatsView` in `packages/web/src/protocol.ts` (after `longestWinStreak`); added `formatAvgFinish` helper + `StatCard` in `StatsScreen.tsx` (after Win rate card). Build green.)

Last updated: 2026-06-19 (Phase 6g — Display-name unification consistency fix: GameScreen now computes resolvedPlayerNames via useMemo (patches local player's entry when loggedIn, deps: playerNames/session.playerId/account). Part2Board and EndScreen now receive resolvedPlayerNames instead of raw playerNames. Body-level nameFor and lastEvent-effect name lambda both use resolvedPlayerNames — no more inline account?.loggedIn checks scattered in render. Build green.)

Last updated: 2026-06-19 (Phase 6f/6g — `get_leaderboard` vertical slice (db + server), mirroring the `get_my_stats` slice. DB: new `LeaderboardEntry` type + `GamePersistence.getLeaderboard(limit=20, offset=0)` in both Pg + Memory impls, plus a shared `toLeaderboardEntry`/`LeaderboardRowInput` mapper in `pg.ts` (winRate derived in JS, 0-guarded — never from SQL). Ordering: `gamesWon DESC, winRate DESC, gamesPlayed DESC, userId ASC`; excludes guests and zero-games users via an inner join on `users` (`isGuest=false AND gamesPlayed>0`). Exported from `packages/db/src/index.ts`. No schema/migration change (drift-guard stays green). 3 new contract cases in `memory.test.ts` (runs vs Pg+Memory): ordering/tiebreak, guest+zero-games exclusion, limit/offset pagination — db 95→101. Server: `LeaderboardEntryView`/`GetLeaderboardAck`/`EVENTS.GET_LEADERBOARD` in `protocol.ts`, PUBLIC `handleGetLeaderboard` + `mapLeaderboardEntry` (assigns 1-based `rank`, derives winRate) in `handlers.ts` — no session gate; only failure is no-persistence→`UNAVAILABLE`. 3 new tests in `leaderboard.test.ts` (UNAVAILABLE, ranked entries to a guest, empty list) — server 44→47. Repo: engine 153 + db 101 + server 47.)

Last updated: 2026-06-19 (Phase 6g — global leaderboard screen (web): mirrors the `StatsScreen` slice for the new PUBLIC `get_leaderboard` socket event. `packages/web/src/protocol.ts` adds `LeaderboardEntryView` (`rank/userId/displayName/avatarUrl/gamesPlayed/gamesWon/winRate`) + `GetLeaderboardAck` (`{ok:true,entries}` | `{ok:false,error:'UNAVAILABLE'}` — no `NOT_LOGGED_IN`, guests can view) + `EVENTS.GET_LEADERBOARD='get_leaderboard'`. `net/socket.ts` adds `requestLeaderboard()`. `GameProvider` widens the `screen` union to include `'leaderboard'` and exposes `requestLeaderboard` (value + useMemo deps). New `LeaderboardScreen.tsx`/`.css`: loading/`UNAVAILABLE`/empty/ranked-table states; medal styling (🥇🥈🥉) for top 3, `#N` otherwise; avatar w/ initial fallback; highlights the current user's row (`entry.userId === session.playerId`) via `.lb__row--me`. Lobby gains an always-visible "Leaderboard" button (guests + logged-in). App routing branch added. `npm run build -w @ganatri/web` green; no web tests/lint. Server `get_leaderboard` handler is the parent agent's responsibility.)

Last updated: 2026-06-19 (Phase 6e/6g — personal player-stats: new `get_my_stats` socket endpoint + `StatsScreen` dashboard, mirroring the `REQUEST_HISTORY`/`HistoryScreen` slice. Server adds `PlayerStatsView`/`GetMyStatsAck`/`EVENTS.GET_MY_STATS` (`protocol.ts`), `handleGetMyStats` + `mapStatsView`/`zeroStatsView` (`handlers.ts`) reusing the DB `getPlayerStats`; guest→`NOT_LOGGED_IN`, no-persistence/throw→`UNAVAILABLE`, logged-in→flat `PlayerStatsView` with derived `winRate` (0-guarded) + ISO `updatedAt`, null-row→zeroed view. 4 new tests in `stats.test.ts` (server 40→44). Web mirrors the wire contract byte-for-byte, adds `requestMyStats()` (`net/socket.ts`), `screen` union widened to 'stats' + `requestMyStats` in `GameProvider`, a Lobby "Stats" button, App routing, and `StatsScreen.tsx`/`.css` (stat-card grid; empty state at 0 games). No schema migration. Code-review verdict: ship it (no Critical/Important). Repo: engine 153 + db 95 + server 44 = 292.)

Last updated: 2026-06-19 (Phase B/C review fixes — server: FIXED the history wire-contract mismatch. The `REQUEST_HISTORY` ack was sending the DB's NESTED `GameHistoryEntry` (`entry.game.*`, `Date` fields), but the web client expects a FLAT entry with top-level `id/startedAt/endedAt/durationMs/playerCount/isAbandoned/winnerId` + ISO-string timestamps, so the history list rendered broken. `server/src/protocol.ts` now declares its own flat `GameHistoryEntry`/`GameHistoryPlayer` (no longer re-exports the db type), matching `packages/web/src/protocol.ts` field-for-field; `handlers.ts` adds a `flattenHistoryEntry` mapper (explicit `.toISOString()`). New contract-guard test in `history.test.ts` asserts the acked entry is flat (`.game` undefined, `startedAt` an ISO string). Also: gated cookie `Secure` behind `cookiesSecure()`/`INSECURE_COOKIES` (local-HTTP dev) threaded through `buildSessionCookie/buildClearCookie/buildStateCookie/buildClearStateCookie` (default secure unchanged); NaN-guarded numeric env via `numEnv()` (`SESSION_TTL_DAYS`, `RETENTION_DAYS`); `oauth.ts exchangeCode` now nulls the email when `email_verified !== true` (anti account-linking-by-unverified-email). `.env.example` documents `INSECURE_COOKIES`. Server tests 39 → 40, all green. Repo: engine 153 + db 95 + server 40.)

Last updated: 2026-06-19 (Phase C — web client: optional Google login + game-history/score-card screen. Socket now connects `withCredentials:true` so the `ganatri_session` cookie rides the handshake; added `requestHistory()` + `loginWithGoogle()`/`logout()` (full-page nav to `/auth/google/login|logout`) in `net/socket.ts`, exported `SERVER_URL`. `protocol.ts` mirrors `REQUEST_HISTORY` event + `RequestHistoryAck`/`GameHistoryEntry`/`GameHistoryPlayer` and extends `SessionPayload` with `loggedIn`+account fields. `GameProvider` gains `account`, `screen`/`setScreen` ('main'|'history'), `requestHistory`/`loginWithGoogle`/`logout`; `onSession` populates `account`. `LobbyScreen` shows a Google login button when logged out (guest flow untouched & primary) and avatar+name+History+Log out when logged in, plus `?login=error` inline handling. New `HistoryScreen` (+`.css`) routed via `screen` state in App: loading/NOT_LOGGED_IN/UNAVAILABLE/empty/list states; each row expands to a framer-motion score card. `npm run build -w @ganatri/web` green; no web tests/lint to run.)

Last updated: 2026-06-19 (Phase B — server: optional Google OAuth login + durable identity, `REQUEST_HISTORY` socket endpoint, and a daily retention prune job. New `server/src/auth/` modules (`oauth.ts`, `session.ts`, `sessionMiddleware.ts`); HTTP routes `GET /auth/google/login|callback|logout` added to the hand-rolled `createApp.ts` handler; CORS switched from `CORS_ORIGIN` `*` to `WEB_ORIGIN` + `credentials:true` (falls back to `*` w/o credentials when unset) on both HTTP + socket.io. Socket `io.use` middleware resolves a logged-in user from the `ganatri_session` cookie → `socket.data.userId/account`; never throws → guest fallback. `SESSION` payload gains `{loggedIn, displayName?, email?, avatarUrl?}`; logged-in `playerId === users.id`. Daily retention runner prunes events + abandoned games older than `RETENTION_DAYS=30`; fixed an interval leak by clearing BOTH the 60s room-cleanup and the new daily handle in `createApp.close()`. Entire feature is a no-op when Google env vars / `DATABASE_URL` are unset; guests unchanged. Server tests 28 → 39, all green. New config: `GOOGLE_CLIENT_ID/SECRET`, `OAUTH_REDIRECT_URI`, `WEB_ORIGIN`, `SESSION_TTL_DAYS`. Added `google-auth-library` dep.)  
Last updated: 2026-06-19 (Phase A — DB layer for accounts/auth/history/retention: added `avatarUrl` to `users`, new `oauth_accounts` + `auth_sessions` tables, retention indexes (`game_events.ts`, `games(is_abandoned, ended_at)`); migration `0001_broken_joystick.sql`. New `GamePersistence` methods: `upsertOAuthUser`, `createAuthSession`, `getUserBySessionTokenHash`, `revokeAuthSession`, `getUserGameHistory`, `pruneGameEventsBefore`, `pruneAbandonedGamesBefore` in both Pg + Memory impls. db tests now 95 (was 69), all green. DB-layer only — server/web not yet touched.)  
Last updated: 2026-06-19 (Phase 6d/6e: wired DB write-through into the server — new `server/src/persistence.ts` service + `handlers.ts` calls. Persists `rooms` (on game start), `games`, `game_players`, `game_events` (async, seq-ordered, batched), and incremental `player_stats` on game-end/abandon. Async fire-and-forget — never blocks the engine; `getPersistence()` returns null when `DATABASE_URL` unset. Restart-rehydration via `loadActiveGames` deferred / out of scope; 28 server tests, 2 new.)  
Last updated: 2026-06-18 (Phase 6a/6b: fixed @ganatri/db foundation — node-postgres Pool + DATABASE_URL, text seed, regenerated migration; built fully-tested GamePersistence layer (Pg + Memory); review fixes: idempotent recordGameFinished via (game_id, seat_index) unique index, deterministic+batched loadActiveGames, isGuest preservation on upsert)  
Last updated: 2026-06-16 (Voice perf/heat fixes: room-gated mic acquisition, watchdog backoff+cap, AudioContext suspend while muted/idle; Critical fixes: TURN_TIMEOUT event, XSS sanitization, grace expiry broadcast, DRY refactor, freeze duration; 26 server tests)  
All 441 tests passing (153 engine + 102 server + 186 db).

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

**Current priority: resume remaining Phase 6 work (6i/6j privacy/ops), then Phase 5 voice smoke test, then production/deployment follow-ups.**

**How to add a priority item:** insert a `- [ ]` line between the two markers below, e.g.
`- [ ] **Fix leaderboard pagination off-by-one** — packages/server handlers.ts; offset should be page*limit. Acceptance: new server test covers page 2.`

<!-- PRIORITY_TODO:START -->
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


**Test count: 102 / 102 passing.**

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
| Wire accounts into existing session flow | ✅ | Socket `io.use` middleware (`server/src/auth/sessionMiddleware.ts`) resolves the cookie → `getUserBySessionTokenHash` → `socket.data.userId/account`; `handlers.ts` `issueNewSession`/`bindAccount` bind a durable `playerId === users.id` for logged-in users (random uuid for guests) and emit account fields in `SESSION`. Reconnect path preserved. HTTP routes `GET /auth/google/login|callback|logout` added to `createApp.ts`. |
| Guest → registered upgrade flow | ✅ | `mergeGuestIntoUser` in both Pg+Memory impls; OAuth callback reads `ganatri_guest` cookie and calls merge (non-fatal). `loginWithGoogle()` passes `?session_token=<token>`. |
| Account settings | 🟡 | Edit display name + avatar, link/unlink OAuth, change email, delete account (ties to 6i). Display-name edit now complete (server + web). Avatar/link/unlink/delete remain. |
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
| Extend `AdminScreen` with analytics views | 🟡 | Build on existing admin auth (harden first per Phase 7e). Live Ops tile section now live. |
| Live operations view | ✅ | `admin_get_stats` socket event; 4-tile grid (Connected / Active games / In lobby / Total rooms); 15 s auto-refresh + manual Refresh button; responsive 2-column on mobile. |
| KPI charts | ✅ | Full stack complete. DB: `getAdminKpiStats(windowDays=7)` in `GamePersistence` (Pg raw SQL + Memory impl); 6 contract tests. Server: `ADMIN_GET_KPI_STATS` event + handler (admin-auth gate, UNAVAILABLE guard); 3 integration tests in `admin-kpi.test.ts`. Web: `AdminKpiStats`/`AdminGetKpiStatsAck` types + `GET_KPI_STATS` in `ADMIN_EVENTS`; `KpiSection` component (3 summary tiles + CSS-only bar chart, stacked completed/abandoned bars); `fetchKpi()` on auth + Refresh. |
| User management | ✅ | Full stack complete. DB + server layer: `searchUsers`/`adminGetUserStats` in `GamePersistence` + both impls; `ADMIN_SEARCH_USERS`/`ADMIN_GET_USER_STATS` socket events + handlers (8 integration tests). Web: `AdminUserView`/`AdminUserStatsView`/`AdminSearchUsersAck`/`AdminGetUserStatsAck` types added to `packages/web/src/protocol.ts`; `SEARCH_USERS`/`GET_USER_STATS` added to `ADMIN_EVENTS`; `UserManagementSection` component in `AdminScreen.tsx` (search bar, results list with avatar/initials/guest badge/games summary/View Stats button, user detail panel with 12-stat grid + formatted avg duration + updatedAt footer, back link); CSS classes added to `AdminScreen.css`. Mounted between KPI section and config fields. Build green. |
| Data export | ✅ | Full stack complete. DB: `ExportGameRow`/`ExportGamePlayer` types + `exportGamesData(limit?)` in `GamePersistence` interface, `PgPersistence` (2-query: games LEFT JOIN rooms ordered newest-first, then game_players by gameIds), `MemoryPersistence` (sort+slice+roomCode lookup); 4 new contract tests (empty + ordering/shape, runs × 2 impls). Server: `ExportGameView`/`ExportGamePlayerView`/`AdminExportDataPayload`/`AdminExportDataAck` types in `protocol.ts`; `ADMIN_EXPORT_DATA='admin_export_data'` in EVENTS; `handleAdminExportData` handler (admin-auth gate, UNAVAILABLE guard, limit clamped to 500); 3 integration tests in `admin-export.test.ts` (NOT_AUTHORIZED / UNAVAILABLE / empty ok). DB: 176→180 tests. Server: 91→94 tests. Web: `ExportGamePlayerView`/`ExportGameView`/`AdminExportDataAck` types + `EXPORT_DATA: 'admin_export_data'` added to `packages/web/src/protocol.ts`; "Data Export" section added to `AdminScreen.tsx` (after User Management, before config sliders) with "Export Games (JSON)" button, Exporting... loading state, inline error message; on success creates a Blob, clicks a hidden `<a download="ganatri-export.json">` link, revokes object URL; `exportLoading`/`exportError` state; `.admin__export-section` + `.admin__export-btn` CSS classes in `AdminScreen.css`. Build green. |
| Secure admin data endpoints | 🟡 | All analytics/admin queries behind hardened admin auth + authorization checks. `admin_get_stats` now requires admin auth; more endpoints forthcoming. |
| `admin_get_stats` live ops endpoint (server) | ✅ | Returns totalRooms/lobbyRooms/activeGames/completedRooms/connectedPlayers/totalSessions; 3 tests in admin.test.ts |

### 6i — Privacy, retention & compliance

| Task | Status | Notes |
| ---- | ------ | ----- |
| Privacy policy & consent | ⬜ | Publish a policy; obtain consent for analytics where required; cookie/localStorage disclosure. |
| Data export (right to access) | ⬜ | Let a user download their account data (GDPR/CCPA). |
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
| Phase 2 — Server             | ✅ Complete (102 tests; TURN_TIMEOUT + sanitization + grace expiry broadcast + DRY refactor + freeze fix + DB write-through + OAuth/history/retention + flat history wire-contract fix + `get_my_stats` + `get_leaderboard` + `myEntry` in leaderboard ack + time-windowed leaderboard + `timeWindow` runtime validation + `update_display_name` + admin secret check + `admin_get_stats` live ops endpoint + session-persistence flow fixes + `get_recent_players` + invitation system + `get_blocked_users` + `admin_get_kpi_stats` KPI endpoint + `admin_search_users`/`admin_get_user_stats` user management + `admin_export_data` + `delete_account` right-to-erasure) |
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
| Phase 6i — Account deletion (right to erasure) | ✅ Complete (full stack: DB + server + web; 441 total tests) |

