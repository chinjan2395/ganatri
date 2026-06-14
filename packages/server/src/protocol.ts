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
  // no payload needed; session token comes from socket.handshake.auth.token
}

export interface JoinRoomPayload {
  roomCode: string;
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

// ---------------------------------------------------------------------------
// Server → Client pushed events
// ---------------------------------------------------------------------------

/** Issued once per connection (new or reconnect) with the session identity. */
export interface SessionPayload {
  token: string;
  playerId: string;
}

/** Broadcast to the room whenever players join/leave or the game starts. */
export interface RoomUpdatePayload {
  roomCode: string;
  players: string[]; // playerIds in join order
  hostId: string;
  phase: 'LOBBY' | 'PLAYING' | 'DONE';
  /** playerIds currently within their disconnect grace period */
  disconnectedPlayers: string[];
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

// ---------------------------------------------------------------------------
// Admin payload types
// ---------------------------------------------------------------------------

export interface AdminAuthPayload { email: string; }
export interface AdminAuthAck { ok: boolean; reason?: string; }

export interface AdminGetConfigAck { config: GameConfig; }

export interface AdminUpdateConfigPayload { config: Partial<GameConfig>; }
export interface AdminUpdateConfigAck { ok: boolean; reason?: string; }

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

  // Admin (Client → Server)
  ADMIN_AUTH: 'admin_auth',
  ADMIN_GET_CONFIG: 'admin_get_config',
  ADMIN_UPDATE_CONFIG: 'admin_update_config',

  // Server → Client
  SESSION: 'session',
  ROOM_UPDATE: 'room_update',
  GAME_EVENT: 'game_event',
  STATE_UPDATE: 'state_update',
  PLAYER_DISCONNECTED: 'player_disconnected',
  PLAYER_RECONNECTED: 'player_reconnected',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
