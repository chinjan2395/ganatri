/**
 * Integration tests for the ADMIN_AUTH socket endpoint.
 *
 * Verifies both the legacy email-only mode (no ADMIN_SECRET set) and the
 * hardened mode (ADMIN_SECRET set — must supply both email and secret).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { createApp, type AppInstance } from './createApp.js';
import { resetStore } from './store.js';
import { resetLastMoveTime } from './handlers.js';
import { EVENTS } from './protocol.js';
import { __setAdminSecretForTests, __setAdminEmailsForTests } from './config.js';

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
    __setAdminSecretForTests(undefined);
    __setAdminEmailsForTests([]);
  });

  it('no ADMIN_SECRET set: email in list -> ok (backward compat)', async () => {
    __setAdminSecretForTests(undefined);
    __setAdminEmailsForTests(['admin@test.com']);

    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      const ack = await emitAck<{ ok: boolean; reason?: string }>(
        client,
        EVENTS.ADMIN_AUTH,
        { email: 'admin@test.com' },
      );
      expect(ack).toEqual({ ok: true });
    } finally {
      client.disconnect();
    }
  });

  it('no ADMIN_SECRET set: email not in list -> not_authorized', async () => {
    __setAdminSecretForTests(undefined);
    __setAdminEmailsForTests(['admin@test.com']);

    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      const ack = await emitAck<{ ok: boolean; reason?: string }>(
        client,
        EVENTS.ADMIN_AUTH,
        { email: 'evil@bad.com' },
      );
      expect(ack).toEqual({ ok: false, reason: 'not_authorized' });
    } finally {
      client.disconnect();
    }
  });

  it('ADMIN_SECRET set: correct email + correct secret -> ok', async () => {
    __setAdminSecretForTests('s3cr3t');
    __setAdminEmailsForTests(['admin@test.com']);

    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      const ack = await emitAck<{ ok: boolean; reason?: string }>(
        client,
        EVENTS.ADMIN_AUTH,
        { email: 'admin@test.com', secret: 's3cr3t' },
      );
      expect(ack).toEqual({ ok: true });
    } finally {
      client.disconnect();
    }
  });

  it('ADMIN_SECRET set: correct email + wrong secret -> not_authorized', async () => {
    __setAdminSecretForTests('s3cr3t');
    __setAdminEmailsForTests(['admin@test.com']);

    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      const ack = await emitAck<{ ok: boolean; reason?: string }>(
        client,
        EVENTS.ADMIN_AUTH,
        { email: 'admin@test.com', secret: 'wrongsecret' },
      );
      expect(ack).toEqual({ ok: false, reason: 'not_authorized' });
    } finally {
      client.disconnect();
    }
  });

  it('ADMIN_SECRET set: correct email + missing secret -> not_authorized', async () => {
    __setAdminSecretForTests('s3cr3t');
    __setAdminEmailsForTests(['admin@test.com']);

    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      const ack = await emitAck<{ ok: boolean; reason?: string }>(
        client,
        EVENTS.ADMIN_AUTH,
        { email: 'admin@test.com' },
      );
      expect(ack).toEqual({ ok: false, reason: 'not_authorized' });
    } finally {
      client.disconnect();
    }
  });
});
