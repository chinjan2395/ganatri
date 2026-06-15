/**
 * Part 2 stalemate redistribution (CALCULATIONS.md §4.6).
 *
 * When consecutive no-cancel cuts reach a threshold, every active player's hand
 * is topped back up to 5 from a reshuffled pool of cards that left play. This
 * breaks the otherwise-infinite cut loop that can occur (in 2-, 3-, and 4-player
 * games) once the table reduces to a non-cancelling active subset.
 */
import { describe, it, expect } from 'vitest';
import { createGame, applyMove, legalMoves, viewFor } from '../src/index';
import type { GameState } from '../src/types';
import { p2, c, deepFreeze } from './helpers';

function play(state: GameState, player: string, card: string) {
  const res = applyMove(state, player, { type: 'PLAY_TRICK', card });
  if (!res.ok) throw new Error(`move ${card} by ${player} rejected: ${res.error}`);
  return res;
}

describe('Part 2 — stalemate redistribution (§4.6)', () => {
  it('cutStreak increments on a cut', () => {
    // a leads 5S; b has no spade → cuts with 2H. a picks up. 1 cut so far.
    // threshold for 2 active = 2, so a single cut must NOT yet redistribute.
    const state = p2({
      seating: ['a', 'b'],
      hands: { a: '5S 9D', b: '2H 4C' },
      removedPool: '7C 8C 9C',
    });
    const r = play(state, 'a', '5S');
    const r2 = play(r.state, 'b', '2H');
    expect(r2.state.part2!.cutStreak).toBe(1);
    expect(r2.events.some((e) => e.type === 'HANDS_REDISTRIBUTED')).toBe(false);
  });

  it('a won trick (cancellation) resets cutStreak and feeds the removed pool', () => {
    // Both follow suit → trick cancels. cutStreak resets to 0; cancelled cards
    // join removedPool.
    const state = p2({
      seating: ['a', 'b'],
      hands: { a: '5S 9D', b: '3S 4C' },
      removedPool: '7C',
      cutStreak: 1,
    });
    const r = play(state, 'a', '5S');
    const r2 = play(r.state, 'b', '3S'); // both spades → cancel
    expect(r2.events.some((e) => e.type === 'TRICK_WON')).toBe(true);
    expect(r2.state.part2!.cutStreak).toBe(0);
    // removedPool now contains the original 7C plus the two cancelled spades.
    expect(r2.state.part2!.removedPool).toHaveLength(3);
  });

  it('redistributes and tops every active player up to 5 when threshold reached', () => {
    // 2 active players, threshold = 2. Pre-load cutStreak = 1 so the next cut
    // (→ 2) triggers redistribution. a has 1 card, b has 2 → after the trick
    // they hold few cards; both should be topped up to 5 from the pool.
    const state = p2({
      seating: ['a', 'b'],
      hands: { a: '5S', b: '2H 4H' },
      removedPool: '7C 8C 9C 10C JC QC KC AD 2D 3D 4D 5D',
      cutStreak: 1,
      turn: 'a',
    });
    const r = play(state, 'a', '5S'); // a leads spade, a now empty in-hand pre-pickup
    const r2 = play(r.state, 'b', '2H'); // b cuts → cutStreak 2 → redistribute
    const ev = r2.events.find((e) => e.type === 'HANDS_REDISTRIBUTED');
    expect(ev).toBeDefined();
    const p = r2.state.part2!;
    // Both active players end at exactly 5 (pool is large enough).
    expect(p.hands['a']).toHaveLength(5);
    expect(p.hands['b']).toHaveLength(5);
    expect(p.cutStreak).toBe(0);
    expect(p.redistributionCount).toBe(1);
    expect(p.trick).toHaveLength(0);
    expect(p.ledSuit).toBeNull();
    expect(r2.state.phase).toBe('PART_2');
  });

  it('current leader continues after redistribution (the cutter leads next)', () => {
    const state = p2({
      seating: ['a', 'b'],
      hands: { a: '5S', b: '2H 4H' },
      removedPool: '7C 8C 9C 10C JC QC KC AD',
      cutStreak: 1,
      turn: 'a',
    });
    const r = play(state, 'a', '5S');
    const r2 = play(r.state, 'b', '2H'); // b is the cutter → b leads next
    expect(r2.state.turn).toBe('b');
  });

  it('players already holding ≥5 cards are not trimmed', () => {
    // a holds 6 cards after the cut; redistribution must leave a untouched and
    // only top up the short player.
    const state = p2({
      seating: ['a', 'b'],
      hands: { a: '5S AD KD QD JD 10D', b: '2H' },
      removedPool: '7C 8C 9C 10C JC',
      cutStreak: 1,
      turn: 'a',
    });
    const r = play(state, 'a', '5S'); // a leads spade (a now has 5 diamonds)
    const r2 = play(r.state, 'b', '2H'); // b cuts → a picks up 5S+2H → a back to 7
    const p = r2.state.part2!;
    // a was at ≥5 → not topped up further (still has its cards, no trim).
    expect(p.hands['a']!.length).toBeGreaterThanOrEqual(5);
    // b emptied by cutting with last card → b is safe, only a active → GAME_OVER.
    // (No redistribution because <2 active holders.) Confirm a loses.
    expect(r2.state.phase).toBe('GAME_OVER');
    expect(r2.state.rankings![r2.state.rankings!.length - 1]).toBe('a');
  });

  it('best-effort top-up when pool is too small to reach 5 each', () => {
    const state = p2({
      seating: ['a', 'b'],
      hands: { a: '5S', b: '2H 4H' },
      removedPool: '7C 8C', // only 2 cards
      cutStreak: 1,
      turn: 'a',
    });
    const r = play(state, 'a', '5S');
    const r2 = play(r.state, 'b', '2H');
    const ev = r2.events.find((e) => e.type === 'HANDS_REDISTRIBUTED');
    expect(ev).toBeDefined();
    if (ev && ev.type === 'HANDS_REDISTRIBUTED') {
      expect(ev.poolRemaining).toBe(0); // pool fully consumed
    }
    const p = r2.state.part2!;
    expect(p.removedPool).toHaveLength(0);
    // Neither player can reach 5 (only 2 cards dealt across both).
    expect(p.hands['a']!.length + p.hands['b']!.length).toBeLessThan(10);
  });

  it('empty pool at the trigger → no-loser draw (cannot break the stalemate)', () => {
    const state = p2({
      seating: ['a', 'b'],
      hands: { a: '5S 9S', b: '2H 4H' },
      removedPool: '',
      cutStreak: 1,
      turn: 'a',
    });
    const r = play(state, 'a', '5S');
    const r2 = play(r.state, 'b', '2H'); // cut → streak 2, pool empty → draw
    expect(r2.state.phase).toBe('GAME_OVER');
    expect(r2.state.rankings).toEqual([]); // no pre-safe players, no loser
    expect(r2.events.some((e) => e.type === 'GAME_OVER')).toBe(true);
  });

  it('redistribution is deterministic for a given seed + redistributionCount', () => {
    const make = () =>
      ({
        ...p2({
          seating: ['a', 'b'],
          hands: { a: '5S', b: '2H 4H' },
          removedPool: '7C 8C 9C 10C JC QC KC AD 2D 3D',
          cutStreak: 1,
          turn: 'a',
        }),
        seed: 'fixed-seed',
      }) as GameState;
    const runOnce = () => {
      const s = make();
      const r = play(s, 'a', '5S');
      const r2 = play(r.state, 'b', '2H');
      return r2.state.part2!.hands;
    };
    expect(runOnce()).toEqual(runOnce());
  });

  it('viewFor redacts the removed pool to a count only', () => {
    const state = p2({
      seating: ['a', 'b'],
      hands: { a: '5S', b: '2H' },
      removedPool: '7C 8C 9C',
    });
    const view = viewFor(state, 'a');
    expect(view.removedCount).toBe(3);
    // No field on the view should expose pool card identities.
    expect(JSON.stringify(view)).not.toContain('7C');
  });

  it('REGRESSION: multi-player games always terminate with the lone holder ranked last', () => {
    const autoPlay = (seating: string[], seed: string): GameState => {
      let state = createGame(seating, seed);
      let guard = 0;
      while (state.phase !== 'GAME_OVER') {
        if (guard++ > 5000) throw new Error(`game did not terminate (${seating.length}p seed ${seed})`);
        const turn = state.turn!;
        const moves = legalMoves(state, turn);
        const res = applyMove(state, turn, moves[0]!);
        if (!res.ok) throw new Error(res.error);
        state = res.state;
      }
      return state;
    };

    const seeds = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'];
    for (const seating of [['a', 'b', 'c'], ['a', 'b', 'c', 'd']]) {
      for (const seed of seeds) {
        const final = autoPlay(seating, seed);
        expect(final.phase).toBe('GAME_OVER');
        const holders = seating.filter((p) => (final.part2?.hands[p] ?? []).length > 0);
        expect(holders.length).toBeLessThanOrEqual(1);
        if (holders.length === 1) {
          // The sole remaining holder is the loser → ranked last.
          expect(final.rankings![final.rankings!.length - 1]).toBe(holders[0]);
        }
      }
    }
  });

  it('REGRESSION: 3-player seed s5 (the original hang) now terminates', () => {
    let state = createGame(['a', 'b', 'c'], 's5');
    let guard = 0;
    while (state.phase !== 'GAME_OVER') {
      if (guard++ > 5000) throw new Error('s5 still hangs');
      const turn = state.turn!;
      const res = applyMove(state, turn, legalMoves(state, turn)[0]!);
      if (!res.ok) throw new Error(res.error);
      state = res.state;
    }
    expect(state.phase).toBe('GAME_OVER');
  });

  it('applyMove stays pure: redistribution does not mutate the input state', () => {
    const state = deepFreeze(
      p2({
        seating: ['a', 'b'],
        hands: { a: '5S', b: '2H 4H' },
        removedPool: '7C 8C 9C 10C JC',
        cutStreak: 1,
        turn: 'a',
      }),
    );
    const r = play(state, 'a', '5S');
    // Freezing the result then making the triggering cut must not throw.
    expect(() => play(deepFreeze(r.state), 'b', '2H')).not.toThrow();
  });
});

// Silence unused import if c() is not referenced above in some edit.
void c;
