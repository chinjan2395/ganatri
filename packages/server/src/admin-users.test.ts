/**
 * Integration tests for admin_search_users and admin_get_user_stats socket
 * endpoints.
 *
 * Follows the same harness as admin-kpi.test.ts: MemoryPersistence injected
 * via __setPersistenceForTests, real createApp + socket.io-client.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { MemoryPersistence } from '@ganatri/db';
import { createApp, type AppInstance } from './createApp.js';
import { resetStore } from './store.js';
import { resetLastMoveTime } from './handlers.js';
import {
  EVENTS,
  type AdminSearchUsersAck,
  type AdminGetUserStatsAck,
} from './protocol.js';
import { __setPersistenceForTests } from './persistence.js';

function emitAck<T>(socket: ClientSocket, event: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Ack timeout for "${event}"`)), 3000);
    socket.emit(event, ...args, (result: T) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

describe('admin user management events', () => {
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
    process.env['ADMIN_EMAILS'] = 'admin@test.com';
  });

  afterEach(async () => {
    await app.close();
    __setPersistenceForTests(null);
    delete process.env['ADMIN_EMAILS'];
    delete process.env['ADMIN_SECRET'];
  });

  /** Connect and authenticate as admin. */
  async function authedClient(): Promise<ClientSocket> {
    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    await emitAck<{ ok: boolean }>(client, EVENTS.ADMIN_AUTH, { email: 'admin@test.com' });
    return client;
  }

  /** Connect without admin auth. */
  function guestClient(): ClientSocket {
    return ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
  }

  // ---------------------------------------------------------------------------
  // admin_search_users
  // ---------------------------------------------------------------------------

  describe('admin_search_users', () => {
    it('returns NOT_AUTHORIZED for an unauthenticated caller', async () => {
      const client = guestClient();
      try {
        const ack = await emitAck<AdminSearchUsersAck>(client, EVENTS.ADMIN_SEARCH_USERS, {
          query: 'alice',
        });
        expect(ack).toEqual({ ok: false, error: 'NOT_AUTHORIZED' });
      } finally {
        client.disconnect();
      }
    });

    it('returns UNAVAILABLE when persistence is not configured', async () => {
      const client = await authedClient();
      try {
        __setPersistenceForTests(null);
        const ack = await emitAck<AdminSearchUsersAck>(client, EVENTS.ADMIN_SEARCH_USERS, {
          query: 'alice',
        });
        expect(ack).toEqual({ ok: false, error: 'UNAVAILABLE' });
      } finally {
        client.disconnect();
      }
    });

    it('returns empty array for an empty query (no DB scan)', async () => {
      // Seed a user so we can confirm they would match if query were non-empty.
      await persistence.upsertUser({
        id: 'user-empty-q',
        displayName: 'Alice',
        isGuest: false,
      });

      const client = await authedClient();
      try {
        const ack = await emitAck<AdminSearchUsersAck>(client, EVENTS.ADMIN_SEARCH_USERS, {
          query: '   ', // whitespace-only → trimmed to ''
        });
        expect(ack).toEqual({ ok: true, users: [] });
      } finally {
        client.disconnect();
      }
    });

    it('happy path: returns matching users', async () => {
      await persistence.upsertUser({
        id: 'user-alice',
        displayName: 'Alice Smith',
        isGuest: false,
      });
      await persistence.upsertUser({
        id: 'user-bob',
        displayName: 'Bob Jones',
        isGuest: false,
      });

      const client = await authedClient();
      try {
        const ack = await emitAck<AdminSearchUsersAck>(client, EVENTS.ADMIN_SEARCH_USERS, {
          query: 'alice',
        });
        expect(ack.ok).toBe(true);
        if (!ack.ok) throw new Error('Expected ok');
        expect(ack.users).toHaveLength(1);
        expect(ack.users[0]!.userId).toBe('user-alice');
        expect(ack.users[0]!.displayName).toBe('Alice Smith');
        expect(typeof ack.users[0]!.gamesPlayed).toBe('number');
        expect(typeof ack.users[0]!.gamesWon).toBe('number');
      } finally {
        client.disconnect();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // admin_get_user_stats
  // ---------------------------------------------------------------------------

  describe('admin_get_user_stats', () => {
    it('returns NOT_AUTHORIZED for an unauthenticated caller', async () => {
      const client = guestClient();
      try {
        const ack = await emitAck<AdminGetUserStatsAck>(client, EVENTS.ADMIN_GET_USER_STATS, {
          userId: 'any',
        });
        expect(ack).toEqual({ ok: false, error: 'NOT_AUTHORIZED' });
      } finally {
        client.disconnect();
      }
    });

    it('returns UNAVAILABLE when persistence is not configured', async () => {
      const client = await authedClient();
      try {
        __setPersistenceForTests(null);
        const ack = await emitAck<AdminGetUserStatsAck>(client, EVENTS.ADMIN_GET_USER_STATS, {
          userId: 'any',
        });
        expect(ack).toEqual({ ok: false, error: 'UNAVAILABLE' });
      } finally {
        client.disconnect();
      }
    });

    it('returns NOT_FOUND for an unknown userId', async () => {
      const client = await authedClient();
      try {
        const ack = await emitAck<AdminGetUserStatsAck>(client, EVENTS.ADMIN_GET_USER_STATS, {
          userId: 'does-not-exist-xyz',
        });
        expect(ack).toEqual({ ok: false, error: 'NOT_FOUND' });
      } finally {
        client.disconnect();
      }
    });

    it('happy path: returns full stats for a known user', async () => {
      await persistence.upsertUser({
        id: 'user-stats-test',
        displayName: 'Stats Tester',
        isGuest: false,
      });
      await persistence.upsertPlayerStats({
        userId: 'user-stats-test',
        gamesPlayed: 5,
        gamesWon: 3,
        gamesLost: 2,
        totalCaptures: 10,
        cutsGiven: 1,
        cutsReceived: 0,
        timesSafe: 2,
        totalPlayTimeMs: 30_000,
        longestWinStreak: 2,
        currentWinStreak: 1,
      });

      const client = await authedClient();
      try {
        const ack = await emitAck<AdminGetUserStatsAck>(client, EVENTS.ADMIN_GET_USER_STATS, {
          userId: 'user-stats-test',
        });
        expect(ack.ok).toBe(true);
        if (!ack.ok) throw new Error('Expected ok');
        const s = ack.stats;
        expect(s.userId).toBe('user-stats-test');
        expect(s.displayName).toBe('Stats Tester');
        expect(s.gamesPlayed).toBe(5);
        expect(s.gamesWon).toBe(3);
        expect(s.gamesLost).toBe(2);
        expect(s.winRate).toBeCloseTo(0.6, 6);
        expect(s.totalCaptures).toBe(10);
        expect(s.longestWinStreak).toBe(2);
        expect(s.currentWinStreak).toBe(1);
        expect(s.updatedAt).not.toBeNull();
      } finally {
        client.disconnect();
      }
    });
  });
});
