/**
 * MemoryStore implementation of GameStore.
 *
 * In-memory Map-based storage for sessions, rooms, and game state.
 * No database — structure is designed so a store interface could be extracted
 * and a PostgreSQL / Redis implementation swapped in later (Phase 6b+).
 */

import type { GameStore, SessionState, RoomState } from '@ganatri/db';

// ---------------------------------------------------------------------------
// Store singleton (internal representation)
// ---------------------------------------------------------------------------

interface InternalStore {
  /** token → session */
  sessions: Map<string, SessionState>;
  /** roomCode → room */
  rooms: Map<string, RoomState>;
  /** playerId → token (reverse index for fast lookup) */
  playerIndex: Map<string, string>;
  /** Socket IDs that have passed admin authentication. */
  adminSockets: Set<string>;
}

const internalStore: InternalStore = {
  sessions: new Map(),
  rooms: new Map(),
  playerIndex: new Map(),
  adminSockets: new Set(),
};

// ---------------------------------------------------------------------------
// MemoryStore class
// ---------------------------------------------------------------------------

/**
 * MemoryStore is a GameStore implementation backed by in-memory Maps.
 * Suitable for testing and single-instance deployments.
 *
 * All operations are synchronous; no I/O blocking.
 */
class MemoryStore implements GameStore {
  getSession(token: string): SessionState | undefined {
    return internalStore.sessions.get(token);
  }

  getSessionByPlayerId(playerId: string): SessionState | undefined {
    const token = internalStore.playerIndex.get(playerId);
    if (token === undefined) return undefined;
    return internalStore.sessions.get(token);
  }

  createSession(token: string, playerId: string, socketId: string, name = ''): SessionState {
    const session: SessionState = { token, playerId, name, roomCode: null, socketId };
    internalStore.sessions.set(token, session);
    internalStore.playerIndex.set(playerId, token);
    return session;
  }

  updateSession(token: string, patch: Partial<Omit<SessionState, 'token' | 'playerId'>>): void {
    const session = internalStore.sessions.get(token);
    if (session === undefined) return;
    if (patch.name !== undefined) session.name = patch.name;
    if (patch.roomCode !== undefined) session.roomCode = patch.roomCode;
    if (patch.socketId !== undefined) session.socketId = patch.socketId;
  }

  getRoom(code: string): RoomState | undefined {
    return internalStore.rooms.get(code);
  }

  createRoom(code: string, hostId: string): RoomState {
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
    internalStore.rooms.set(code, room);
    return room;
  }

  resetStore(): void {
    // Cancel all outstanding timers to avoid leaks.
    for (const room of internalStore.rooms.values()) {
      for (const timer of room.gracePeriodTimers.values()) {
        clearTimeout(timer);
      }
      if (room.turnTimer !== null) {
        clearTimeout(room.turnTimer);
      }
    }
    internalStore.sessions.clear();
    internalStore.rooms.clear();
    internalStore.playerIndex.clear();
    internalStore.adminSockets.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton instance and backward-compatibility helpers
// ---------------------------------------------------------------------------

/** The singleton MemoryStore instance. */
export const memoryStore = new MemoryStore();

/**
 * Helper functions for backward compatibility.
 * These delegate to the memoryStore singleton, preserving the existing API
 * so handlers.ts requires no changes.
 */

export function getSession(token: string): SessionState | undefined {
  return memoryStore.getSession(token);
}

export function getSessionByPlayerId(playerId: string): SessionState | undefined {
  return memoryStore.getSessionByPlayerId(playerId);
}

export function createSession(token: string, playerId: string, socketId: string, name = ''): SessionState {
  return memoryStore.createSession(token, playerId, socketId, name);
}

export function updateSession(token: string, patch: Partial<Omit<SessionState, 'token' | 'playerId'>>): void {
  memoryStore.updateSession(token, patch);
}

export function getRoom(code: string): RoomState | undefined {
  return memoryStore.getRoom(code);
}

export function createRoom(code: string, hostId: string): RoomState {
  return memoryStore.createRoom(code, hostId);
}

export function resetStore(): void {
  memoryStore.resetStore();
}

/**
 * Get the store's admin sockets set.
 * Internal use only — for admin authentication in handlers.ts.
 */
export function getAdminSockets(): Set<string> {
  return internalStore.adminSockets;
}

/**
 * Export the internal store for backward compatibility.
 * TODO (Phase 6c): wrap store.rooms and store.adminSockets access in methods.
 */
export const store = internalStore;

// Re-export types for backward compatibility.
export type { SessionState, RoomState };
