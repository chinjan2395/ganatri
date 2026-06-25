# Web Component Inventory

Private reference for the non-admin web app. Admin routes are excluded.

Notes:
- Typography, spacing, and most backgrounds are CSS/token driven, so they are called out in the overview rather than listed as component cards.
- `Ganatri Logo` is included as an asset because it is part of the web app inventory, even though it is not a React component.
- `Chip` exists in the codebase but is not currently referenced by the non-admin app.

## Design System Primitives

| Component | Context | Purpose | Source | Used in | Scope | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `DsButton` | DesignSystemScreen | Button primitive with primary, secondary, danger, and ghost tones. | `packages/web/src/design-system/DesignSystemPrimitives.tsx` | `DesignSystemScreen` | Shared |  |
| `DsCard` | DesignSystemScreen | Generic surface container with optional title and subtitle. | `packages/web/src/design-system/DesignSystemPrimitives.tsx` | `DesignSystemScreen` | Shared |  |
| `DsBadge` | DesignSystemScreen | Status pill used for tones like success, warning, danger, and info. | `packages/web/src/design-system/DesignSystemPrimitives.tsx` | `DesignSystemScreen` | Shared |  |
| `DsField` | DesignSystemScreen | Read-only field shell with label and helper text. | `packages/web/src/design-system/DesignSystemPrimitives.tsx` | `DesignSystemScreen` | Shared |  |
| `DsListRow` | DesignSystemScreen | List row with avatar, copy block, and optional trailing content. | `packages/web/src/design-system/DesignSystemPrimitives.tsx` | `DesignSystemScreen` | Shared |  |
| `DsStat` | DesignSystemScreen | Compact stat card with label, value, and optional delta. | `packages/web/src/design-system/DesignSystemPrimitives.tsx` | `DesignSystemScreen` | Shared |  |
| `DsTabs` | DesignSystemScreen | Simple tab list used to preview active and inactive tab states. | `packages/web/src/design-system/DesignSystemPrimitives.tsx` | `DesignSystemScreen` | Shared |  |
| `DsAlert` | DesignSystemScreen | Inline alert block used for success, warning, danger, and info states. | `packages/web/src/design-system/DesignSystemPrimitives.tsx` | `DesignSystemScreen` | Shared |  |
| `DsPageHeader` | DesignSystemScreen | Large page hero with eyebrow, title, description, and optional actions. | `packages/web/src/design-system/DesignSystemPrimitives.tsx` | `DesignSystemScreen` | Shared |  |
| `DsSection` | DesignSystemScreen | Reusable section wrapper with heading and description. | `packages/web/src/design-system/DesignSystemPrimitives.tsx` | `DesignSystemScreen` | Shared |  |

## Foundations

| Component | Context | Purpose | Source | Used in | Scope | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Card` | Shared game primitive | Animated playing-card component with selection, highlight, and size variants. | `packages/web/src/components/Card.tsx` | `Hand`, `Part1Board`, `Part2Board` | Shared |  |
| `Chip` | Shared game primitive | Animated chip/token component with color variants. | `packages/web/src/components/Chip.tsx` | Not currently referenced | Shared | Defined in the codebase, but currently unused in the non-admin app. |

## Game UI

| Component | Context | Purpose | Source | Used in | Scope | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `OpponentSeat` | GameScreen | Opponent seat display with name, avatar, and speaking state. | `packages/web/src/components/OpponentSeat.tsx` | `GameScreen` | Shared |  |
| `Hand` | GameScreen | Player hand with drag-to-reorder support for the second game phase. | `packages/web/src/components/Hand.tsx` | `GameScreen` | Shared |  |
| `Part1Board` | GameScreen | Phase-one board for capture selection and move preview. | `packages/web/src/components/Part1Board.tsx` | `GameScreen` | Shared |  |
| `Part2Board` | GameScreen | Phase-two board for cut / trick resolution and play history. | `packages/web/src/components/Part2Board.tsx` | `GameScreen` | Shared |  |
| `CapturedPile` | GameScreen | Portal-rendered pile of captured cards with suit grouping. | `packages/web/src/components/CapturedPile.tsx` | `GameScreen` | Shared |  |
| `TurnTimer` | GameScreen | Turn countdown bar with urgent-state styling. | `packages/web/src/components/TurnTimer.tsx` | `GameScreen` | Shared |  |
| `CutAnimation` | GameScreen | Full-screen animation that plays when a player cuts the deck. | `packages/web/src/components/CutAnimation.tsx` | `GameScreen` | Shared |  |
| `EndScreen` | GameScreen | Post-game results screen with rankings, scoring, and progression. | `packages/web/src/components/EndScreen.tsx` | `GameScreen` | Shared |  |

## Shell & Feedback

| Component | Context | Purpose | Source | Used in | Scope | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Toast` | App shell | Dismissible error toast rendered by the app shell. | `packages/web/src/components/Toast.tsx` | `App.tsx` | Shared |  |
| `ConnectionBanner` | App shell | Connectivity banner shown when the socket drops or reconnects. | `packages/web/src/components/ConnectionBanner.tsx` | `App.tsx` | Shared |  |
| `InviteToast` | App shell | Invite notification that appears above the main app shell. | `packages/web/src/components/InviteToast.tsx` | `App.tsx` | Shared |  |
| `VoicePttFab` | VoiceChatProvider | Private push-to-talk floating action button rendered from the voice provider. | `packages/web/src/state/VoiceChatProvider.tsx` | `VoiceChatProvider`, `App.tsx` | Screen-local | Internal helper component, not exported on its own. |

## Screen Composites

| Component | Context | Purpose | Source | Used in | Scope | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `LobbyScreen` | Lobby | Landing screen for creating rooms, joining rooms, and navigating to profile views. | `packages/web/src/screens/LobbyScreen.tsx` | `App.tsx (default screen)` | Route |  |
| `RoomScreen` | Room | Lobby room screen for seat selection, room details, voice chat, and activity. | `packages/web/src/screens/RoomScreen.tsx` | `App.tsx (room state)` | Route |  |
| `GameScreen` | Game | In-game screen that hosts the active match UI. | `packages/web/src/screens/GameScreen.tsx` | `App.tsx (active game state)` | Route |  |
| `LeaderboardScreen` | Leaderboard | Leaderboard route showing rankings and personal performance context. | `packages/web/src/screens/LeaderboardScreen.tsx` | `App.tsx (navigation route)` | Route |  |
| `HistoryScreen` | History | Match history route with recent results and win-rate context. | `packages/web/src/screens/HistoryScreen.tsx` | `App.tsx (navigation route)` | Route |  |
| `StatsScreen` | Stats | Stats route for personal performance, modes, and progression metrics. | `packages/web/src/screens/StatsScreen.tsx` | `App.tsx (navigation route)` | Route |  |
| `SessionsScreen` | Sessions | Session-management route that shows active auth sessions and revoke actions. | `packages/web/src/screens/SessionsScreen.tsx` | `App.tsx (navigation route)` | Route |  |

## Interaction Patterns

### Lobby

| Component | Context | Purpose | Source | Used in | Scope | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `LobbyHeader` | Lobby | Lobby header with profile, avatar, and settings access. | `packages/web/src/screens/LobbyScreen.tsx` | `LobbyScreen` | Screen-local |  |
| `CreateJoinPanel` | Lobby | Create-room and join-room form block. | `packages/web/src/screens/LobbyScreen.tsx` | `LobbyScreen` | Screen-local |  |
| `QuickActions` | Lobby | Quick-action tiles for leaderboard, invite, and how-to-play. | `packages/web/src/screens/LobbyScreen.tsx` | `LobbyScreen` | Screen-local |  |
| `RecentlyPlayed` | Lobby | Recently played player grid with invite actions. | `packages/web/src/screens/LobbyScreen.tsx` | `LobbyScreen` | Screen-local |  |
| `DesktopSidebar` | Lobby | Desktop-only sidebar that surfaces top players and personal stats. | `packages/web/src/screens/LobbyScreen.tsx` | `LobbyScreen` | Screen-local |  |
| `MobileBottomNav` | Lobby | Mobile bottom navigation for home, history, stats, and profile. | `packages/web/src/screens/LobbyScreen.tsx` | `LobbyScreen` | Screen-local |  |
| `ProfilePanel` | Lobby | Profile modal for display-name edits, blocked users, and account actions. | `packages/web/src/screens/LobbyScreen.tsx` | `LobbyScreen` | Screen-local |  |
| `HowToPlayModal` | Lobby | Rules modal that explains Part 1 and Part 2 gameplay. | `packages/web/src/screens/LobbyScreen.tsx` | `LobbyScreen` | Screen-local |  |

### Room

| Component | Context | Purpose | Source | Used in | Scope | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `DetailIcon` | Room | Icon helper for room metadata rows such as code, mode, players, fee, and voice. | `packages/web/src/screens/RoomScreen.tsx` | `RoomScreen` | Screen-local |  |
| `CopyIcon` | Room | Copy icon used in room-code actions. | `packages/web/src/screens/RoomScreen.tsx` | `RoomScreen` | Screen-local |  |
| `LinkIcon` | Room | Share-link icon used in room actions. | `packages/web/src/screens/RoomScreen.tsx` | `RoomScreen` | Screen-local |  |
| `MicIcon` | Room | Microphone icon that changes to a muted state. | `packages/web/src/screens/RoomScreen.tsx` | `RoomScreen` | Screen-local |  |
| `SeatSlot` | Room | Individual seat slot on the room table with avatar and host state. | `packages/web/src/screens/RoomScreen.tsx` | `RoomScreen` | Screen-local |  |
| `OvalTable` | Room | Oval room table that positions all seat slots around the board. | `packages/web/src/screens/RoomScreen.tsx` | `RoomScreen` | Screen-local |  |
| `VoiceChatPanel` | Room | Voice chat controls and participant display for room play. | `packages/web/src/screens/RoomScreen.tsx` | `RoomScreen` | Screen-local |  |
| `ActivityPanel` | Room | Activity and chat panel with tab switching and message input stub. | `packages/web/src/screens/RoomScreen.tsx` | `RoomScreen` | Screen-local |  |
| `RoomDetailsSidebar` | Room | Room details sidebar with code, mode, players, fee, host, and voice status. | `packages/web/src/screens/RoomScreen.tsx` | `RoomScreen` | Screen-local |  |
| `FriendsOnlineSidebar` | Room | Friends-online and recent-opponent sidebars with invite actions. | `packages/web/src/screens/RoomScreen.tsx` | `RoomScreen` | Screen-local |  |
| `RoomFooterDecor` | Room | Decorative footer cards and chips used in the room layout. | `packages/web/src/screens/RoomScreen.tsx` | `RoomScreen` | Screen-local |  |
| `RoomHeaderMobile` | Room | Mobile room header with back, copy, and overflow menu actions. | `packages/web/src/screens/RoomScreen.tsx` | `RoomScreen` | Screen-local |  |
| `RoomHeaderDesktop` | Room | Desktop room header with logo, room title, and exit button. | `packages/web/src/screens/RoomScreen.tsx` | `RoomScreen` | Screen-local |  |

### Leaderboard

| Component | Context | Purpose | Source | Used in | Scope | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `MedalIcon` | Leaderboard | Leaderboard medal glyph for top-three ranks and fallback numeric ranks. | `packages/web/src/screens/LeaderboardScreen.tsx` | `LeaderboardScreen` | Screen-local |  |
| `TitleFlourish` | Leaderboard | Decorative title flourish used in stats-style section headings. | `packages/web/src/screens/LeaderboardScreen.tsx` | `LeaderboardScreen` | Screen-local |  |
| `CrownIcon` | Leaderboard | Crown icon used for top-player and host emphasis. | `packages/web/src/screens/LeaderboardScreen.tsx` | `LeaderboardScreen` | Screen-local |  |
| `LeaderboardRow` | Leaderboard | Leaderboard entry row with rank, avatar, and win counts. | `packages/web/src/screens/LeaderboardScreen.tsx` | `LeaderboardScreen` | Screen-local |  |
| `LeaderboardHeader` | Leaderboard | Leaderboard page header with profile access and navigation. | `packages/web/src/screens/LeaderboardScreen.tsx` | `LeaderboardScreen` | Screen-local |  |
| `LeaderboardProfileSidebar` | Leaderboard | Sidebar with account context and quick stats for the leaderboard view. | `packages/web/src/screens/LeaderboardScreen.tsx` | `LeaderboardScreen` | Screen-local |  |
| `LeaderboardBottomNav` | Leaderboard | Bottom navigation for the leaderboard screen. | `packages/web/src/screens/LeaderboardScreen.tsx` | `LeaderboardScreen` | Screen-local |  |

### History

| Component | Context | Purpose | Source | Used in | Scope | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `TitleFlourish` | History | Decorative title flourish used in the history screen heading. | `packages/web/src/screens/HistoryScreen.tsx` | `HistoryScreen` | Screen-local |  |
| `CrownIcon` | History | Crown icon reused for host and top-player emphasis in history. | `packages/web/src/screens/HistoryScreen.tsx` | `HistoryScreen` | Screen-local |  |
| `HistoryHeader` | History | History page header with account context and navigation. | `packages/web/src/screens/HistoryScreen.tsx` | `HistoryScreen` | Screen-local |  |
| `HistoryProfileSidebar` | History | Sidebar profile and summary block for the history view. | `packages/web/src/screens/HistoryScreen.tsx` | `HistoryScreen` | Screen-local |  |
| `MobileProfileStrip` | History | Compact mobile profile strip used in history and stats views. | `packages/web/src/screens/HistoryScreen.tsx` | `HistoryScreen`, `StatsScreen` | Screen-local |  |
| `HistoryBottomNav` | History | Bottom navigation for the history screen. | `packages/web/src/screens/HistoryScreen.tsx` | `HistoryScreen` | Screen-local |  |
| `SummaryBar` | History | History summary strip with totals, wins, and win rate. | `packages/web/src/screens/HistoryScreen.tsx` | `HistoryScreen` | Screen-local |  |
| `HistoryRow` | History | Match-history row with result, opponent, score, and timing details. | `packages/web/src/screens/HistoryScreen.tsx` | `HistoryScreen` | Screen-local |  |

### Stats

| Component | Context | Purpose | Source | Used in | Scope | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `TitleFlourish` | Stats | Decorative title flourish used in the stats screen heading. | `packages/web/src/screens/StatsScreen.tsx` | `StatsScreen` | Screen-local |  |
| `CrownIcon` | Stats | Crown icon reused for top-player and highlight states in stats. | `packages/web/src/screens/StatsScreen.tsx` | `StatsScreen` | Screen-local |  |
| `StatIcon` | Stats | Icon set for games, win rate, average finish, and similar stats. | `packages/web/src/screens/StatsScreen.tsx` | `StatsScreen` | Screen-local |  |
| `StatCard` | Stats | Stats summary card used for the headline metric tiles. | `packages/web/src/screens/StatsScreen.tsx` | `StatsScreen` | Screen-local |  |
| `StatsHeader` | Stats | Stats page header with account context and navigation. | `packages/web/src/screens/StatsScreen.tsx` | `StatsScreen` | Screen-local |  |
| `StatsProfileSidebar` | Stats | Profile sidebar used by the stats screen. | `packages/web/src/screens/StatsScreen.tsx` | `StatsScreen` | Screen-local |  |
| `MobileProfileStrip` | Stats | Compact mobile profile strip shared with the history view. | `packages/web/src/screens/StatsScreen.tsx` | `HistoryScreen`, `StatsScreen` | Screen-local |  |
| `StatsBottomNav` | Stats | Bottom navigation for the stats screen. | `packages/web/src/screens/StatsScreen.tsx` | `StatsScreen` | Screen-local |  |
| `PlayTimeBar` | Stats | Horizontal play-time bar visualisation. | `packages/web/src/screens/StatsScreen.tsx` | `StatsScreen` | Screen-local |  |
| `PerformancePlaceholder` | Stats | Placeholder state for the performance chart section. | `packages/web/src/screens/StatsScreen.tsx` | `StatsScreen` | Screen-local |  |
| `FavoriteCardsPlaceholder` | Stats | Placeholder state for favourite-card analytics. | `packages/web/src/screens/StatsScreen.tsx` | `StatsScreen` | Screen-local |  |
| `GameModesPlaceholder` | Stats | Placeholder state for mode breakdown analytics. | `packages/web/src/screens/StatsScreen.tsx` | `StatsScreen` | Screen-local |  |
| `AchievementsPlaceholder` | Stats | Placeholder state for achievements and milestones. | `packages/web/src/screens/StatsScreen.tsx` | `StatsScreen` | Screen-local |  |
| `RecentResults` | Stats | Recent results list used by the stats route. | `packages/web/src/screens/StatsScreen.tsx` | `StatsScreen` | Screen-local |  |

### Sessions

| Component | Context | Purpose | Source | Used in | Scope | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `SessionsHeader` | Sessions | Sessions page header with navigation back to the lobby. | `packages/web/src/screens/SessionsScreen.tsx` | `SessionsScreen` | Screen-local |  |
| `SessionRow` | Sessions | Session row with device details, dates, and revoke/logout actions. | `packages/web/src/screens/SessionsScreen.tsx` | `SessionsScreen` | Screen-local |  |

### Game

| Component | Context | Purpose | Source | Used in | Scope | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `PlayerWrap` | Game | Internal wrapper that subscribes a player to voice-speaking state. | `packages/web/src/screens/GameScreen.tsx` | `GameScreen` | Screen-local |  |

## Brand & Assets

| Component | Context | Purpose | Source | Used in | Scope | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Ganatri Logo` | Brand | Brand mark rendered in lobby, room, results, and stat-style screens. | `packages/web/src/assets/ganatri-logo.png` | `LobbyScreen`, `RoomScreen`, `LeaderboardScreen`, `HistoryScreen`, `StatsScreen`, `SessionsScreen`, `EndScreen` | Asset | Imported as an image asset rather than a React component. |
