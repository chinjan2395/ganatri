/**
 * Local copy of the server wire protocol (packages/server/src/protocol.ts).
 * The server package exposes no importable subpath, so the EVENTS constant and
 * server-only payload/ack interfaces are re-declared here. Engine types are
 * imported structurally from @ganatri/engine.
 */

import type { GameEvent, Move, MoveError, PlayerView } from '@ganatri/engine';

// --- Client → Server payloads ---
export interface CreateRoomPayload {
  name?: string;
}

export interface UpdateDisplayNamePayload {
  newDisplayName: string;
}

export type UpdateDisplayNameAck =
  | { ok: true; displayName: string }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' | 'INVALID_NAME' };
export interface JoinRoomPayload {
  roomCode: string;
  name?: string;
}
export interface MakeMovePayload {
  move: Move;
}

// --- Client → Server acks ---
export interface CreateRoomAck {
  ok: boolean;
  roomCode?: string;
  error?: 'ALREADY_IN_GAME';
  currentRoomCode?: string;
}
export interface JoinRoomAck {
  ok: boolean;
  error?: 'NOT_FOUND' | 'FULL' | 'ALREADY_STARTED' | 'ALREADY_IN_GAME';
  currentRoomCode?: string;
}
export interface LeaveRoomAck {
  ok: boolean;
  error?: string;
}
export interface StartGameAck {
  ok: boolean;
  error?: 'NOT_HOST' | 'NOT_ENOUGH_PLAYERS';
}
export type MakeMoveAck =
  | { ok: true; view: PlayerView; turnStartedAt: number | null; matchScoring?: MatchScoringView[] }
  | { ok: false; error: MoveError; message: string };
export interface RequestStateAck {
  view: PlayerView | null;
}

/** One player's row within a game history entry. */
export interface GameHistoryPlayer {
  userId: string | null;
  displayNameSnapshot: string;
  seatIndex: number;
  finalRank: number | null;
  result: string | null;
  captureCount: number;
  wasCut: boolean;
  matchScore: number | null;
  xpEarned: number | null;
  rankedRatingDelta: number | null;
}

/** A single completed game in the logged-in player's history. */
export interface GameHistoryEntry {
  id: string;
  /** ISO timestamp string. */
  startedAt: string;
  /** ISO timestamp string, or null if not recorded. */
  endedAt: string | null;
  durationMs: number;
  playerCount: number;
  isAbandoned: boolean;
  winnerId: string | null;
  /** This player's own row. */
  you: {
    seatIndex: number;
    finalRank: number | null;
    result: string | null;
    captureCount: number;
    wasCut: boolean;
  };
  /** Every player in the game (including you). */
  players: GameHistoryPlayer[];
  matchScore: number | null;
  xpEarned: number | null;
  rankedRatingDelta: number | null;
}

export type RequestHistoryAck =
  | { ok: true; games: GameHistoryEntry[] }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' };

export interface PlayerStatsView {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesAbandoned: number;
  winRate: number; // gamesWon / gamesPlayed in [0,1]; 0 when gamesPlayed === 0
  totalCaptures: number;
  cutsGiven: number;
  cutsReceived: number;
  timesSafe: number;
  totalPlayTimeMs: number;
  currentWinStreak: number;
  longestWinStreak: number;
  avgFinish: number; // sumFinishPositions / gamesPlayed; 0 when gamesPlayed === 0
  highestMatchScore: number;
  totalMatchScore: number;
  ghostFinishes: number;
  averageMatchScore: number;
  updatedAt: string | null;
}

export type GetMyStatsAck =
  | { ok: true; stats: PlayerStatsView }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' };

export interface ScoreBreakdownRowView {
  reason: 'CAPTURE_CARD' | 'SAME_RANK_BONUS' | 'TABLE_CLEAR' | 'CUT' | 'PLACEMENT_BONUS' | 'GHOST_BONUS' | 'RANKED_PLACEMENT' | 'ABANDON_PENALTY' | 'XP_MATCH_BASE' | 'XP_MATCH_SCORE';
  delta: number;
}

export interface PlayerProgressionView {
  rankedRating: number;
  totalXp: number;
  level: number;
  xpToNextLevel: number;
  highestMatchScore: number;
  totalMatchScore: number;
  ghostFinishes: number;
  updatedAt: string | null;
}

export interface MatchScoringView {
  playerId: string;
  matchScore: number;
  xpEarned: number;
  rankedRatingDelta: number;
  matchScoreBreakdown: ScoreBreakdownRowView[];
  ratingBreakdown: ScoreBreakdownRowView[];
  xpBreakdown: ScoreBreakdownRowView[];
  progressionAfter?: PlayerProgressionView;
  ghostFinish: boolean;
}

export interface ScoreHistoryEntryView {
  gameId: string;
  createdAt: string;
  matchScore: number;
  xpEarned: number;
  rankedRatingDelta: number;
  rows: Array<{
    kind: 'MATCH_SCORE' | 'RANKED_RATING' | 'XP';
    reason: ScoreBreakdownRowView['reason'];
    delta: number;
    createdAt: string;
  }>;
}

export type GetMyProgressionAck =
  | { ok: true; progression: PlayerProgressionView }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' };

export type GetMyScoreHistoryAck =
  | { ok: true; history: ScoreHistoryEntryView[] }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' };

export interface LeaderboardEntryView {
  rank: number; // 1-based
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number; // [0,1]
}

export interface GetLeaderboardRequest {
  timeWindow?: 'week' | 'month';
}

export type GetLeaderboardAck =
  | { ok: true; entries: LeaderboardEntryView[]; myEntry?: LeaderboardEntryView }
  | { ok: false; error: 'UNAVAILABLE' };

export interface CoPlayerView {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  gamesPlayedTogether: number;
  isOnline: boolean;
}

export type GetRecentPlayersAck =
  | { ok: true; players: CoPlayerView[] }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' };

// --- Social / invitations — Client → Server payloads + acks ---

export interface InvitePlayerPayload {
  targetUserId: string;
}

export type InvitePlayerAck =
  | { ok: true; roomCode: string }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' | 'SELF_INVITE' | 'OFFLINE' | 'BLOCKED' | 'ALREADY_IN_ROOM' | 'ALREADY_IN_GAME' };

export interface RespondToInvitePayload {
  inviterUserId: string;
  accept: boolean;
  block?: boolean;
}

export type RespondToInviteAck =
  | { ok: true; roomCode?: string }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'NOT_FOUND' | 'UNAVAILABLE' };

export interface BlockUserPayload {
  targetUserId: string;
}

export type BlockUserAck =
  | { ok: true }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' };

export interface UnblockUserPayload {
  targetUserId: string;
}

export type UnblockUserAck =
  | { ok: true }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' };

export interface BlockedUserView {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export type GetBlockedUsersAck =
  | { ok: true; users: BlockedUserView[] }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' };

export interface AuthSessionView {
  id: string;
  current: boolean;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export type GetAuthSessionsAck =
  | { ok: true; sessions: AuthSessionView[] }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' };

export interface RevokeAuthSessionPayload {
  sessionId: string;
}

export type RevokeAuthSessionAck =
  | { ok: true; revokedCurrent: boolean }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' | 'NOT_FOUND' };

export type RevokeOtherAuthSessionsAck =
  | { ok: true; revokedCount: number }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' };

// --- Social / invitations — Server → Client push payloads ---

export interface InviteReceivedPayload {
  inviterUserId: string;
  displayName: string;
  avatarUrl: string | null;
  roomCode: string;
}

export interface InviteAcceptedPayload {
  inviteeUserId: string;
  displayName: string;
  roomCode: string;
}

export interface InviteRejectedPayload {
  inviteeUserId: string;
}

export interface InviteCancelledPayload {
  inviterUserId: string;
}

// --- Server → Client pushed payloads ---
export interface SessionPayload {
  playerId: string;
  /** Guest runtime reconnect token, only present for anonymous sessions. */
  guestToken?: string;
  /** Whether this session is authenticated via Google. Guests are false. */
  loggedIn: boolean;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  name?: string; // guest display name restored on reconnect
}
export interface RoomUpdatePayload {
  roomCode: string;
  players: string[];
  hostId: string;
  phase: 'LOBBY' | 'PLAYING' | 'DONE';
  /** playerIds currently within their disconnect grace period */
  disconnectedPlayers: string[];
  /** playerId → display name */
  playerNames: Record<string, string>;
  /** playerId → avatar URL from their OAuth profile, or null for guests. */
  playerAvatarUrls: Record<string, string | null>;
}
export interface GameEventPayload {
  event: GameEvent;
}
export interface StateUpdatePayload {
  view: PlayerView;
  turnStartedAt: number | null;
  turnTimeoutMs: number;
  matchScoring?: MatchScoringView[];
}
export interface PlayerDisconnectedPayload {
  playerId: string;
}
export interface PlayerReconnectedPayload {
  playerId: string;
}
export interface PlayerOnlineStatusPayload {
  userId: string;
  isOnline: boolean;
}
export interface TurnTimeoutPayload {
  playerId: string;
  move?: { type: string; card: string };
}

// --- Voice chat signaling payloads (WebRTC peer mesh) ---

/** Client → Server: send WebRTC offer to a specific peer. */
export interface VoiceOfferPayload {
  targetPlayerId: string;
  offer: RTCSessionDescriptionInit;
}

/** Client → Server: send WebRTC answer to a specific peer. */
export interface VoiceAnswerPayload {
  targetPlayerId: string;
  answer: RTCSessionDescriptionInit;
}

/** Client → Server: send ICE candidate to a specific peer. */
export interface VoiceIcePayload {
  targetPlayerId: string;
  candidate: RTCIceCandidateInit;
}

/** Server → Client: relayed WebRTC offer from a peer. */
export interface VoiceOfferRelayPayload {
  sourcePlayerId: string;
  offer: RTCSessionDescriptionInit;
}

/** Server → Client: relayed WebRTC answer from a peer. */
export interface VoiceAnswerRelayPayload {
  sourcePlayerId: string;
  answer: RTCSessionDescriptionInit;
}

/** Server → Client: relayed ICE candidate from a peer. */
export interface VoiceIceRelayPayload {
  sourcePlayerId: string;
  candidate: RTCIceCandidateInit;
}

/** Client → Server: ask a peer (the initiator) to (re)start negotiation. */
export interface VoiceRenegotiatePayload {
  targetPlayerId: string;
}

/** Server → Client: relayed renegotiation request from a peer. */
export interface VoiceRenegotiateRelayPayload {
  sourcePlayerId: string;
}

/** A single ICE (STUN/TURN) server entry. Compatible with RTCIceServer. */
export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/** Server → Client (ack): ICE servers for building RTCPeerConnections. */
export interface RequestIceServersAck {
  iceServers: IceServerConfig[];
}

export const EVENTS = {
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  START_GAME: 'start_game',
  MAKE_MOVE: 'make_move',
  REQUEST_STATE: 'request_state',
  REQUEST_HISTORY: 'request_history',
  GET_MY_STATS: 'get_my_stats',
  GET_MY_PROGRESSION: 'get_my_progression',
  GET_MY_SCORE_HISTORY: 'get_my_score_history',
  GET_LEADERBOARD: 'get_leaderboard',
  GET_RECENT_PLAYERS: 'get_recent_players',
  GET_BLOCKED_USERS: 'get_blocked_users',
  GET_AUTH_SESSIONS: 'get_auth_sessions',
  UPDATE_DISPLAY_NAME: 'update_display_name',
  REVOKE_AUTH_SESSION: 'revoke_auth_session',
  REVOKE_OTHER_AUTH_SESSIONS: 'revoke_other_auth_sessions',
  DELETE_ACCOUNT: 'delete_account',

  // Social / invitations (Client → Server)
  INVITE_PLAYER: 'invite_player',
  RESPOND_TO_INVITE: 'respond_to_invite',
  BLOCK_USER: 'block_user',
  UNBLOCK_USER: 'unblock_user',

  // Social / invitations (Server → Client push)
  INVITE_RECEIVED: 'invite_received',
  INVITE_ACCEPTED: 'invite_accepted',
  INVITE_REJECTED: 'invite_rejected',
  INVITE_CANCELLED: 'invite_cancelled',

  // Presence (Server → Client push)
  PLAYER_ONLINE_STATUS: 'player_online_status',

  SESSION: 'session',
  ROOM_UPDATE: 'room_update',
  GAME_EVENT: 'game_event',
  STATE_UPDATE: 'state_update',
  PLAYER_DISCONNECTED: 'player_disconnected',
  PLAYER_RECONNECTED: 'player_reconnected',
  TURN_TIMEOUT: 'turn_timeout',

  // Voice chat signaling (Client → Server)
  VOICE_OFFER: 'voice_offer',
  VOICE_ANSWER: 'voice_answer',
  VOICE_ICE: 'voice_ice_candidate',
  VOICE_ICE_SERVERS: 'voice_ice_servers',
  VOICE_RENEGOTIATE: 'voice_renegotiate',

  // Voice chat relay (Server → Client)
  VOICE_OFFER_RELAY: 'voice_offer_relay',
  VOICE_ANSWER_RELAY: 'voice_answer_relay',
  VOICE_ICE_RELAY: 'voice_ice_relay',
  VOICE_RENEGOTIATE_RELAY: 'voice_renegotiate_relay',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

// --- Admin events ---
export interface AdminAuthPayload { email: string; secret?: string; }

export const ADMIN_EVENTS = {
  AUTH:           'admin_auth',
  GET_CONFIG:     'admin_get_config',
  UPDATE_CONFIG:  'admin_update_config',
  GET_STATS:      'admin_get_stats',
  GET_KPI_STATS:  'admin_get_kpi_stats',
  SEARCH_USERS:   'admin_search_users',
  GET_USER_STATS: 'admin_get_user_stats',
  EXPORT_DATA:    'admin_export_data',
} as const;

export interface GameConfig {
  turnTimeoutMs: number;
  maxPlayers: number;
  gracePeriodMs: number;
  roomExpiryMs: number;
}

/** Live operational stats returned by admin_get_stats. */
export interface AdminServerStats {
  totalRooms: number;
  lobbyRooms: number;
  activeGames: number;
  completedRooms: number;
  connectedPlayers: number;
  totalSessions: number;
}

export type AdminGetStatsAck =
  | { ok: true; stats: AdminServerStats }
  | { ok: false; reason: string };

export interface AdminKpiStats {
  windowDays: number;
  totalGames: number;
  completedGames: number;
  abandonedGames: number;
  abandonmentRate: number;
  avgDurationMs: number | null;
  dailyBreakdown: Array<{
    date: string;
    total: number;
    completed: number;
    abandoned: number;
  }>;
}

export type AdminGetKpiStatsAck =
  | { ok: true; stats: AdminKpiStats }
  | { ok: false; reason: 'NOT_AUTHORIZED' | 'UNAVAILABLE' };

// --- Admin user management ---

export interface AdminUserView {
  userId: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  isGuest: boolean;
  gamesPlayed: number;
  gamesWon: number;
}

export interface AdminUserStatsView {
  userId: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  isGuest: boolean;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesAbandoned: number;
  winRate: number;
  totalCaptures: number;
  cutsGiven: number;
  cutsReceived: number;
  timesSafe: number;
  totalPlayTimeMs: number;
  longestWinStreak: number;
  currentWinStreak: number;
  highestMatchScore: number;
  totalMatchScore: number;
  ghostFinishes: number;
  progression: PlayerProgressionView | null;
  updatedAt: string | null;
}

export type AdminSearchUsersAck =
  | { ok: true; users: AdminUserView[] }
  | { ok: false; error: 'NOT_AUTHORIZED' | 'UNAVAILABLE' };

export type AdminGetUserStatsAck =
  | { ok: true; stats: AdminUserStatsView }
  | { ok: false; error: 'NOT_AUTHORIZED' | 'UNAVAILABLE' | 'NOT_FOUND' };

// --- Admin data export ---

export interface ExportGamePlayerView {
  userId: string | null;
  displayName: string;
  seatIndex: number;
  finalRank: number | null;
  captureCount: number;
  wasCut: boolean;
  result: string | null;
  matchScore: number | null;
  xpEarned: number | null;
  rankedRatingDelta: number | null;
}

export interface ExportGameView {
  id: string;
  roomCode: string | null;
  seed: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  playerCount: number;
  isAbandoned: boolean;
  winnerId: string | null;
  players: ExportGamePlayerView[];
}

export type AdminExportDataAck =
  | { ok: true; games: ExportGameView[] }
  | { ok: false; error: 'NOT_AUTHORIZED' | 'UNAVAILABLE' };

export type DeleteAccountAck =
  | { ok: true }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' };
