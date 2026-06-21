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
  | { ok: true; view: PlayerView; turnStartedAt: number | null }
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
  updatedAt: string | null;
}

export type GetMyStatsAck =
  | { ok: true; stats: PlayerStatsView }
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

// --- Server → Client pushed payloads ---
export interface SessionPayload {
  token: string;
  playerId: string;
  /** Whether this session is authenticated via Google. Guests are false. */
  loggedIn: boolean;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
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
}
export interface GameEventPayload {
  event: GameEvent;
}
export interface StateUpdatePayload {
  view: PlayerView;
  turnStartedAt: number | null;
  turnTimeoutMs: number;
}
export interface PlayerDisconnectedPayload {
  playerId: string;
}
export interface PlayerReconnectedPayload {
  playerId: string;
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
  GET_LEADERBOARD: 'get_leaderboard',
  UPDATE_DISPLAY_NAME: 'update_display_name',
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
  AUTH:          'admin_auth',
  GET_CONFIG:    'admin_get_config',
  UPDATE_CONFIG: 'admin_update_config',
} as const;

export interface GameConfig {
  turnTimeoutMs: number;
  maxPlayers: number;
  gracePeriodMs: number;
  roomExpiryMs: number;
}
