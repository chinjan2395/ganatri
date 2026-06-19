import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestDb,
  seedEvent,
  seedGame,
  seedGamePlayer,
  seedRoom,
  seedUser,
  type TestDb,
} from './helpers/pglite';

describe('retention pruning (pg)', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.close();
  });

  it('pruneGameEventsBefore deletes only old events and returns the count', async () => {
    const host = await seedUser(t);
    const roomId = await seedRoom(t, host);
    const gameId = await seedGame(t, roomId);

    await seedEvent(t, gameId, 0, new Date('2026-01-01T00:00:00Z'));
    await seedEvent(t, gameId, 1, new Date('2026-01-02T00:00:00Z'));
    await seedEvent(t, gameId, 2, new Date('2026-06-01T00:00:00Z'));
    await seedEvent(t, gameId, 3, new Date('2026-06-02T00:00:00Z'));

    const deleted = await t.repo.pruneGameEventsBefore(new Date('2026-03-01T00:00:00Z'));
    expect(deleted).toBe(2);

    const remaining = await t.repo.loadGameEvents(gameId);
    expect(remaining.map((e) => e.seq)).toEqual([2, 3]);
  });

  it('pruneAbandonedGamesBefore deletes only old abandoned games + cascades, leaving others intact', async () => {
    const host = await seedUser(t, 'Host', { isGuest: false });
    const roomId = await seedRoom(t, host);
    await t.repo.upsertPlayerStats({ userId: host, gamesPlayed: 1 });

    // Old abandoned -> should be deleted (with players + events).
    const oldAbandoned = await seedGame(t, roomId, {
      endedAt: new Date('2026-01-01T00:00:00Z'),
      isAbandoned: true,
    });
    await seedGamePlayer(t, oldAbandoned, { userId: host, seatIndex: 0 });
    await seedEvent(t, oldAbandoned, 0, new Date('2026-01-01T00:00:00Z'));

    // Recent abandoned -> kept (after cutoff).
    const recentAbandoned = await seedGame(t, roomId, {
      endedAt: new Date('2026-06-01T00:00:00Z'),
      isAbandoned: true,
    });
    await seedGamePlayer(t, recentAbandoned, { userId: host, seatIndex: 0 });

    // Old but completed -> kept (not abandoned).
    const oldCompleted = await seedGame(t, roomId, {
      endedAt: new Date('2026-01-01T00:00:00Z'),
      isAbandoned: false,
      winnerId: host,
    });
    await seedGamePlayer(t, oldCompleted, { userId: host, seatIndex: 0, result: 'WIN' });

    const deleted = await t.repo.pruneAbandonedGamesBefore(
      new Date('2026-03-01T00:00:00Z')
    );
    expect(deleted).toBe(1);

    // Old abandoned game and its cascade are gone.
    expect(await t.repo.loadGameWithPlayers(oldAbandoned)).toBeNull();
    expect(await t.repo.loadGameEvents(oldAbandoned)).toEqual([]);

    // The other two games survive.
    expect(await t.repo.loadGameWithPlayers(recentAbandoned)).not.toBeNull();
    expect(await t.repo.loadGameWithPlayers(oldCompleted)).not.toBeNull();

    // player_stats untouched.
    const stats = await t.repo.getPlayerStats(host);
    expect(stats!.gamesPlayed).toBe(1);
  });

  it('pruneAbandonedGamesBefore returns 0 when nothing matches', async () => {
    expect(
      await t.repo.pruneAbandonedGamesBefore(new Date('2000-01-01T00:00:00Z'))
    ).toBe(0);
  });
});
