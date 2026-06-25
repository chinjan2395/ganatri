/**
 * Integration tests for the DOWNLOAD_MY_DATA socket endpoint (Phase 6i).
 *
 * Follows the same harness as delete-account.test.ts / blocked-users.test.ts:
 * MemoryPersistence injected via __setPersistenceForTests, logged-in
 * connections simulated via the ganatri_session cookie.
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
import type { DownloadMyDataAck, SessionPayload } from './protocol.js';

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

async function seedLoggedInUser(
  p: MemoryPersistence,
  providerUserId: string,
  token: string,
  displayName: string,
): Promise<{ id: string }> {
  const user = await p.upsertOAuthUser({
    provider: 'google',
    providerUserId,
    email: `${providerUserId}@test.test`,
    displayName,
  });
  await p.createAuthSession({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60_000),
  });
  return user;
}

describe('DOWNLOAD_MY_DATA', () => {
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
      const ack = await emitAck<DownloadMyDataAck>(client, EVENTS.DOWNLOAD_MY_DATA);
      expect(ack).toEqual({ ok: false, error: 'NOT_LOGGED_IN' });
    } finally {
      client.disconnect();
    }
  });

  it('returns UNAVAILABLE when persistence is not configured', async () => {
    const token = 'dmd-token-unavail';
    await seedLoggedInUser(persistence, 'dmd-unavail', token, 'DMDUnavail');

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
      const ack = await emitAck<DownloadMyDataAck>(client, EVENTS.DOWNLOAD_MY_DATA);
      expect(ack).toEqual({ ok: false, error: 'UNAVAILABLE' });
    } finally {
      client.disconnect();
    }
  });

  it('happy path with seeded game: stats non-null and game entry is flat with ISO dates', async () => {
    const token = 'dmd-token-seeded';
    const user = await seedLoggedInUser(persistence, 'dmd-seeded', token, 'SeededUser');

    // Seed a finished game + stats row
    const room = await persistence.recordRoomCreated({ roomCode: 'DMDROM', hostUserId: user.id, status: 'PLAYING' });
    const game = await persistence.recordGameStarted({ roomId: room.id, seed: 7, seatingOrder: [user.id] });
    await persistence.recordGameFinished({
      gameId: game.id,
      endedAt: new Date(),
      durationMs: 5_000,
      winnerId: user.id,
      isAbandoned: false,
      players: [{ userId: user.id, seatIndex: 0, displayName: 'SeededUser', finalRank: 1, wasCut: false, captureCount: 2, result: 'WIN' }],
    });
    // upsertPlayerStats is called by the server's persistence.ts helper after game end;
    // seed it explicitly here since we bypass the server handler.
    await persistence.upsertPlayerStats({ userId: user.id, gamesPlayed: 1, gamesWon: 1, sumFinishPositions: 1, totalCaptures: 2 });

    const client = ioClient(`http://localhost:${port}`, {
      autoConnect: true,
      reconnection: false,
      transports: ['polling'],
      extraHeaders: { Cookie: `ganatri_session=${token}` },
    });
    try {
      const session = await waitFor<SessionPayload>(client, EVENTS.SESSION);
      expect(session.loggedIn).toBe(true);

      const ack = await emitAck<DownloadMyDataAck>(client, EVENTS.DOWNLOAD_MY_DATA);
      expect(ack.ok).toBe(true);
      if (!ack.ok) throw new Error('Expected ok');

      const { data } = ack;
      expect(data.games).toHaveLength(1);
      // Flat shape: no nested `.game` sub-object
      expect((data.games[0] as Record<string, unknown>).game).toBeUndefined();
      // Dates serialised as ISO strings, not Date objects
      expect(typeof data.games[0]!.startedAt).toBe('string');
      expect(data.stats).not.toBeNull();
      expect(data.stats!.gamesPlayed).toBe(1);
      expect(data.stats!.gamesWon).toBe(1);
    } finally {
      client.disconnect();
    }
  });

  it('happy path: returns account data for a logged-in user with MemoryPersistence', async () => {
    const token = 'dmd-token-happy';
    const user = await seedLoggedInUser(persistence, 'dmd-happy', token, 'DataUser');

    const client = ioClient(`http://localhost:${port}`, {
      autoConnect: true,
      reconnection: false,
      transports: ['polling'],
      extraHeaders: { Cookie: `ganatri_session=${token}` },
    });
    try {
      const session = await waitFor<SessionPayload>(client, EVENTS.SESSION);
      expect(session.loggedIn).toBe(true);

      const ack = await emitAck<DownloadMyDataAck>(client, EVENTS.DOWNLOAD_MY_DATA);
      expect(ack.ok).toBe(true);
      if (!ack.ok) throw new Error('Expected ok');

      const { data } = ack;
      expect(data.userId).toBe(user.id);
      expect(data.displayName).toBe('DataUser');
      expect(data.email).toBe('dmd-happy@test.test');
      // exportedAt should be a valid ISO timestamp
      expect(() => new Date(data.exportedAt)).not.toThrow();
      expect(new Date(data.exportedAt).getTime()).toBeGreaterThan(0);
      // No games played yet so games should be an empty array
      expect(Array.isArray(data.games)).toBe(true);
      expect(data.games).toHaveLength(0);
      // No stats row yet so stats should be null (not zeroStatsView)
      expect(data.stats).toBeNull();
    } finally {
      client.disconnect();
    }
  });
});
