/**
 * Integration tests for admin authentication (ADMIN_AUTH event).
 *
 * Uses vi.resetModules() + dynamic imports so that process.env changes take
 * effect on the module-level Set in config.ts (which is built at import time).
 *
 * Tests:
 *   1. ADMIN_SECRET set: correct email + correct secret → ok: true
 *   2. ADMIN_SECRET set: correct email + wrong secret → not_authorized
 *   3. ADMIN_SECRET set: wrong email + correct secret → not_authorized
 *   4. No ADMIN_SECRET: correct email alone → ok: true (backward compat)
 *   5. admin_get_config succeeds after authenticated with correct email+secret
 */

import { describe, it, expect } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { AdminAuthAck, AdminGetConfigAck } from './protocol.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function waitConnected(socket: ClientSocket): Promise<void> {
  return new Promise((resolve) => {
    if (socket.connected) { resolve(); return; }
    socket.once('connect', resolve);
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

/**
 * Boot a fresh server with the given ADMIN_EMAILS / ADMIN_SECRET env vars,
 * run `fn`, then tear down. Uses vi.resetModules() so each call gets a fresh
 * module graph (ensuring the module-level _adminEmails Set is rebuilt).
 */
async function withFreshServer(
  envOverrides: Record<string, string | undefined>,
  fn: (port: number, events: Record<string, string>) => Promise<void>,
): Promise<void> {
  const { vi } = await import('vitest');

  // Apply env overrides.
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(envOverrides)) {
    saved[k] = process.env[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }

  vi.resetModules();

  let app: { listen: (port: number) => Promise<number>; close: () => Promise<void> };
  try {
    const { createApp } = await import('./createApp.js');
    const { resetStore } = await import('./store.js');
    const { resetLastMoveTime } = await import('./handlers.js');
    const { EVENTS } = await import('./protocol.js');

    resetStore();
    resetLastMoveTime();
    app = createApp();
    const port = await app.listen(0);

    await fn(port, EVENTS as Record<string, string>);
  } finally {
    // Restore env.
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
    await app!.close();
    vi.resetModules();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admin authentication', () => {
  it('1. ADMIN_SECRET set: correct email + correct secret → ok: true', async () => {
    await withFreshServer(
      { ADMIN_EMAILS: 'admin@example.com', ADMIN_SECRET: 'supersecret' },
      async (port, EVENTS) => {
        const client = ioClient(`http://localhost:${port}`, { auth: {}, autoConnect: true, reconnection: false });
        await waitConnected(client);
        try {
          const res = await emitAck<AdminAuthAck>(client, EVENTS['ADMIN_AUTH']!, { email: 'admin@example.com', secret: 'supersecret' });
          expect(res.ok).toBe(true);
          expect(res.reason).toBeUndefined();
        } finally {
          client.disconnect();
        }
      },
    );
  });

  it('2. ADMIN_SECRET set: correct email + wrong secret → not_authorized', async () => {
    await withFreshServer(
      { ADMIN_EMAILS: 'admin@example.com', ADMIN_SECRET: 'supersecret' },
      async (port, EVENTS) => {
        const client = ioClient(`http://localhost:${port}`, { auth: {}, autoConnect: true, reconnection: false });
        await waitConnected(client);
        try {
          const res = await emitAck<AdminAuthAck>(client, EVENTS['ADMIN_AUTH']!, { email: 'admin@example.com', secret: 'wrongsecret' });
          expect(res.ok).toBe(false);
          expect(res.reason).toBe('not_authorized');
        } finally {
          client.disconnect();
        }
      },
    );
  });

  it('3. ADMIN_SECRET set: wrong email + correct secret → not_authorized', async () => {
    await withFreshServer(
      { ADMIN_EMAILS: 'admin@example.com', ADMIN_SECRET: 'supersecret' },
      async (port, EVENTS) => {
        const client = ioClient(`http://localhost:${port}`, { auth: {}, autoConnect: true, reconnection: false });
        await waitConnected(client);
        try {
          const res = await emitAck<AdminAuthAck>(client, EVENTS['ADMIN_AUTH']!, { email: 'notadmin@example.com', secret: 'supersecret' });
          expect(res.ok).toBe(false);
          expect(res.reason).toBe('not_authorized');
        } finally {
          client.disconnect();
        }
      },
    );
  });

  it('4. No ADMIN_SECRET: correct email alone → ok: true (backward compat)', async () => {
    await withFreshServer(
      { ADMIN_EMAILS: 'admin@example.com', ADMIN_SECRET: undefined },
      async (port, EVENTS) => {
        const client = ioClient(`http://localhost:${port}`, { auth: {}, autoConnect: true, reconnection: false });
        await waitConnected(client);
        try {
          const res = await emitAck<AdminAuthAck>(client, EVENTS['ADMIN_AUTH']!, { email: 'admin@example.com' });
          expect(res.ok).toBe(true);
          expect(res.reason).toBeUndefined();
        } finally {
          client.disconnect();
        }
      },
    );
  });

  it('5. admin_get_config succeeds after authenticated with correct email+secret', async () => {
    await withFreshServer(
      { ADMIN_EMAILS: 'admin@example.com', ADMIN_SECRET: 'supersecret' },
      async (port, EVENTS) => {
        const client = ioClient(`http://localhost:${port}`, { auth: {}, autoConnect: true, reconnection: false });
        await waitConnected(client);
        try {
          const authRes = await emitAck<AdminAuthAck>(client, EVENTS['ADMIN_AUTH']!, { email: 'admin@example.com', secret: 'supersecret' });
          expect(authRes.ok).toBe(true);

          const configRes = await emitAck<AdminGetConfigAck>(client, EVENTS['ADMIN_GET_CONFIG']!, {});
          expect(configRes).toHaveProperty('config');
          expect(typeof configRes.config).toBe('object');
        } finally {
          client.disconnect();
        }
      },
    );
  });
});
