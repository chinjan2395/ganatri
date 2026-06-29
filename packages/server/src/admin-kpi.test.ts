/**
 * Integration tests for the admin_get_kpi_stats socket endpoint.
 *
 * Uses the same harness as admin.test.ts: MemoryPersistence injected via
 * __setPersistenceForTests, real createApp + socket.io-client.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { MemoryPersistence } from '@ganatri/db';
import { createApp, type AppInstance } from './createApp.js';
import { resetStore } from './store.js';
import { resetLastMoveTime } from './handlers.js';
import { EVENTS, type AdminGetKpiStatsAck } from './protocol.js';
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

describe('admin_get_kpi_stats', () => {
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

  async function authedClient(): Promise<ClientSocket> {
    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    await emitAck<{ ok: boolean }>(client, EVENTS.ADMIN_AUTH, { email: 'admin@test.com' });
    return client;
  }

  it('returns NOT_AUTHORIZED for an unauthenticated socket', async () => {
    const client = ioClient(`http://localhost:${port}`, { autoConnect: true, reconnection: false });
    try {
      const ack = await emitAck<AdminGetKpiStatsAck>(client, EVENTS.ADMIN_GET_KPI_STATS, {});
      expect(ack).toEqual({ ok: false, reason: 'NOT_AUTHORIZED' });
    } finally {
      client.disconnect();
    }
  });

  it('returns UNAVAILABLE when persistence is not configured', async () => {
    const client = await authedClient();
    try {
      __setPersistenceForTests(null);
      const ack = await emitAck<AdminGetKpiStatsAck>(client, EVENTS.ADMIN_GET_KPI_STATS, {});
      expect(ack).toEqual({ ok: false, reason: 'UNAVAILABLE' });
    } finally {
      client.disconnect();
    }
  });

  it('happy path: returns ok=true with correct KPI shape when persistence is configured', async () => {
    const client = await authedClient();
    try {
      const ack = await emitAck<AdminGetKpiStatsAck>(client, EVENTS.ADMIN_GET_KPI_STATS, {});
      expect(ack.ok).toBe(true);
      if (!ack.ok) throw new Error('Expected ok');
      expect(ack.stats.windowDays).toBe(7);
      expect(typeof ack.stats.totalGames).toBe('number');
      expect(typeof ack.stats.completedGames).toBe('number');
      expect(typeof ack.stats.abandonedGames).toBe('number');
      expect(typeof ack.stats.abandonmentRate).toBe('number');
      // avgDurationMs is number or null
      expect(ack.stats.avgDurationMs === null || typeof ack.stats.avgDurationMs === 'number').toBe(true);
      expect(Array.isArray(ack.stats.dailyBreakdown)).toBe(true);
      // When no games are in the window, totals are zero.
      expect(ack.stats.totalGames).toBe(0);
      expect(ack.stats.abandonmentRate).toBe(0);
      expect(ack.stats.avgDurationMs).toBeNull();
      // Scoring KPI fields — null/empty when no scored games.
      expect(ack.stats.avgXpGrantedPerDay).toBeNull();
      expect(Array.isArray(ack.stats.avgMatchScoreByPlayerCount)).toBe(true);
      expect(ack.stats.avgMatchScoreByPlayerCount).toHaveLength(0);
      expect(ack.stats.abandonRatingImpact).toMatchObject({
        avgRatingDeltaCompleted: null,
        avgRatingDeltaAbandoned: null,
      });
    } finally {
      client.disconnect();
    }
  });
});
