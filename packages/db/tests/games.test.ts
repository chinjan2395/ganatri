import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestDb,
  seedRoom,
  seedUser,
  uuid,
  type TestDb,
} from './helpers/pglite';

describe('games (pg)', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.close();
  });

  it('recordGameStarted round-trips seating jsonb, text seed, player_count', async () => {
    const host = await seedUser(t);
    const roomId = await seedRoom(t, host);
    const game = await t.repo.recordGameStarted({
      roomId,
      seed: 'seed-abc-123',
      seatingOrder: ['p1', 'p2', 'p3'],
      configSnapshot: { x: 1 },
    });
    expect(game.seed).toBe('seed-abc-123');
    expect(game.seatingOrder).toEqual(['p1', 'p2', 'p3']);
    expect(game.playerCount).toBe(3);
    expect(game.endedAt).toBeNull();
    expect(game.isAbandoned).toBe(false);
  });

  it('coerces a numeric seed to text', async () => {
    const host = await seedUser(t);
    const roomId = await seedRoom(t, host);
    const game = await t.repo.recordGameStarted({
      roomId,
      seed: 987654,
      seatingOrder: ['a', 'b'],
    });
    expect(game.seed).toBe('987654');
  });

  it('enforces FK on room_id', async () => {
    await expect(
      t.repo.recordGameStarted({ roomId: uuid(), seed: '1', seatingOrder: ['a'] })
    ).rejects.toThrow();
  });

  it('recordGameFinished writes games + game_players in one tx', async () => {
    const u1 = await seedUser(t, 'A');
    const u2 = await seedUser(t, 'B');
    const roomId = await seedRoom(t, u1);
    const game = await t.repo.recordGameStarted({
      roomId,
      seed: '42',
      seatingOrder: [u1, u2],
    });

    const result = await t.repo.recordGameFinished({
      gameId: game.id,
      durationMs: 120000,
      winnerId: u1,
      players: [
        {
          userId: u1,
          seatIndex: 0,
          displayName: 'A',
          finalRank: 1,
          wasCut: false,
          captureCount: 7,
          result: 'WIN',
        },
        {
          userId: u2,
          seatIndex: 1,
          displayName: 'B',
          finalRank: 2,
          wasCut: true,
          captureCount: 3,
          result: 'LOSS',
        },
      ],
    });

    expect(result.game.endedAt).toBeInstanceOf(Date);
    expect(result.game.winnerId).toBe(u1);
    expect(result.game.durationMs).toBe(120000);
    expect(result.players).toHaveLength(2);

    const loaded = await t.repo.loadGameWithPlayers(game.id);
    expect(loaded!.players.map((p) => p.finalRank)).toEqual([1, 2]);
    expect(loaded!.players[0]!.captureCount).toBe(7);
    expect(loaded!.players[1]!.wasCut).toBe(true);
  });

  it('recordGameFinished throws for unknown game', async () => {
    await expect(
      t.repo.recordGameFinished({ gameId: uuid(), players: [] })
    ).rejects.toThrow();
  });

  it('recordGameFinished is idempotent on (game_id, seat_index)', async () => {
    const u1 = await seedUser(t, 'A');
    const u2 = await seedUser(t, 'B');
    const roomId = await seedRoom(t, u1);
    const game = await t.repo.recordGameStarted({
      roomId,
      seed: '42',
      seatingOrder: [u1, u2],
    });

    const players = [
      {
        userId: u1,
        seatIndex: 0,
        displayName: 'A',
        finalRank: 1,
        wasCut: false,
        captureCount: 7,
        result: 'WIN',
      },
      {
        userId: u2,
        seatIndex: 1,
        displayName: 'B',
        finalRank: 2,
        wasCut: true,
        captureCount: 3,
        result: 'LOSS',
      },
    ];

    await t.repo.recordGameFinished({ gameId: game.id, winnerId: u1, players });
    // Second call (retry / double GAME_OVER) with a corrected capture count.
    await t.repo.recordGameFinished({
      gameId: game.id,
      winnerId: u1,
      players: [{ ...players[0]!, captureCount: 9 }, players[1]!],
    });

    const loaded = await t.repo.loadGameWithPlayers(game.id);
    // Exactly one set of game_players rows — no duplicates from the retry.
    expect(loaded!.players).toHaveLength(2);
    expect(loaded!.players.map((p) => p.seatIndex)).toEqual([0, 1]);
    // The corrected value was written through on conflict.
    expect(loaded!.players[0]!.captureCount).toBe(9);
  });
});
