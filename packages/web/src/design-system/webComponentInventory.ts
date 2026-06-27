export type WebComponentScope = 'shared' | 'screen-local' | 'route' | 'asset';

export type WebComponentCategoryId =
  | 'primitives'
  | 'foundations'
  | 'game-ui'
  | 'shell-feedback'
  | 'screen-composites'
  | 'interaction-patterns'
  | 'brand-assets';

export interface WebComponentCategory {
  id: WebComponentCategoryId;
  label: string;
  description: string;
}

export interface WebComponentInventoryItem {
  name: string;
  context?: string;
  categoryId: WebComponentCategoryId;
  purpose: string;
  source: string;
  usage: string[];
  scope: WebComponentScope;
  notes?: string;
}

export const WEB_COMPONENT_CATEGORIES: WebComponentCategory[] = [
  {
    id: 'primitives',
    label: 'Design System Primitives',
    description: 'Reusable primitives that power the private design-system page itself.',
  },
  {
    id: 'foundations',
    label: 'Foundations',
    description: 'Shared base building blocks and app-level primitives used across the non-admin web app.',
  },
  {
    id: 'game-ui',
    label: 'Game UI',
    description: 'Reusable game-board components that render play, turn flow, and end-of-match states.',
  },
  {
    id: 'shell-feedback',
    label: 'Shell & Feedback',
    description: 'App-shell banners, toasts, and voice controls that appear outside a single screen.',
  },
  {
    id: 'screen-composites',
    label: 'Screen Composites',
    description: 'Route-level screens used by the non-admin app.',
  },
  {
    id: 'interaction-patterns',
    label: 'Interaction Patterns',
    description: 'Screen-local headers, modals, rows, navs, and helper components used to compose each screen.',
  },
  {
    id: 'brand-assets',
    label: 'Brand & Assets',
    description: 'Non-component assets that are part of the web app inventory, such as the logo mark.',
  },
];

export const WEB_COMPONENT_INVENTORY: WebComponentInventoryItem[] = [
  // Design system primitives used by the private design-system route.
  {
    name: 'DsButton',
    context: 'DesignSystemScreen',
    categoryId: 'primitives',
    purpose: 'Button primitive with primary, secondary, danger, and ghost tones.',
    source: 'packages/web/src/design-system/DesignSystemPrimitives.tsx',
    usage: ['DesignSystemScreen'],
    scope: 'shared',
  },
  {
    name: 'DsCard',
    context: 'DesignSystemScreen',
    categoryId: 'primitives',
    purpose: 'Generic surface container with optional title and subtitle.',
    source: 'packages/web/src/design-system/DesignSystemPrimitives.tsx',
    usage: ['DesignSystemScreen'],
    scope: 'shared',
  },
  {
    name: 'DsBadge',
    context: 'DesignSystemScreen',
    categoryId: 'primitives',
    purpose: 'Status pill used for tones like success, warning, danger, and info.',
    source: 'packages/web/src/design-system/DesignSystemPrimitives.tsx',
    usage: ['DesignSystemScreen'],
    scope: 'shared',
  },
  {
    name: 'DsField',
    context: 'DesignSystemScreen',
    categoryId: 'primitives',
    purpose: 'Read-only field shell with label and helper text.',
    source: 'packages/web/src/design-system/DesignSystemPrimitives.tsx',
    usage: ['DesignSystemScreen'],
    scope: 'shared',
  },
  {
    name: 'DsListRow',
    context: 'DesignSystemScreen',
    categoryId: 'primitives',
    purpose: 'List row with avatar, copy block, and optional trailing content.',
    source: 'packages/web/src/design-system/DesignSystemPrimitives.tsx',
    usage: ['DesignSystemScreen'],
    scope: 'shared',
  },
  {
    name: 'DsStat',
    context: 'DesignSystemScreen',
    categoryId: 'primitives',
    purpose: 'Compact stat card with label, value, and optional delta.',
    source: 'packages/web/src/design-system/DesignSystemPrimitives.tsx',
    usage: ['DesignSystemScreen'],
    scope: 'shared',
  },
  {
    name: 'DsTabs',
    context: 'DesignSystemScreen',
    categoryId: 'primitives',
    purpose: 'Simple tab list used to preview active and inactive tab states.',
    source: 'packages/web/src/design-system/DesignSystemPrimitives.tsx',
    usage: ['DesignSystemScreen'],
    scope: 'shared',
  },
  {
    name: 'DsAlert',
    context: 'DesignSystemScreen',
    categoryId: 'primitives',
    purpose: 'Inline alert block used for success, warning, danger, and info states.',
    source: 'packages/web/src/design-system/DesignSystemPrimitives.tsx',
    usage: ['DesignSystemScreen'],
    scope: 'shared',
  },
  {
    name: 'DsPageHeader',
    context: 'DesignSystemScreen',
    categoryId: 'primitives',
    purpose: 'Large page hero with eyebrow, title, description, and optional actions.',
    source: 'packages/web/src/design-system/DesignSystemPrimitives.tsx',
    usage: ['DesignSystemScreen'],
    scope: 'shared',
  },
  {
    name: 'DsSection',
    context: 'DesignSystemScreen',
    categoryId: 'primitives',
    purpose: 'Reusable section wrapper with heading and description.',
    source: 'packages/web/src/design-system/DesignSystemPrimitives.tsx',
    usage: ['DesignSystemScreen'],
    scope: 'shared',
  },

  // Shared foundations used throughout the non-admin app.
  {
    name: 'Card',
    context: 'Shared game primitive',
    categoryId: 'foundations',
    purpose: 'Animated playing-card component with selection, highlight, and size variants.',
    source: 'packages/web/src/components/Card.tsx',
    usage: ['Hand', 'Part1Board', 'Part2Board'],
    scope: 'shared',
  },
  {
    name: 'Chip',
    context: 'Shared game primitive',
    categoryId: 'foundations',
    purpose: 'Animated chip/token component with color variants.',
    source: 'packages/web/src/components/Chip.tsx',
    usage: [],
    scope: 'shared',
    notes: 'Defined in the codebase, but currently unused in the non-admin app.',
  },

  // Game UI components.
  {
    name: 'OpponentSeat',
    context: 'GameScreen',
    categoryId: 'game-ui',
    purpose: 'Opponent seat display with name, avatar, and speaking state.',
    source: 'packages/web/src/components/OpponentSeat.tsx',
    usage: ['GameScreen'],
    scope: 'shared',
  },
  {
    name: 'Hand',
    context: 'GameScreen',
    categoryId: 'game-ui',
    purpose: 'Player hand with drag-to-reorder support for the second game phase.',
    source: 'packages/web/src/components/Hand.tsx',
    usage: ['GameScreen'],
    scope: 'shared',
  },
  {
    name: 'Part1Board',
    context: 'GameScreen',
    categoryId: 'game-ui',
    purpose: 'Phase-one board for capture selection and move preview.',
    source: 'packages/web/src/components/Part1Board.tsx',
    usage: ['GameScreen'],
    scope: 'shared',
  },
  {
    name: 'Part2Board',
    context: 'GameScreen',
    categoryId: 'game-ui',
    purpose: 'Phase-two board for cut / trick resolution and play history.',
    source: 'packages/web/src/components/Part2Board.tsx',
    usage: ['GameScreen'],
    scope: 'shared',
  },
  {
    name: 'CapturedPile',
    context: 'GameScreen',
    categoryId: 'game-ui',
    purpose: 'Portal-rendered pile of captured cards with suit grouping.',
    source: 'packages/web/src/components/CapturedPile.tsx',
    usage: ['GameScreen'],
    scope: 'shared',
  },
  {
    name: 'TurnTimer',
    context: 'GameScreen',
    categoryId: 'game-ui',
    purpose: 'Turn countdown bar with urgent-state styling.',
    source: 'packages/web/src/components/TurnTimer.tsx',
    usage: ['GameScreen'],
    scope: 'shared',
  },
  {
    name: 'CutAnimation',
    context: 'GameScreen',
    categoryId: 'game-ui',
    purpose: 'Full-screen animation that plays when a player cuts the deck.',
    source: 'packages/web/src/components/CutAnimation.tsx',
    usage: ['GameScreen'],
    scope: 'shared',
  },
  {
    name: 'EndScreen',
    context: 'GameScreen',
    categoryId: 'game-ui',
    purpose: 'Post-game results screen with rankings, scoring, and progression.',
    source: 'packages/web/src/components/EndScreen.tsx',
    usage: ['GameScreen'],
    scope: 'shared',
  },

  // App shell and feedback.
  {
    name: 'Toast',
    context: 'App shell',
    categoryId: 'shell-feedback',
    purpose: 'Dismissible error toast rendered by the app shell.',
    source: 'packages/web/src/components/Toast.tsx',
    usage: ['App.tsx'],
    scope: 'shared',
  },
  {
    name: 'ConnectionBanner',
    context: 'App shell',
    categoryId: 'shell-feedback',
    purpose: 'Connectivity banner shown when the socket drops or reconnects.',
    source: 'packages/web/src/components/ConnectionBanner.tsx',
    usage: ['App.tsx'],
    scope: 'shared',
  },
  {
    name: 'InviteToast',
    context: 'App shell',
    categoryId: 'shell-feedback',
    purpose: 'Invite notification that appears above the main app shell.',
    source: 'packages/web/src/components/InviteToast.tsx',
    usage: ['App.tsx'],
    scope: 'shared',
  },
  {
    name: 'VoicePttFab',
    context: 'VoiceChatProvider',
    categoryId: 'shell-feedback',
    purpose: 'Private push-to-talk floating action button rendered from the voice provider.',
    source: 'packages/web/src/state/VoiceChatProvider.tsx',
    usage: ['VoiceChatProvider', 'App.tsx'],
    scope: 'screen-local',
    notes: 'This helper is internal to the voice provider and not exported as a standalone component.',
  },

  // Route-level screen composites.
  {
    name: 'LobbyScreen',
    context: 'Lobby',
    categoryId: 'screen-composites',
    purpose: 'Landing screen for creating rooms, joining rooms, and navigating to profile views.',
    source: 'packages/web/src/screens/LobbyScreen.tsx',
    usage: ['App.tsx (default screen)'],
    scope: 'route',
  },
  {
    name: 'RoomScreen',
    context: 'Room',
    categoryId: 'screen-composites',
    purpose: 'Lobby room screen for seat selection, room details, voice chat, and activity.',
    source: 'packages/web/src/screens/RoomScreen.tsx',
    usage: ['App.tsx (room state)'],
    scope: 'route',
  },
  {
    name: 'GameScreen',
    context: 'Game',
    categoryId: 'screen-composites',
    purpose: 'In-game screen that hosts the active match UI.',
    source: 'packages/web/src/screens/GameScreen.tsx',
    usage: ['App.tsx (active game state)'],
    scope: 'route',
  },
  {
    name: 'LeaderboardScreen',
    context: 'Leaderboard',
    categoryId: 'screen-composites',
    purpose: 'Leaderboard route showing rankings and personal performance context.',
    source: 'packages/web/src/screens/LeaderboardScreen.tsx',
    usage: ['App.tsx (navigation route)'],
    scope: 'route',
  },
  {
    name: 'HistoryScreen',
    context: 'History',
    categoryId: 'screen-composites',
    purpose: 'Match history route with recent results and win-rate context.',
    source: 'packages/web/src/screens/HistoryScreen.tsx',
    usage: ['App.tsx (navigation route)'],
    scope: 'route',
  },
  {
    name: 'StatsScreen',
    context: 'Stats',
    categoryId: 'screen-composites',
    purpose: 'Stats route for personal performance, modes, and progression metrics.',
    source: 'packages/web/src/screens/StatsScreen.tsx',
    usage: ['App.tsx (navigation route)'],
    scope: 'route',
  },
  {
    name: 'SessionsScreen',
    context: 'Sessions',
    categoryId: 'screen-composites',
    purpose: 'Session-management route that shows active auth sessions and revoke actions.',
    source: 'packages/web/src/screens/SessionsScreen.tsx',
    usage: ['App.tsx (navigation route)'],
    scope: 'route',
  },

  // Screen-local interaction patterns and helper components.
  {
    name: 'LobbyHeader',
    context: 'Lobby',
    categoryId: 'interaction-patterns',
    purpose: 'Lobby header with profile, avatar, and settings access.',
    source: 'packages/web/src/screens/LobbyScreen.tsx',
    usage: ['LobbyScreen'],
    scope: 'screen-local',
  },
  {
    name: 'CreateJoinPanel',
    context: 'Lobby',
    categoryId: 'interaction-patterns',
    purpose: 'Create-room and join-room form block.',
    source: 'packages/web/src/screens/LobbyScreen.tsx',
    usage: ['LobbyScreen'],
    scope: 'screen-local',
  },
  {
    name: 'QuickActions',
    context: 'Lobby',
    categoryId: 'interaction-patterns',
    purpose: 'Quick-action tiles for leaderboard, invite, and how-to-play.',
    source: 'packages/web/src/screens/LobbyScreen.tsx',
    usage: ['LobbyScreen'],
    scope: 'screen-local',
  },
  {
    name: 'RecentlyPlayed',
    context: 'Lobby',
    categoryId: 'interaction-patterns',
    purpose: 'Recently played player grid with invite actions.',
    source: 'packages/web/src/screens/LobbyScreen.tsx',
    usage: ['LobbyScreen'],
    scope: 'screen-local',
  },
  {
    name: 'DesktopSidebar',
    context: 'Lobby',
    categoryId: 'interaction-patterns',
    purpose: 'Desktop-only sidebar that surfaces top players and personal stats.',
    source: 'packages/web/src/screens/LobbyScreen.tsx',
    usage: ['LobbyScreen'],
    scope: 'screen-local',
  },
  {
    name: 'MobileBottomNav',
    context: 'Lobby',
    categoryId: 'interaction-patterns',
    purpose: 'Mobile bottom navigation for home, history, stats, and profile.',
    source: 'packages/web/src/screens/LobbyScreen.tsx',
    usage: ['LobbyScreen'],
    scope: 'screen-local',
  },
  {
    name: 'ProfilePanel',
    context: 'Lobby',
    categoryId: 'interaction-patterns',
    purpose: 'Profile modal for display-name edits, blocked users, and account actions.',
    source: 'packages/web/src/screens/LobbyScreen.tsx',
    usage: ['LobbyScreen'],
    scope: 'screen-local',
  },
  {
    name: 'HowToPlayModal',
    context: 'Lobby',
    categoryId: 'interaction-patterns',
    purpose: 'Rules modal that explains Part 1 and Part 2 gameplay.',
    source: 'packages/web/src/screens/LobbyScreen.tsx',
    usage: ['LobbyScreen'],
    scope: 'screen-local',
  },
  {
    name: 'PlayerStatusBar',
    context: 'Room',
    categoryId: 'interaction-patterns',
    purpose: 'Player count with filled/empty pip row and elapsed-time display — shown in the Players panel.',
    source: 'packages/web/src/screens/RoomScreen.tsx',
    usage: ['RoomScreen'],
    scope: 'screen-local',
  },
  {
    name: 'RoomFeltBackdrop',
    context: 'Room',
    categoryId: 'interaction-patterns',
    purpose: 'Fixed casino-felt background with crosshatch grain, vignette, and SVG crest watermark.',
    source: 'packages/web/src/screens/RoomScreen.tsx',
    usage: ['RoomScreen'],
    scope: 'screen-local',
  },
  {
    name: 'PlayerPipIcon',
    context: 'Room',
    categoryId: 'interaction-patterns',
    purpose: 'Filled pip icon (chip-style) used inside occupied seat pips in PlayerStatusBar.',
    source: 'packages/web/src/screens/RoomScreen.tsx',
    usage: ['RoomScreen'],
    scope: 'screen-local',
  },
  {
    name: 'PlayerBadgeIcon',
    context: 'Room',
    categoryId: 'interaction-patterns',
    purpose: 'Players icon used inside the room player-count badge in headers.',
    source: 'packages/web/src/screens/RoomScreen.tsx',
    usage: ['RoomScreen'],
    scope: 'screen-local',
  },
  {
    name: 'UserSilhouetteIcon',
    context: 'Room',
    categoryId: 'interaction-patterns',
    purpose: 'Ghost silhouette icon for empty seat slots and empty voice-participant slots.',
    source: 'packages/web/src/screens/RoomScreen.tsx',
    usage: ['RoomScreen'],
    scope: 'screen-local',
  },
  {
    name: 'DetailIcon',
    context: 'Room',
    categoryId: 'interaction-patterns',
    purpose: 'Icon helper for room metadata rows such as code, mode, players, fee, and voice.',
    source: 'packages/web/src/screens/RoomScreen.tsx',
    usage: ['RoomScreen'],
    scope: 'screen-local',
  },
  {
    name: 'CopyIcon',
    context: 'Room',
    categoryId: 'interaction-patterns',
    purpose: 'Copy icon used in room-code actions.',
    source: 'packages/web/src/screens/RoomScreen.tsx',
    usage: ['RoomScreen'],
    scope: 'screen-local',
  },
  {
    name: 'LinkIcon',
    context: 'Room',
    categoryId: 'interaction-patterns',
    purpose: 'Share-link icon used in room actions.',
    source: 'packages/web/src/screens/RoomScreen.tsx',
    usage: ['RoomScreen'],
    scope: 'screen-local',
  },
  {
    name: 'MicIcon',
    context: 'Room',
    categoryId: 'interaction-patterns',
    purpose: 'Microphone icon that changes to a muted state.',
    source: 'packages/web/src/screens/RoomScreen.tsx',
    usage: ['RoomScreen'],
    scope: 'screen-local',
  },
  {
    name: 'SeatSlot',
    context: 'Room',
    categoryId: 'interaction-patterns',
    purpose: 'Individual seat slot on the room table with avatar and host state.',
    source: 'packages/web/src/screens/RoomScreen.tsx',
    usage: ['RoomScreen'],
    scope: 'screen-local',
  },
  {
    name: 'OvalTable',
    context: 'Room',
    categoryId: 'interaction-patterns',
    purpose: 'Oval room table that positions all seat slots around the board.',
    source: 'packages/web/src/screens/RoomScreen.tsx',
    usage: ['RoomScreen'],
    scope: 'screen-local',
  },
  {
    name: 'VoiceChatPanel',
    context: 'Room',
    categoryId: 'interaction-patterns',
    purpose: 'Voice chat controls and participant display for room play.',
    source: 'packages/web/src/screens/RoomScreen.tsx',
    usage: ['RoomScreen'],
    scope: 'screen-local',
  },
  {
    name: 'ActivityPanel',
    context: 'Room',
    categoryId: 'interaction-patterns',
    purpose: 'Activity and chat panel with tab switching and message input stub.',
    source: 'packages/web/src/screens/RoomScreen.tsx',
    usage: ['RoomScreen'],
    scope: 'screen-local',
  },
  {
    name: 'RoomDetailsSidebar',
    context: 'Room',
    categoryId: 'interaction-patterns',
    purpose: 'Room details sidebar with code, mode, players, fee, host, and voice status.',
    source: 'packages/web/src/screens/RoomScreen.tsx',
    usage: ['RoomScreen'],
    scope: 'screen-local',
  },
  {
    name: 'FriendsOnlineSidebar',
    context: 'Room',
    categoryId: 'interaction-patterns',
    purpose: 'Friends-online and recent-opponent sidebars with invite actions.',
    source: 'packages/web/src/screens/RoomScreen.tsx',
    usage: ['RoomScreen'],
    scope: 'screen-local',
  },
  {
    name: 'RoomFooterDecor',
    context: 'Room',
    categoryId: 'interaction-patterns',
    purpose: 'Decorative footer cards and chips used in the room layout.',
    source: 'packages/web/src/screens/RoomScreen.tsx',
    usage: ['RoomScreen'],
    scope: 'screen-local',
  },
  {
    name: 'RoomHeaderMobile',
    context: 'Room',
    categoryId: 'interaction-patterns',
    purpose: 'Mobile room header with back, copy, and overflow menu actions.',
    source: 'packages/web/src/screens/RoomScreen.tsx',
    usage: ['RoomScreen'],
    scope: 'screen-local',
  },
  {
    name: 'RoomHeaderDesktop',
    context: 'Room',
    categoryId: 'interaction-patterns',
    purpose: 'Desktop room header with logo, room title, and exit button.',
    source: 'packages/web/src/screens/RoomScreen.tsx',
    usage: ['RoomScreen'],
    scope: 'screen-local',
  },
  {
    name: 'MedalIcon',
    context: 'Leaderboard',
    categoryId: 'interaction-patterns',
    purpose: 'Leaderboard medal glyph for top-three ranks and fallback numeric ranks.',
    source: 'packages/web/src/screens/LeaderboardScreen.tsx',
    usage: ['LeaderboardScreen'],
    scope: 'screen-local',
  },
  {
    name: 'TitleFlourish',
    context: 'Leaderboard',
    categoryId: 'interaction-patterns',
    purpose: 'Decorative title flourish used in stats-style section headings.',
    source: 'packages/web/src/screens/LeaderboardScreen.tsx',
    usage: ['LeaderboardScreen'],
    scope: 'screen-local',
  },
  {
    name: 'CrownIcon',
    context: 'Leaderboard',
    categoryId: 'interaction-patterns',
    purpose: 'Crown icon used for top-player and host emphasis.',
    source: 'packages/web/src/screens/LeaderboardScreen.tsx',
    usage: ['LeaderboardScreen'],
    scope: 'screen-local',
  },
  {
    name: 'LeaderboardRow',
    context: 'Leaderboard',
    categoryId: 'interaction-patterns',
    purpose: 'Leaderboard entry row with rank, avatar, and win counts.',
    source: 'packages/web/src/screens/LeaderboardScreen.tsx',
    usage: ['LeaderboardScreen'],
    scope: 'screen-local',
  },
  {
    name: 'LeaderboardHeader',
    context: 'Leaderboard',
    categoryId: 'interaction-patterns',
    purpose: 'Leaderboard page header with profile access and navigation.',
    source: 'packages/web/src/screens/LeaderboardScreen.tsx',
    usage: ['LeaderboardScreen'],
    scope: 'screen-local',
  },
  {
    name: 'LeaderboardProfileSidebar',
    context: 'Leaderboard',
    categoryId: 'interaction-patterns',
    purpose: 'Sidebar with account context and quick stats for the leaderboard view.',
    source: 'packages/web/src/screens/LeaderboardScreen.tsx',
    usage: ['LeaderboardScreen'],
    scope: 'screen-local',
  },
  {
    name: 'LeaderboardBottomNav',
    context: 'Leaderboard',
    categoryId: 'interaction-patterns',
    purpose: 'Bottom navigation for the leaderboard screen.',
    source: 'packages/web/src/screens/LeaderboardScreen.tsx',
    usage: ['LeaderboardScreen'],
    scope: 'screen-local',
  },
  {
    name: 'TitleFlourish',
    context: 'History',
    categoryId: 'interaction-patterns',
    purpose: 'Decorative title flourish used in the history screen heading.',
    source: 'packages/web/src/screens/HistoryScreen.tsx',
    usage: ['HistoryScreen'],
    scope: 'screen-local',
  },
  {
    name: 'CrownIcon',
    context: 'History',
    categoryId: 'interaction-patterns',
    purpose: 'Crown icon reused for host and top-player emphasis in history.',
    source: 'packages/web/src/screens/HistoryScreen.tsx',
    usage: ['HistoryScreen'],
    scope: 'screen-local',
  },
  {
    name: 'HistoryHeader',
    context: 'History',
    categoryId: 'interaction-patterns',
    purpose: 'History page header with account context and navigation.',
    source: 'packages/web/src/screens/HistoryScreen.tsx',
    usage: ['HistoryScreen'],
    scope: 'screen-local',
  },
  {
    name: 'HistoryProfileSidebar',
    context: 'History',
    categoryId: 'interaction-patterns',
    purpose: 'Sidebar profile and summary block for the history view.',
    source: 'packages/web/src/screens/HistoryScreen.tsx',
    usage: ['HistoryScreen'],
    scope: 'screen-local',
  },
  {
    name: 'MobileProfileStrip',
    context: 'History',
    categoryId: 'interaction-patterns',
    purpose: 'Compact mobile profile strip used in history and stats views.',
    source: 'packages/web/src/screens/HistoryScreen.tsx',
    usage: ['HistoryScreen', 'StatsScreen'],
    scope: 'screen-local',
  },
  {
    name: 'HistoryBottomNav',
    context: 'History',
    categoryId: 'interaction-patterns',
    purpose: 'Bottom navigation for the history screen.',
    source: 'packages/web/src/screens/HistoryScreen.tsx',
    usage: ['HistoryScreen'],
    scope: 'screen-local',
  },
  {
    name: 'SummaryBar',
    context: 'History',
    categoryId: 'interaction-patterns',
    purpose: 'History summary strip with totals, wins, and win rate.',
    source: 'packages/web/src/screens/HistoryScreen.tsx',
    usage: ['HistoryScreen'],
    scope: 'screen-local',
  },
  {
    name: 'HistoryRow',
    context: 'History',
    categoryId: 'interaction-patterns',
    purpose: 'Match-history row with result, opponent, score, and timing details.',
    source: 'packages/web/src/screens/HistoryScreen.tsx',
    usage: ['HistoryScreen'],
    scope: 'screen-local',
  },
  {
    name: 'TitleFlourish',
    context: 'Stats',
    categoryId: 'interaction-patterns',
    purpose: 'Decorative title flourish used in the stats screen heading.',
    source: 'packages/web/src/screens/StatsScreen.tsx',
    usage: ['StatsScreen'],
    scope: 'screen-local',
  },
  {
    name: 'CrownIcon',
    context: 'Stats',
    categoryId: 'interaction-patterns',
    purpose: 'Crown icon reused for top-player and highlight states in stats.',
    source: 'packages/web/src/screens/StatsScreen.tsx',
    usage: ['StatsScreen'],
    scope: 'screen-local',
  },
  {
    name: 'StatIcon',
    context: 'Stats',
    categoryId: 'interaction-patterns',
    purpose: 'Icon set for games, win rate, average finish, and similar stats.',
    source: 'packages/web/src/screens/StatsScreen.tsx',
    usage: ['StatsScreen'],
    scope: 'screen-local',
  },
  {
    name: 'StatCard',
    context: 'Stats',
    categoryId: 'interaction-patterns',
    purpose: 'Stats summary card used for the headline metric tiles.',
    source: 'packages/web/src/screens/StatsScreen.tsx',
    usage: ['StatsScreen'],
    scope: 'screen-local',
  },
  {
    name: 'StatsHeader',
    context: 'Stats',
    categoryId: 'interaction-patterns',
    purpose: 'Stats page header with account context and navigation.',
    source: 'packages/web/src/screens/StatsScreen.tsx',
    usage: ['StatsScreen'],
    scope: 'screen-local',
  },
  {
    name: 'StatsProfileSidebar',
    context: 'Stats',
    categoryId: 'interaction-patterns',
    purpose: 'Profile sidebar used by the stats screen.',
    source: 'packages/web/src/screens/StatsScreen.tsx',
    usage: ['StatsScreen'],
    scope: 'screen-local',
  },
  {
    name: 'MobileProfileStrip',
    context: 'Stats',
    categoryId: 'interaction-patterns',
    purpose: 'Compact mobile profile strip shared with the history view.',
    source: 'packages/web/src/screens/StatsScreen.tsx',
    usage: ['HistoryScreen', 'StatsScreen'],
    scope: 'screen-local',
  },
  {
    name: 'StatsBottomNav',
    context: 'Stats',
    categoryId: 'interaction-patterns',
    purpose: 'Bottom navigation for the stats screen.',
    source: 'packages/web/src/screens/StatsScreen.tsx',
    usage: ['StatsScreen'],
    scope: 'screen-local',
  },
  {
    name: 'PlayTimeBar',
    context: 'Stats',
    categoryId: 'interaction-patterns',
    purpose: 'Horizontal play-time bar visualisation.',
    source: 'packages/web/src/screens/StatsScreen.tsx',
    usage: ['StatsScreen'],
    scope: 'screen-local',
  },
  {
    name: 'PerformancePlaceholder',
    context: 'Stats',
    categoryId: 'interaction-patterns',
    purpose: 'Placeholder state for the performance chart section.',
    source: 'packages/web/src/screens/StatsScreen.tsx',
    usage: ['StatsScreen'],
    scope: 'screen-local',
  },
  {
    name: 'FavoriteCardsPlaceholder',
    context: 'Stats',
    categoryId: 'interaction-patterns',
    purpose: 'Placeholder state for favourite-card analytics.',
    source: 'packages/web/src/screens/StatsScreen.tsx',
    usage: ['StatsScreen'],
    scope: 'screen-local',
  },
  {
    name: 'GameModesPlaceholder',
    context: 'Stats',
    categoryId: 'interaction-patterns',
    purpose: 'Placeholder state for mode breakdown analytics.',
    source: 'packages/web/src/screens/StatsScreen.tsx',
    usage: ['StatsScreen'],
    scope: 'screen-local',
  },
  {
    name: 'AchievementsPlaceholder',
    context: 'Stats',
    categoryId: 'interaction-patterns',
    purpose: 'Placeholder state for achievements and milestones.',
    source: 'packages/web/src/screens/StatsScreen.tsx',
    usage: ['StatsScreen'],
    scope: 'screen-local',
  },
  {
    name: 'RecentResults',
    context: 'Stats',
    categoryId: 'interaction-patterns',
    purpose: 'Recent results list used by the stats route.',
    source: 'packages/web/src/screens/StatsScreen.tsx',
    usage: ['StatsScreen'],
    scope: 'screen-local',
  },
  {
    name: 'SessionsHeader',
    context: 'Sessions',
    categoryId: 'interaction-patterns',
    purpose: 'Sessions page header with navigation back to the lobby.',
    source: 'packages/web/src/screens/SessionsScreen.tsx',
    usage: ['SessionsScreen'],
    scope: 'screen-local',
  },
  {
    name: 'SessionRow',
    context: 'Sessions',
    categoryId: 'interaction-patterns',
    purpose: 'Session row with device details, dates, and revoke/logout actions.',
    source: 'packages/web/src/screens/SessionsScreen.tsx',
    usage: ['SessionsScreen'],
    scope: 'screen-local',
  },
  {
    name: 'PlayerWrap',
    context: 'Game',
    categoryId: 'interaction-patterns',
    purpose: 'Internal wrapper that subscribes a player to voice-speaking state.',
    source: 'packages/web/src/screens/GameScreen.tsx',
    usage: ['GameScreen'],
    scope: 'screen-local',
  },

  // Brand asset inventory.
  {
    name: 'Ganatri Logo',
    context: 'Brand',
    categoryId: 'brand-assets',
    purpose: 'Brand mark rendered in room, lobby, results, and stat-style screens.',
    source: 'packages/web/src/assets/ganatri-logo.png',
    usage: ['LobbyScreen', 'RoomScreen', 'LeaderboardScreen', 'HistoryScreen', 'StatsScreen', 'SessionsScreen', 'EndScreen'],
    scope: 'asset',
    notes: 'Imported as an image asset rather than a React component.',
  },
];

export type DesignSectionId =
  | 'buttons'
  | 'typography'
  | 'cards'
  | 'pills-badges'
  | 'tabs'
  | 'modals'
  | 'tables'
  | 'forms'
  | 'logo'
  | 'game-table'
  | 'header'
  | 'footer'
  | 'backgrounds';

export interface DesignSection {
  id: DesignSectionId;
  label: string;
  description: string;
  icon: string;
}

export const DESIGN_SECTIONS: DesignSection[] = [
  { id: 'buttons', label: 'Buttons', description: 'Primary, secondary, ghost, and danger variants with compact and disabled states.', icon: 'Bt' },
  { id: 'typography', label: 'Typography', description: 'Display headings, body copy, eyebrow labels, and monospace used throughout the app.', icon: 'Aa' },
  { id: 'cards', label: 'Cards', description: 'Card surfaces, stat tiles, and list rows used to surface content.', icon: 'Cd' },
  { id: 'pills-badges', label: 'Pills & Badges', description: 'Status badges in success, warning, danger, info, and default tones, plus inline alerts.', icon: 'Bd' },
  { id: 'tabs', label: 'Tabs', description: 'Tab strip and pill navigation with active and inactive states.', icon: 'Tb' },
  { id: 'modals', label: 'Modals', description: 'Modal shell, overlay backdrop, and confirmation dialog patterns.', icon: 'Mo' },
  { id: 'tables', label: 'Tables', description: 'Data table with header, body rows, and responsive layout.', icon: 'Tl' },
  { id: 'forms', label: 'Forms', description: 'Input fields, labels, helper text, and error states.', icon: 'Fm' },
  { id: 'logo', label: 'Logo', description: 'Ganatri logo mark and wordmark at full, medium, and compact sizes.', icon: 'G' },
  { id: 'game-table', label: 'Game Table', description: 'Oval game table with seat slots, board center, and chip tray.', icon: 'GT' },
  { id: 'header', label: 'Header', description: 'App header bar with logo, navigation, profile block, and action buttons.', icon: 'Hd' },
  { id: 'footer', label: 'Footer', description: 'Screen footer with room info, decorative playing cards, and chip stack.', icon: 'Ft' },
  { id: 'backgrounds', label: 'Backgrounds', description: 'Radial-light and linear-gradient background treatments for screens and cards.', icon: 'Bg' },
];

export function getInventoryCategory(categoryId: WebComponentCategoryId): WebComponentCategory {
  const category = WEB_COMPONENT_CATEGORIES.find((entry) => entry.id === categoryId);
  if (!category) {
    throw new Error(`Unknown inventory category: ${categoryId}`);
  }
  return category;
}

export function getInventoryItemsForCategory(categoryId: WebComponentCategoryId): WebComponentInventoryItem[] {
  return WEB_COMPONENT_INVENTORY.filter((item) => item.categoryId === categoryId);
}

export function getInventorySummary(): {
  total: number;
  shared: number;
  screenLocal: number;
  route: number;
  asset: number;
} {
  const summary = {
    total: WEB_COMPONENT_INVENTORY.length,
    shared: 0,
    screenLocal: 0,
    route: 0,
    asset: 0,
  };

  for (const item of WEB_COMPONENT_INVENTORY) {
    if (item.scope === 'shared') summary.shared += 1;
    if (item.scope === 'screen-local') summary.screenLocal += 1;
    if (item.scope === 'route') summary.route += 1;
    if (item.scope === 'asset') summary.asset += 1;
  }

  return summary;
}
