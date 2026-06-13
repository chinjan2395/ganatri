import { describe, expect, it } from 'vitest';
import { applyMove, legalMoves, legalPart2Cards } from '../src/game';
import { p1, p2 } from './helpers';

describe('legalMoves', () => {
  it('enumerates every hand card with each legal capture set (or [] when none)', () => {
    const state = p1({ hands: { a: '7S KH 2C', b: '9H' }, table: '3H 4D KS' });
    const moves = legalMoves(state, 'a');
    expect(moves).toHaveLength(3);
    expect(moves).toContainEqual({ type: 'PLAY_CAPTURE', card: '7S', capture: ['3H', '4D'] });
    expect(moves).toContainEqual({ type: 'PLAY_CAPTURE', card: 'KH', capture: ['KS'] });
    expect(moves).toContainEqual({ type: 'PLAY_CAPTURE', card: '2C', capture: [] });
  });

  it('lists multiple options for the same card when the player has a choice', () => {
    const state = p1({ hands: { a: '6H', b: '3H' }, table: 'AS 2C 3D 4H' });
    const moves = legalMoves(state, 'a');
    expect(moves).toHaveLength(2); // {2,4} or {A,2,3}
    for (const m of moves) expect(m.card).toBe('6H');
  });

  it('returns [] when it is not your turn', () => {
    const state = p1({ hands: { a: '7S', b: '3H' }, turn: 'a' });
    expect(legalMoves(state, 'b')).toEqual([]);
  });

  it('every enumerated move is accepted by applyMove', () => {
    const state = p1({ hands: { a: '7S KH 2C 6H', b: '9H' }, table: '3H 4D KS AS 2D' });
    for (const move of legalMoves(state, 'a')) {
      expect(applyMove(state, 'a', move)).toMatchObject({ ok: true });
    }
  });

  it('Part 2: legalMoves enumerates PLAY_TRICK moves from legalPart2Cards', () => {
    const state = p2({ a: '2S 3H', b: '4D' });
    const moves = legalMoves(state, 'a');
    expect(moves).toHaveLength(2);
    expect(moves).toContainEqual({ type: 'PLAY_TRICK', card: '2S' });
    expect(moves).toContainEqual({ type: 'PLAY_TRICK', card: '3H' });
    expect(legalPart2Cards(state, 'a')).toEqual(expect.arrayContaining(['2S', '3H']));
  });
});
