import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { MemoryPersistence } from '@ganatri/db';
import { createApp, type AppInstance } from './createApp.js';
import { resetStore } from './store.js';
import { resetLastMoveTime } from './handlers.js';
import { __setPersistenceForTests } from './persistence.js';
import { hashToken } from './auth/session.js';
import {
  EVENTS,
  type GetAuthSessionsAck,
  type RevokeAuthSessionAck,
  type RevokeOtherAuthSessionsAck,
  type SessionPayload,
} from './protocol.js';

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

function connectWithCookie(port: number, token: string, auth: Record<string, unknown> = {}): ClientSocket {
  return ioClient(`http://localhost:${port}`, {
    autoConnect: true,
    reconnection: false,
    transports: ['polling'],
    auth,
    extraHeaders: { Cookie: `ganatri_session=${token}` },
  });
}

describe('durable auth sessions', () => {
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
    __setPersistenceForTests(null);
    await app.close();
  });

  it('does not authenticate a logged-in account from client-sent guestToken alone', async () => {
    const user = await persistence.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'google-sub-no-fallback',
      email: 'fallback@example.com',
      displayName: 'Fallback User',
    });
    const authToken = 'auth-token-no-cookie';
    await persistence.createAuthSession({
      userId: user.id,
      tokenHash: hashToken(authToken),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const client = ioClient(`http://localhost:${port}`, {
      autoConnect: true,
      reconnection: false,
      auth: { guestToken: authToken },
    });

    try {
      const session = await waitFor<SessionPayload>(client, EVENTS.SESSION);
      expect(session.loggedIn).toBe(false);
      expect(typeof session.guestToken).toBe('string');
    } finally {
      client.disconnect();
    }
  });

  it('authenticates via authSessionToken handshake fallback when cookie is absent', async () => {
    const user = await persistence.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'google-sub-handshake',
      email: 'handshake@example.com',
      displayName: 'Handshake User',
    });
    const authToken = 'handshake-auth-token';
    await persistence.createAuthSession({
      userId: user.id,
      tokenHash: hashToken(authToken),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const client = ioClient(`http://localhost:${port}`, {
      autoConnect: true,
      reconnection: false,
      auth: { authSessionToken: authToken },
    });

    try {
      const session = await waitFor<SessionPayload>(client, EVENTS.SESSION);
      expect(session.loggedIn).toBe(true);
      expect(session.displayName).toBe('Handshake User');
    } finally {
      client.disconnect();
    }
  });

  it('lists active sessions and rolls expiry on authenticated connect', async () => {
    const user = await persistence.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'google-sub-list',
      email: 'list@example.com',
      displayName: 'List User',
    });
    const currentToken = 'current-auth-token';
    const currentSession = await persistence.createAuthSession({
      userId: user.id,
      tokenHash: hashToken(currentToken),
      expiresAt: new Date(Date.now() + 1_000),
      userAgent: 'Current Device',
    });
    const otherSession = await persistence.createAuthSession({
      userId: user.id,
      tokenHash: hashToken('other-auth-token'),
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: 'Other Device',
    });

    const client = connectWithCookie(port, currentToken);

    try {
      const session = await waitFor<SessionPayload>(client, EVENTS.SESSION);
      expect(session.loggedIn).toBe(true);

      const ack = await emitAck<GetAuthSessionsAck>(client, EVENTS.GET_AUTH_SESSIONS);
      expect(ack.ok).toBe(true);
      if (!ack.ok) return;

      expect(ack.sessions).toHaveLength(2);
      expect(ack.sessions.find((entry) => entry.id === currentSession.id)?.current).toBe(true);
      expect(ack.sessions.find((entry) => entry.id === otherSession.id)?.current).toBe(false);

      const refreshedCurrent = (await persistence.listAuthSessions(user.id)).find(
        (entry) => entry.id === currentSession.id,
      );
      expect(refreshedCurrent).toBeDefined();
      expect(refreshedCurrent!.expiresAt.getTime()).toBeGreaterThan(currentSession.expiresAt.getTime());
      expect(refreshedCurrent!.lastSeenAt.getTime()).toBeGreaterThanOrEqual(currentSession.lastSeenAt.getTime());
    } finally {
      client.disconnect();
    }
  });

  it('revokes other sessions and can revoke the current session', async () => {
    const user = await persistence.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'google-sub-revoke',
      email: 'revoke@example.com',
      displayName: 'Revoke User',
    });
    const currentToken = 'current-revoke-token';
    const currentSession = await persistence.createAuthSession({
      userId: user.id,
      tokenHash: hashToken(currentToken),
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: 'Current Device',
    });
    const otherSession = await persistence.createAuthSession({
      userId: user.id,
      tokenHash: hashToken('other-revoke-token'),
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: 'Other Device',
    });

    const client = connectWithCookie(port, currentToken);

    try {
      const session = await waitFor<SessionPayload>(client, EVENTS.SESSION);
      expect(session.loggedIn).toBe(true);

      const revokeOthers = await emitAck<RevokeOtherAuthSessionsAck>(client, EVENTS.REVOKE_OTHER_AUTH_SESSIONS);
      expect(revokeOthers).toEqual({ ok: true, revokedCount: 1 });
      expect((await persistence.listAuthSessions(user.id)).map((entry) => entry.id)).toEqual([currentSession.id]);

      const nextSessionPromise = waitFor<SessionPayload>(client, EVENTS.SESSION);
      const revokeCurrent = await emitAck<RevokeAuthSessionAck>(
        client,
        EVENTS.REVOKE_AUTH_SESSION,
        { sessionId: currentSession.id },
      );

      expect(revokeCurrent).toEqual({ ok: true, revokedCurrent: true });
      const downgradedSession = await nextSessionPromise;
      expect(downgradedSession.loggedIn).toBe(false);
      expect(typeof downgradedSession.guestToken).toBe('string');

      expect(await persistence.getAuthSessionByTokenHash(hashToken(currentToken))).toBeNull();
      expect((await persistence.listAuthSessions(user.id)).find((entry) => entry.id === otherSession.id)).toBeUndefined();
    } finally {
      client.disconnect();
    }
  });
});
