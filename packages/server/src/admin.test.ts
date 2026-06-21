/**
 * Integration tests for the strengthened admin_auth socket endpoint.
 *
 * Uses the same harness pattern as account.test.ts: MemoryPersistence injected
 * via __setPersistenceForTests, real createApp + socket.io-client.
 *
 * Key property under test: when ADMIN_SECRET is set, the payload must supply a
 * matching secret field in addition to a valid admin email — the email alone is
 * no longer sufficient.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { MemoryPersistence } from '@ganatri/db';
import { createApp, type AppInstance } from './createApp.js';
import { resetStore } from './store.js';
import { resetLastMoveTime } from './handlers.js';
import { EVENTS } from './protocol.js';
import { __setPersistenceForTests } from './persistence.js';

function emitAck<T>(socket: ClientSocket, event: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Ack timeout for "${event}"`)), 3000);
    socket.emit(event, ...args, (result: T) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

describe('admin_auth strengthened', () => {
  let app: AppInstance;
  let port: number;

  beforeEach(async () => {
    resetStore();
    resetLastMoveTime();
    const persistence = new MemoryPersistence();
    __setPersistenceForTests(persistence);
    app = createApp();
    port = await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
    __setPersistenceForTests(null);
    // Clean up ADMIN_SECRET so each test starts fresh
    delete process.env['ADMIN_SECRET'];
    delete process.env['ADMIN_EMAILS'];
  });

  it('accepts valid email when no ADMIN_SECRET set', async () => {
    process.env['ADMIN_EMAILS'] = 'admin@test.com';
    delete process.env['ADMIN_SECRET'];

    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      const ack = await emitAck<{ ok: boolean; reason?: string }>(
        client,
        EVENTS.ADMIN_AUTH,
        { email: 'admin@test.com', secret: '' },
      );
      expect(ack).toEqual({ ok: true });
    } finally {
      client.disconnect();
    }
  });

  it('rejects unknown email when no ADMIN_SECRET set', async () => {
    process.env['ADMIN_EMAILS'] = 'admin@test.com';
    delete process.env['ADMIN_SECRET'];

    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      const ack = await emitAck<{ ok: boolean; reason?: string }>(
        client,
        EVENTS.ADMIN_AUTH,
        { email: 'stranger@test.com' },
      );
      expect(ack).toEqual({ ok: false, reason: 'not_authorized' });
    } finally {
      client.disconnect();
    }
  });

  it('accepts valid email + correct secret when ADMIN_SECRET set', async () => {
    process.env['ADMIN_EMAILS'] = 'admin@test.com';
    process.env['ADMIN_SECRET'] = 'supersecret';

    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      const ack = await emitAck<{ ok: boolean; reason?: string }>(
        client,
        EVENTS.ADMIN_AUTH,
        { email: 'admin@test.com', secret: 'supersecret' },
      );
      expect(ack).toEqual({ ok: true });
    } finally {
      client.disconnect();
    }
  });

  it('rejects valid email with wrong/missing secret when ADMIN_SECRET set', async () => {
    process.env['ADMIN_EMAILS'] = 'admin@test.com';
    process.env['ADMIN_SECRET'] = 'supersecret';

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
});
