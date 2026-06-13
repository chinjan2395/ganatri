import { describe, expect, it } from 'vitest';
import { buildDeck, cardId, parseCardId, summationValue } from '../src/cards';

describe('cards', () => {
  it('builds a 52-card deck with unique ids', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map(cardId)).size).toBe(52);
  });

  it('cardId round-trips through parseCardId, including 10', () => {
    for (const card of buildDeck()) {
      expect(parseCardId(cardId(card))).toEqual(card);
    }
    expect(cardId({ rank: '10', suit: 'H' })).toBe('10H');
    expect(parseCardId('10H')).toEqual({ rank: '10', suit: 'H' });
  });

  it('parseCardId throws on malformed ids', () => {
    expect(() => parseCardId('1H')).toThrow();
    expect(() => parseCardId('AX')).toThrow();
    expect(() => parseCardId('')).toThrow();
  });

  it('summationValue: A=1, numbers at face value, J/Q/K null', () => {
    expect(summationValue({ rank: 'A', suit: 'S' })).toBe(1);
    expect(summationValue({ rank: '2', suit: 'S' })).toBe(2);
    expect(summationValue({ rank: '10', suit: 'S' })).toBe(10);
    expect(summationValue({ rank: 'J', suit: 'S' })).toBeNull();
    expect(summationValue({ rank: 'Q', suit: 'S' })).toBeNull();
    expect(summationValue({ rank: 'K', suit: 'S' })).toBeNull();
  });
});
