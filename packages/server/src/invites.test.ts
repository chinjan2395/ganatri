/**
 * Integration tests for the invitation system socket events:
 * INVITE_PLAYER, RESPOND_TO_INVITE, BLOCK_USER, UNBLOCK_USER.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { MemoryPersistence } from '@ganatri/db';
import { createApp, type AppInstance } from './createApp.js';
import { resetStore } from './store.js';
import { resetLastMoveTime, __resetPendingInvitesForTests } from './handlers.js';
import { EVENTS } from './protocol.js';
import { __setPersistenceForTests } from './persistence.js';
import { hashToken } from './auth/session.js';
import type {
  BlockUserAck,
  InvitePlayerAck,
  RespondToInviteAck,
  SessionPayload,
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

let persistence: MemoryPersistence;
let app: AppInstance;
let port: number;

async function seedLoggedInUser(
  providerUserId: string,
  token: string,
  displayName: string,
): Promise<{ id: string }> {
  const user = await persistence.upsertOAuthUser({
    provider: 'google',
    providerUserId,
    email: `${providerUserId}@test.test`,
    displayName,
  });
  await persistence.createAuthSession({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60_000),
  });
  return user;
}

function connect(token?: string): ClientSocket {
  return ioClient(`http://localhost:${port}`, {
    autoConnect: true,
    reconnection: false,
    transports: ['polling'],
    ...(token ? { extraHeaders: { Cookie: `ganatri_session=${token}` } } : {}),
  });
}

describe('Invitation system', () => {
  beforeEach(async () => {
    resetStore();
    resetLastMoveTime();
    __resetPendingInvitesForTests();
    persistence = new MemoryPersistence();
    __setPersistenceForTests(persistence);
    app = createApp();
    port = await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
    __setPersistenceForTests(null);
  });

  // ---------------------------------------------------------------------------
  // INVITE_PLAYER
  // ---------------------------------------------------------------------------

  it('INVITE_PLAYER: returns NOT_LOGGED_IN for a guest', async () => {
    const client = connect();
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      const ack = await emitAck<InvitePlayerAck>(client, EVENTS.INVITE_PLAYER, { targetUserId: 'any' });
      expect(ack).toEqual({ ok: false, error: 'NOT_LOGGED_IN' });
    } finally {
      client.disconnect();
    }
  });

  it('INVITE_PLAYER: returns UNAVAILABLE when persistence drops out', async () => {
    await seedLoggedInUser('inv-a', 'tok-a', 'UserA');
    const client = connect('tok-a');
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      __setPersistenceForTests(null);
      const ack = await emitAck<InvitePlayerAck>(client, EVENTS.INVITE_PLAYER, { targetUserId: 'any-user' });
      expect(ack).toEqual({ ok: false, error: 'UNAVAILABLE' });
    } finally {
      client.disconnect();
    }
  });

  it('INVITE_PLAYER: returns SELF_INVITE when targeting own userId', async () => {
    const userA = await seedLoggedInUser('inv-b', 'tok-b', 'UserB');
    const client = connect('tok-b');
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      const ack = await emitAck<InvitePlayerAck>(client, EVENTS.INVITE_PLAYER, { targetUserId: userA.id });
      expect(ack).toEqual({ ok: false, error: 'SELF_INVITE' });
    } finally {
      client.disconnect();
    }
  });

  it('INVITE_PLAYER: returns OFFLINE when invitee has no live socket', async () => {
    await seedLoggedInUser('inv-c', 'tok-c', 'UserC');
    const userD = await seedLoggedInUser('inv-d', 'tok-d', 'UserD');
    const client = connect('tok-c');
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      // userD is seeded but never connects — no live socket
      const ack = await emitAck<InvitePlayerAck>(client, EVENTS.INVITE_PLAYER, { targetUserId: userD.id });
      expect(ack).toEqual({ ok: false, error: 'OFFLINE' });
    } finally {
      client.disconnect();
    }
  });

  it('INVITE_PLAYER: happy path — invitee receives INVITE_RECEIVED push and ack carries roomCode', async () => {
    await seedLoggedInUser('inv-e', 'tok-e', 'Inviter');
    const userF = await seedLoggedInUser('inv-f', 'tok-f', 'Invitee');
    const inviter = connect('tok-e');
    const invitee = connect('tok-f');
    try {
      await Promise.all([
        waitFor<SessionPayload>(inviter, EVENTS.SESSION),
        waitFor<SessionPayload>(invitee, EVENTS.SESSION),
      ]);

      const receivePromise = waitFor<{ inviterUserId: string; roomCode: string }>(invitee, EVENTS.INVITE_RECEIVED);
      const ack = await emitAck<InvitePlayerAck>(inviter, EVENTS.INVITE_PLAYER, { targetUserId: userF.id });

      expect(ack.ok).toBe(true);
      if (!ack.ok) throw new Error('expected ok');
      expect(typeof ack.roomCode).toBe('string');

      const push = await receivePromise;
      expect(push.roomCode).toBe(ack.roomCode);
    } finally {
      inviter.disconnect();
      invitee.disconnect();
    }
  });

  // ---------------------------------------------------------------------------
  // RESPOND_TO_INVITE — accept
  // ---------------------------------------------------------------------------

  it('RESPOND_TO_INVITE: accept joins invitee to room and pushes INVITE_ACCEPTED to inviter', async () => {
    const userG = await seedLoggedInUser('inv-g', 'tok-g', 'Inviter2');
    const userH = await seedLoggedInUser('inv-h', 'tok-h', 'Invitee2');
    const inviter = connect('tok-g');
    const invitee = connect('tok-h');
    try {
      await Promise.all([
        waitFor<SessionPayload>(inviter, EVENTS.SESSION),
        waitFor<SessionPayload>(invitee, EVENTS.SESSION),
      ]);

      const inviteAck = await emitAck<InvitePlayerAck>(inviter, EVENTS.INVITE_PLAYER, { targetUserId: userH.id });
      expect(inviteAck.ok).toBe(true);
      if (!inviteAck.ok) throw new Error('expected ok');
      const { roomCode } = inviteAck;

      const acceptedPromise = waitFor<{ inviteeUserId: string; roomCode: string }>(inviter, EVENTS.INVITE_ACCEPTED);
      const respondAck = await emitAck<RespondToInviteAck>(invitee, EVENTS.RESPOND_TO_INVITE, {
        inviterUserId: userG.id,
        accept: true,
      });

      expect(respondAck.ok).toBe(true);
      if (!respondAck.ok) throw new Error('expected ok');
      expect(respondAck.roomCode).toBe(roomCode);

      const accepted = await acceptedPromise;
      expect(accepted.inviteeUserId).toBe(userH.id);
      expect(accepted.roomCode).toBe(roomCode);
    } finally {
      inviter.disconnect();
      invitee.disconnect();
    }
  });

  // ---------------------------------------------------------------------------
  // RESPOND_TO_INVITE — reject
  // ---------------------------------------------------------------------------

  it('RESPOND_TO_INVITE: reject pushes INVITE_REJECTED to inviter', async () => {
    const userI = await seedLoggedInUser('inv-i', 'tok-i', 'Inviter3');
    const userJ = await seedLoggedInUser('inv-j', 'tok-j', 'Invitee3');
    const inviter = connect('tok-i');
    const invitee = connect('tok-j');
    try {
      await Promise.all([
        waitFor<SessionPayload>(inviter, EVENTS.SESSION),
        waitFor<SessionPayload>(invitee, EVENTS.SESSION),
      ]);

      await emitAck<InvitePlayerAck>(inviter, EVENTS.INVITE_PLAYER, { targetUserId: userJ.id });

      const rejectedPromise = waitFor<{ inviteeUserId: string }>(inviter, EVENTS.INVITE_REJECTED);
      const respondAck = await emitAck<RespondToInviteAck>(invitee, EVENTS.RESPOND_TO_INVITE, {
        inviterUserId: userI.id,
        accept: false,
      });

      expect(respondAck).toEqual({ ok: true });
      const rejected = await rejectedPromise;
      expect(rejected.inviteeUserId).toBe(userJ.id);
    } finally {
      inviter.disconnect();
      invitee.disconnect();
    }
  });

  // ---------------------------------------------------------------------------
  // RESPOND_TO_INVITE — invite not found
  // ---------------------------------------------------------------------------

  it('RESPOND_TO_INVITE: returns NOT_FOUND when no pending invite exists', async () => {
    const userK = await seedLoggedInUser('inv-k', 'tok-k', 'UserK');
    await seedLoggedInUser('inv-l', 'tok-l', 'UserL');
    const client = connect('tok-k');
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      const ack = await emitAck<RespondToInviteAck>(client, EVENTS.RESPOND_TO_INVITE, {
        inviterUserId: userK.id, // no pending invite from self
        accept: true,
      });
      expect(ack).toEqual({ ok: false, error: 'NOT_FOUND' });
    } finally {
      client.disconnect();
    }
  });

  // ---------------------------------------------------------------------------
  // BLOCK_USER
  // ---------------------------------------------------------------------------

  it('BLOCK_USER: returns NOT_LOGGED_IN for a guest', async () => {
    const client = connect();
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      const ack = await emitAck<BlockUserAck>(client, EVENTS.BLOCK_USER, { targetUserId: 'any' });
      expect(ack).toEqual({ ok: false, error: 'NOT_LOGGED_IN' });
    } finally {
      client.disconnect();
    }
  });

  it('BLOCK_USER: logged-in user can block another user', async () => {
    const userM = await seedLoggedInUser('inv-m', 'tok-m', 'UserM');
    const userN = await seedLoggedInUser('inv-n', 'tok-n', 'UserN');
    const client = connect('tok-m');
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      const ack = await emitAck<BlockUserAck>(client, EVENTS.BLOCK_USER, { targetUserId: userN.id });
      expect(ack).toEqual({ ok: true });
      // Block is persisted: subsequent isBlocked check confirms it
      expect(await persistence.isBlocked(userM.id, userN.id)).toBe(true);
    } finally {
      client.disconnect();
    }
  });
});
