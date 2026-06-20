import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, seedUser, type TestDb } from './helpers/pglite';

describe('player_stats (pg)', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.close();
  });

  it('inserts then increments accumulated counters', async () => {
    const u = await seedUser(t);
    await t.repo.upsertPlayerStats({
      userId: u,
      gamesPlayed: 1,
      gamesWon: 1,
      totalCaptures: 5,
      timesSafe: 1,
    });
    const after1 = await t.repo.getPlayerStats(u);
    expect(after1!.gamesPlayed).toBe(1);
    expect(after1!.gamesWon).toBe(1);
    expect(after1!.totalCaptures).toBe(5);

    await t.repo.upsertPlayerStats({
      userId: u,
      gamesPlayed: 1,
      gamesLost: 1,
      totalCaptures: 3,
      cutsReceived: 2,
    });
    const after2 = await t.repo.getPlayerStats(u);
    expect(after2!.gamesPlayed).toBe(2);
    expect(after2!.gamesWon).toBe(1);
    expect(after2!.gamesLost).toBe(1);
    expect(after2!.totalCaptures).toBe(8);
    expect(after2!.cutsReceived).toBe(2);
  });

  it('sets streak fields absolutely (not incremented)', async () => {
    const u = await seedUser(t);
    await t.repo.upsertPlayerStats({ userId: u, currentWinStreak: 3, longestWinStreak: 3 });
    await t.repo.upsertPlayerStats({ userId: u, currentWinStreak: 0 });
    const s = await t.repo.getPlayerStats(u);
    expect(s!.currentWinStreak).toBe(0);
    expect(s!.longestWinStreak).toBe(3);
  });

  it('getPlayerStats returns null for unknown user', async () => {
    expect(await t.repo.getPlayerStats('00000000-0000-4000-8000-ffffffffffff')).toBeNull();
  });

  it('enforces a single stats row per user', async () => {
    const u = await seedUser(t);
    await t.repo.upsertPlayerStats({ userId: u, gamesPlayed: 1 });
    await t.repo.upsertPlayerStats({ userId: u, gamesPlayed: 1 });
    const res = await t.pglite.query<{ count: string }>(
      `select count(*)::text as count from player_stats where user_id = $1`,
      [u]
    );
    expect(Number(res.rows[0]!.count)).toBe(1);
  });

  it('accumulates sumFinishPositions across games', async () => {
    const u = await seedUser(t);
    // Game 1: rank 2
    await t.repo.upsertPlayerStats({ userId: u, gamesPlayed: 1, sumFinishPositions: 2 });
    const after1 = await t.repo.getPlayerStats(u);
    expect(after1!.sumFinishPositions).toBe(2);

    // Game 2: rank 1
    await t.repo.upsertPlayerStats({ userId: u, gamesPlayed: 1, sumFinishPositions: 1 });
    const after2 = await t.repo.getPlayerStats(u);
    expect(after2!.sumFinishPositions).toBe(3);

    // avgFinish = 3 / 2 = 1.5
    expect(after2!.gamesPlayed).toBe(2);
  });
});
