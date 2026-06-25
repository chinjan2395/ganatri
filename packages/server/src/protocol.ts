/**
 * Ganatri socket event protocol.
 *
 * This file is the authoritative contract between server and frontend.
 * The frontend agent should import types from here rather than re-declaring them.
 *
 * Client → Server events use acknowledgement callbacks (ack pattern).
 * Server → Client events are pushed (no ack).
 */

import type { GameEvent, Move, MoveError, MoveResult, PlayerView } from '@ganatri/engine';
import type { GameConfig } from './config.js';

// ---------------------------------------------------------------------------
// Client → Server payloads
// ---------------------------------------------------------------------------

export interface CreateRoomPayload {
  name?: string;
}

export interface JoinRoomPayload {
  roomCode: string;
  name?: string;
}

export interface LeaveRoomPayload {
  // no payload
}

export interface StartGamePayload {
  // no payload; only the host may call this
}

export interface MakeMovePayload {
  move: Move;
}

export interface RequestStatePayload {
  // no payload; server responds with the caller's current PlayerView
}

// ---------------------------------------------------------------------------
// Client → Server acknowledgement responses
// ---------------------------------------------------------------------------

export interface CreateRoomAck {
  ok: boolean;
  roomCode?: string;
  error?: 'ALREADY_IN_GAME';
  currentRoomCode?: string; // present when error === 'ALREADY_IN_GAME'
}

export interface JoinRoomAck {
  ok: boolean;
  error?: 'NOT_FOUND' | 'FULL' | 'ALREADY_STARTED' | 'ALREADY_IN_GAME';
  currentRoomCode?: string; // present when error === 'ALREADY_IN_GAME'
}

export interface LeaveRoomAck {
  ok: boolean;
  error?: string;
}

export interface StartGameAck {
  ok: boolean;
  error?: 'NOT_HOST' | 'NOT_ENOUGH_PLAYERS';
}

/**
 * Ack for make_move.
 * On success, `view` is the caller's redacted PlayerView after the move and
 * `turnStartedAt` is the Unix ms timestamp at which the next turn began
 * (null if the game ended).
 * On failure, the MoveError is forwarded directly from the engine.
 */
export type MakeMoveAck =
  | { ok: true; view: PlayerView; turnStartedAt: number | null; matchScoring?: MatchScoringView[] }
  | { ok: false; error: MoveError; message: string };

export interface RequestStateAck {
  view: PlayerView | null; // null if not in a game
}

export interface RequestHistoryPayload {
  // no payload; server responds with the caller's game history
}

/**
 * One player's row within a game history entry (wire shape).
 * Mirrors `packages/web/src/protocol.ts` field-for-field.
 */
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

/**
 * A single completed game in the logged-in player's history (wire shape).
 *
 * This is the AUTHORITATIVE cross-package wire contract: it is FLAT (no nested
 * `game`) and timestamps are ISO strings. It must match
 * `packages/web/src/protocol.ts` `GameHistoryEntry` field-for-field. The DB's
 * own nested `GameHistoryEntry` (with a `game` sub-object and `Date` fields) is
 * flattened by the REQUEST_HISTORY handler before it goes on the wire.
 */
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

/**
 * Ack for request_history.
 * - logged-in account → list of completed games (newest first), flattened
 * - guest connection → NOT_LOGGED_IN
 * - no persistence configured → UNAVAILABLE
 */
export type RequestHistoryAck =
  | { ok: true; games: GameHistoryEntry[] }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' };

/**
 * Aggregate player statistics for the logged-in account (wire shape).
 * Mirrors `packages/web/src/protocol.ts` field-for-field. Timestamps are ISO
 * strings (or null when the user has no stats row yet).
 */
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
  avgFinish: number; // sumFinishPositions / gamesPlayed in [1..playerCount]; 0 when gamesPlayed === 0
  highestMatchScore: number;
  totalMatchScore: number;
  ghostFinishes: number;
  averageMatchScore: number;
  updatedAt: string | null; // ISO string; null when the user has no stats row yet
}

export interface ScoreBreakdownRowView {
  reason: 'CAPTURE_CARD' | 'SAME_RANK_BONUS' | 'TABLE_CLEAR' | 'CUT' | 'PLACEMENT_BONUS' | 'GHOST_BONUS' | 'RANKED_PLACEMENT' | 'ABANDON_PENALTY' | 'XP_MATCH_BASE' | 'XP_MATCH_SCORE';
  delta: number;
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

/**
 * Ack for get_my_stats.
 * - logged-in account → aggregate stats (all-zero view when no row exists yet)
 * - guest connection → NOT_LOGGED_IN
 * - no persistence configured / DB error → UNAVAILABLE
 */
export type GetMyStatsAck =
  | { ok: true; stats: PlayerStatsView }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' };

/** Client → Server request payload for get_leaderboard. */
export interface GetLeaderboardRequest {
  timeWindow?: 'week' | 'month';
}

/** One leaderboard row (wire shape). Mirrors packages/web/src/protocol.ts. */
export interface LeaderboardEntryView {
  rank: number; // 1-based, assigned by the server after ordering
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number; // [0,1]
}

/**
 * Ack for get_leaderboard. Public — guests may view it.
 * - persistence available → ranked entries (possibly empty)
 * - no persistence configured / DB error → UNAVAILABLE
 * - when the requesting user is logged in but outside the top page, myEntry
 *   carries their own rank so they can see where they stand
 */
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

export interface BlockedUserView {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export type GetBlockedUsersAck =
  | { ok: true; users: BlockedUserView[] }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' };

// ---------------------------------------------------------------------------
// Social / invitations — Client → Server payloads + acks
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Social / invitations — Server → Client push payloads
// ---------------------------------------------------------------------------

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

export interface UpdateDisplayNamePayload {
  newDisplayName: string;
}

export type UpdateDisplayNameAck =
  | { ok: true; displayName: string }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' | 'INVALID_NAME' };

/**
 * Ack for delete_account (right to erasure).
 * - logged-in account → hard-delete the user row + anonymize historical records, then convert
 *   the current session back to a guest state.
 * - guest → NOT_LOGGED_IN
 * - no persistence / DB error → UNAVAILABLE
 */
export type DeleteAccountAck =
  | { ok: true }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' };

/**
 * Ack for download_my_data (GDPR/CCPA right to access).
 * - logged-in account → full account data export (userId, displayName, email,
 *   exportedAt, stats, games)
 * - guest → NOT_LOGGED_IN
 * - no persistence / DB error → UNAVAILABLE
 */
export type DownloadMyDataAck =
  | {
      ok: true;
      data: {
        userId: string;
        displayName: string | null;
        email: string | null;
        exportedAt: string; // ISO timestamp
        stats: PlayerStatsView | null;
        games: GameHistoryEntry[];
      };
    }
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

// ---------------------------------------------------------------------------
// Server → Client pushed events
// ---------------------------------------------------------------------------

/** Issued once per connection (new or reconnect) with the session identity. */
export interface SessionPayload {
  playerId: string;
  /** Guest runtime reconnect token, only present for anonymous sessions. */
  guestToken?: string;
  /** True when the connection is bound to a durable (OAuth) account. */
  loggedIn: boolean;
  /** Account display name (only when loggedIn). */
  displayName?: string;
  /** Account email, if the provider supplied one (only when loggedIn). */
  email?: string;
  /** Account avatar URL (only when loggedIn). */
  avatarUrl?: string;
  /** Guest display name set from a previous create_room / join_room (only when !loggedIn). */
  name?: string;
}

/** Broadcast to the room whenever players join/leave or the game starts. */
export interface RoomUpdatePayload {
  roomCode: string;
  players: string[]; // playerIds in join order
  hostId: string;
  phase: 'LOBBY' | 'PLAYING' | 'DONE';
  /** playerIds currently within their disconnect grace period */
  disconnectedPlayers: string[];
  /** playerId → display name */
  playerNames: Record<string, string>;
  /** playerId → avatar URL (from their OAuth profile), or null for guests. */
  playerAvatarUrls: Record<string, string | null>;
}

/** Broadcast to the room after each valid move (one emit per event in the events array). */
export interface GameEventPayload {
  event: GameEvent;
}

/**
 * Unicast to each player after each valid move.
 * Each player only sees their own redacted view.
 * `turnStartedAt` is the Unix ms timestamp at which the current turn began;
 * clients use this to render a countdown. Null when no active turn (game over).
 * `turnTimeoutMs` is the configured timeout for each turn.
 */
export interface StateUpdatePayload {
  view: PlayerView;
  turnStartedAt: number | null;
  turnTimeoutMs: number;
  matchScoring?: MatchScoringView[];
}

/** Broadcast when a player's socket disconnects. */
export interface PlayerDisconnectedPayload {
  playerId: string;
}

/** Broadcast when a player reconnects within the grace period. */
export interface PlayerReconnectedPayload {
  playerId: string;
}

/** Broadcast globally when a logged-in user comes online or goes offline. */
export interface PlayerOnlineStatusPayload {
  userId: string;
  isOnline: boolean;
}

/** Broadcast when a player's turn times out and a move is auto-played. */
export interface TurnTimeoutPayload {
  playerId: string;
  /** Optional: details of the auto-played move (for logging/UI). */
  move?: { type: string; card: string };
}

// ---------------------------------------------------------------------------
// Voice chat signaling payloads (WebRTC peer mesh)
// RTCSdpType must be declared locally — no DOM import on the server.
// ---------------------------------------------------------------------------

type RTCSdpType = 'answer' | 'offer' | 'pranswer' | 'rollback';

interface RTCSessionDescriptionInit {
  sdp?: string;
  type: RTCSdpType;
}

interface RTCIceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

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

/** A single ICE (STUN/TURN) server entry handed to clients. */
export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/** Server → Client (ack): ICE servers for building RTCPeerConnections. */
export interface RequestIceServersAck {
  iceServers: IceServerConfig[];
}

// ---------------------------------------------------------------------------
// Admin payload types
// ---------------------------------------------------------------------------

export interface AdminAuthPayload { email: string; secret?: string; }
export interface AdminAuthAck { ok: boolean; reason?: string; }

export interface AdminGetConfigAck { config: GameConfig; }

export interface AdminUpdateConfigPayload { config: Partial<GameConfig>; }
export interface AdminUpdateConfigAck { ok: boolean; reason?: string; }

/** Live operational stats snapshot from the in-memory store. */
export interface AdminServerStats {
  totalRooms: number;
  lobbyRooms: number;
  activeGames: number;
  completedRooms: number;
  connectedPlayers: number;
  totalSessions: number;
}

/** Ack for admin_get_stats. Requires admin auth. */
export type AdminGetStatsAck =
  | { ok: true; stats: AdminServerStats }
  | { ok: false; reason: string };

/**
 * Historical KPI stats for the admin dashboard (7-day window by default).
 * Mirrors AdminKpiStats from @ganatri/db.
 */
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

/** Ack for admin_get_kpi_stats. Requires admin auth and persistence. */
export type AdminGetKpiStatsAck =
  | { ok: true; stats: AdminKpiStats }
  | { ok: false; reason: 'NOT_AUTHORIZED' | 'UNAVAILABLE' };

// ---------------------------------------------------------------------------
// Admin: user management
// ---------------------------------------------------------------------------

export interface AdminSearchUsersPayload {
  query: string;
  limit?: number;
}

export interface AdminUserView {
  userId: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  isGuest: boolean;
  gamesPlayed: number;
  gamesWon: number;
}

export type AdminSearchUsersAck =
  | { ok: true; users: AdminUserView[] }
  | { ok: false; error: 'NOT_AUTHORIZED' | 'UNAVAILABLE' };

export interface AdminGetUserStatsPayload {
  userId: string;
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

export type AdminGetUserStatsAck =
  | { ok: true; stats: AdminUserStatsView }
  | { ok: false; error: 'NOT_AUTHORIZED' | 'UNAVAILABLE' | 'NOT_FOUND' };

// ---------------------------------------------------------------------------
// Admin: data export
// ---------------------------------------------------------------------------

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

/** Payload for admin_export_data (no required fields). */
export interface AdminExportDataPayload {
  /** Max games to return; clamped to 500 server-side. Default 500. */
  limit?: number;
}

/** Ack for admin_export_data. Requires admin auth. */
export type AdminExportDataAck =
  | { ok: true; games: ExportGameView[] }
  | { ok: false; error: 'NOT_AUTHORIZED' | 'UNAVAILABLE' };

// Re-export for consumers that want the config shape via the protocol module.
export type { GameConfig };

// ---------------------------------------------------------------------------
// Socket event name constants — single source of truth
// ---------------------------------------------------------------------------

export const EVENTS = {
  // Client → Server
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
  DOWNLOAD_MY_DATA: 'download_my_data',

  // Social / invitations (Client → Server)
  INVITE_PLAYER: 'invite_player',
  RESPOND_TO_INVITE: 'respond_to_invite',
  BLOCK_USER: 'block_user',
  UNBLOCK_USER: 'unblock_user',

  // Admin (Client → Server)
  ADMIN_AUTH: 'admin_auth',
  ADMIN_GET_CONFIG: 'admin_get_config',
  ADMIN_UPDATE_CONFIG: 'admin_update_config',
  ADMIN_GET_STATS: 'admin_get_stats',
  ADMIN_GET_KPI_STATS: 'admin_get_kpi_stats',
  ADMIN_SEARCH_USERS: 'admin_search_users',
  ADMIN_GET_USER_STATS: 'admin_get_user_stats',
  ADMIN_EXPORT_DATA: 'admin_export_data',

  // Server → Client
  SESSION: 'session',
  ROOM_UPDATE: 'room_update',
  GAME_EVENT: 'game_event',
  STATE_UPDATE: 'state_update',
  PLAYER_DISCONNECTED: 'player_disconnected',
  PLAYER_RECONNECTED: 'player_reconnected',
  TURN_TIMEOUT: 'turn_timeout',

  // Social / invitations (Server → Client push)
  INVITE_RECEIVED: 'invite_received',
  INVITE_ACCEPTED: 'invite_accepted',
  INVITE_REJECTED: 'invite_rejected',
  INVITE_CANCELLED: 'invite_cancelled',

  // Presence (Server → Client push)
  PLAYER_ONLINE_STATUS: 'player_online_status',

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
