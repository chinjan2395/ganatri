/**
 * Integration tests for the admin_export_data socket endpoint.
 *
 * Uses the same harness as admin-kpi.test.ts and admin-users.test.ts:
 * MemoryPersistence injected via __setPersistenceForTests, real createApp +
 * socket.io-client.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { MemoryPersistence } from '@ganatri/db';
import { createApp, type AppInstance } from './createApp.js';
import { resetStore } from './store.js';
import { resetLastMoveTime } from './handlers.js';
import { EVENTS, type AdminExportDataAck } from './protocol.js';
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

describe('admin_export_data', () => {
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
    process.env['ADMIN_EMAILS'] = 'admin@test.com';
  });

  afterEach(async () => {
    await app.close();
    __setPersistenceForTests(null);
    delete process.env['ADMIN_EMAILS'];
    delete process.env['ADMIN_SECRET'];
  });

  /** Connect and authenticate as admin. */
  async function authedClient(): Promise<ClientSocket> {
    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    await emitAck<{ ok: boolean }>(client, EVENTS.ADMIN_AUTH, { email: 'admin@test.com' });
    return client;
  }

  it('returns NOT_AUTHORIZED when not admin', async () => {
    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      const ack = await emitAck<AdminExportDataAck>(client, EVENTS.ADMIN_EXPORT_DATA, {});
      expect(ack).toEqual({ ok: false, error: 'NOT_AUTHORIZED' });
    } finally {
      client.disconnect();
    }
  });

  it('returns UNAVAILABLE when no persistence', async () => {
    const client = await authedClient();
    try {
      __setPersistenceForTests(null);
      const ack = await emitAck<AdminExportDataAck>(client, EVENTS.ADMIN_EXPORT_DATA, {});
      expect(ack).toEqual({ ok: false, error: 'UNAVAILABLE' });
    } finally {
      client.disconnect();
    }
  });

  it('returns games array (empty when no games recorded)', async () => {
    const client = await authedClient();
    try {
      const ack = await emitAck<AdminExportDataAck>(client, EVENTS.ADMIN_EXPORT_DATA, {});
      expect(ack.ok).toBe(true);
      if (!ack.ok) throw new Error('Expected ok');
      expect(Array.isArray(ack.games)).toBe(true);
      expect(ack.games).toHaveLength(0);
    } finally {
      client.disconnect();
    }
  });
});
