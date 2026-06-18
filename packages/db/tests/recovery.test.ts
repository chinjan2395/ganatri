import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, seedRoom, seedUser, type TestDb } from './helpers/pglite';

describe('recovery reads (pg)', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.close();
  });

  it('loadActiveGames returns only games in PLAYING rooms with no ended_at', async () => {
    const host = await seedUser(t);

    // Active: PLAYING room, unfinished game.
    const activeRoom = await seedRoom(t, host, { status: 'PLAYING', roomCode: 'ACT001' });
    const activeGame = await t.repo.recordGameStarted({
      roomId: activeRoom,
      seed: '1',
      seatingOrder: [host, 'p2'],
    });

    // Inactive #1: DONE room.
    const doneRoom = await seedRoom(t, host, { status: 'DONE', roomCode: 'DON001' });
    await t.repo.recordGameStarted({ roomId: doneRoom, seed: '2', seatingOrder: ['a', 'b'] });

    // Inactive #2: PLAYING room but the game has ended.
    const playingRoom2 = await seedRoom(t, host, { status: 'PLAYING', roomCode: 'ACT002' });
    const endedGame = await t.repo.recordGameStarted({
      roomId: playingRoom2,
      seed: '3',
      seatingOrder: ['c', 'd'],
    });
    await t.repo.recordGameFinished({ gameId: endedGame.id, players: [] });

    const active = await t.repo.loadActiveGames();
    expect(active).toHaveLength(1);
    expect(active[0]!.game.id).toBe(activeGame.id);
  });

  it('loadActiveGames includes ordered player rows', async () => {
    const host = await seedUser(t);
    const room = await seedRoom(t, host, { status: 'PLAYING', roomCode: 'ACT003' });
    const game = await t.repo.recordGameStarted({
      roomId: room,
      seed: '9',
      seatingOrder: [host, 'p2', 'p3'],
    });
    // Insert player rows out of seat order; expect ordered output.
    await t.db.insert((await import('../src/schema')).gamePlayers).values([
      { gameId: game.id, seatIndex: 2, displayNameSnapshot: 'C' },
      { gameId: game.id, seatIndex: 0, displayNameSnapshot: 'A' },
      { gameId: game.id, seatIndex: 1, displayNameSnapshot: 'B' },
    ]);
    const active = await t.repo.loadActiveGames();
    expect(active[0]!.players.map((p) => p.seatIndex)).toEqual([0, 1, 2]);
  });

  it('loadActiveGames returns multiple active games ordered by startedAt', async () => {
    const host = await seedUser(t);
    const roomA = await seedRoom(t, host, { status: 'PLAYING', roomCode: 'ORD001' });
    const roomB = await seedRoom(t, host, { status: 'PLAYING', roomCode: 'ORD002' });

    // Insert the later game first to prove ordering is by startedAt, not insert
    // order / id.
    const later = await t.repo.recordGameStarted({
      roomId: roomB,
      seed: '2',
      seatingOrder: [host],
      startedAt: new Date('2026-02-02T00:00:00.000Z'),
    });
    const earlier = await t.repo.recordGameStarted({
      roomId: roomA,
      seed: '1',
      seatingOrder: [host],
      startedAt: new Date('2026-02-01T00:00:00.000Z'),
    });

    const active = await t.repo.loadActiveGames();
    expect(active.map((a) => a.game.id)).toEqual([earlier.id, later.id]);
  });

  it('loadGameEvents returns events ordered by seq', async () => {
    const host = await seedUser(t);
    const room = await seedRoom(t, host, { status: 'PLAYING', roomCode: 'ACT004' });
    const game = await t.repo.recordGameStarted({
      roomId: room,
      seed: '7',
      seatingOrder: ['a', 'b'],
    });
    // Append in shuffled order.
    await t.repo.appendGameEvent({ gameId: game.id, seq: 2, eventType: 'CUT', payload: {} });
    await t.repo.appendGameEvent({ gameId: game.id, seq: 0, eventType: 'CARD_PLAYED', payload: {} });
    await t.repo.appendGameEvent({ gameId: game.id, seq: 1, eventType: 'CAPTURED', payload: {} });
    const events = await t.repo.loadGameEvents(game.id);
    expect(events.map((e) => e.seq)).toEqual([0, 1, 2]);
  });
});
