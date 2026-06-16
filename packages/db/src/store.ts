/**
 * GameStore interface — the contract that any data-access layer must implement.
 *
 * This abstraction mirrors the GameTransport pattern: implementations (MemoryStore,
 * PostgresStore) plug behind this interface, and handlers never import the DB directly.
 *
 * For v1, this focuses on the minimal set needed for game lifecycle and session
 * management. Full CRUD for stats, analytics, and accounts will be added in Phase 6c+.
 */

import type { GameState } from '@ganatri/engine';

// ---------------------------------------------------------------------------
// Session Management
// ---------------------------------------------------------------------------

export interface SessionData {
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
// Room State
// ---------------------------------------------------------------------------

export interface RoomData {
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
// GameStore Interface
// ---------------------------------------------------------------------------

/**
 * The contract for a data-access layer backing the Ganatri server.
 *
 * Implementations:
 * - MemoryStore: Today's in-memory Map<> based store (fast, no persistence).
 * - PostgresStore: Persistent Postgres store (Phase 6).
 */
export interface GameStore {
  // =========================================================================
  // Sessions
  // =========================================================================

  /** Retrieve a session by token. Returns undefined if not found. */
  getSession(token: string): SessionData | undefined;

  /** Create a new session with the given token and playerId. */
  createSession(token: string, playerId: string, name: string): SessionData;

  /** Update a session's room binding, socket ID, or name. */
  updateSession(
    token: string,
    patch: Partial<Pick<SessionData, 'roomCode' | 'socketId' | 'name'>>
  ): SessionData | undefined;

  /** Delete a session (on logout or if needed for cleanup). */
  deleteSession(token: string): void;

  // =========================================================================
  // Rooms
  // =========================================================================

  /** Retrieve a room by code. Returns undefined if not found. */
  getRoom(code: string): RoomData | undefined;

  /** Create a new room with the given code and host. */
  createRoom(code: string, hostId: string): RoomData;

  /** Update a room's state (players, phase, game state, etc.). */
  updateRoom(
    code: string,
    patch: Partial<
      Pick<RoomData, 'players' | 'phase' | 'gameState' | 'turnStartedAt' | 'completedAt'>
    >
  ): RoomData | undefined;

  /** Record a player's disconnect timestamp in the room. */
  recordDisconnect(code: string, playerId: string, timestamp: number): void;

  /** Clear a player's disconnect timestamp on reconnect. */
  clearDisconnect(code: string, playerId: string): void;

  /** Set a grace-period timer handle for a player (for cleanup on reconnect). */
  setGracePeriodTimer(
    code: string,
    playerId: string,
    timer: ReturnType<typeof setTimeout>
  ): void;

  /** Clear a grace-period timer handle for a player. */
  clearGracePeriodTimer(code: string, playerId: string): void;

  /** Set a turn timer handle. */
  setTurnTimer(code: string, timer: ReturnType<typeof setTimeout>): void;

  /** Clear the turn timer. */
  clearTurnTimer(code: string): void;

  /** Delete a room (on expiry or explicit cleanup). */
  deleteRoom(code: string): void;

  /** List all rooms (for admin queries). */
  listRooms(): RoomData[];

  // =========================================================================
  // Player Index (reverse lookup)
  // =========================================================================

  /** Get the token for a player ID (for fast lookup). */
  getTokenForPlayer(playerId: string): string | undefined;

  /** Set the token for a player ID. */
  setPlayerToken(playerId: string, token: string): void;

  /** Remove a player from the index. */
  deletePlayerToken(playerId: string): void;

  // =========================================================================
  // Admin & Auth
  // =========================================================================

  /** Track that a socket has been authenticated as admin. */
  markAdminSocket(socketId: string): void;

  /** Remove an admin socket (on disconnect). */
  unmarkAdminSocket(socketId: string): void;

  /** Check if a socket is marked as admin. */
  isAdminSocket(socketId: string): boolean;
}
