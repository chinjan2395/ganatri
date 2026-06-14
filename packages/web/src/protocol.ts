/**
 * Local copy of the server wire protocol (packages/server/src/protocol.ts).
 * The server package exposes no importable subpath, so the EVENTS constant and
 * server-only payload/ack interfaces are re-declared here. Engine types are
 * imported structurally from @ganatri/engine.
 */

import type { GameEvent, Move, MoveError, PlayerView } from '@ganatri/engine';

// --- Client → Server payloads ---
export interface JoinRoomPayload {
  roomCode: string;
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

// --- Server → Client pushed payloads ---
export interface SessionPayload {
  token: string;
  playerId: string;
}
export interface RoomUpdatePayload {
  roomCode: string;
  players: string[];
  hostId: string;
  phase: 'LOBBY' | 'PLAYING' | 'DONE';
  /** playerIds currently within their disconnect grace period */
  disconnectedPlayers: string[];
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

export const EVENTS = {
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  START_GAME: 'start_game',
  MAKE_MOVE: 'make_move',
  REQUEST_STATE: 'request_state',
  SESSION: 'session',
  ROOM_UPDATE: 'room_update',
  GAME_EVENT: 'game_event',
  STATE_UPDATE: 'state_update',
  PLAYER_DISCONNECTED: 'player_disconnected',
  PLAYER_RECONNECTED: 'player_reconnected',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

// --- Admin events ---
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
