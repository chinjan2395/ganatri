/**
 * Integration tests for the REQUEST_HISTORY socket endpoint and the durable
 * (OAuth) identity binding.
 *
 * A MemoryPersistence is injected via the __setPersistenceForTests hook. A
 * logged-in connection is simulated by seeding an auth session and sending the
 * matching `ganatri_session` cookie in the handshake headers — exercising the
 * real socket auth middleware end-to-end.
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
import type { RequestHistoryAck, SessionPayload } from './protocol.js';

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

/** Seed a finished game owned by the given user, returning its DB game id. */
async function seedFinishedGame(p: MemoryPersistence, userId: string, displayName: string): Promise<string> {
  await p.ensureGuest(userId, displayName);
  const room = await p.recordRoomCreated({ roomCode: 'TESTRM', hostUserId: userId, status: 'PLAYING' });
  const game = await p.recordGameStarted({ roomId: room.id, seed: 42, seatingOrder: [userId] });
  await p.recordGameFinished({
    gameId: game.id,
    endedAt: new Date(),
    durationMs: 12_345,
    winnerId: userId,
    isAbandoned: false,
    players: [
      {
        userId,
        seatIndex: 0,
        displayName,
        finalRank: 1,
        wasCut: false,
        captureCount: 3,
        result: 'WIN',
      },
    ],
  });
  return game.id;
}

describe('REQUEST_HISTORY + durable identity', () => {
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
      const ack = await emitAck<RequestHistoryAck>(client, EVENTS.REQUEST_HISTORY);
      expect(ack).toEqual({ ok: false, error: 'NOT_LOGGED_IN' });
    } finally {
      client.disconnect();
    }
  });

  it('returns UNAVAILABLE for a logged-in session when persistence drops out', async () => {
    // Connect while persistence is available so the socket binds a durable
    // userId, then remove persistence before requesting history. The handler
    // reads getPersistence() at call time → UNAVAILABLE.
    const { user } = await persistence.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'google-sub-gone',
      email: null,
      displayName: 'Vanishing User',
    });
    const token = 'token-for-vanish';
    await persistence.createAuthSession({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60_000),
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

      __setPersistenceForTests(null);
      const ack = await emitAck<RequestHistoryAck>(client, EVENTS.REQUEST_HISTORY);
      expect(ack).toEqual({ ok: false, error: 'UNAVAILABLE' });
    } finally {
      client.disconnect();
    }
  });

  it('binds a durable account from the session cookie and returns its history', async () => {
    // Seed an OAuth user + auth session and a finished game.
    const { user } = await persistence.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'google-sub-123',
      email: 'player@example.com',
      displayName: 'Test Player',
      avatarUrl: 'https://example.com/a.png',
    });
    const token = 'opaque-session-token-abc';
    await persistence.createAuthSession({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await seedFinishedGame(persistence, user.id, 'Test Player');

    const client = ioClient(`http://localhost:${port}`, {
      autoConnect: true,
      reconnection: false,
      transports: ['polling'],
      extraHeaders: { Cookie: `ganatri_session=${token}` },
    });
    try {
      const session = await waitFor<SessionPayload>(client, EVENTS.SESSION);
      expect(session.loggedIn).toBe(true);
      expect(session.playerId).toBe(user.id);
      expect(session.displayName).toBe('Test Player');
      expect(session.email).toBe('player@example.com');

      const ack = await emitAck<RequestHistoryAck>(client, EVENTS.REQUEST_HISTORY);
      expect(ack.ok).toBe(true);
      if (ack.ok) {
        expect(ack.games).toHaveLength(1);
        expect(ack.games[0]!.you.captureCount).toBe(3);
        expect(ack.games[0]!.winnerId).toBe(user.id);
      }
    } finally {
      client.disconnect();
    }
  });

  it('acks a FLAT history entry matching the web wire contract', async () => {
    // Cross-package contract guard: the web client expects a flattened entry
    // (top-level id/startedAt/endedAt/durationMs/playerCount/isAbandoned/
    // winnerId, with ISO-string timestamps) — NOT the DB's nested `{ game }`.
    const { user } = await persistence.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'google-sub-flat',
      email: 'flat@example.com',
      displayName: 'Flat Player',
    });
    const token = 'opaque-session-token-flat';
    await persistence.createAuthSession({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await seedFinishedGame(persistence, user.id, 'Flat Player');

    const client = ioClient(`http://localhost:${port}`, {
      autoConnect: true,
      reconnection: false,
      transports: ['polling'],
      extraHeaders: { Cookie: `ganatri_session=${token}` },
    });
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      const ack = await emitAck<RequestHistoryAck>(client, EVENTS.REQUEST_HISTORY);
      expect(ack.ok).toBe(true);
      if (ack.ok) {
        const g = ack.games[0]!;
        // FLAT: these live at the top level, not under `.game`.
        expect((g as unknown as { game?: unknown }).game).toBeUndefined();
        expect(g.id).toBeDefined();
        expect(typeof g.id).toBe('string');
        // Timestamps are ISO strings, not Dates.
        expect(typeof g.startedAt).toBe('string');
        expect(new Date(g.startedAt).toISOString()).toBe(g.startedAt);
        expect(typeof g.endedAt).toBe('string');
        expect(g.durationMs).toBe(12_345);
        expect(g.playerCount).toBe(1);
        expect(g.isAbandoned).toBe(false);
        expect(g.winnerId).toBe(user.id);
        // `you` and `players` are present and well-formed.
        expect(g.you).toBeDefined();
        expect(g.you.captureCount).toBe(3);
        expect(g.players).toHaveLength(1);
        expect(g.players[0]!.displayNameSnapshot).toBe('Flat Player');
      }
    } finally {
      client.disconnect();
    }
  });
});
