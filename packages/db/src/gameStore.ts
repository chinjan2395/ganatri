/**
 * GameStore interface — abstract data-access layer for sessions, rooms, and game state.
 *
 * This interface mirrors the `GameTransport` pattern: concrete implementations (MemoryStore,
 * PostgresStore) plug behind this interface, allowing the server handlers to remain
 * agnostic to the persistence mechanism.
 *
 * The types SessionState and RoomState are defined here so both MemoryStore and PostgresStore
 * can share the same domain types.
 */

import type { GameState } from '@ganatri/engine';

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/**
 * SessionState represents a player's session and room binding.
 * Issued on first connect, persisted across reconnects.
 */
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

/**
 * RoomState represents the ephemeral state of a room (in-memory, not persisted to DB yet).
 * Includes game state, player list, timers, and lifecycle phase.
 */
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
// GameStore interface
// ---------------------------------------------------------------------------

/**
 * GameStore interface abstracts all data-access operations for sessions and rooms.
 *
 * Implementations:
 * - MemoryStore: in-memory Map-based storage (v1, tests, fast)
 * - PostgresStore: persistent Postgres backend (Phase 6b+)
 *
 * The interface is intentionally simple for v1: it only covers the session/room
 * lifecycle operations needed for game flows. In Phase 6b, this will expand to
 * cover user accounts, game history, and stats.
 */
export interface GameStore {
  /**
   * Look up a session by its token.
   * Returns the SessionState if found, undefined otherwise.
   */
  getSession(token: string): SessionState | undefined;

  /**
   * Look up a session by playerId.
   * Returns the SessionState if found, undefined otherwise.
   */
  getSessionByPlayerId(playerId: string): SessionState | undefined;

  /**
   * Create a new session and register it in the store.
   * Idempotent: may be called multiple times with the same token (no effect).
   */
  createSession(token: string, playerId: string, socketId: string, name?: string): SessionState;

  /**
   * Update mutable fields of an existing session (name, roomCode, socketId).
   * No-op if the session does not exist.
   */
  updateSession(token: string, patch: Partial<Omit<SessionState, 'token' | 'playerId'>>): void;

  /**
   * Look up a room by its code.
   * Returns the RoomState if found, undefined otherwise.
   */
  getRoom(code: string): RoomState | undefined;

  /**
   * Create and register a new room.
   * Returns the newly created RoomState.
   */
  createRoom(code: string, hostId: string): RoomState;

  /**
   * Reset the store to empty state.
   * For use in tests only — do not call in production code.
   */
  resetStore(): void;
}
