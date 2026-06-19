import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestDb,
  seedGame,
  seedGamePlayer,
  seedRoom,
  seedUser,
  type TestDb,
} from './helpers/pglite';

describe('getUserGameHistory (pg)', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.close();
  });

  it('returns a user games newest-first with you vs players, and honours limit/offset', async () => {
    const me = await seedUser(t, 'Me', { email: 'me@x.com', isGuest: false });
    const them = await seedUser(t, 'Them', { email: 'them@x.com', isGuest: false });
    const roomId = await seedRoom(t, me);

    // Three games, oldest -> newest by startedAt.
    const g1 = await seedGame(t, roomId, {
      startedAt: new Date('2026-01-01T00:00:00Z'),
      endedAt: new Date('2026-01-01T00:10:00Z'),
      winnerId: me,
    });
    const g2 = await seedGame(t, roomId, {
      startedAt: new Date('2026-01-02T00:00:00Z'),
      endedAt: new Date('2026-01-02T00:10:00Z'),
      winnerId: them,
    });
    const g3 = await seedGame(t, roomId, {
      startedAt: new Date('2026-01-03T00:00:00Z'),
      endedAt: new Date('2026-01-03T00:10:00Z'),
      winnerId: me,
    });

    for (const [g, myRank, myResult, theirRank, theirResult] of [
      [g1, 1, 'WIN', 2, 'LOSS'],
      [g2, 2, 'LOSS', 1, 'WIN'],
      [g3, 1, 'WIN', 2, 'LOSS'],
    ] as const) {
      await seedGamePlayer(t, g, {
        userId: me,
        seatIndex: 0,
        displayName: 'Me',
        finalRank: myRank,
        result: myResult,
        captureCount: 5,
      });
      await seedGamePlayer(t, g, {
        userId: them,
        seatIndex: 1,
        displayName: 'Them',
        finalRank: theirRank,
        result: theirResult,
        wasCut: true,
      });
    }

    const history = await t.repo.getUserGameHistory(me);
    expect(history.map((h) => h.game.id)).toEqual([g3, g2, g1]);

    // `you` is always Me's row; `players` includes both ordered by seat.
    const top = history[0]!;
    expect(top.you.result).toBe('WIN');
    expect(top.you.seatIndex).toBe(0);
    expect(top.players.map((p) => p.seatIndex)).toEqual([0, 1]);
    expect(top.players[1]!.displayNameSnapshot).toBe('Them');
    expect(top.players[1]!.wasCut).toBe(true);
    expect(top.game.winnerId).toBe(me);

    // limit/offset paginate the newest-first list.
    const page = await t.repo.getUserGameHistory(me, 1, 1);
    expect(page.map((h) => h.game.id)).toEqual([g2]);
    expect(page[0]!.you.result).toBe('LOSS');
  });

  it('returns empty for a user with no games', async () => {
    const u = await seedUser(t, 'Lonely', { isGuest: false });
    expect(await t.repo.getUserGameHistory(u)).toEqual([]);
  });
});
