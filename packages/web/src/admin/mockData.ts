import type { AdminServerStats } from '../protocol';

export interface KpiCardData {
  label: string;
  value: string;
  delta: number;
  deltaLabel: string;
  icon: string;
}

export interface LiveGameRow {
  gameId: string;
  roomCode: string;
  players: string;
  status: 'Playing' | 'In Progress' | 'Completed';
  duration: string;
  startedAt: string;
}

export interface DonutSegment {
  label: string;
  value: number;
  percent: number;
  color: string;
}

export interface ServerHealthData {
  connectedSessions: number;
  socketConnections: number;
  memoryPercent: number;
  cpuPercent: number;
  dbConnections: string;
  dbResponseMs: number;
}

export interface DailyGameData {
  date: string;
  label: string;
  completed: number;
  abandoned: number;
}

export interface TopPlayer {
  rank: number;
  name: string;
  score: number;
  initials: string;
}

export interface ActivityItem {
  id: string;
  text: string;
  time: string;
  type: 'join' | 'start' | 'complete' | 'leave';
}

export const MOCK_KPI_CARDS: KpiCardData[] = [
  { label: 'Connected Players', value: '1,248', delta: 12.5, deltaLabel: 'vs yesterday', icon: 'users' },
  { label: 'Active Games', value: '78', delta: 8.3, deltaLabel: 'vs yesterday', icon: 'game' },
  { label: 'Rooms Open', value: '46', delta: 5.6, deltaLabel: 'vs yesterday', icon: 'room' },
  { label: 'Rooms Today', value: '986', delta: 15.2, deltaLabel: 'vs yesterday', icon: 'calendar' },
  { label: 'Abandonment Rate', value: '3.24%', delta: -1.1, deltaLabel: 'vs yesterday', icon: 'alert' },
  { label: 'Avg Duration', value: '12m 45s', delta: 2.3, deltaLabel: 'vs yesterday', icon: 'clock' },
  { label: 'Voice Usage', value: '62.7%', delta: 6.4, deltaLabel: 'vs yesterday', icon: 'mic' },
];

export const MOCK_LIVE_GAMES: LiveGameRow[] = [
  { gameId: '#4512', roomCode: 'YD3BTK', players: '4/4', status: 'Playing', duration: '8m 32s', startedAt: '12:36 PM' },
  { gameId: '#4511', roomCode: 'XK9M2P', players: '3/4', status: 'In Progress', duration: '2m 15s', startedAt: '12:43 PM' },
  { gameId: '#4510', roomCode: 'AB7C4D', players: '4/4', status: 'Playing', duration: '15m 08s', startedAt: '12:30 PM' },
  { gameId: '#4509', roomCode: 'EF2G8H', players: '2/4', status: 'In Progress', duration: '0m 45s', startedAt: '12:44 PM' },
  { gameId: '#4508', roomCode: 'IJ5K1L', players: '4/4', status: 'Completed', duration: '18m 22s', startedAt: '12:26 PM' },
];

export const MOCK_ROOM_DONUT = {
  total: 124,
  segments: [
    { label: 'Playing Rooms', value: 78, percent: 62.9, color: 'var(--safe)' },
    { label: 'Lobby Rooms', value: 32, percent: 25.8, color: '#e07045' },
    { label: 'Finished Rooms', value: 14, percent: 11.3, color: 'var(--danger)' },
  ] satisfies DonutSegment[],
};

export const MOCK_SERVER_HEALTH: ServerHealthData = {
  connectedSessions: 1248,
  socketConnections: 1512,
  memoryPercent: 68,
  cpuPercent: 42,
  dbConnections: '32 / 100',
  dbResponseMs: 18,
};

export const MOCK_GAMES_OVER_TIME: DailyGameData[] = [
  { date: '2026-06-17', label: '17 Jun', completed: 280, abandoned: 45 },
  { date: '2026-06-18', label: '18 Jun', completed: 310, abandoned: 38 },
  { date: '2026-06-19', label: '19 Jun', completed: 295, abandoned: 52 },
  { date: '2026-06-20', label: '20 Jun', completed: 340, abandoned: 41 },
  { date: '2026-06-21', label: '21 Jun', completed: 365, abandoned: 35 },
  { date: '2026-06-22', label: '22 Jun', completed: 320, abandoned: 48 },
  { date: '2026-06-23', label: '23 Jun', completed: 350, abandoned: 42 },
];

export const MOCK_TOP_PLAYERS: TopPlayer[] = [
  { rank: 1, name: 'Rohan Mehta', score: 2450, initials: 'RM' },
  { rank: 2, name: 'Priya Sharma', score: 2180, initials: 'PS' },
  { rank: 3, name: 'Arjun Patel', score: 1920, initials: 'AP' },
  { rank: 4, name: 'Kavya Reddy', score: 1750, initials: 'KR' },
  { rank: 5, name: 'Vikram Singh', score: 1580, initials: 'VS' },
];

export const MOCK_ACTIVITY: ActivityItem[] = [
  { id: '1', text: 'Kartik joined room YD3BTK', time: '12:44 PM', type: 'join' },
  { id: '2', text: 'Game #4512 started', time: '12:36 PM', type: 'start' },
  { id: '3', text: 'Game #4508 completed', time: '12:44 PM', type: 'complete' },
  { id: '4', text: 'Ananya left room EF2G8H', time: '12:43 PM', type: 'leave' },
  { id: '5', text: 'Game #4511 started', time: '12:43 PM', type: 'start' },
];

export const MOCK_SYSTEM_STATUS = {
  uptime: '15d 7h 32m',
  services: [
    { name: 'API Server', status: 'Healthy' as const },
    { name: 'Database', status: 'Healthy' as const },
    { name: 'Socket Server', status: 'Healthy' as const },
    { name: 'Voice Service', status: 'Healthy' as const },
  ],
};

export type RoomStatus = 'Playing' | 'Lobby' | 'Finished' | 'Closed';

export interface RoomListRow {
  code: string;
  hostName: string;
  hostInitials: string;
  players: string;
  status: RoomStatus;
  createdAt: string;
  duration: string;
  gameId?: string;
}

export interface RoomPlayer {
  name: string;
  initials: string;
  isHost: boolean;
  online: boolean;
}

export interface RoomDetail {
  code: string;
  status: RoomStatus;
  hostName: string;
  roomCreated: string;
  players: string;
  gameStarted?: string;
  currentDuration: string;
  gameId?: string;
  voiceChat: 'Enabled' | 'Disabled';
  playersInRoom: RoomPlayer[];
}

export const MOCK_ROOM_MGMT_KPIS: KpiCardData[] = [
  { label: 'Total Rooms', value: '124', delta: 8.3, deltaLabel: 'vs yesterday', icon: 'room' },
  { label: 'Active Rooms', value: '46', delta: 5.6, deltaLabel: 'vs yesterday', icon: 'game' },
  { label: 'Lobby Rooms', value: '32', delta: 7.2, deltaLabel: 'vs yesterday', icon: 'users' },
  { label: 'Playing Rooms', value: '14', delta: 3.1, deltaLabel: 'vs yesterday', icon: 'game' },
  { label: 'Finished Rooms', value: '78', delta: 10.4, deltaLabel: 'vs yesterday', icon: 'calendar' },
  { label: 'Avg Duration', value: '12m 45s', delta: 2.3, deltaLabel: 'vs yesterday', icon: 'clock' },
];

export const MOCK_ROOM_LIST: RoomListRow[] = [
  { code: 'YD3BTK', hostName: 'Chinjan Patel', hostInitials: 'CP', players: '4/4', status: 'Playing', createdAt: '23 Jun 2025, 12:36 PM', duration: '8m 32s', gameId: '#4512' },
  { code: 'PQ7HLM', hostName: 'Rahul Sharma', hostInitials: 'RS', players: '2/4', status: 'Lobby', createdAt: '23 Jun 2025, 12:40 PM', duration: '—' },
  { code: 'NM4FZQ', hostName: 'Riya Gupta', hostInitials: 'RG', players: '4/4', status: 'Playing', createdAt: '23 Jun 2025, 12:30 PM', duration: '15m 08s', gameId: '#4510' },
  { code: 'LK8WTJ', hostName: 'Amit Verma', hostInitials: 'AV', players: '3/4', status: 'Lobby', createdAt: '23 Jun 2025, 12:42 PM', duration: '—' },
  { code: 'GH2VBN', hostName: 'Neha Kapoor', hostInitials: 'NK', players: '4/4', status: 'Finished', createdAt: '23 Jun 2025, 12:26 PM', duration: '18m 22s', gameId: '#4508' },
  { code: 'XR5MPQ', hostName: 'Suresh Iyer', hostInitials: 'SI', players: '1/4', status: 'Lobby', createdAt: '23 Jun 2025, 12:44 PM', duration: '—' },
  { code: 'ZC9KLD', hostName: 'Divya Nair', hostInitials: 'DN', players: '4/4', status: 'Playing', createdAt: '23 Jun 2025, 12:28 PM', duration: '16m 45s', gameId: '#4509' },
  { code: 'WB3GHF', hostName: 'Karan Joshi', hostInitials: 'KJ', players: '0/4', status: 'Closed', createdAt: '23 Jun 2025, 11:58 AM', duration: '—' },
  { code: 'TP6JRN', hostName: 'Meera Desai', hostInitials: 'MD', players: '4/4', status: 'Finished', createdAt: '23 Jun 2025, 12:10 PM', duration: '22m 10s', gameId: '#4505' },
  { code: 'VS1QWE', hostName: 'Anil Reddy', hostInitials: 'AR', players: '2/4', status: 'Lobby', createdAt: '23 Jun 2025, 12:43 PM', duration: '—' },
];

const ROOM_DETAILS: Record<string, RoomDetail> = {
  YD3BTK: {
    code: 'YD3BTK',
    status: 'Playing',
    hostName: 'Chinjan Patel',
    roomCreated: '23 Jun 2025, 12:36 PM',
    players: '4/4',
    gameStarted: '23 Jun 2025, 12:36 PM',
    currentDuration: '8m 32s',
    gameId: '#4512',
    voiceChat: 'Enabled',
    playersInRoom: [
      { name: 'Chinjan Patel', initials: 'CP', isHost: true, online: true },
      { name: 'Rohan Mehta', initials: 'RM', isHost: false, online: true },
      { name: 'Priya Sharma', initials: 'PS', isHost: false, online: true },
      { name: 'Arjun Patel', initials: 'AP', isHost: false, online: true },
    ],
  },
};

export function getRoomDetail(code: string, row?: RoomListRow): RoomDetail {
  const existing = ROOM_DETAILS[code];
  if (existing) return existing;

  const fallbackRow = row ?? MOCK_ROOM_LIST.find(r => r.code === code);
  if (!fallbackRow) {
    return {
      code,
      status: 'Lobby',
      hostName: 'Unknown',
      roomCreated: '—',
      players: '0/4',
      currentDuration: '—',
      voiceChat: 'Disabled',
      playersInRoom: [],
    };
  }

  const [current, max] = fallbackRow.players.split('/').map(Number);
  const syntheticPlayers: RoomPlayer[] = [
    { name: fallbackRow.hostName, initials: fallbackRow.hostInitials, isHost: true, online: true },
  ];
  const extras = ['Rohan Mehta', 'Priya Sharma', 'Arjun Patel', 'Kavya Reddy'];
  for (let i = 1; i < (current ?? 0); i += 1) {
    const name = extras[i - 1] ?? `Player ${i + 1}`;
    syntheticPlayers.push({
      name,
      initials: name.split(' ').map(w => w[0]).join('').slice(0, 2),
      isHost: false,
      online: fallbackRow.status !== 'Closed',
    });
  }

  return {
    code: fallbackRow.code,
    status: fallbackRow.status,
    hostName: fallbackRow.hostName,
    roomCreated: fallbackRow.createdAt,
    players: fallbackRow.players,
    gameStarted: fallbackRow.status === 'Playing' || fallbackRow.status === 'Finished' ? fallbackRow.createdAt : undefined,
    currentDuration: fallbackRow.duration,
    gameId: fallbackRow.gameId,
    voiceChat: fallbackRow.status === 'Closed' ? 'Disabled' : 'Enabled',
    playersInRoom: syntheticPlayers,
  };
}

export function applyRoomStatsOverrides(
  cards: KpiCardData[],
  stats: AdminServerStats | null,
): KpiCardData[] {
  if (!stats) return cards;
  return cards.map(card => {
    if (card.label === 'Total Rooms') {
      return { ...card, value: String(stats.totalRooms) };
    }
    if (card.label === 'Active Rooms') {
      return { ...card, value: String(stats.activeGames + stats.lobbyRooms) };
    }
    if (card.label === 'Lobby Rooms') {
      return { ...card, value: String(stats.lobbyRooms) };
    }
    if (card.label === 'Playing Rooms') {
      return { ...card, value: String(stats.activeGames) };
    }
    if (card.label === 'Finished Rooms') {
      return { ...card, value: String(stats.completedRooms) };
    }
    return card;
  });
}

export function applyStatsOverrides(
  cards: KpiCardData[],
  stats: AdminServerStats | null,
): KpiCardData[] {
  if (!stats) return cards;
  return cards.map(card => {
    if (card.label === 'Connected Players') {
      return { ...card, value: stats.connectedPlayers.toLocaleString() };
    }
    if (card.label === 'Active Games') {
      return { ...card, value: String(stats.activeGames) };
    }
    if (card.label === 'Rooms Open') {
      return { ...card, value: String(stats.totalRooms) };
    }
    return card;
  });
}

export function applyServerHealthOverrides(
  health: ServerHealthData,
  stats: AdminServerStats | null,
): ServerHealthData {
  if (!stats) return health;
  return {
    ...health,
    connectedSessions: stats.connectedPlayers,
    socketConnections: stats.totalSessions,
  };
}

// ---------------------------------------------------------------------------
// User management mock data
// ---------------------------------------------------------------------------

export interface UserListRow {
  userId: string;
  displayName: string;
  email: string | null;
  initials: string;
  isGuest: boolean;
  isOnline: boolean;
  gamesPlayed: number;
  gamesWon: number;
}

export interface UserDetail extends UserListRow {
  joinedOn: string;
  lastActive: string;
  gamesLost: number;
  gamesAbandoned: number;
  winRate: number;
  avgFinish: number;
  totalCaptures: number;
  totalCuts: number;
  timesSafe: number;
  totalPlayTimeMs: number;
  longestWinStreak: number;
}

export const MOCK_USER_TOTAL_COUNT = 1248;

export const MOCK_USER_LIST: UserListRow[] = [
  { userId: 'usr-mock-001', displayName: 'Chinjan Patel', email: 'chinjan@example.com', initials: 'CP', isGuest: false, isOnline: true, gamesPlayed: 128, gamesWon: 78 },
  { userId: 'usr-mock-002', displayName: 'Rohan Mehta', email: 'rohan@example.com', initials: 'RM', isGuest: false, isOnline: true, gamesPlayed: 245, gamesWon: 142 },
  { userId: 'usr-mock-003', displayName: 'Priya Sharma', email: 'priya@example.com', initials: 'PS', isGuest: false, isOnline: false, gamesPlayed: 189, gamesWon: 98 },
  { userId: 'usr-mock-004', displayName: 'Arjun Patel', email: 'arjun@example.com', initials: 'AP', isGuest: false, isOnline: true, gamesPlayed: 312, gamesWon: 201 },
  { userId: 'usr-mock-005', displayName: 'Kavya Reddy', email: 'kavya@example.com', initials: 'KR', isGuest: false, isOnline: false, gamesPlayed: 156, gamesWon: 89 },
  { userId: 'usr-mock-006', displayName: 'Vikram Singh', email: null, initials: 'VS', isGuest: true, isOnline: true, gamesPlayed: 42, gamesWon: 18 },
  { userId: 'usr-mock-007', displayName: 'Ananya Iyer', email: 'ananya@example.com', initials: 'AI', isGuest: false, isOnline: true, gamesPlayed: 98, gamesWon: 55 },
  { userId: 'usr-mock-008', displayName: 'Kartik Joshi', email: null, initials: 'KJ', isGuest: true, isOnline: false, gamesPlayed: 15, gamesWon: 4 },
  { userId: 'usr-mock-009', displayName: 'Meera Desai', email: 'meera@example.com', initials: 'MD', isGuest: false, isOnline: true, gamesPlayed: 203, gamesWon: 118 },
  { userId: 'usr-mock-010', displayName: 'Suresh Nair', email: 'suresh@example.com', initials: 'SN', isGuest: false, isOnline: false, gamesPlayed: 67, gamesWon: 31 },
];

const USER_DETAILS: Record<string, UserDetail> = {
  'usr-mock-001': {
    userId: 'usr-mock-001',
    displayName: 'Chinjan Patel',
    email: 'chinjan@example.com',
    initials: 'CP',
    isGuest: false,
    isOnline: true,
    gamesPlayed: 128,
    gamesWon: 78,
    gamesLost: 42,
    gamesAbandoned: 8,
    winRate: 0.609,
    avgFinish: 2.3,
    totalCaptures: 654,
    totalCuts: 342,
    timesSafe: 218,
    totalPlayTimeMs: 67_320_000,
    longestWinStreak: 7,
    joinedOn: '12 Jan 2025',
    lastActive: '23 Jun 2025, 12:44 PM',
  },
};

function syntheticUserDetail(row: UserListRow): UserDetail {
  const lost = Math.max(0, row.gamesPlayed - row.gamesWon - Math.floor(row.gamesPlayed * 0.06));
  const abandoned = row.gamesPlayed - row.gamesWon - lost;
  const winRate = row.gamesPlayed > 0 ? row.gamesWon / row.gamesPlayed : 0;
  return {
    ...row,
    gamesLost: lost,
    gamesAbandoned: Math.max(0, abandoned),
    winRate,
    avgFinish: 2 + (1 - winRate) * 1.5,
    totalCaptures: row.gamesPlayed * 5 + row.gamesWon * 2,
    totalCuts: row.gamesPlayed * 2 + row.gamesWon,
    timesSafe: Math.floor(row.gamesPlayed * 1.7),
    totalPlayTimeMs: row.gamesPlayed * 8 * 60_000,
    longestWinStreak: Math.min(7, Math.floor(row.gamesWon / 12) + 1),
    joinedOn: '15 Mar 2025',
    lastActive: row.isOnline ? 'Just now' : '22 Jun 2025, 6:30 PM',
  };
}

export function getUserDetail(userId: string, row?: UserListRow): UserDetail {
  const existing = USER_DETAILS[userId];
  if (existing) return existing;
  const fallbackRow = row ?? MOCK_USER_LIST.find(u => u.userId === userId);
  if (!fallbackRow) {
    return syntheticUserDetail({
      userId,
      displayName: 'Unknown User',
      email: null,
      initials: '?',
      isGuest: true,
      isOnline: false,
      gamesPlayed: 0,
      gamesWon: 0,
    });
  }
  return syntheticUserDetail(fallbackRow);
}
