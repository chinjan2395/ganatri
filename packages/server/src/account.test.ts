/**
 * Integration tests for the UPDATE_DISPLAY_NAME socket endpoint.
 *
 * Uses the same harness pattern as stats.test.ts: MemoryPersistence injected
 * via __setPersistenceForTests, logged-in connections simulated by seeding an
 * auth session and sending the matching `ganatri_session` cookie.
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
import type { UpdateDisplayNameAck, SessionPayload } from './protocol.js';

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

/** Seed an OAuth user + a valid auth session, returning the user. */
async function seedLoggedInUser(
  p: MemoryPersistence,
  providerUserId: string,
  token: string,
  displayName: string,
): Promise<{ id: string }> {
  const user = await p.upsertOAuthUser({
    provider: 'google',
    providerUserId,
    email: null,
    displayName,
  });
  await p.createAuthSession({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60_000),
  });
  return user;
}

describe('UPDATE_DISPLAY_NAME', () => {
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

  it('guest gets NOT_LOGGED_IN', async () => {
    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      const session = await waitFor<SessionPayload>(client, EVENTS.SESSION);
      expect(session.loggedIn).toBe(false);
      const ack = await emitAck<UpdateDisplayNameAck>(client, EVENTS.UPDATE_DISPLAY_NAME, { newDisplayName: 'NewName' });
      expect(ack).toEqual({ ok: false, error: 'NOT_LOGGED_IN' });
    } finally {
      client.disconnect();
    }
  });

  it('returns UNAVAILABLE when persistence drops out after connect', async () => {
    const token = 'token-unavailable';
    await seedLoggedInUser(persistence, 'google-sub-unavailable', token, 'Vanishing');

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
      const ack = await emitAck<UpdateDisplayNameAck>(client, EVENTS.UPDATE_DISPLAY_NAME, { newDisplayName: 'NewName' });
      expect(ack).toEqual({ ok: false, error: 'UNAVAILABLE' });
    } finally {
      client.disconnect();
    }
  });

  it('empty name after sanitize gets INVALID_NAME', async () => {
    const token = 'token-invalid-name';
    await seedLoggedInUser(persistence, 'google-sub-invalid', token, 'OriginalName');

    const client = ioClient(`http://localhost:${port}`, {
      autoConnect: true,
      reconnection: false,
      transports: ['polling'],
      extraHeaders: { Cookie: `ganatri_session=${token}` },
    });
    try {
      const session = await waitFor<SessionPayload>(client, EVENTS.SESSION);
      expect(session.loggedIn).toBe(true);

      // Empty string sanitizes to '' -> INVALID_NAME
      const ack = await emitAck<UpdateDisplayNameAck>(client, EVENTS.UPDATE_DISPLAY_NAME, { newDisplayName: '   ' });
      expect(ack).toEqual({ ok: false, error: 'INVALID_NAME' });
    } finally {
      client.disconnect();
    }
  });

  it('happy path: updates name, re-emits SESSION, and acks ok', async () => {
    const token = 'token-happy-update';
    const user = await seedLoggedInUser(persistence, 'google-sub-happy', token, 'OldDisplayName');

    const client = ioClient(`http://localhost:${port}`, {
      autoConnect: true,
      reconnection: false,
      transports: ['polling'],
      extraHeaders: { Cookie: `ganatri_session=${token}` },
    });
    try {
      const firstSession = await waitFor<SessionPayload>(client, EVENTS.SESSION);
      expect(firstSession.loggedIn).toBe(true);
      expect(firstSession.displayName).toBe('OldDisplayName');

      // Set up listener for the SESSION re-emit BEFORE calling the event.
      const nextSessionPromise = waitFor<SessionPayload>(client, EVENTS.SESSION);

      const ack = await emitAck<UpdateDisplayNameAck>(client, EVENTS.UPDATE_DISPLAY_NAME, { newDisplayName: 'BrandNewName' });

      expect(ack).toEqual({ ok: true, displayName: 'BrandNewName' });

      // The server should re-emit SESSION with the updated name.
      const updatedSession = await nextSessionPromise;
      expect(updatedSession.loggedIn).toBe(true);
      expect(updatedSession.displayName).toBe('BrandNewName');

      // The in-memory persistence should also reflect the change.
      // We verify via getLeaderboard (which reads displayName from users).
      await persistence.upsertPlayerStats({ userId: user.id, gamesPlayed: 1, gamesWon: 1, gamesLost: 0 });
      const board = await persistence.getLeaderboard();
      const entry = board.find((e) => e.userId === user.id);
      expect(entry).toBeDefined();
      expect(entry!.displayName).toBe('BrandNewName');
    } finally {
      client.disconnect();
    }
  });
});
