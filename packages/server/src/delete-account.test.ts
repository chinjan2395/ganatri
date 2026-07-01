/**
 * Integration tests for the DELETE_ACCOUNT socket endpoint (Phase 6i).
 *
 * Follows the same harness as account.test.ts / blocked-users.test.ts:
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
import type { DeleteAccountAck, SessionPayload } from './protocol.js';

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

describe('DELETE_ACCOUNT', () => {
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
      const ack = await emitAck<DeleteAccountAck>(client, EVENTS.DELETE_ACCOUNT);
      expect(ack).toEqual({ ok: false, error: 'NOT_LOGGED_IN' });
    } finally {
      client.disconnect();
    }
  });

  it('returns UNAVAILABLE when persistence is not configured', async () => {
    const token = 'da-token-unavail';
    await seedLoggedInUser(persistence, 'da-unavail', token, 'DAUnavail');

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
      const ack = await emitAck<DeleteAccountAck>(client, EVENTS.DELETE_ACCOUNT);
      expect(ack).toEqual({ ok: false, error: 'UNAVAILABLE' });
    } finally {
      client.disconnect();
    }
  });

  it('happy path: deletes account and re-emits SESSION as guest', async () => {
    const token = 'da-token-happy';
    const user = await seedLoggedInUser(persistence, 'da-happy', token, 'ToDelete');

    const client = ioClient(`http://localhost:${port}`, {
      autoConnect: true,
      reconnection: false,
      transports: ['polling'],
      extraHeaders: { Cookie: `ganatri_session=${token}` },
    });
    try {
      const firstSession = await waitFor<SessionPayload>(client, EVENTS.SESSION);
      expect(firstSession.loggedIn).toBe(true);
      expect(firstSession.displayName).toBe('ToDelete');

      // Listen for the SESSION re-emit before sending the event.
      const nextSessionPromise = waitFor<SessionPayload>(client, EVENTS.SESSION);

      const ack = await emitAck<DeleteAccountAck>(client, EVENTS.DELETE_ACCOUNT);
      expect(ack).toEqual({ ok: true });

      // The server should re-emit SESSION with loggedIn: false.
      const guestSession = await nextSessionPromise;
      expect(guestSession.loggedIn).toBe(false);

      // The user should no longer exist in persistence.
      const adminStats = await persistence.adminGetUserStats(user.id);
      expect(adminStats).toBeNull();
    } finally {
      client.disconnect();
    }
  });
});
