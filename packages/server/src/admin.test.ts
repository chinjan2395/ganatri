/**
 * Integration tests for the ADMIN_AUTH socket endpoint (Phase 7e).
 *
 * Tests the strengthened admin authentication logic:
 *  - Email-only auth (no ADMIN_SECRET set) — backwards compat
 *  - Email + correct secret when ADMIN_SECRET is set → ok
 *  - Email + wrong secret when ADMIN_SECRET is set → not_authorized
 *  - Email + missing secret when ADMIN_SECRET is set → not_authorized
 *  - Wrong email → not_authorized (existing behaviour)
 *
 * The ADMIN_EMAILS env var is pre-seeded to 'admin@test.com' via vitest.config.ts
 * so that _adminEmails (module-load-time cache in config.ts) is populated.
 *
 * ADMIN_SECRET is read by adminSecret() at call time (not cached), so tests can
 * safely set/unset process.env['ADMIN_SECRET'] within individual test cases.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { createApp, type AppInstance } from './createApp.js';
import { resetStore } from './store.js';
import { resetLastMoveTime } from './handlers.js';
import { EVENTS } from './protocol.js';
import type { AdminAuthAck, SessionPayload } from './protocol.js';

/** The admin email seeded via vitest.config.ts env.ADMIN_EMAILS. */
const ADMIN_EMAIL = 'admin@test.com';
const TEST_SECRET = 'super-secret-admin-key';

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

describe('ADMIN_AUTH', () => {
  let app: AppInstance;
  let port: number;

  beforeEach(async () => {
    resetStore();
    resetLastMoveTime();
    app = createApp();
    port = await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
    // Always restore ADMIN_SECRET to unset after each test.
    delete process.env['ADMIN_SECRET'];
  });

  it('correct email with no ADMIN_SECRET set → ok: true (backwards compat)', async () => {
    // ADMIN_SECRET is not set (deleted in afterEach, clean slate).
    delete process.env['ADMIN_SECRET'];

    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      const ack = await emitAck<AdminAuthAck>(client, EVENTS.ADMIN_AUTH, { email: ADMIN_EMAIL });
      expect(ack).toEqual({ ok: true });
    } finally {
      client.disconnect();
    }
  });

  it('correct email AND correct secret when ADMIN_SECRET is set → ok: true', async () => {
    process.env['ADMIN_SECRET'] = TEST_SECRET;

    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      const ack = await emitAck<AdminAuthAck>(client, EVENTS.ADMIN_AUTH, {
        email: ADMIN_EMAIL,
        secret: TEST_SECRET,
      });
      expect(ack).toEqual({ ok: true });
    } finally {
      client.disconnect();
    }
  });

  it('correct email but WRONG secret when ADMIN_SECRET is set → ok: false, not_authorized', async () => {
    process.env['ADMIN_SECRET'] = TEST_SECRET;

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

  it('correct email but MISSING secret when ADMIN_SECRET is set → ok: false, not_authorized', async () => {
    process.env['ADMIN_SECRET'] = TEST_SECRET;

    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      // Send no secret field at all.
      const ack = await emitAck<AdminAuthAck>(client, EVENTS.ADMIN_AUTH, { email: ADMIN_EMAIL });
      expect(ack).toEqual({ ok: false, reason: 'not_authorized' });
    } finally {
      client.disconnect();
    }
  });

  it('wrong email → ok: false, not_authorized (regardless of secret)', async () => {
    // No ADMIN_SECRET set — email check alone is what should fail.
    delete process.env['ADMIN_SECRET'];

    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      await waitFor<SessionPayload>(client, EVENTS.SESSION);
      const ack = await emitAck<AdminAuthAck>(client, EVENTS.ADMIN_AUTH, {
        email: 'not-an-admin@example.com',
      });
      expect(ack).toEqual({ ok: false, reason: 'not_authorized' });
    } finally {
      client.disconnect();
    }
  });
});
