/**
 * Integration tests for the GET_BLOCKED_USERS socket endpoint.
 *
 * Follows the same harness as recent-players.test.ts: MemoryPersistence
 * injected via __setPersistenceForTests, logged-in connections simulated
 * via cookie.
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
import type { GetBlockedUsersAck, SessionPayload } from './protocol.js';

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

describe('GET_BLOCKED_USERS', () => {
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
      const ack = await emitAck<GetBlockedUsersAck>(client, EVENTS.GET_BLOCKED_USERS);
      expect(ack).toEqual({ ok: false, error: 'NOT_LOGGED_IN' });
    } finally {
      client.disconnect();
    }
  });

  it('returns UNAVAILABLE when persistence is not configured', async () => {
    const token = 'bu-token-unavail';
    await seedLoggedInUser(persistence, 'bu-unavail', token, 'BUUnavail');

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
      const ack = await emitAck<GetBlockedUsersAck>(client, EVENTS.GET_BLOCKED_USERS);
      expect(ack).toEqual({ ok: false, error: 'UNAVAILABLE' });
    } finally {
      client.disconnect();
    }
  });

  it('returns blocked users list for a logged-in user', async () => {
    const userA = await seedLoggedInUser(persistence, 'bu-a', 'bu-token-a', 'BlockerUser');
    const userB = await seedLoggedInUser(persistence, 'bu-b', 'bu-token-b', 'BlockedUser');

    // Block userB from userA's perspective
    await persistence.blockUser(userA.id, userB.id);

    const clientA = ioClient(`http://localhost:${port}`, {
      autoConnect: true,
      reconnection: false,
      transports: ['polling'],
      extraHeaders: { Cookie: `ganatri_session=bu-token-a` },
    });
    try {
      const session = await waitFor<SessionPayload>(clientA, EVENTS.SESSION);
      expect(session.loggedIn).toBe(true);

      const ack = await emitAck<GetBlockedUsersAck>(clientA, EVENTS.GET_BLOCKED_USERS);
      expect(ack.ok).toBe(true);
      if (!ack.ok) throw new Error('Expected ok');
      expect(ack.users).toHaveLength(1);
      expect(ack.users[0]!.userId).toBe(userB.id);
      expect(ack.users[0]!.displayName).toBe('BlockedUser');
      expect(ack.users[0]!.avatarUrl).toBeNull();
    } finally {
      clientA.disconnect();
    }
  });
});
