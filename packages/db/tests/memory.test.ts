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

  // Auth --------------------------------------------------------------------

  it('upsertOAuthUser: new identity creates a non-guest user, repeat login is idempotent', async () => {
    const first = await repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'oauth-1',
      email: 'one@example.com',
      displayName: 'One',
    });
    expect(first.isGuest).toBe(false);
    const second = await repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'oauth-1',
      email: 'one@example.com',
      displayName: 'One Renamed',
    });
    expect(second.id).toBe(first.id);
    expect(second.displayName).toBe('One Renamed');
  });

  it('upsertOAuthUser links a new identity onto a user matched by email', async () => {
    // First login establishes the user + email.
    const created = await repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'oauth-email-a',
      email: 'shared@example.com',
      displayName: 'Shared',
    });
    // A different provider identity but same email links to the same user.
    const linked = await repo.upsertOAuthUser({
      provider: 'github',
      providerUserId: 'oauth-email-b',
      email: 'shared@example.com',
      displayName: 'Shared Linked',
    });
    expect(linked.id).toBe(created.id);
    expect(linked.isGuest).toBe(false);
  });

  it('auth sessions: valid lookup, expired -> null, revoked -> null', async () => {
    const user = await repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'oauth-sess',
      email: 'sess@example.com',
      displayName: 'Sess',
    });
    await repo.createAuthSession({
      userId: user.id,
      tokenHash: 'valid'.padEnd(64, '0'),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const found = await repo.getUserBySessionTokenHash('valid'.padEnd(64, '0'));
    expect(found!.id).toBe(user.id);

    await repo.createAuthSession({
      userId: user.id,
      tokenHash: 'expired'.padEnd(64, '0'),
      expiresAt: new Date(Date.now() - 1_000),
    });
    expect(
      await repo.getUserBySessionTokenHash('expired'.padEnd(64, '0'))
    ).toBeNull();

    await repo.revokeAuthSession('valid'.padEnd(64, '0'));
    expect(await repo.getUserBySessionTokenHash('valid'.padEnd(64, '0'))).toBeNull();
  });

  // History -----------------------------------------------------------------

  it('getUserGameHistory orders newest-first with you vs players', async () => {
    const me = await freshUser('Me');
    const them = await freshUser('Them');
    const room = await repo.recordRoomCreated({ roomCode: 'CONH01', hostUserId: me });

    const g1 = await repo.recordGameStarted({
      roomId: room.id,
      seed: 'h1',
      seatingOrder: [me, them],
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const g2 = await repo.recordGameStarted({
      roomId: room.id,
      seed: 'h2',
      seatingOrder: [me, them],
      startedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    for (const [g, winner] of [[g1, me], [g2, them]] as const) {
      await repo.recordGameFinished({
        gameId: g.id,
        winnerId: winner,
        players: [
          { userId: me, seatIndex: 0, displayName: 'Me', finalRank: winner === me ? 1 : 2, wasCut: false, captureCount: 3, result: winner === me ? 'WIN' : 'LOSS' },
          { userId: them, seatIndex: 1, displayName: 'Them', finalRank: winner === them ? 1 : 2, wasCut: false, captureCount: 2, result: winner === them ? 'WIN' : 'LOSS' },
        ],
      });
    }

    const history = await repo.getUserGameHistory(me);
    expect(history.map((h) => h.game.id)).toEqual([g2.id, g1.id]);
    expect(history[0]!.you.result).toBe('LOSS');
    expect(history[0]!.players.map((p) => p.seatIndex)).toEqual([0, 1]);

    const page = await repo.getUserGameHistory(me, 1, 1);
    expect(page.map((h) => h.game.id)).toEqual([g1.id]);
  });

  // Leaderboard --------------------------------------------------------------

  it('getLeaderboard ranks non-guests by the win-record tiebreak chain', async () => {
    // Three registered (non-guest) users with distinct win records.
    const alice = h.newUserId();
    const bob = h.newUserId();
    const carol = h.newUserId();
    await repo.upsertUser({ id: alice, displayName: 'Alice', isGuest: false });
    await repo.upsertUser({ id: bob, displayName: 'Bob', isGuest: false });
    await repo.upsertUser({ id: carol, displayName: 'Carol', isGuest: false });

    // Alice: 5 wins / 10 played (0.5). Bob: 5 wins / 8 played (0.625).
    // Carol: 3 wins / 4 played (0.75).
    await repo.upsertPlayerStats({ userId: alice, gamesPlayed: 10, gamesWon: 5, gamesLost: 5 });
    await repo.upsertPlayerStats({ userId: bob, gamesPlayed: 8, gamesWon: 5, gamesLost: 3 });
    await repo.upsertPlayerStats({ userId: carol, gamesPlayed: 4, gamesWon: 3, gamesLost: 1 });

    const board = await repo.getLeaderboard();
    // gamesWon DESC first: Alice(5) & Bob(5) tie on wins; Bob has higher winRate
    // so ranks above Alice. Carol(3 wins) ranks last.
    expect(board.map((e) => e.userId)).toEqual([bob, alice, carol]);
    expect(board[0]!.winRate).toBeCloseTo(0.625, 6);
    expect(board[1]!.winRate).toBeCloseTo(0.5, 6);
    expect(board[2]!.winRate).toBeCloseTo(0.75, 6);
    expect(board[2]!.gamesLost).toBe(1);
  });

  it('getLeaderboard excludes guests and zero-games users', async () => {
    const winner = h.newUserId();
    const guest = h.newUserId();
    const idle = h.newUserId();
    await repo.upsertUser({ id: winner, displayName: 'Winner', isGuest: false });
    await repo.ensureGuest(guest, 'Guest'); // isGuest = true
    await repo.upsertUser({ id: idle, displayName: 'Idle', isGuest: false });

    await repo.upsertPlayerStats({ userId: winner, gamesPlayed: 3, gamesWon: 2, gamesLost: 1 });
    await repo.upsertPlayerStats({ userId: guest, gamesPlayed: 9, gamesWon: 9, gamesLost: 0 });
    // idle: a stats row exists but gamesPlayed is 0 -> excluded.
    await repo.upsertPlayerStats({ userId: idle, gamesPlayed: 0, gamesWon: 0, gamesLost: 0 });

    const board = await repo.getLeaderboard();
    expect(board.map((e) => e.userId)).toEqual([winner]);
  });

  it('getLeaderboard paginates with limit and offset', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const id = h.newUserId();
      ids.push(id);
      await repo.upsertUser({ id, displayName: `U${i}`, isGuest: false });
      // Descending wins so order is deterministic: U0 highest .. U3 lowest.
      await repo.upsertPlayerStats({
        userId: id,
        gamesPlayed: 10,
        gamesWon: 8 - i,
        gamesLost: 2 + i,
      });
    }
    const full = await repo.getLeaderboard();
    expect(full.map((e) => e.userId)).toEqual(ids);

    const page = await repo.getLeaderboard(2, 1);
    expect(page.map((e) => e.userId)).toEqual([ids[1], ids[2]]);
  });

  // getMyLeaderboardRank ----------------------------------------------------

  it('getMyLeaderboardRank returns null for a guest user', async () => {
    const guest = h.newUserId();
    await repo.ensureGuest(guest, 'Guest');
    await repo.upsertPlayerStats({ userId: guest, gamesPlayed: 10, gamesWon: 9, gamesLost: 1 });
    expect(await repo.getMyLeaderboardRank(guest)).toBeNull();
  });

  it('getMyLeaderboardRank returns null for a user with zero games played', async () => {
    const idle = h.newUserId();
    await repo.upsertUser({ id: idle, displayName: 'Idle', isGuest: false });
    await repo.upsertPlayerStats({ userId: idle, gamesPlayed: 0, gamesWon: 0, gamesLost: 0 });
    expect(await repo.getMyLeaderboardRank(idle)).toBeNull();
  });

  it('getMyLeaderboardRank returns correct rank for a qualifying user', async () => {
    const u1 = h.newUserId();
    const u2 = h.newUserId();
    const u3 = h.newUserId();
    await repo.upsertUser({ id: u1, displayName: 'U1', isGuest: false });
    await repo.upsertUser({ id: u2, displayName: 'U2', isGuest: false });
    await repo.upsertUser({ id: u3, displayName: 'U3', isGuest: false });
    // u1: 10 wins, u2: 5 wins, u3: 2 wins — clear ordering.
    await repo.upsertPlayerStats({ userId: u1, gamesPlayed: 10, gamesWon: 10, gamesLost: 0 });
    await repo.upsertPlayerStats({ userId: u2, gamesPlayed: 10, gamesWon: 5, gamesLost: 5 });
    await repo.upsertPlayerStats({ userId: u3, gamesPlayed: 10, gamesWon: 2, gamesLost: 8 });

    const r1 = await repo.getMyLeaderboardRank(u1);
    expect(r1?.rank).toBe(1);
    expect(r1?.userId).toBe(u1);
    expect(r1?.gamesWon).toBe(10);

    const r3 = await repo.getMyLeaderboardRank(u3);
    expect(r3?.rank).toBe(3);
    expect(r3?.userId).toBe(u3);
  });

  // Retention ---------------------------------------------------------------

  it('pruneGameEventsBefore removes only events older than the cutoff', async () => {
    const host = await freshUser();
    const room = await repo.recordRoomCreated({ roomCode: 'CONR01', hostUserId: host });
    const game = await repo.recordGameStarted({
      roomId: room.id,
      seed: 'r',
      seatingOrder: [host],
    });
    await repo.appendGameEvent({ gameId: game.id, seq: 0, ts: new Date('2026-01-01T00:00:00.000Z'), eventType: 'CARD_PLAYED', payload: {} });
    await repo.appendGameEvent({ gameId: game.id, seq: 1, ts: new Date('2026-06-01T00:00:00.000Z'), eventType: 'CAPTURED', payload: {} });

    const deleted = await repo.pruneGameEventsBefore(new Date('2026-03-01T00:00:00.000Z'));
    expect(deleted).toBe(1);
    const events = await repo.loadGameEvents(game.id);
    expect(events.map((e) => e.seq)).toEqual([1]);
  });

  it('pruneAbandonedGamesBefore removes only old abandoned games and cascades', async () => {
    const host = await freshUser();
    const room = await repo.recordRoomCreated({ roomCode: 'CONR02', hostUserId: host });

    const oldAbandoned = await repo.recordGameStarted({
      roomId: room.id,
      seed: 'a',
      seatingOrder: [host],
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await repo.appendGameEvent({ gameId: oldAbandoned.id, seq: 0, eventType: 'CUT', payload: {} });
    await repo.recordGameFinished({
      gameId: oldAbandoned.id,
      endedAt: new Date('2026-01-01T00:10:00.000Z'),
      isAbandoned: true,
      players: [{ userId: host, seatIndex: 0, displayName: 'H', finalRank: null, wasCut: false, captureCount: 0, result: 'ABANDONED' }],
    });

    const completed = await repo.recordGameStarted({
      roomId: room.id,
      seed: 'b',
      seatingOrder: [host],
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await repo.recordGameFinished({
      gameId: completed.id,
      endedAt: new Date('2026-01-01T00:10:00.000Z'),
      isAbandoned: false,
      winnerId: host,
      players: [{ userId: host, seatIndex: 0, displayName: 'H', finalRank: 1, wasCut: false, captureCount: 1, result: 'WIN' }],
    });

    const deleted = await repo.pruneAbandonedGamesBefore(new Date('2026-03-01T00:00:00.000Z'));
    expect(deleted).toBe(1);
    expect(await repo.loadGameWithPlayers(oldAbandoned.id)).toBeNull();
    expect(await repo.loadGameEvents(oldAbandoned.id)).toEqual([]);
    expect(await repo.loadGameWithPlayers(completed.id)).not.toBeNull();
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
