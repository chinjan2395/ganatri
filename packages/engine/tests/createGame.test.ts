import { describe, expect, it } from 'vitest';
import { cardId } from '../src/cards';
import { createGame } from '../src/game';

describe('createGame', () => {
  it.each([
    [2, 42],
    [3, 37],
    [4, 32],
  ])('deals 5 cards each to %i players, stock = %i, all 52 unique', (n, stockSize) => {
    const seating = ['p1', 'p2', 'p3', 'p4'].slice(0, n);
    const state = createGame(seating, 'seed');
    expect(state.phase).toBe('PART_1');
    expect(state.part2).toBeNull();
    expect(state.rankings).toBeNull();
    const part1 = state.part1!;
    const all: string[] = [];
    for (const p of seating) {
      expect(part1.hands[p]).toHaveLength(5);
      all.push(...part1.hands[p]!.map(cardId));
    }
    expect(part1.stock).toHaveLength(stockSize);
    expect(part1.table).toHaveLength(0);
    all.push(...part1.stock.map(cardId));
    expect(all).toHaveLength(52);
    expect(new Set(all).size).toBe(52);
    for (const p of seating) expect(part1.capturePiles[p]).toEqual([]);
    expect(part1.lastCapturer).toBeNull();
  });

  it('turn and firstPlayer match and are a seated player', () => {
    const state = createGame(['a', 'b', 'c'], 7);
    expect(state.turn).toBe(state.firstPlayer);
    expect(state.seating).toContain(state.firstPlayer);
  });

  it('same seed → identical game; different seed → different game', () => {
    const a = createGame(['a', 'b', 'c'], 'alpha');
    const b = createGame(['a', 'b', 'c'], 'alpha');
    expect(a).toEqual(b);
    const c = createGame(['a', 'b', 'c'], 'beta');
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it('numeric and string seeds are both deterministic', () => {
    expect(createGame(['a', 'b'], 123)).toEqual(createGame(['a', 'b'], 123));
  });

  it('rejects fewer than 2, more than 4, or duplicate players', () => {
    expect(() => createGame(['solo'], 1)).toThrow();
    expect(() => createGame(['a', 'b', 'c', 'd', 'e'], 1)).toThrow();
    expect(() => createGame(['a', 'a'], 1)).toThrow();
  });
});
