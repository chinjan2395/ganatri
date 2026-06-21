/**
 * Integration tests for the ADMIN_AUTH socket endpoint.
 *
 * admin auth requires BOTH a valid email (from ADMIN_EMAILS env var) AND a
 * matching shared secret (from ADMIN_SECRET env var). Tests set these env vars
 * before each test and restore them after.
 *
 * isAdminEmail reads ADMIN_EMAILS at module load time, so we call
 * __resetAdminEmailsForTests() after mutating process.env to pick up changes.
 * isAdminSecret reads process.env at call time, so no reset is needed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { createApp, type AppInstance } from './createApp.js';
import { resetStore } from './store.js';
import { resetLastMoveTime } from './handlers.js';
import { EVENTS } from './protocol.js';
import { __resetAdminEmailsForTests } from './config.js';
import type { AdminAuthAck, SessionPayload } from './protocol.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Constants used across tests
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = 'admin@ganatri-test.example';
const ADMIN_SECRET = 'super-secret-test-value';

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ADMIN_AUTH', () => {
  let app: AppInstance;
  let port: number;
  let savedEmails: string | undefined;
  let savedSecret: string | undefined;

  beforeEach(async () => {
    // Save original env values so we can restore them after each test.
    savedEmails = process.env['ADMIN_EMAILS'];
    savedSecret = process.env['ADMIN_SECRET'];

    // Inject test values.
    process.env['ADMIN_EMAILS'] = ADMIN_EMAIL;
    process.env['ADMIN_SECRET'] = ADMIN_SECRET;
    // Rebuild the cached Set so isAdminEmail picks up the new value.
    __resetAdminEmailsForTests();

    resetStore();
    resetLastMoveTime();
    app = createApp();
    port = await app.listen(0);
  });

  afterEach(async () => {
    await app.close();

    // Restore env and rebuild the cached Set.
    if (savedEmails === undefined) {
      delete process.env['ADMIN_EMAILS'];
    } else {
      process.env['ADMIN_EMAILS'] = savedEmails;
    }
    if (savedSecret === undefined) {
      delete process.env['ADMIN_SECRET'];
    } else {
      process.env['ADMIN_SECRET'] = savedSecret;
    }
    __resetAdminEmailsForTests();
  });

  it('returns invalid_payload when secret field is missing', async () => {
    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      // Send payload without secret field
      const ack = await emitAck<AdminAuthAck>(client, EVENTS.ADMIN_AUTH, { email: ADMIN_EMAIL });
      expect(ack).toEqual({ ok: false, reason: 'invalid_payload' });
    } finally {
      client.disconnect();
    }
  });

  it('returns invalid_payload when email field is missing', async () => {
    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      const ack = await emitAck<AdminAuthAck>(client, EVENTS.ADMIN_AUTH, { secret: ADMIN_SECRET });
      expect(ack).toEqual({ ok: false, reason: 'invalid_payload' });
    } finally {
      client.disconnect();
    }
  });

  it('returns not_authorized when ADMIN_SECRET is not set', async () => {
    // Temporarily clear the secret so isAdminSecret returns false.
    delete process.env['ADMIN_SECRET'];

    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      const ack = await emitAck<AdminAuthAck>(client, EVENTS.ADMIN_AUTH, {
        email: ADMIN_EMAIL,
        secret: ADMIN_SECRET,
      });
      expect(ack).toEqual({ ok: false, reason: 'not_authorized' });
    } finally {
      client.disconnect();
    }
  });

  it('returns not_authorized when email is correct but secret is wrong', async () => {
    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      const ack = await emitAck<AdminAuthAck>(client, EVENTS.ADMIN_AUTH, {
        email: ADMIN_EMAIL,
        secret: 'wrong-secret',
      });
      expect(ack).toEqual({ ok: false, reason: 'not_authorized' });
    } finally {
      client.disconnect();
    }
  });

  it('returns not_authorized when secret is correct but email is wrong', async () => {
    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      const ack = await emitAck<AdminAuthAck>(client, EVENTS.ADMIN_AUTH, {
        email: 'not-an-admin@example.com',
        secret: ADMIN_SECRET,
      });
      expect(ack).toEqual({ ok: false, reason: 'not_authorized' });
    } finally {
      client.disconnect();
    }
  });

  it('returns ok: true when both email and secret are correct', async () => {
    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      const ack = await emitAck<AdminAuthAck>(client, EVENTS.ADMIN_AUTH, {
        email: ADMIN_EMAIL,
        secret: ADMIN_SECRET,
      });
      expect(ack).toEqual({ ok: true });
    } finally {
      client.disconnect();
    }
  });
});
