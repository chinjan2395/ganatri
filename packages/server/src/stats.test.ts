/**
 * Integration tests for the GET_MY_STATS socket endpoint.
 *
 * Mirrors the REQUEST_HISTORY harness: a MemoryPersistence is injected via the
 * __setPersistenceForTests hook, and a logged-in connection is simulated by
 * seeding an auth session and sending the matching `ganatri_session` cookie in
 * the handshake headers — exercising the real socket auth middleware
 * end-to-end.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { MemoryPersistence } from '@ganatri/db';
import { createApp, type AppInstance } from './createApp.js';
import { resetStore } from './store.js';
import { resetLastMoveTime } from './handlers.js';
import { EVENTS } from './protocol.js';
import { __setPersistenceForTests } from './persistence.js';
import { hashToken } from './auth/session.js';
import type { GetMyStatsAck, SessionPayload } from './protocol.js';

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

/** Seed an OAuth user + a valid auth session, returning the user and its token. */
async function seedLoggedInUser(
  p: MemoryPersistence,
  providerUserId: string,
  token: string,
  displayName: string,
  email: string | null = null,
): Promise<{ id: string }> {
  const user = await p.upsertOAuthUser({
    provider: 'google',
    providerUserId,
    email,
    displayName,
  });
  await p.createAuthSession({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60_000),
  });
  return user;
}

describe('GET_MY_STATS', () => {
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

  it('returns NOT_LOGGED_IN for a guest connection', async () => {
    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      const session = await waitFor<SessionPayload>(client, EVENTS.SESSION);
      expect(session.loggedIn).toBe(false);
      const ack = await emitAck<GetMyStatsAck>(client, EVENTS.GET_MY_STATS);
      expect(ack).toEqual({ ok: false, error: 'NOT_LOGGED_IN' });
    } finally {
      client.disconnect();
    }
  });

  it('returns UNAVAILABLE for a logged-in session when persistence drops out', async () => {
    const token = 'token-for-vanish';
    await seedLoggedInUser(persistence, 'google-sub-gone', token, 'Vanishing User');

    const client = ioClient(`http://localhost:${port}`, {
      autoConnect: true,
      reconnection: false,
      transports: ['polling'],
      extraHeaders: { Cookie: `ganatri_session=${token}` },
    });
    try {
      const session = await waitFor<SessionPayload>(client, EVENTS.SESSION);
      expect(session.loggedIn).toBe(true);

      __setPersistenceForTests(null);
      const ack = await emitAck<GetMyStatsAck>(client, EVENTS.GET_MY_STATS);
      expect(ack).toEqual({ ok: false, error: 'UNAVAILABLE' });
    } finally {
      client.disconnect();
    }
  });

  it('returns seeded aggregate stats with a derived winRate', async () => {
    const token = 'opaque-session-token-stats';
    const user = await seedLoggedInUser(
      persistence,
      'google-sub-stats',
      token,
      'Stats Player',
      'stats@example.com',
    );
    await persistence.upsertPlayerStats({
      userId: user.id,
      gamesPlayed: 4,
      gamesWon: 3,
      gamesLost: 1,
      totalCaptures: 12,
      cutsGiven: 2,
      cutsReceived: 1,
      timesSafe: 3,
      totalPlayTimeMs: 60000,
      currentWinStreak: 2,
      longestWinStreak: 3,
      sumFinishPositions: 6,
    });

    const client = ioClient(`http://localhost:${port}`, {
      autoConnect: true,
      reconnection: false,
      transports: ['polling'],
      extraHeaders: { Cookie: `ganatri_session=${token}` },
    });
    try {
      const session = await waitFor<SessionPayload>(client, EVENTS.SESSION);
      expect(session.loggedIn).toBe(true);

      const ack = await emitAck<GetMyStatsAck>(client, EVENTS.GET_MY_STATS);
      expect(ack.ok).toBe(true);
      if (ack.ok) {
        expect(ack.stats.gamesPlayed).toBe(4);
        expect(ack.stats.gamesWon).toBe(3);
        expect(ack.stats.winRate).toBe(0.75);
        expect(ack.stats.avgFinish).toBe(1.5);
        expect(typeof ack.stats.updatedAt).toBe('string');
      }
    } finally {
      client.disconnect();
    }
  });

  it('returns an all-zero stats view for a logged-in user with no stats row', async () => {
    const token = 'opaque-session-token-empty';
    await seedLoggedInUser(persistence, 'google-sub-empty', token, 'Empty Player');

    const client = ioClient(`http://localhost:${port}`, {
      autoConnect: true,
      reconnection: false,
      transports: ['polling'],
      extraHeaders: { Cookie: `ganatri_session=${token}` },
    });
    try {
      const session = await waitFor<SessionPayload>(client, EVENTS.SESSION);
      expect(session.loggedIn).toBe(true);

      const ack = await emitAck<GetMyStatsAck>(client, EVENTS.GET_MY_STATS);
      expect(ack.ok).toBe(true);
      if (ack.ok) {
        expect(ack.stats.gamesPlayed).toBe(0);
        expect(ack.stats.winRate).toBe(0);
        expect(ack.stats.avgFinish).toBe(0);
        expect(ack.stats.updatedAt).toBeNull();
      }
    } finally {
      client.disconnect();
    }
  });
});
