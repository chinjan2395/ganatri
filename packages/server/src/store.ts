/**
 * In-memory store for sessions and rooms.
 *
 * No database. Structure is designed so a store interface could be extracted
 * and a Redis / persistent implementation swapped in later.
 */

import type { GameState } from '@ganatri/engine';

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

export interface SessionState {
  /** UUID v4 token issued to the client. */
  token: string;
  /** Stable UUID for this player across reconnects. */
  playerId: string;
  /** Display name chosen by the player. */
  name: string;
  /** The room this player is currently bound to, or null. */
  roomCode: string | null;
  /** The current socket.id, or null when disconnected. */
  socketId: string | null;
}

// ---------------------------------------------------------------------------
// Room state
// ---------------------------------------------------------------------------

export interface RoomState {
  /** 6-char uppercase alphanumeric room code (no O/0). */
  code: string;
  /** playerId of the host (first player to create the room). */
  hostId: string;
  /** Players in join order — becomes seating order at game start. */
  players: string[];
  /** Full server-only game state; null until the game starts. */
  gameState: GameState | null;
  /** Room lifecycle phase. */
  phase: 'LOBBY' | 'PLAYING' | 'DONE';
  /**
   * playerId → timestamp (ms) of disconnect.
   * A player is removed from this map when they reconnect.
   */
  disconnectedAt: Map<string, number>;
  /**
   * playerId → NodeJS.Timeout handle for the grace-period expiry timer.
   * Cleared on reconnect.
   */
  gracePeriodTimers: Map<string, ReturnType<typeof setTimeout>>;
  /**
   * Handle for the active turn timer, or null when no game is in progress or
   * the current turn has no pending auto-play timeout.
   */
  turnTimer: ReturnType<typeof setTimeout> | null;
  /**
   * Unix timestamp (ms) at which the current turn began, or null when no
   * turn is active. Sent to clients so they can render a countdown.
   */
  turnStartedAt: number | null;
  /**
   * Unix ms timestamp when the room transitioned to 'DONE', or null if it
   * hasn't ended yet. Used by the room-expiry cleanup interval.
   */
  completedAt: number | null;
}

// ---------------------------------------------------------------------------
// Store singleton
// ---------------------------------------------------------------------------

export interface Store {
  /** token → session */
  sessions: Map<string, SessionState>;
  /** roomCode → room */
  rooms: Map<string, RoomState>;
  /** playerId → token (reverse index for fast lookup) */
  playerIndex: Map<string, string>;
  /** Socket IDs that have passed admin authentication. */
  adminSockets: Set<string>;
}

/** The single in-memory store instance. */
export const store: Store = {
  sessions: new Map(),
  rooms: new Map(),
  playerIndex: new Map(),
  adminSockets: new Set(),
};

// ---------------------------------------------------------------------------
// Store helpers
// ---------------------------------------------------------------------------

/** Look up a session by its token. Returns undefined if not found. */
export function getSession(token: string): SessionState | undefined {
  return store.sessions.get(token);
}

/** Look up a session by playerId. Returns undefined if not found. */
export function getSessionByPlayerId(playerId: string): SessionState | undefined {
  const token = store.playerIndex.get(playerId);
  if (token === undefined) return undefined;
  return store.sessions.get(token);
}

/** Create a brand-new session and register it in the store. */
export function createSession(token: string, playerId: string, socketId: string, name = ''): SessionState {
  const session: SessionState = { token, playerId, name, roomCode: null, socketId };
  store.sessions.set(token, session);
  store.playerIndex.set(playerId, token);
  return session;
}

/** Update mutable fields of a session in place. */
export function updateSession(token: string, patch: Partial<Omit<SessionState, 'token' | 'playerId'>>): void {
  const session = store.sessions.get(token);
  if (session === undefined) return;
  if (patch.name !== undefined) session.name = patch.name;
  if (patch.roomCode !== undefined) session.roomCode = patch.roomCode;
  if (patch.socketId !== undefined) session.socketId = patch.socketId;
}

/** Look up a room by its code. Returns undefined if not found. */
export function getRoom(code: string): RoomState | undefined {
  return store.rooms.get(code);
}

/** Create and register a new room. */
export function createRoom(code: string, hostId: string): RoomState {
  const room: RoomState = {
    code,
    hostId,
    players: [hostId],
    gameState: null,
    phase: 'LOBBY',
    disconnectedAt: new Map(),
    gracePeriodTimers: new Map(),
    turnTimer: null,
    turnStartedAt: null,
    completedAt: null,
  };
  store.rooms.set(code, room);
  return room;
}

/**
 * Reset the store to empty state.
 * For use in tests only — do not call in production code.
 */
export function resetStore(): void {
  // Cancel all outstanding timers to avoid leaks.
  for (const room of store.rooms.values()) {
    for (const timer of room.gracePeriodTimers.values()) {
      clearTimeout(timer);
    }
    if (room.turnTimer !== null) {
      clearTimeout(room.turnTimer);
    }
  }
  store.sessions.clear();
  store.rooms.clear();
  store.playerIndex.clear();
  store.adminSockets.clear();
}
