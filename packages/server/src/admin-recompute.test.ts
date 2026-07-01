/**
 * Integration tests for the admin_recompute_stats socket endpoint.
 *
 * Uses MemoryPersistence injected via __setPersistenceForTests.
 * Three scenarios:
 *   1. Non-admin gets NOT_AUTHORIZED.
 *   2. No persistence configured → UNAVAILABLE.
 *   3. Happy path: admin calls recompute for a specific userId → ok + recomputedCount.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { MemoryPersistence } from '@ganatri/db';
import { createApp, type AppInstance } from './createApp.js';
import { resetStore } from './store.js';
import { resetLastMoveTime } from './handlers.js';
import { EVENTS, type AdminRecomputeStatsAck } from './protocol.js';
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function authedAdminClient(port: number): Promise<ClientSocket> {
  process.env['ADMIN_EMAILS'] = 'admin@test.com';
  const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
  await emitAck<{ ok: boolean }>(client, EVENTS.ADMIN_AUTH, { email: 'admin@test.com' });
  return client;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('admin_recompute_stats', () => {
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
    delete process.env['ADMIN_EMAILS'];
    delete process.env['ADMIN_SECRET'];
  });

  it('returns NOT_AUTHORIZED for non-admin client', async () => {
    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      const ack = await emitAck<AdminRecomputeStatsAck>(
        client,
        EVENTS.ADMIN_RECOMPUTE_STATS,
        {},
      );
      expect(ack.ok).toBe(false);
      if (!ack.ok) {
        expect(ack.error).toBe('NOT_AUTHORIZED');
      }
    } finally {
      client.disconnect();
    }
  });

  it('returns UNAVAILABLE when persistence is not configured', async () => {
    // Remove persistence so the handler hits the UNAVAILABLE branch.
    __setPersistenceForTests(null);
    const client = await authedAdminClient(port);
    try {
      const ack = await emitAck<AdminRecomputeStatsAck>(
        client,
        EVENTS.ADMIN_RECOMPUTE_STATS,
        {},
      );
      expect(ack.ok).toBe(false);
      if (!ack.ok) {
        expect(ack.error).toBe('UNAVAILABLE');
      }
    } finally {
      client.disconnect();
    }
  });

  it('happy path: admin recomputes stats for a specific userId', async () => {
    // Pre-populate the persistence with a user and some game history via
    // MemoryPersistence's in-memory store, then call recompute.
    const persistence = new MemoryPersistence();
    __setPersistenceForTests(persistence);

    // Create a user, room, game, and player row.
    const user = await persistence.ensureGuest('test-user-id-001', 'TestPlayer');
    const room = await persistence.recordRoomCreated({
      roomCode: 'ADMRC1',
      hostUserId: user.id,
    });
    const game = await persistence.recordGameStarted({
      roomId: room.id,
      seed: 'seed-123',
      seatingOrder: [user.id],
    });
    await persistence.recordGameFinished({
      gameId: game.id,
      endedAt: new Date(),
      durationMs: 5000,
      winnerId: user.id,
      isAbandoned: false,
      players: [{
        userId: user.id,
        seatIndex: 0,
        displayName: 'TestPlayer',
        finalRank: 1,
        wasCut: false,
        captureCount: 6,
        result: 'WIN',
      }],
    });

    const client = await authedAdminClient(port);
    try {
      const ack = await emitAck<AdminRecomputeStatsAck>(
        client,
        EVENTS.ADMIN_RECOMPUTE_STATS,
        { userId: user.id },
      );
      expect(ack.ok).toBe(true);
      if (ack.ok) {
        expect(ack.recomputedCount).toBe(1);
      }
    } finally {
      client.disconnect();
    }
  });
});
