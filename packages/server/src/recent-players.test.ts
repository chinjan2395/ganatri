/**
 * Integration tests for the GET_RECENT_PLAYERS socket endpoint.
 *
 * Follows the same harness as stats.test.ts: MemoryPersistence injected via
 * __setPersistenceForTests, logged-in connections simulated via cookie.
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
import type { GetRecentPlayersAck, SessionPayload } from './protocol.js';

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
  const { user } = await p.upsertOAuthUser({
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

describe('GET_RECENT_PLAYERS', () => {
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
      const ack = await emitAck<GetRecentPlayersAck>(client, EVENTS.GET_RECENT_PLAYERS);
      expect(ack).toEqual({ ok: false, error: 'NOT_LOGGED_IN' });
    } finally {
      client.disconnect();
    }
  });

  it('returns UNAVAILABLE for a logged-in session when persistence drops out', async () => {
    const token = 'rp-token-unavail';
    await seedLoggedInUser(persistence, 'rp-unavail', token, 'RPUnavail');

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
      const ack = await emitAck<GetRecentPlayersAck>(client, EVENTS.GET_RECENT_PLAYERS);
      expect(ack).toEqual({ ok: false, error: 'UNAVAILABLE' });
    } finally {
      client.disconnect();
    }
  });

  it('returns co-players with isOnline=true when they have a live socket', async () => {
    const userA = await seedLoggedInUser(persistence, 'rp-a', 'rp-token-a', 'PlayerA');
    const userB = await seedLoggedInUser(persistence, 'rp-b', 'rp-token-b', 'PlayerB');

    const room = await persistence.recordRoomCreated({ roomCode: 'RPTEST', hostUserId: userA.id });
    const game = await persistence.recordGameStarted({
      roomId: room.id,
      seed: 'rp-seed',
      seatingOrder: [userA.id, userB.id],
    });
    await persistence.recordGameFinished({
      gameId: game.id,
      winnerId: userA.id,
      players: [
        { userId: userA.id, seatIndex: 0, displayName: 'PlayerA', finalRank: 1, wasCut: false, captureCount: 0, result: 'WIN' },
        { userId: userB.id, seatIndex: 1, displayName: 'PlayerB', finalRank: 2, wasCut: false, captureCount: 0, result: 'LOSS' },
      ],
    });

    const clientA = ioClient(`http://localhost:${port}`, {
      autoConnect: true,
      reconnection: false,
      transports: ['polling'],
      extraHeaders: { Cookie: `ganatri_session=rp-token-a` },
    });
    const clientB = ioClient(`http://localhost:${port}`, {
      autoConnect: true,
      reconnection: false,
      transports: ['polling'],
      extraHeaders: { Cookie: `ganatri_session=rp-token-b` },
    });
    try {
      await Promise.all([
        waitFor<SessionPayload>(clientA, EVENTS.SESSION),
        waitFor<SessionPayload>(clientB, EVENTS.SESSION),
      ]);

      const ack = await emitAck<GetRecentPlayersAck>(clientA, EVENTS.GET_RECENT_PLAYERS);
      expect(ack.ok).toBe(true);
      if (!ack.ok) throw new Error('Expected ok');
      expect(ack.players).toHaveLength(1);
      expect(ack.players[0]!.userId).toBe(userB.id);
      expect(ack.players[0]!.gamesPlayedTogether).toBe(1);
      expect(ack.players[0]!.isOnline).toBe(true);
    } finally {
      clientA.disconnect();
      clientB.disconnect();
    }
  });

  it('returns co-players with isOnline=false when they have no live socket', async () => {
    const userA = await seedLoggedInUser(persistence, 'rp-c', 'rp-token-c', 'PlayerC');
    const userB = await seedLoggedInUser(persistence, 'rp-d', 'rp-token-d', 'PlayerD');

    const room = await persistence.recordRoomCreated({ roomCode: 'RPTST2', hostUserId: userA.id });
    const game = await persistence.recordGameStarted({
      roomId: room.id,
      seed: 'rp-seed2',
      seatingOrder: [userA.id, userB.id],
    });
    await persistence.recordGameFinished({
      gameId: game.id,
      winnerId: userA.id,
      players: [
        { userId: userA.id, seatIndex: 0, displayName: 'PlayerC', finalRank: 1, wasCut: false, captureCount: 0, result: 'WIN' },
        { userId: userB.id, seatIndex: 1, displayName: 'PlayerD', finalRank: 2, wasCut: false, captureCount: 0, result: 'LOSS' },
      ],
    });

    // Only clientA connects — userB has no live socket
    const clientA = ioClient(`http://localhost:${port}`, {
      autoConnect: true,
      reconnection: false,
      transports: ['polling'],
      extraHeaders: { Cookie: `ganatri_session=rp-token-c` },
    });
    try {
      await waitFor<SessionPayload>(clientA, EVENTS.SESSION);

      const ack = await emitAck<GetRecentPlayersAck>(clientA, EVENTS.GET_RECENT_PLAYERS);
      expect(ack.ok).toBe(true);
      if (!ack.ok) throw new Error('Expected ok');
      expect(ack.players).toHaveLength(1);
      expect(ack.players[0]!.userId).toBe(userB.id);
      expect(ack.players[0]!.isOnline).toBe(false);
    } finally {
      clientA.disconnect();
    }
  });
});
