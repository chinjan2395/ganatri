/**
 * Integration tests for DB write-through persistence.
 *
 * A fresh `MemoryPersistence` is injected via `__setPersistenceForTests` so the
 * real handlers exercise the persistence service end-to-end without a Postgres.
 * A full 2-player game is driven to GAME_OVER through the actual socket
 * handlers, then the durable reads are asserted. Writes are fire-and-forget, so
 * assertions poll until the game row settles.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { MemoryPersistence } from '@ganatri/db';
import type { GamePersistence, GameRow, GameWithPlayers } from '@ganatri/db';
import { createApp, type AppInstance } from './createApp.js';
import { resetStore } from './store.js';
import { resetLastMoveTime } from './handlers.js';
import { __setPersistenceForTests } from './persistence.js';
import { EVENTS } from './protocol.js';

// ---------------------------------------------------------------------------
// Helpers (mirrors the handlers.test.ts harness)
// ---------------------------------------------------------------------------

function connectClient(port: number, guestToken?: string): ClientSocket {
  return ioClient(`http://localhost:${port}`, {
    auth: guestToken !== undefined ? { guestToken } : {},
    autoConnect: true,
    reconnection: false,
  });
}

function waitFor<T>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function emitAck<T>(socket: ClientSocket, event: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Ack timeout for "${event}"`)), 3000);
    socket.emit(event, ...args, (result: T) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

/** Poll an async predicate until it returns a truthy value or times out. */
async function poll<T>(fn: () => Promise<T | null | undefined>, timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > deadline) throw new Error('poll timed out');
    await new Promise((r) => setTimeout(r, 50));
  }
}

/**
 * `MemoryPersistence` has no list-all API, so resolve the single finished game
 * via its private `games` map (reachable at runtime) + the public
 * `loadGameWithPlayers` recovery read. A finished game's room is DONE, so it
 * never surfaces through `loadActiveGames`.
 */
async function resolveSingleGame(p: GamePersistence): Promise<GameWithPlayers | null> {
  const mem = p as unknown as { games?: Map<string, GameRow> };
  const games = mem.games;
  if (!games) return null;
  // Only return once the lone game is FINISHED (endedAt set).
  const finished = [...games.values()].find((g) => g.endedAt != null);
  if (!finished) return null;
  return p.loadGameWithPlayers(finished.id);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('DB persistence write-through', () => {
  let app: AppInstance;
  let port: number;
  let persistence: MemoryPersistence;

  beforeEach(async () => {
    resetStore();
    resetLastMoveTime();
    persistence = new MemoryPersistence();
    __setPersistenceForTests(persistence);
    app = createApp();
    port = await app.listen(0);
  });

  afterEach(async () => {
    __setPersistenceForTests(null);
    await app.close();
  });

  it('persists a full 2-player game: game row, players, events, and stats', async () => {
    const { legalMoves, createGame } = await import('@ganatri/engine');
    const { store } = await import('./store.js');

    const host = connectClient(port);
    const guest = connectClient(port);

    const [hostSession, guestSession] = await Promise.all([
      waitFor<{ guestToken?: string; playerId: string }>(host, EVENTS.SESSION),
      waitFor<{ guestToken?: string; playerId: string }>(guest, EVENTS.SESSION),
    ]);

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM, {
        name: 'Host',
      });
      const roomCode = createAck.roomCode;
      await emitAck(guest, EVENTS.JOIN_ROOM, { roomCode, name: 'Guest' });

      await Promise.all([
        waitFor(host, EVENTS.STATE_UPDATE),
        waitFor(guest, EVENTS.STATE_UPDATE),
        emitAck(host, EVENTS.START_GAME),
      ]);

      // Inject a deterministic, verified-terminating deal (seed 3, ~88 moves).
      const startedRoom = store.rooms.get(roomCode)!;
      startedRoom.gameState = createGame(startedRoom.players, 3);

      const socketForPlayer: Record<string, ClientSocket> = {
        [hostSession.playerId]: host,
        [guestSession.playerId]: guest,
      };

      let phase = 'PART_1';
      let moveCount = 0;
      const MAX_MOVES = 150;

      while (phase !== 'GAME_OVER' && moveCount < MAX_MOVES) {
        const room = store.rooms.get(roomCode);
        if (room === undefined || room.gameState === null) break;
        const { gameState } = room;
        phase = gameState.phase;
        if (phase === 'GAME_OVER') break;

        const turnPlayerId = gameState.turn;
        if (turnPlayerId === null) break;
        const moves = legalMoves(gameState, turnPlayerId);
        if (moves.length === 0) break;

        const move = moves[0]!;
        const activeSocket = socketForPlayer[turnPlayerId];
        if (activeSocket === undefined) break;

        const moveAck = await emitAck<{ ok: boolean; view?: { phase: string } }>(
          activeSocket,
          EVENTS.MAKE_MOVE,
          { move },
        );
        expect(moveAck.ok).toBe(true);
        if (moveAck.view?.phase === 'GAME_OVER') phase = 'GAME_OVER';

        moveCount++;
        await new Promise((r) => setTimeout(r, 110));
      }

      expect(phase).toBe('GAME_OVER');

      // Writes are async/fire-and-forget — poll until the finished game settles.
      const resolved = await poll<GameWithPlayers>(() => resolveSingleGame(persistence));
      const { game, players } = resolved;

      // Exactly one game row, with a winner and a duration.
      expect(game.winnerId).not.toBeNull();
      expect(game.durationMs).not.toBeNull();
      expect(game.durationMs!).toBeGreaterThanOrEqual(0);
      expect(game.isAbandoned).toBe(false);

      // Two game_players rows, finalRank 1 and 2, with capture counts present.
      expect(players).toHaveLength(2);
      const ranks = [...players.map((p) => p.finalRank)].sort();
      expect(ranks).toEqual([1, 2]);
      for (const p of players) {
        expect(typeof p.captureCount).toBe('number');
        expect(p.captureCount).toBeGreaterThanOrEqual(0);
      }

      // Non-empty, contiguously sequenced (0..n) event log.
      const events = await persistence.loadGameEvents(game.id);
      expect(events.length).toBeGreaterThan(0);
      events.forEach((ev, i) => expect(ev.seq).toBe(i));

      // Player stats: gamesPlayed=1 for both, exactly one gamesWon=1.
      const hostStats = await poll(() => persistence.getPlayerStats(hostSession.playerId));
      const guestStats = await poll(() => persistence.getPlayerStats(guestSession.playerId));
      expect(hostStats.gamesPlayed).toBe(1);
      expect(guestStats.gamesPlayed).toBe(1);
      const wins = hostStats.gamesWon + guestStats.gamesWon;
      expect(wins).toBe(1);

      // The winner has a win streak of 1.
      const winner = hostStats.gamesWon === 1 ? hostStats : guestStats;
      expect(winner.currentWinStreak).toBe(1);
      expect(winner.longestWinStreak).toBeGreaterThanOrEqual(1);
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  }, 30_000);

  it('persists an abandoned game when a player leaves and too few remain', async () => {
    const { createGame } = await import('@ganatri/engine');
    const { store } = await import('./store.js');

    const host = connectClient(port);
    const guest = connectClient(port);
    const [, guestSession] = await Promise.all([
      waitFor<{ guestToken?: string; playerId: string }>(host, EVENTS.SESSION),
      waitFor<{ guestToken?: string; playerId: string }>(guest, EVENTS.SESSION),
    ]);

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM, {
        name: 'Host',
      });
      const roomCode = createAck.roomCode;
      await emitAck(guest, EVENTS.JOIN_ROOM, { roomCode, name: 'Guest' });

      await Promise.all([
        waitFor(host, EVENTS.STATE_UPDATE),
        waitFor(guest, EVENTS.STATE_UPDATE),
        emitAck(host, EVENTS.START_GAME),
      ]);

      const startedRoom = store.rooms.get(roomCode)!;
      startedRoom.gameState = createGame(startedRoom.players, 3);

      // Guest explicitly leaves the active 2-player game -> abandonment.
      await emitAck(guest, EVENTS.LEAVE_ROOM);

      const resolved = await poll<GameWithPlayers>(() => resolveSingleGame(persistence));
      expect(resolved.game.isAbandoned).toBe(true);

      // Both players counted one abandoned game.
      const hostStats = await poll(() => persistence.getPlayerStats(startedRoom.hostId));
      const guestStats = await poll(() => persistence.getPlayerStats(guestSession.playerId));
      expect(hostStats.gamesAbandoned).toBe(1);
      expect(guestStats.gamesAbandoned).toBe(1);
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  }, 15_000);
});
