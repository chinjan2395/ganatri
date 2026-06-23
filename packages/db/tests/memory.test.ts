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

  // Windowed leaderboard (week / month) -------------------------------------

  /**
   * Seed helper: creates a non-guest user, a room, a started game, then
   * finishes the game with a given endedAt and a WIN result for the user.
   * Returns the userId.
   */
  async function seedGameForUser(
    displayName: string,
    result: 'WIN' | 'LOSS',
    endedAt: Date,
  ): Promise<string> {
    const userId = h.newUserId();
    await repo.upsertUser({ id: userId, displayName, isGuest: false });
    // A second host user is needed to satisfy the FK for recordRoomCreated.
    const hostId = h.newUserId();
    await repo.ensureGuest(hostId, 'host');
    const code = `W${Math.random().toString(36).slice(2, 7).toUpperCase()}`.slice(0, 6);
    const room = await repo.recordRoomCreated({ roomCode: code, hostUserId: hostId });
    const game = await repo.recordGameStarted({
      roomId: room.id,
      seed: 'seed',
      seatingOrder: [userId, hostId],
      startedAt: new Date(endedAt.getTime() - 60_000),
    });
    await repo.recordGameFinished({
      gameId: game.id,
      endedAt,
      winnerId: result === 'WIN' ? userId : null,
      isAbandoned: false,
      players: [
        { userId, seatIndex: 0, displayName, finalRank: result === 'WIN' ? 1 : 2, wasCut: false, captureCount: 3, result },
        { userId: hostId, seatIndex: 1, displayName: 'host', finalRank: result === 'WIN' ? 2 : 1, wasCut: false, captureCount: 1, result: result === 'WIN' ? 'LOSS' : 'WIN' },
      ],
    });
    return userId;
  }

  it('week window returns only games from the last 7 days', async () => {
    // "3 days ago" (2026-06-17) is within 7 days; "10 days ago" (2026-06-10) is not.
    const recentEnded = new Date('2026-06-17T12:00:00Z');
    const oldEnded = new Date('2026-06-10T12:00:00Z');

    const userId = h.newUserId();
    await repo.upsertUser({ id: userId, displayName: 'Windowed', isGuest: false });
    const hostId = h.newUserId();
    await repo.ensureGuest(hostId, 'host');
    const room = await repo.recordRoomCreated({ roomCode: 'WNDW01', hostUserId: hostId });

    // Game 1: ended 3 days ago (in window).
    const g1 = await repo.recordGameStarted({ roomId: room.id, seed: 's1', seatingOrder: [userId, hostId], startedAt: new Date('2026-06-17T11:00:00Z') });
    await repo.recordGameFinished({
      gameId: g1.id,
      endedAt: recentEnded,
      winnerId: userId,
      isAbandoned: false,
      players: [
        { userId, seatIndex: 0, displayName: 'Windowed', finalRank: 1, wasCut: false, captureCount: 3, result: 'WIN' },
        { userId: hostId, seatIndex: 1, displayName: 'host', finalRank: 2, wasCut: false, captureCount: 1, result: 'LOSS' },
      ],
    });

    // Game 2: ended 10 days ago (outside week window).
    const g2 = await repo.recordGameStarted({ roomId: room.id, seed: 's2', seatingOrder: [userId, hostId], startedAt: new Date('2026-06-10T11:00:00Z') });
    await repo.recordGameFinished({
      gameId: g2.id,
      endedAt: oldEnded,
      winnerId: userId,
      isAbandoned: false,
      players: [
        { userId, seatIndex: 0, displayName: 'Windowed', finalRank: 1, wasCut: false, captureCount: 3, result: 'WIN' },
        { userId: hostId, seatIndex: 1, displayName: 'host', finalRank: 2, wasCut: false, captureCount: 1, result: 'LOSS' },
      ],
    });

    const board = await repo.getLeaderboard(20, 0, 'week');
    const entry = board.find((e) => e.userId === userId);
    // Only the recent game should be counted.
    expect(entry).toBeDefined();
    expect(entry!.gamesPlayed).toBe(1);
    expect(entry!.gamesWon).toBe(1);
  });

  it('month window is wider than week window', async () => {
    // "20 days ago" (2026-05-31) is within 30 days but NOT within 7 days.
    const mediumEnded = new Date('2026-05-31T12:00:00Z');

    const userId = h.newUserId();
    await repo.upsertUser({ id: userId, displayName: 'Monthly', isGuest: false });
    const hostId = h.newUserId();
    await repo.ensureGuest(hostId, 'host');
    const room = await repo.recordRoomCreated({ roomCode: 'MNTH01', hostUserId: hostId });

    const g = await repo.recordGameStarted({ roomId: room.id, seed: 'sm', seatingOrder: [userId, hostId], startedAt: new Date('2026-05-31T11:00:00Z') });
    await repo.recordGameFinished({
      gameId: g.id,
      endedAt: mediumEnded,
      winnerId: userId,
      isAbandoned: false,
      players: [
        { userId, seatIndex: 0, displayName: 'Monthly', finalRank: 1, wasCut: false, captureCount: 3, result: 'WIN' },
        { userId: hostId, seatIndex: 1, displayName: 'host', finalRank: 2, wasCut: false, captureCount: 1, result: 'LOSS' },
      ],
    });

    const weekBoard = await repo.getLeaderboard(20, 0, 'week');
    const monthBoard = await repo.getLeaderboard(20, 0, 'month');

    // Game is 20 days ago: outside week, inside month.
    expect(weekBoard.find((e) => e.userId === userId)).toBeUndefined();
    const monthEntry = monthBoard.find((e) => e.userId === userId);
    expect(monthEntry).toBeDefined();
    expect(monthEntry!.gamesPlayed).toBe(1);
  });

  it('window returns empty when no games are in range', async () => {
    // "40 days ago" (2026-05-11) is outside both week and month windows.
    const oldEnded = new Date('2026-05-11T12:00:00Z');
    await seedGameForUser('OldPlayer', 'WIN', oldEnded);

    const weekBoard = await repo.getLeaderboard(20, 0, 'week');
    const monthBoard = await repo.getLeaderboard(20, 0, 'month');
    // OldPlayer's game is too old for both windows.
    expect(weekBoard.find((e) => e.displayName === 'OldPlayer')).toBeUndefined();
    expect(monthBoard.find((e) => e.displayName === 'OldPlayer')).toBeUndefined();
  });

  it('getMyLeaderboardRank with week window returns rank 1 for a user with a recent game', async () => {
    // "3 days ago" (2026-06-17) is within 7 days.
    const recentEnded = new Date('2026-06-17T12:00:00Z');
    const userId = h.newUserId();
    await repo.upsertUser({ id: userId, displayName: 'WeekRanker', isGuest: false });
    const hostId = h.newUserId();
    await repo.ensureGuest(hostId, 'host');
    const room = await repo.recordRoomCreated({ roomCode: 'WKRK01', hostUserId: hostId });

    const g = await repo.recordGameStarted({ roomId: room.id, seed: 'wr', seatingOrder: [userId, hostId], startedAt: new Date('2026-06-17T11:00:00Z') });
    await repo.recordGameFinished({
      gameId: g.id,
      endedAt: recentEnded,
      winnerId: userId,
      isAbandoned: false,
      players: [
        { userId, seatIndex: 0, displayName: 'WeekRanker', finalRank: 1, wasCut: false, captureCount: 3, result: 'WIN' },
        { userId: hostId, seatIndex: 1, displayName: 'host', finalRank: 2, wasCut: false, captureCount: 1, result: 'LOSS' },
      ],
    });

    const rank = await repo.getMyLeaderboardRank(userId, 'week');
    expect(rank).not.toBeNull();
    expect(rank!.rank).toBe(1);
    expect(rank!.userId).toBe(userId);
    expect(rank!.gamesPlayed).toBe(1);
    expect(rank!.gamesWon).toBe(1);
  });

  it('getMyLeaderboardRank with week window returns null when only old games exist', async () => {
    // Game ended 10 days ago — outside the 7-day window.
    const oldEnded = new Date('2026-06-10T12:00:00Z');
    const userId = await seedGameForUser('OldRanker', 'WIN', oldEnded);

    const rank = await repo.getMyLeaderboardRank(userId, 'week');
    expect(rank).toBeNull();
  });

  it('week window excludes abandoned games', async () => {
    // Seed a non-guest user with a recent game (3 days ago) that is abandoned.
    const recentEnded = new Date('2026-06-17T12:00:00Z');
    const userId = h.newUserId();
    await repo.upsertUser({ id: userId, displayName: 'AbandonedPlayer', isGuest: false });
    const hostId = h.newUserId();
    await repo.ensureGuest(hostId, 'host');
    const room = await repo.recordRoomCreated({ roomCode: 'ABND01', hostUserId: hostId });

    const g = await repo.recordGameStarted({
      roomId: room.id,
      seed: 'sabd',
      seatingOrder: [userId, hostId],
      startedAt: new Date('2026-06-17T11:00:00Z'),
    });
    await repo.recordGameFinished({
      gameId: g.id,
      endedAt: recentEnded,
      winnerId: null,
      isAbandoned: true,
      players: [
        { userId, seatIndex: 0, displayName: 'AbandonedPlayer', finalRank: null, wasCut: false, captureCount: 0, result: 'ABANDONED' },
        { userId: hostId, seatIndex: 1, displayName: 'host', finalRank: null, wasCut: false, captureCount: 0, result: 'ABANDONED' },
      ],
    });

    // The week window leaderboard should not include the abandoned game.
    const board = await repo.getLeaderboard(20, 0, 'week');
    const entry = board.find((e) => e.userId === userId);
    expect(entry).toBeUndefined();
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

  // mergeGuestIntoUser ---------------------------------------------------

  it('mergeGuestIntoUser: merges guest stats and game_players into registered user (no prior stats)', async () => {
    const guestId = h.newUserId();
    await repo.ensureGuest(guestId, 'GuestPlayer');

    const regUser = await repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'merge-oauth-1',
      email: 'merge1@example.com',
      displayName: 'Registered',
    });

    // Give the guest a game
    const roomCode = `MG${Math.random().toString(36).slice(2, 6).toUpperCase()}`.slice(0, 6);
    const room = await repo.recordRoomCreated({ roomCode, hostUserId: guestId });
    const game = await repo.recordGameStarted({
      roomId: room.id,
      seed: 'merge-seed',
      seatingOrder: [guestId, regUser.id],
    });
    await repo.recordGameFinished({
      gameId: game.id,
      winnerId: guestId,
      players: [
        { userId: guestId, seatIndex: 0, displayName: 'GuestPlayer', finalRank: 1, wasCut: false, captureCount: 5, result: 'WIN' },
        { userId: regUser.id, seatIndex: 1, displayName: 'Registered', finalRank: 2, wasCut: false, captureCount: 2, result: 'LOSS' },
      ],
    });

    // Give the guest some stats
    await repo.upsertPlayerStats({
      userId: guestId,
      gamesPlayed: 3,
      gamesWon: 2,
      gamesLost: 1,
      totalCaptures: 10,
      longestWinStreak: 2,
      currentWinStreak: 1,
    });

    await repo.mergeGuestIntoUser(guestId, regUser.id);

    // Stats transferred
    const stats = await repo.getPlayerStats(regUser.id);
    expect(stats).not.toBeNull();
    expect(stats!.gamesPlayed).toBe(3);
    expect(stats!.gamesWon).toBe(2);
    expect(stats!.totalCaptures).toBe(10);

    // Guest stats gone
    expect(await repo.getPlayerStats(guestId)).toBeNull();

    // Game history now shows for registered user
    const history = await repo.getUserGameHistory(regUser.id);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history.some((e) => e.game.id === game.id)).toBe(true);
  });

  it('mergeGuestIntoUser: sums stats when registered user already has stats', async () => {
    const guestId = h.newUserId();
    await repo.ensureGuest(guestId, 'GuestWithStats');

    const regUser = await repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'merge-oauth-2',
      email: 'merge2@example.com',
      displayName: 'RegWithStats',
    });

    // Stats for guest
    await repo.upsertPlayerStats({
      userId: guestId,
      gamesPlayed: 4,
      gamesWon: 3,
      gamesLost: 1,
      totalCaptures: 8,
      longestWinStreak: 3,
      currentWinStreak: 2,
    });

    // Stats for registered user
    await repo.upsertPlayerStats({
      userId: regUser.id,
      gamesPlayed: 2,
      gamesWon: 1,
      gamesLost: 1,
      totalCaptures: 5,
      longestWinStreak: 1,
      currentWinStreak: 1,
    });

    await repo.mergeGuestIntoUser(guestId, regUser.id);

    const stats = await repo.getPlayerStats(regUser.id);
    expect(stats).not.toBeNull();
    expect(stats!.gamesPlayed).toBe(6);  // 4 + 2
    expect(stats!.gamesWon).toBe(4);     // 3 + 1
    expect(stats!.gamesLost).toBe(2);    // 1 + 1
    expect(stats!.totalCaptures).toBe(13); // 8 + 5
    // longestWinStreak is max(3, 1) = 3
    expect(stats!.longestWinStreak).toBe(3);

    // Guest stats gone
    expect(await repo.getPlayerStats(guestId)).toBeNull();
  });

  it('mergeGuestIntoUser: no-op when guestId === registeredId', async () => {
    const userId = h.newUserId();
    await repo.upsertUser({ id: userId, displayName: 'SameUser', isGuest: false });
    await repo.upsertPlayerStats({ userId, gamesPlayed: 5, gamesWon: 3, gamesLost: 2 });

    await repo.mergeGuestIntoUser(userId, userId);

    const stats = await repo.getPlayerStats(userId);
    expect(stats!.gamesPlayed).toBe(5);
  });

  it('mergeGuestIntoUser: no-op when guest not found', async () => {
    const regId = h.newUserId();
    // Should not throw even when guestUserId does not exist
    await expect(repo.mergeGuestIntoUser('nonexistent-id', regId)).resolves.toBeUndefined();
  });

  // updateUserDisplayName ---------------------------------------------------

  it('updateUserDisplayName — updates a registered user\'s display name', async () => {
    const userId = h.newUserId();
    await repo.upsertUser({ id: userId, displayName: 'OldName', isGuest: false });
    await repo.upsertPlayerStats({ userId, gamesPlayed: 1, gamesWon: 1, gamesLost: 0 });

    await repo.updateUserDisplayName(userId, 'NewName');

    // Verify the change is reflected in the leaderboard, which reads displayName
    // directly from the users table.
    const board = await repo.getLeaderboard();
    const entry = board.find((e) => e.userId === userId);
    expect(entry).toBeDefined();
    expect(entry!.displayName).toBe('NewName');
  });

  it('updateUserDisplayName — no-op for unknown user (does not throw)', async () => {
    const unknownId = h.newUserId();
    // Should resolve without throwing.
    await expect(repo.updateUserDisplayName(unknownId, 'SomeName')).resolves.toBeUndefined();
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

  // Phase 8: co-player queries and blocks -----------------------------------

  async function freshRegistered(name: string, emailSuffix: string): Promise<string> {
    const u = await repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: `ph8-${emailSuffix}`,
      email: `${emailSuffix}@ph8.test`,
      displayName: name,
    });
    return u.id;
  }

  async function seedSharedGame(playerIds: string[], seed: string): Promise<void> {
    const code = `B${seed.replace(/[^A-Z0-9]/gi, '').slice(0, 5).toUpperCase()}`;
    const room = await repo.recordRoomCreated({ roomCode: code, hostUserId: playerIds[0]! });
    const game = await repo.recordGameStarted({
      roomId: room.id,
      seed,
      seatingOrder: playerIds,
    });
    await repo.recordGameFinished({
      gameId: game.id,
      winnerId: playerIds[0]!,
      players: playerIds.map((uid, idx) => ({
        userId: uid,
        seatIndex: idx,
        displayName: `P${idx}`,
        finalRank: idx + 1,
        wasCut: false,
        captureCount: 0,
        result: (idx === 0 ? 'WIN' : 'LOSS') as 'WIN' | 'LOSS',
      })),
    });
  }

  describe('getFrequentCoPlayers', () => {
    it('returns co-players ordered by shared-game count DESC', async () => {
      const me = await freshRegistered('Me', 'me-coplay1');
      const p1 = await freshRegistered('P1', 'p1-coplay1');
      const p2 = await freshRegistered('P2', 'p2-coplay1');
      await seedSharedGame([me, p1, p2], 'cp-g1');
      await seedSharedGame([me, p1], 'cp-g2');

      const result = await repo.getFrequentCoPlayers(me);
      expect(result[0]!.userId).toBe(p1);
      expect(result[0]!.gamesPlayedTogether).toBe(2);
      expect(result[1]!.userId).toBe(p2);
      expect(result[1]!.gamesPlayedTogether).toBe(1);
    });

    it('excludes the requesting user from results', async () => {
      const me = await freshRegistered('Me2', 'me-coplay2');
      const p1 = await freshRegistered('P1b', 'p1-coplay2');
      await seedSharedGame([me, p1], 'cp-g3');

      const result = await repo.getFrequentCoPlayers(me);
      expect(result.some((e) => e.userId === me)).toBe(false);
    });

    it('excludes guest co-players from results', async () => {
      const me = await freshRegistered('Me3', 'me-coplay3');
      const guest = await freshUser('GuestCo');
      await seedSharedGame([me, guest], 'cp-g4');

      const result = await repo.getFrequentCoPlayers(me);
      expect(result.some((e) => e.userId === guest)).toBe(false);
    });

    it('returns empty array when user has no shared games', async () => {
      const me = await freshRegistered('Me4', 'me-coplay4');
      expect(await repo.getFrequentCoPlayers(me)).toEqual([]);
    });
  });

  describe('blockUser / unblockUser / isBlocked', () => {
    it('blockUser makes isBlocked return true', async () => {
      const a = await freshUser('BlockA');
      const b = await freshUser('BlockB');
      await repo.blockUser(a, b);
      expect(await repo.isBlocked(a, b)).toBe(true);
    });

    it('unblockUser makes isBlocked return false', async () => {
      const a = await freshUser('BlockC');
      const b = await freshUser('BlockD');
      await repo.blockUser(a, b);
      await repo.unblockUser(a, b);
      expect(await repo.isBlocked(a, b)).toBe(false);
    });

    it('blockUser is idempotent — double block does not throw', async () => {
      const a = await freshUser('BlockE');
      const b = await freshUser('BlockF');
      await repo.blockUser(a, b);
      await expect(repo.blockUser(a, b)).resolves.toBeUndefined();
      expect(await repo.isBlocked(a, b)).toBe(true);
    });

    it('isBlocked is one-directional: A blocks B does not imply B blocks A', async () => {
      const a = await freshUser('BlockG');
      const b = await freshUser('BlockH');
      await repo.blockUser(a, b);
      expect(await repo.isBlocked(a, b)).toBe(true);
      expect(await repo.isBlocked(b, a)).toBe(false);
    });
  });

  describe('getBlockedUsers', () => {
    it('getBlockedUsers returns blocked user details', async () => {
      const blocker = await freshRegistered('Blocker', 'blocker-bu1');
      const blocked = await freshRegistered('BlockedPerson', 'blocked-bu1');
      // Retrieve the blocked user's row to check avatarUrl
      await repo.blockUser(blocker, blocked);
      const result = await repo.getBlockedUsers(blocker);
      expect(result).toHaveLength(1);
      expect(result[0]!.userId).toBe(blocked);
      expect(result[0]!.displayName).toBe('BlockedPerson');
      expect(result[0]!.avatarUrl).toBeNull();
    });

    it('getBlockedUsers returns empty array when no blocks', async () => {
      const user = await freshRegistered('NobodyBlocked', 'nobody-bu2');
      const result = await repo.getBlockedUsers(user);
      expect(result).toEqual([]);
    });
  });

  // searchUsers / adminGetUserStats -----------------------------------------

  describe('searchUsers', () => {
    it('returns matching users case-insensitively by displayName', async () => {
      const id = h.newUserId();
      await repo.upsertUser({ id, displayName: 'Alphonso', isGuest: false });

      const results = await repo.searchUsers('alph');
      expect(results.some((r) => r.userId === id)).toBe(true);
      const hit = results.find((r) => r.userId === id)!;
      expect(hit.displayName).toBe('Alphonso');
    });

    it('returns empty array when no match', async () => {
      const id = h.newUserId();
      await repo.upsertUser({ id, displayName: 'Zeno', isGuest: false });
      const results = await repo.searchUsers('qqqqqqqqqq');
      expect(results).toEqual([]);
    });

    it('respects limit', async () => {
      // Create 5 users all matching the query.
      for (let i = 0; i < 5; i++) {
        const id = h.newUserId();
        await repo.upsertUser({ id, displayName: `SearchUser${i}`, isGuest: false });
      }
      const results = await repo.searchUsers('SearchUser', 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('matches by email case-insensitively', async () => {
      const user = await repo.upsertOAuthUser({
        provider: 'google',
        providerUserId: 'su-email-1',
        email: 'FindMe@example.com',
        displayName: 'FindMeByEmail',
      });
      const results = await repo.searchUsers('findme@');
      expect(results.some((r) => r.userId === user.id)).toBe(true);
    });
  });

  describe('adminGetUserStats', () => {
    it('returns full stats for a known user', async () => {
      const id = h.newUserId();
      await repo.upsertUser({ id, displayName: 'StatUser', email: null, isGuest: false });
      await repo.upsertPlayerStats({
        userId: id,
        gamesPlayed: 10,
        gamesWon: 6,
        gamesLost: 3,
        gamesAbandoned: 1,
        totalCaptures: 20,
        cutsGiven: 2,
        cutsReceived: 1,
        timesSafe: 4,
        totalPlayTimeMs: 50_000,
        longestWinStreak: 3,
        currentWinStreak: 2,
      });

      const stats = await repo.adminGetUserStats(id);
      expect(stats).not.toBeNull();
      expect(stats!.userId).toBe(id);
      expect(stats!.displayName).toBe('StatUser');
      expect(stats!.gamesPlayed).toBe(10);
      expect(stats!.gamesWon).toBe(6);
      expect(stats!.gamesLost).toBe(3);
      expect(stats!.gamesAbandoned).toBe(1);
      expect(stats!.winRate).toBeCloseTo(0.6, 6);
      expect(stats!.totalCaptures).toBe(20);
      expect(stats!.longestWinStreak).toBe(3);
      expect(stats!.currentWinStreak).toBe(2);
      expect(stats!.updatedAt).not.toBeNull();
    });

    it('returns null for unknown userId', async () => {
      const result = await repo.adminGetUserStats('does-not-exist');
      expect(result).toBeNull();
    });

    it('returns zeroed stats when no player_stats row exists', async () => {
      const id = h.newUserId();
      await repo.upsertUser({ id, displayName: 'NoStats', isGuest: false });

      const stats = await repo.adminGetUserStats(id);
      expect(stats).not.toBeNull();
      expect(stats!.gamesPlayed).toBe(0);
      expect(stats!.gamesWon).toBe(0);
      expect(stats!.winRate).toBe(0);
      expect(stats!.totalCaptures).toBe(0);
      expect(stats!.updatedAt).toBeNull();
    });
  });

  // getAdminKpiStats ---------------------------------------------------------

  /**
   * Helper: creates a room+game that ended at `endedAt` with optional
   * durationMs and isAbandoned flag.
   */
  async function seedEndedGame(opts: {
    endedAt: Date;
    durationMs?: number | null;
    isAbandoned?: boolean;
  }): Promise<void> {
    const host = await freshUser('KPIHost');
    const code = `K${Math.random().toString(36).slice(2, 6).toUpperCase()}`.slice(0, 6);
    const room = await repo.recordRoomCreated({ roomCode: code, hostUserId: host });
    const game = await repo.recordGameStarted({
      roomId: room.id,
      seed: 'kpi-seed',
      seatingOrder: [host],
      startedAt: new Date(opts.endedAt.getTime() - (opts.durationMs ?? 60_000)),
    });
    await repo.recordGameFinished({
      gameId: game.id,
      endedAt: opts.endedAt,
      durationMs: opts.durationMs ?? null,
      isAbandoned: opts.isAbandoned ?? false,
      winnerId: opts.isAbandoned ? null : host,
      players: [
        {
          userId: host,
          seatIndex: 0,
          displayName: 'KPIHost',
          finalRank: opts.isAbandoned ? null : 1,
          wasCut: false,
          captureCount: 0,
          result: opts.isAbandoned ? 'ABANDONED' : 'WIN',
        },
      ],
    });
  }

  describe('getAdminKpiStats', () => {
    it('returns zeroed stats when no games ended in the window', async () => {
      // Seed a game that ended 30 days ago (outside default 7-day window).
      const oldEnded = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 - 1000);
      await seedEndedGame({ endedAt: oldEnded, durationMs: 5000 });

      const stats = await repo.getAdminKpiStats(7);
      expect(stats.windowDays).toBe(7);
      expect(stats.totalGames).toBe(0);
      expect(stats.completedGames).toBe(0);
      expect(stats.abandonedGames).toBe(0);
      expect(stats.abandonmentRate).toBe(0);
      expect(stats.avgDurationMs).toBeNull();
      expect(stats.dailyBreakdown).toHaveLength(0);
    });

    it('correctly counts completed vs abandoned games in the window', async () => {
      const recentEnded = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      // 2 completed games
      await seedEndedGame({ endedAt: recentEnded, durationMs: 10_000 });
      await seedEndedGame({ endedAt: recentEnded, durationMs: 20_000 });
      // 1 abandoned game
      await seedEndedGame({ endedAt: recentEnded, durationMs: null, isAbandoned: true });

      const stats = await repo.getAdminKpiStats(7);
      expect(stats.totalGames).toBe(3);
      expect(stats.completedGames).toBe(2);
      expect(stats.abandonedGames).toBe(1);
      expect(stats.abandonmentRate).toBeCloseTo(1 / 3, 6);
      // avgDurationMs only considers completed games with durationMs set.
      expect(stats.avgDurationMs).toBeCloseTo(15_000, 1); // (10000+20000)/2
    });

    it('avgDurationMs is null when no completed games have durationMs', async () => {
      const recentEnded = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // yesterday
      // Only an abandoned game (no durationMs).
      await seedEndedGame({ endedAt: recentEnded, durationMs: null, isAbandoned: true });

      const stats = await repo.getAdminKpiStats(7);
      expect(stats.totalGames).toBe(1);
      expect(stats.completedGames).toBe(0);
      expect(stats.avgDurationMs).toBeNull();
    });

    it('avgDurationMs only counts completed games that have durationMs (not null-duration ones)', async () => {
      const recentEnded = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // yesterday
      // Two completed games with real durations and one completed game with null durationMs.
      await seedEndedGame({ endedAt: recentEnded, durationMs: 1_000 });
      await seedEndedGame({ endedAt: recentEnded, durationMs: 2_000 });
      await seedEndedGame({ endedAt: recentEnded, durationMs: null }); // completed but no duration

      const stats = await repo.getAdminKpiStats(7);
      expect(stats.totalGames).toBe(3);
      expect(stats.completedGames).toBe(3);
      // avgDurationMs must be (1000+2000)/2 = 1500, NOT (1000+2000+0)/3 = 1000
      expect(stats.avgDurationMs).toBeCloseTo(1_500, 1);
    });
  });
});
