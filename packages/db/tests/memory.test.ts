import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { GamePersistence } from '../src/persistence/types';
import { MemoryPersistence } from '../src/persistence/memory';
import { createTestDb, uuid, type TestDb } from './helpers/pglite';

/**
 * Shared contract suite. Every assertion uses only `GamePersistence` methods so
 * it runs identically against the Postgres-backed and in-memory implementations.
 * FK/unique-constraint enforcement lives in the pg-only test files.
 */

interface Harness {
  repo: GamePersistence;
  newUserId: () => string;
  teardown: () => Promise<void>;
}

async function pgHarness(): Promise<Harness> {
  const t: TestDb = await createTestDb();
  return {
    repo: t.repo,
    newUserId: () => uuid(),
    teardown: () => t.close(),
  };
}

async function memoryHarness(): Promise<Harness> {
  let n = 0;
  return {
    repo: new MemoryPersistence(),
    newUserId: () => `mem-user-${n++}`,
    teardown: async () => {},
  };
}

const impls: Array<[string, () => Promise<Harness>]> = [
  ['PgPersistence', pgHarness],
  ['MemoryPersistence', memoryHarness],
];

describe.each(impls)('GamePersistence contract: %s', (_name, makeHarness) => {
  let h: Harness;
  let repo: GamePersistence;
  beforeEach(async () => {
    h = await makeHarness();
    repo = h.repo;
  });
  afterEach(async () => {
    await h.teardown();
  });

  async function freshUser(name = 'P'): Promise<string> {
    const id = h.newUserId();
    await repo.ensureGuest(id, name);
    return id;
  }

  it('ensureGuest is idempotent', async () => {
    const id = h.newUserId();
    const a = await repo.ensureGuest(id, 'G');
    const b = await repo.ensureGuest(id, 'G');
    expect(a.id).toBe(b.id);
    expect(b.isGuest).toBe(true);
  });

  it('records a room and updates its status', async () => {
    const host = await freshUser('Host');
    const room = await repo.recordRoomCreated({ roomCode: 'CON001', hostUserId: host });
    expect(room.status).toBe('LOBBY');
    const updated = await repo.updateRoomStatus(room.id, 'PLAYING');
    expect(updated!.status).toBe('PLAYING');
  });

  it('records game start and finish with players', async () => {
    const u1 = await freshUser('A');
    const u2 = await freshUser('B');
    const room = await repo.recordRoomCreated({ roomCode: 'CON002', hostUserId: u1 });
    const game = await repo.recordGameStarted({
      roomId: room.id,
      seed: 'seed-x',
      seatingOrder: [u1, u2],
    });
    expect(game.seed).toBe('seed-x');
    expect(game.playerCount).toBe(2);

    const finished = await repo.recordGameFinished({
      gameId: game.id,
      winnerId: u1,
      durationMs: 1000,
      players: [
        { userId: u1, seatIndex: 0, displayName: 'A', finalRank: 1, wasCut: false, captureCount: 4, result: 'WIN' },
        { userId: u2, seatIndex: 1, displayName: 'B', finalRank: 2, wasCut: true, captureCount: 1, result: 'LOSS' },
      ],
    });
    expect(finished.game.winnerId).toBe(u1);
    expect(finished.players).toHaveLength(2);

    const loaded = await repo.loadGameWithPlayers(game.id);
    expect(loaded!.players.map((p) => p.seatIndex)).toEqual([0, 1]);
  });

  it('recordGameFinished twice yields exactly one set of game_players', async () => {
    const u1 = await freshUser('A');
    const u2 = await freshUser('B');
    const room = await repo.recordRoomCreated({ roomCode: 'CON0FF', hostUserId: u1 });
    const game = await repo.recordGameStarted({
      roomId: room.id,
      seed: 's',
      seatingOrder: [u1, u2],
    });
    const players = [
      { userId: u1, seatIndex: 0, displayName: 'A', finalRank: 1, wasCut: false, captureCount: 7, result: 'WIN' },
      { userId: u2, seatIndex: 1, displayName: 'B', finalRank: 2, wasCut: true, captureCount: 3, result: 'LOSS' },
    ];
    await repo.recordGameFinished({ gameId: game.id, winnerId: u1, players });
    await repo.recordGameFinished({
      gameId: game.id,
      winnerId: u1,
      players: [{ ...players[0]!, captureCount: 9 }, players[1]!],
    });
    const loaded = await repo.loadGameWithPlayers(game.id);
    expect(loaded!.players).toHaveLength(2);
    expect(loaded!.players.map((p) => p.seatIndex)).toEqual([0, 1]);
    expect(loaded!.players[0]!.captureCount).toBe(9);
  });

  it('loadActiveGames orders multiple active games by startedAt', async () => {
    const host = await freshUser();
    const r1 = await repo.recordRoomCreated({ roomCode: 'CONOR1', hostUserId: host });
    await repo.updateRoomStatus(r1.id, 'PLAYING');
    const r2 = await repo.recordRoomCreated({ roomCode: 'CONOR2', hostUserId: host });
    await repo.updateRoomStatus(r2.id, 'PLAYING');

    // g1 starts earlier than g2.
    const g1 = await repo.recordGameStarted({
      roomId: r1.id,
      seed: '1',
      seatingOrder: [host],
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const g2 = await repo.recordGameStarted({
      roomId: r2.id,
      seed: '2',
      seatingOrder: [host],
      startedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    const active = await repo.loadActiveGames();
    expect(active.map((a) => a.game.id)).toEqual([g1.id, g2.id]);
  });

  it('appends events and reads them ordered by seq', async () => {
    const host = await freshUser();
    const room = await repo.recordRoomCreated({ roomCode: 'CON003', hostUserId: host });
    const game = await repo.recordGameStarted({
      roomId: room.id,
      seed: '1',
      seatingOrder: [host],
    });
    await repo.appendGameEvents([
      { gameId: game.id, seq: 0, eventType: 'CARD_PLAYED', payload: { a: 0 } },
      { gameId: game.id, seq: 1, eventType: 'CAPTURED', payload: { a: 1 } },
    ]);
    await repo.appendGameEvent({ gameId: game.id, seq: 2, eventType: 'PART1_ENDED', payload: { a: 2 } });
    const events = await repo.loadGameEvents(game.id);
    expect(events.map((e) => e.seq)).toEqual([0, 1, 2]);
  });

  it('rejects duplicate (game_id, seq)', async () => {
    const host = await freshUser();
    const room = await repo.recordRoomCreated({ roomCode: 'CON004', hostUserId: host });
    const game = await repo.recordGameStarted({
      roomId: room.id,
      seed: '1',
      seatingOrder: [host],
    });
    await repo.appendGameEvent({ gameId: game.id, seq: 0, eventType: 'CUT', payload: {} });
    await expect(
      repo.appendGameEvent({ gameId: game.id, seq: 0, eventType: 'CUT', payload: {} })
    ).rejects.toThrow();
  });

  it('upserts stats incrementally', async () => {
    const u = await freshUser();
    await repo.upsertPlayerStats({ userId: u, gamesPlayed: 1, totalCaptures: 2 });
    await repo.upsertPlayerStats({ userId: u, gamesPlayed: 1, totalCaptures: 3 });
    const s = await repo.getPlayerStats(u);
    expect(s!.gamesPlayed).toBe(2);
    expect(s!.totalCaptures).toBe(5);
  });

  it('getPlayerStatsView returns null for an unknown user', async () => {
    expect(await repo.getPlayerStatsView(h.newUserId())).toBeNull();
  });

  it('getPlayerStatsView derives rates and average finishing position', async () => {
    const u = await freshUser('Star');
    const opp = await freshUser('Opp');
    // 4 played: 2 wins, 1 loss, 1 abandoned.
    await repo.upsertPlayerStats({
      userId: u,
      gamesPlayed: 4,
      gamesWon: 2,
      gamesLost: 1,
      gamesAbandoned: 1,
    });

    // Three ranked games for `u` with finalRank 1, 2, 3 (mean 2), plus an
    // abandoned game where `u`'s finalRank is null (must be ignored).
    const room = await repo.recordRoomCreated({ roomCode: 'CONV01', hostUserId: u });
    const ranks = [1, 2, 3, null];
    for (const rank of ranks) {
      const game = await repo.recordGameStarted({
        roomId: room.id,
        seed: `s-${rank}`,
        seatingOrder: [u, opp],
      });
      await repo.recordGameFinished({
        gameId: game.id,
        players: [
          {
            userId: u,
            seatIndex: 0,
            displayName: 'Star',
            finalRank: rank,
            wasCut: false,
            captureCount: 0,
            result: rank === null ? 'ABANDONED' : 'PLAYED',
          },
          {
            userId: opp,
            seatIndex: 1,
            displayName: 'Opp',
            finalRank: rank === null ? null : 4 - rank,
            wasCut: false,
            captureCount: 0,
            result: 'PLAYED',
          },
        ],
      });
    }

    const view = await repo.getPlayerStatsView(u);
    expect(view).not.toBeNull();
    expect(view!.gamesPlayed).toBe(4);
    expect(view!.winRate).toBeCloseTo(0.5, 10);
    expect(view!.lossRate).toBeCloseTo(0.25, 10);
    expect(view!.abandonRate).toBeCloseTo(0.25, 10);
    expect(view!.averageFinishPosition).toBeCloseTo(2, 10);
  });

  it('getPlayerStatsView: zero games → zero rates and null average', async () => {
    const u = await freshUser('Zero');
    // A stats row exists with no games played and no ranked game_players rows.
    await repo.upsertPlayerStats({ userId: u });
    const view = await repo.getPlayerStatsView(u);
    expect(view).not.toBeNull();
    expect(view!.gamesPlayed).toBe(0);
    expect(view!.winRate).toBe(0);
    expect(view!.lossRate).toBe(0);
    expect(view!.abandonRate).toBe(0);
    expect(view!.averageFinishPosition).toBeNull();
  });

  it('loadActiveGames returns PLAYING, unfinished games only', async () => {
    const host = await freshUser();
    const playing = await repo.recordRoomCreated({ roomCode: 'CON005', hostUserId: host });
    await repo.updateRoomStatus(playing.id, 'PLAYING');
    const g = await repo.recordGameStarted({
      roomId: playing.id,
      seed: '1',
      seatingOrder: [host],
    });

    const done = await repo.recordRoomCreated({ roomCode: 'CON006', hostUserId: host });
    await repo.updateRoomStatus(done.id, 'DONE');
    await repo.recordGameStarted({ roomId: done.id, seed: '2', seatingOrder: [host] });

    const active = await repo.loadActiveGames();
    expect(active.map((a) => a.game.id)).toEqual([g.id]);
  });
});
