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
  | { ok: true; view: PlayerView; turnStartedAt: number | null }
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
  updatedAt: string | null; // ISO string; null when the user has no stats row yet
}

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

export interface UpdateDisplayNamePayload {
  newDisplayName: string;
}

export type UpdateDisplayNameAck =
  | { ok: true; displayName: string }
  | { ok: false; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' | 'INVALID_NAME' };

// ---------------------------------------------------------------------------
// Server → Client pushed events
// ---------------------------------------------------------------------------

/** Issued once per connection (new or reconnect) with the session identity. */
export interface SessionPayload {
  token: string;
  playerId: string;
  /** True when the connection is bound to a durable (OAuth) account. */
  loggedIn: boolean;
  /** Account display name (only when loggedIn). */
  displayName?: string;
  /** Account email, if the provider supplied one (only when loggedIn). */
  email?: string;
  /** Account avatar URL (only when loggedIn). */
  avatarUrl?: string;
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
}

/** Broadcast when a player's socket disconnects. */
export interface PlayerDisconnectedPayload {
  playerId: string;
}

/** Broadcast when a player reconnects within the grace period. */
export interface PlayerReconnectedPayload {
  playerId: string;
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
  GET_LEADERBOARD: 'get_leaderboard',
  UPDATE_DISPLAY_NAME: 'update_display_name',

  // Admin (Client → Server)
  ADMIN_AUTH: 'admin_auth',
  ADMIN_GET_CONFIG: 'admin_get_config',
  ADMIN_UPDATE_CONFIG: 'admin_update_config',
  ADMIN_GET_STATS: 'admin_get_stats',

  // Server → Client
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
