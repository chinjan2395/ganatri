/**
 * Integration tests for the GET_LEADERBOARD socket endpoint.
 *
 * The leaderboard is PUBLIC: guests and logged-in users alike may read it, so
 * these tests connect as a plain guest (no cookie). A MemoryPersistence is
 * injected via the __setPersistenceForTests hook and seeded with non-guest
 * users + player_stats rows.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { MemoryPersistence } from '@ganatri/db';
import { createApp, type AppInstance } from './createApp.js';
import { resetStore } from './store.js';
import { resetLastMoveTime } from './handlers.js';
import { EVENTS } from './protocol.js';
import { __setPersistenceForTests } from './persistence.js';
import type { GetLeaderboardAck, GetLeaderboardRequest, SessionPayload } from './protocol.js';

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

/** Seed a non-guest user with an aggregate win record. */
async function seedRankedUser(
  p: MemoryPersistence,
  id: string,
  displayName: string,
  stats: { gamesPlayed: number; gamesWon: number; gamesLost: number },
): Promise<void> {
  await p.upsertUser({ id, displayName, isGuest: false });
  await p.upsertPlayerStats({ userId: id, ...stats });
}

describe('GET_LEADERBOARD', () => {
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
    await app.close();
    __setPersistenceForTests(null);
  });

  it('returns UNAVAILABLE when persistence is not configured', async () => {
    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      __setPersistenceForTests(null);
      const ack = await emitAck<GetLeaderboardAck>(client, EVENTS.GET_LEADERBOARD, {});
      expect(ack).toEqual({ ok: false, error: 'UNAVAILABLE' });
    } finally {
      client.disconnect();
    }
  });

  it('returns ranked entries to a guest connection', async () => {
    // Bob: 5/8 (0.625), Alice: 5/10 (0.5), Carol: 3/4 (0.75).
    await seedRankedUser(persistence, 'u-alice', 'Alice', { gamesPlayed: 10, gamesWon: 5, gamesLost: 5 });
    await seedRankedUser(persistence, 'u-bob', 'Bob', { gamesPlayed: 8, gamesWon: 5, gamesLost: 3 });
    await seedRankedUser(persistence, 'u-carol', 'Carol', { gamesPlayed: 4, gamesWon: 3, gamesLost: 1 });

    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      const session = await waitFor<SessionPayload>(client, EVENTS.SESSION);
      expect(session.loggedIn).toBe(false);

      const ack = await emitAck<GetLeaderboardAck>(client, EVENTS.GET_LEADERBOARD, {});
      expect(ack.ok).toBe(true);
      if (ack.ok) {
        // gamesWon DESC, then winRate DESC for the Alice/Bob tie.
        expect(ack.entries.map((e) => e.userId)).toEqual(['u-bob', 'u-alice', 'u-carol']);
        expect(ack.entries.map((e) => e.rank)).toEqual([1, 2, 3]);
        expect(ack.entries[0]!.winRate).toBeCloseTo(0.625, 6);
        expect(ack.entries[2]!.winRate).toBeCloseTo(0.75, 6);
      }
    } finally {
      client.disconnect();
    }
  });

  it('returns an empty list when there are no qualifying users', async () => {
    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      const ack = await emitAck<GetLeaderboardAck>(client, EVENTS.GET_LEADERBOARD, {});
      expect(ack).toEqual({ ok: true, entries: [] });
    } finally {
      client.disconnect();
    }
  });

  it('omits myEntry for a guest connection', async () => {
    await seedRankedUser(persistence, 'u-alice', 'Alice', { gamesPlayed: 10, gamesWon: 5, gamesLost: 5 });
    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      const session = await waitFor<SessionPayload>(client, EVENTS.SESSION);
      expect(session.loggedIn).toBe(false);
      const ack = await emitAck<GetLeaderboardAck>(client, EVENTS.GET_LEADERBOARD, {});
      expect(ack.ok).toBe(true);
      if (ack.ok) expect(ack.myEntry).toBeUndefined();
    } finally {
      client.disconnect();
    }
  });

  // Windowed leaderboard -----------------------------------------------------

  /**
   * Seed a completed game in persistence: creates a room + game + game_players
   * so windowed queries that join game_players + games can find the data.
   */
  async function seedGameResult(
    p: MemoryPersistence,
    userId: string,
    result: 'WIN' | 'LOSS',
    endedAt: Date,
  ): Promise<void> {
    const hostId = `host-${Math.random().toString(36).slice(2)}`;
    await p.ensureGuest(hostId, 'host');
    const code = `T${Math.random().toString(36).slice(2, 7).toUpperCase()}`.slice(0, 6);
    const room = await p.recordRoomCreated({ roomCode: code, hostUserId: hostId });
    const game = await p.recordGameStarted({
      roomId: room.id,
      seed: 'seed',
      seatingOrder: [userId, hostId],
      startedAt: new Date(endedAt.getTime() - 60_000),
    });
    await p.recordGameFinished({
      gameId: game.id,
      endedAt,
      winnerId: result === 'WIN' ? userId : null,
      isAbandoned: false,
      players: [
        { userId, seatIndex: 0, displayName: 'U', finalRank: result === 'WIN' ? 1 : 2, wasCut: false, captureCount: 1, result },
        { userId: hostId, seatIndex: 1, displayName: 'host', finalRank: result === 'WIN' ? 2 : 1, wasCut: false, captureCount: 1, result: result === 'WIN' ? 'LOSS' : 'WIN' },
      ],
    });
  }

  it('returns entries for week window when persistence has data', async () => {
    const userId = 'u-weektest';
    await persistence.upsertUser({ id: userId, displayName: 'WeekUser', isGuest: false });
    await seedGameResult(persistence, userId, 'WIN', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000));

    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      const req: GetLeaderboardRequest = { timeWindow: 'week' };
      const ack = await emitAck<GetLeaderboardAck>(client, EVENTS.GET_LEADERBOARD, req);
      expect(ack.ok).toBe(true);
      if (ack.ok) {
        const entry = ack.entries.find((e) => e.userId === userId);
        expect(entry).toBeDefined();
        expect(entry!.gamesWon).toBe(1);
        expect(entry!.rank).toBe(1);
      }
    } finally {
      client.disconnect();
    }
  });

  it('passes timeWindow through: month window returns ok response', async () => {
    const userId = 'u-monthtest';
    await persistence.upsertUser({ id: userId, displayName: 'MonthUser', isGuest: false });
    await seedGameResult(persistence, userId, 'WIN', new Date(Date.now() - 20 * 24 * 60 * 60 * 1000));

    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      const monthAck = await emitAck<GetLeaderboardAck>(client, EVENTS.GET_LEADERBOARD, { timeWindow: 'month' } as GetLeaderboardRequest);
      expect(monthAck.ok).toBe(true);
      if (monthAck.ok) {
        const entry = monthAck.entries.find((e) => e.userId === userId);
        expect(entry).toBeDefined();
      }

      const weekAck = await emitAck<GetLeaderboardAck>(client, EVENTS.GET_LEADERBOARD, { timeWindow: 'week' } as GetLeaderboardRequest);
      expect(weekAck.ok).toBe(true);
      if (weekAck.ok) {
        // Game is 20 days old — outside week window.
        const entry = weekAck.entries.find((e) => e.userId === userId);
        expect(entry).toBeUndefined();
      }
    } finally {
      client.disconnect();
    }
  });
});
