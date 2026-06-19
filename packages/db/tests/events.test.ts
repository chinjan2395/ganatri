import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { GameEvent } from '@ganatri/engine';
import {
  createTestDb,
  seedGame,
  seedRoom,
  seedUser,
  uuid,
  type TestDb,
} from './helpers/pglite';
import { mapEvent } from '../src/persistence/mappers';

describe('game_events (pg)', () => {
  let t: TestDb;
  let gameId: string;
  let userId: string;
  beforeEach(async () => {
    t = await createTestDb();
    userId = await seedUser(t);
    const roomId = await seedRoom(t, userId);
    gameId = await seedGame(t, roomId);
  });
  afterEach(async () => {
    await t.close();
  });

  it('appends a single event and reads it back', async () => {
    const row = await t.repo.appendGameEvent({
      gameId,
      seq: 0,
      eventType: 'CARD_PLAYED',
      payload: { type: 'CARD_PLAYED', player: 'p1', card: { rank: 'A', suit: 'S' } },
    });
    expect(row.seq).toBe(0);
    const loaded = await t.repo.loadGameEvents(gameId);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.eventType).toBe('CARD_PLAYED');
  });

  it('appends a batch atomically and preserves ordering', async () => {
    await t.repo.appendGameEvents([
      { gameId, seq: 0, eventType: 'CARD_PLAYED', payload: { a: 0 } },
      { gameId, seq: 1, eventType: 'CARD_DRAWN', payload: { a: 1 } },
      { gameId, seq: 2, eventType: 'PART1_ENDED', payload: { a: 2 } },
    ]);
    const loaded = await t.repo.loadGameEvents(gameId);
    expect(loaded.map((e) => e.seq)).toEqual([0, 1, 2]);
    expect(loaded.map((e) => e.eventType)).toEqual([
      'CARD_PLAYED',
      'CARD_DRAWN',
      'PART1_ENDED',
    ]);
  });

  it('enforces (game_id, seq) uniqueness', async () => {
    await t.repo.appendGameEvent({ gameId, seq: 0, eventType: 'CUT', payload: {} });
    await expect(
      t.repo.appendGameEvent({ gameId, seq: 0, eventType: 'CUT', payload: {} })
    ).rejects.toThrow();
  });

  it('rejects a duplicate seq inside a batch (transactional rollback)', async () => {
    await expect(
      t.repo.appendGameEvents([
        { gameId, seq: 5, eventType: 'CUT', payload: {} },
        { gameId, seq: 5, eventType: 'CUT', payload: {} },
      ])
    ).rejects.toThrow();
    const loaded = await t.repo.loadGameEvents(gameId);
    expect(loaded).toHaveLength(0);
  });

  it('enforces FK on game_id', async () => {
    await expect(
      t.repo.appendGameEvent({ gameId: uuid(), seq: 0, eventType: 'CUT', payload: {} })
    ).rejects.toThrow();
  });

  it('round-trips a real engine CUT event payload', async () => {
    const cut: GameEvent = {
      type: 'CUT',
      cutter: 'p1',
      pickerUpper: 'p2',
      pickedUp: [
        { rank: 'K', suit: 'H' },
        { rank: '7', suit: 'C' },
      ],
    };
    // Resolve the engine player to a durable user id (uuid FK column).
    const mapped = mapEvent(cut, { userIdOf: () => userId });
    expect(mapped.eventType).toBe('CUT');
    expect(mapped.actorUserId).toBe(userId);
    await t.repo.appendGameEvent({ gameId, seq: 0, ...mapped });
    const loaded = await t.repo.loadGameEvents(gameId);
    expect(loaded[0]!.payload).toEqual(cut);
  });

  it('round-trips a real engine GAME_OVER event payload', async () => {
    const over: GameEvent = {
      type: 'GAME_OVER',
      rankings: ['p2', 'p1', 'p3'],
    };
    const mapped = mapEvent(over, { userIdOf: () => userId });
    expect(mapped.eventType).toBe('GAME_OVER');
    expect(mapped.actorUserId).toBe(userId);
    await t.repo.appendGameEvent({ gameId, seq: 0, ...mapped });
    const loaded = await t.repo.loadGameEvents(gameId);
    expect(loaded[0]!.payload).toEqual(over);
  });

  it('appendGameEvents([]) is a no-op', async () => {
    const res = await t.repo.appendGameEvents([]);
    expect(res).toEqual([]);
  });
});
