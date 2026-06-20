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
import type { GetLeaderboardAck, SessionPayload } from './protocol.js';

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
      const ack = await emitAck<GetLeaderboardAck>(client, EVENTS.GET_LEADERBOARD);
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

      const ack = await emitAck<GetLeaderboardAck>(client, EVENTS.GET_LEADERBOARD);
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
      const ack = await emitAck<GetLeaderboardAck>(client, EVENTS.GET_LEADERBOARD);
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
      const ack = await emitAck<GetLeaderboardAck>(client, EVENTS.GET_LEADERBOARD);
      expect(ack.ok).toBe(true);
      if (ack.ok) expect(ack.myEntry).toBeUndefined();
    } finally {
      client.disconnect();
    }
  });
});
