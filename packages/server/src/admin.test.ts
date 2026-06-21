/**
 * Integration tests for admin_auth strengthened authentication (Phase 7e).
 *
 * Verifies that the admin_auth event requires both a valid email in
 * ADMIN_EMAILS and a matching ADMIN_SECRET.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { createApp, type AppInstance } from './createApp.js';
import { resetStore } from './store.js';
import { EVENTS } from './protocol.js';
import { __setAdminEmailsForTests } from './config.js';
import type { AdminAuthAck, AdminGetConfigAck } from './protocol.js';

function emitAck<T>(socket: ClientSocket, event: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Ack timeout for "${event}"`)), 3000);
    socket.emit(event, ...args, (result: T) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

function connectClient(port: number): ClientSocket {
  return ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
}

describe('admin_auth — strengthened secret check', () => {
  let app: AppInstance;
  let port: number;

  beforeEach(async () => {
    resetStore();
    __setAdminEmailsForTests(['admin@test.com']);
    process.env['ADMIN_SECRET'] = 'test-secret-123';
    app = createApp();
    port = await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
    delete process.env['ADMIN_SECRET'];
    __setAdminEmailsForTests([]);
  });

  it('missing_secret — valid email but empty secret → not_authorized', async () => {
    const client = connectClient(port);
    try {
      const ack = await emitAck<AdminAuthAck>(
        client,
        EVENTS.ADMIN_AUTH,
        { email: 'admin@test.com', secret: '' },
      );
      expect(ack).toEqual({ ok: false, reason: 'not_authorized' });
    } finally {
      client.disconnect();
    }
  });

  it('wrong_secret — valid email but wrong secret → not_authorized', async () => {
    const client = connectClient(port);
    try {
      const ack = await emitAck<AdminAuthAck>(
        client,
        EVENTS.ADMIN_AUTH,
        { email: 'admin@test.com', secret: 'wrong-secret' },
      );
      expect(ack).toEqual({ ok: false, reason: 'not_authorized' });
    } finally {
      client.disconnect();
    }
  });

  it('wrong_email — correct secret but email not in ADMIN_EMAILS → not_authorized', async () => {
    const client = connectClient(port);
    try {
      const ack = await emitAck<AdminAuthAck>(
        client,
        EVENTS.ADMIN_AUTH,
        { email: 'notadmin@test.com', secret: 'test-secret-123' },
      );
      expect(ack).toEqual({ ok: false, reason: 'not_authorized' });
    } finally {
      client.disconnect();
    }
  });

  it('happy_path — correct email + correct secret → ok; admin_get_config returns config', async () => {
    const client = connectClient(port);
    try {
      const authAck = await emitAck<AdminAuthAck>(
        client,
        EVENTS.ADMIN_AUTH,
        { email: 'admin@test.com', secret: 'test-secret-123' },
      );
      expect(authAck).toEqual({ ok: true });

      const configAck = await emitAck<AdminGetConfigAck>(
        client,
        EVENTS.ADMIN_GET_CONFIG,
        {},
      );
      expect(configAck).toBeDefined();
      expect(typeof configAck.config).toBe('object');
      expect(configAck.config).not.toBeNull();
    } finally {
      client.disconnect();
    }
  });
});

describe('admin_auth — backward compat (no ADMIN_SECRET)', () => {
  let app: AppInstance;
  let port: number;

  beforeEach(async () => {
    resetStore();
    __setAdminEmailsForTests(['admin@test.com']);
    delete process.env['ADMIN_SECRET'];
    app = createApp();
    port = await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
    __setAdminEmailsForTests([]);
  });

  it('backward_compat — correct email with ADMIN_SECRET unset grants access', async () => {
    const client = connectClient(port);
    try {
      const ack = await emitAck<AdminAuthAck>(
        client,
        EVENTS.ADMIN_AUTH,
        { email: 'admin@test.com', secret: '' },
      );
      expect(ack).toEqual({ ok: true });
    } finally {
      client.disconnect();
    }
  });
});
