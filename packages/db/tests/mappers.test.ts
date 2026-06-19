import { describe, it, expect } from 'vitest';
import type {
  Card,
  GameEvent,
  GameState,
  Part1State,
  Part2State,
} from '@ganatri/engine';
import {
  actorOfEvent,
  captureCountFor,
  mapCaptureCounts,
  mapEvent,
  mapFinalPlayers,
  mapRankings,
  mapSafeOrder,
  mapSeating,
  mapWinner,
  tallyCuts,
} from '../src/persistence/mappers';

const C = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

function part1(piles: Record<string, Card[]>): Part1State {
  return {
    hands: {},
    stock: [],
    table: [],
    capturePiles: piles,
    lastCapturer: null,
  };
}

function part2(safeOrder: string[]): Part2State {
  return {
    hands: {},
    trick: [],
    ledSuit: null,
    safeOrder,
    removedPool: [],
    cutStreak: 0,
    redistributionCount: 0,
  };
}

describe('mapSeating', () => {
  it('maps seating to seating order + count', () => {
    expect(mapSeating(['a', 'b', 'c'])).toEqual({
      seatingOrder: ['a', 'b', 'c'],
      playerCount: 3,
    });
  });
});

describe('mapRankings / mapWinner', () => {
  it('produces 1-based ranks, winner = 1', () => {
    expect(mapRankings(['x', 'y', 'z'])).toEqual({ x: 1, y: 2, z: 3 });
    expect(mapWinner(['x', 'y', 'z'])).toBe('x');
  });
  it('handles null rankings', () => {
    expect(mapRankings(null)).toEqual({});
    expect(mapWinner(null)).toBeNull();
  });
});

describe('capture counts', () => {
  it('captureCountFor reads pile length', () => {
    const p1 = part1({ a: [C('A', 'S'), C('2', 'H')], b: [] });
    expect(captureCountFor(p1, 'a')).toBe(2);
    expect(captureCountFor(p1, 'b')).toBe(0);
    expect(captureCountFor(p1, 'missing')).toBe(0);
    expect(captureCountFor(null, 'a')).toBe(0);
  });
  it('mapCaptureCounts maps all piles', () => {
    const p1 = part1({ a: [C('A', 'S')], b: [C('2', 'H'), C('3', 'H')] });
    expect(mapCaptureCounts(p1)).toEqual({ a: 1, b: 2 });
  });
});

describe('tallyCuts', () => {
  it('counts cuts given/received and was-cut set from CUT events', () => {
    const events: GameEvent[] = [
      { type: 'CUT', cutter: 'a', pickerUpper: 'b', pickedUp: [C('K', 'H')] },
      { type: 'CUT', cutter: 'a', pickerUpper: 'c', pickedUp: [C('Q', 'D')] },
      { type: 'TRICK_WON', winner: 'a', cancelled: [] },
    ];
    const t = tallyCuts(events);
    expect(t.cutsGiven).toEqual({ a: 2 });
    expect(t.cutsReceived).toEqual({ b: 1, c: 1 });
    expect(t.wasCut.has('b')).toBe(true);
    expect(t.wasCut.has('c')).toBe(true);
    expect(t.wasCut.has('a')).toBe(false);
  });
});

describe('mapSafeOrder', () => {
  it('returns safe order copy', () => {
    expect(mapSafeOrder(part2(['a', 'b']))).toEqual(['a', 'b']);
    expect(mapSafeOrder(null)).toEqual([]);
  });
});

describe('actorOfEvent', () => {
  it('resolves the actor for each event type', () => {
    expect(actorOfEvent({ type: 'CARD_PLAYED', player: 'p', card: C('A', 'S') })).toBe('p');
    expect(actorOfEvent({ type: 'CAPTURED', player: 'p', cards: [] })).toBe('p');
    expect(actorOfEvent({ type: 'CARD_DRAWN', player: 'p' })).toBe('p');
    expect(actorOfEvent({ type: 'PLAYER_SAFE', player: 'p' })).toBe('p');
    expect(actorOfEvent({ type: 'CUT', cutter: 'c', pickerUpper: 'u', pickedUp: [] })).toBe('c');
    expect(actorOfEvent({ type: 'TRICK_WON', winner: 'w', cancelled: [] })).toBe('w');
    expect(actorOfEvent({ type: 'PART1_ENDED', sweeper: 's', swept: [] })).toBe('s');
    expect(actorOfEvent({ type: 'PART1_ENDED', sweeper: null, swept: [] })).toBeNull();
    expect(actorOfEvent({ type: 'GAME_OVER', rankings: ['x', 'y'] })).toBe('x');
    expect(
      actorOfEvent({ type: 'HANDS_REDISTRIBUTED', dealt: {}, poolRemaining: 0 })
    ).toBeNull();
  });
});

describe('mapEvent', () => {
  it('maps type, payload, and actor (with optional user map)', () => {
    const ev: GameEvent = { type: 'CUT', cutter: 'p1', pickerUpper: 'p2', pickedUp: [] };
    const plain = mapEvent(ev);
    expect(plain.eventType).toBe('CUT');
    expect(plain.payload).toEqual(ev);
    expect(plain.actorUserId).toBe('p1');

    const mapped = mapEvent(ev, { userIdOf: (p) => (p === 'p1' ? 'user-1' : null) });
    expect(mapped.actorUserId).toBe('user-1');
  });
});

describe('mapFinalPlayers', () => {
  const baseState: GameState = {
    phase: 'GAME_OVER',
    seating: ['a', 'b', 'c'],
    firstPlayer: 'a',
    turn: null,
    part1: part1({ a: [C('A', 'S'), C('2', 'H')], b: [C('3', 'H')], c: [] }),
    part2: part2(['b', 'a']),
    rankings: ['b', 'a', 'c'],
    seed: 'xyz',
  };

  it('builds per-player rows with rank, captures, was_cut, result', () => {
    const events: GameEvent[] = [
      { type: 'CUT', cutter: 'a', pickerUpper: 'c', pickedUp: [] },
    ];
    const rows = mapFinalPlayers({
      state: baseState,
      events,
      userIdOf: (p) => `user-${p}`,
      displayNameOf: (p) => p.toUpperCase(),
    });
    expect(rows.map((r) => r.seatIndex)).toEqual([0, 1, 2]);
    const byPlayer = Object.fromEntries(rows.map((r) => [r.displayName, r]));
    expect(byPlayer.A!.finalRank).toBe(2);
    expect(byPlayer.A!.result).toBe('LOSS');
    expect(byPlayer.A!.captureCount).toBe(2);
    expect(byPlayer.A!.userId).toBe('user-a');
    expect(byPlayer.B!.finalRank).toBe(1);
    expect(byPlayer.B!.result).toBe('WIN');
    expect(byPlayer.C!.wasCut).toBe(true);
    expect(byPlayer.C!.captureCount).toBe(0);
  });

  it('marks all players ABANDONED when isAbandoned', () => {
    const rows = mapFinalPlayers({ state: baseState, events: [], isAbandoned: true });
    expect(rows.every((r) => r.result === 'ABANDONED')).toBe(true);
  });

  it('defaults userId/displayName when no mappers given', () => {
    const rows = mapFinalPlayers({ state: baseState, events: [] });
    expect(rows[0]!.userId).toBeNull();
    expect(rows[0]!.displayName).toBe('a');
  });
});
