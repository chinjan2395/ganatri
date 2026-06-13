import { describe, expect, it } from 'vitest';
import { cardId } from '../src/cards';
import { viewFor } from '../src/view';
import { p1, p2, sortedIds } from './helpers';

describe('viewFor — redaction', () => {
  const state = p1({
    hands: { a: '7S 2H', b: '3H 4D 9C' },
    table: 'KD',
    stock: 'QC JH 5S',
    capturePiles: { a: '6D 6H', b: '' },
    lastCapturer: 'a',
  });

  it('shows your own hand only', () => {
    const view = viewFor(state, 'a');
    expect(sortedIds(view.hand)).toEqual(['2H', '7S']);
    expect(viewFor(state, 'b').hand.map(cardId).sort()).toEqual(['3H', '4D', '9C']);
  });

  it('opponents, stock, and capture piles appear as counts only', () => {
    const view = viewFor(state, 'a');
    expect(view.handCounts).toEqual({ a: 2, b: 3 });
    expect(view.stockCount).toBe(3);
    expect(view.captureCounts).toEqual({ a: 2, b: 0 });
    expect(sortedIds(view.table)).toEqual(['KD']);
  });

  it('serialized view leaks no hidden card ids', () => {
    const json = JSON.stringify(viewFor(state, 'a'));
    for (const hidden of ['3H', '4D', '9C', 'QC', 'JH', '5S', '6D', '6H']) {
      expect(json).not.toContain(`"${hidden.slice(0, -1)}","suit":"${hidden.slice(-1)}"`);
    }
    // Stronger: rebuild every card object string present and compare to allowed set.
    expect(json).toContain('"rank":"7","suit":"S"'); // own hand visible
    expect(json).toContain('"rank":"K","suit":"D"'); // table visible
    expect(json).not.toContain('"rank":"Q"'); // stock hidden
    expect(json).not.toContain('"rank":"3"'); // opponent hand hidden
    expect(json).not.toContain('"rank":"6"'); // capture piles hidden
  });

  it('Part 2 view: hand from part2.hands, part1 fields zeroed', () => {
    const state2 = p2({ a: '2S AH', b: '3H' });
    const view = viewFor(state2, 'a');
    expect(sortedIds(view.hand)).toEqual(['2S', 'AH']);
    expect(view.handCounts).toEqual({ a: 2, b: 1 });
    expect(view.table).toEqual([]);
    expect(view.stockCount).toBe(0);
    expect(view.trick).toEqual([]);
    expect(view.ledSuit).toBeNull();
    expect(view.safeOrder).toEqual([]);
    expect(view.rankings).toBeNull();
  });

  it('carries phase/turn/seating/you', () => {
    const view = viewFor(state, 'b');
    expect(view.you).toBe('b');
    expect(view.phase).toBe('PART_1');
    expect(view.turn).toBe('a');
    expect(view.seating).toEqual(['a', 'b']);
  });
});
