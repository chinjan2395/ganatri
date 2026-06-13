import { describe, expect, it } from 'vitest';
import { type Card, cardId } from '../src/cards';
import { applyMove, createGame, legalMoves } from '../src/game';
import type { GameState, PlayerId } from '../src/types';

/** All Part 1 card locations flattened, for conservation checks. */
function allPart1Cards(state: GameState): Card[] {
  const part1 = state.part1!;
  const cards: Card[] = [...part1.stock, ...part1.table];
  for (const p of state.seating) {
    cards.push(...(part1.hands[p] ?? []));
    cards.push(...(part1.capturePiles[p] ?? []));
  }
  return cards;
}

/** All Part 2 card locations flattened (hands + current trick), for conservation ≤ 52. */
function allPart2Cards(state: GameState): Card[] {
  const part2 = state.part2!;
  const cards: Card[] = [];
  for (const p of state.seating) {
    cards.push(...(part2.hands[p] ?? []));
  }
  for (const tp of part2.trick) {
    cards.push(tp.card);
  }
  return cards;
}

describe('smoke — full seeded Part 1 playthrough', () => {
  it.each(['smoke-seed-1', 'smoke-seed-2', 12345])('seed %s: plays to PART_2/GAME_OVER with invariants', (seed) => {
    let state = createGame(['alice', 'bob'], seed);
    let guard = 0;
    while (state.phase === 'PART_1') {
      expect(++guard).toBeLessThan(200);
      // Conservation: hands + stock + table + piles = 52 unique cards.
      const cards = allPart1Cards(state);
      expect(cards).toHaveLength(52);
      expect(new Set(cards.map(cardId)).size).toBe(52);

      const turn = state.turn!;
      const moves = legalMoves(state, turn);
      expect(moves.length).toBeGreaterThan(0);
      // Deterministic policy: prefer the first capturing move, else first move.
      const move = moves.find((m) => m.type === 'PLAY_CAPTURE' && m.capture.length > 0) ?? moves[0]!;
      const res = applyMove(state, turn, move);
      if (!res.ok) throw new Error(`move rejected: ${res.error}`);
      state = res.state;
    }
    expect(['PART_2', 'GAME_OVER']).toContain(state.phase);
    expect(state.part1).toBeNull();
    const part2 = state.part2!;
    // Someone captured during a 2-player game with this many plays; all 52
    // cards must land in Part 2 hands via piles + sweep.
    const total = state.seating.reduce((n, p) => n + (part2.hands[p]?.length ?? 0), 0);
    expect(total).toBe(52);
    if (state.phase === 'PART_2') {
      expect(state.turn).not.toBeNull();
      expect(part2.hands[state.turn!]!.length).toBeGreaterThan(0);
    } else {
      expect(state.rankings).not.toBeNull();
    }
  });

  it('replaying the same seed with the same policy yields identical final state', () => {
    const run = (): GameState => {
      let state = createGame(['alice', 'bob', 'carol'], 'replay');
      while (state.phase === 'PART_1') {
        const res = applyMove(state, state.turn!, legalMoves(state, state.turn!)[0]!);
        if (!res.ok) throw new Error(res.error);
        state = res.state;
      }
      return state;
    };
    expect(run()).toEqual(run());
  });
});

// ---------------------------------------------------------------------------
// Full game smoke tests (Part 1 → Part 2 → GAME_OVER)
// ---------------------------------------------------------------------------

describe('smoke — full game from createGame to GAME_OVER', () => {
  /**
   * Play a complete game (Part 1 + Part 2) using legalMoves, picking the
   * first legal move each turn. Asserts:
   * - Terminates within `maxMoves` moves.
   * - Part 2 card conservation: hands + trick ≤ 52 at all times.
   * - Final state is GAME_OVER with a valid rankings array.
   */
  function playFullGame(players: readonly PlayerId[], seed: number | string, maxMoves = 10_000): GameState {
    let state = createGame([...players], seed);
    let moveCount = 0;

    while (state.phase !== 'GAME_OVER') {
      if (++moveCount > maxMoves) {
        throw new Error(
          `Game did not terminate within ${maxMoves} moves ` +
          `(phase=${state.phase}, turn=${state.turn}, ` +
          `safeOrder=${JSON.stringify(state.part2?.safeOrder)})`,
        );
      }

      if (state.phase === 'PART_2') {
        // Card conservation: all cards in Part 2 must be ≤ 52.
        const cards = allPart2Cards(state);
        if (cards.length > 52) {
          throw new Error(`Card conservation violated: ${cards.length} cards in play`);
        }
        // No duplicates.
        const ids = cards.map(cardId);
        if (new Set(ids).size !== ids.length) {
          throw new Error(`Duplicate cards in Part 2: ${ids.join(', ')}`);
        }
      }

      const turn = state.turn!;
      const moves = legalMoves(state, turn);
      if (moves.length === 0) {
        throw new Error(`No legal moves for ${turn} in phase ${state.phase}`);
      }
      const move = moves[0]!;
      const res = applyMove(state, turn, move);
      if (!res.ok) {
        throw new Error(`Move rejected: ${res.error} — ${res.message}`);
      }
      state = res.state;
    }

    return state;
  }

  it.each([
    ['alice', 'bob'],
    ['p1', 'p2'],
  ] as [string, string][])(
    '2-player full game (seed "smoke-2p"): terminates, valid rankings',
    (p1, p2) => {
      const state = playFullGame([p1, p2], 'smoke-2p');
      expect(state.phase).toBe('GAME_OVER');
      expect(state.rankings).not.toBeNull();
      // Rankings must be a non-empty subset of players (in this game all 2 should appear).
      const players = [p1, p2];
      for (const r of state.rankings!) {
        expect(players).toContain(r);
      }
    },
  );

  it.each(['seed-4p-1', 'seed-4p-2', 999])(
    '4-player full game (seed %s): terminates within 10000 moves, valid rankings',
    (seed) => {
      const players = ['alice', 'bob', 'carol', 'dave'];
      const state = playFullGame(players, seed);
      expect(state.phase).toBe('GAME_OVER');
      expect(state.rankings).not.toBeNull();
      for (const r of state.rankings!) {
        expect(players).toContain(r);
      }
    },
  );

  it('3-player full game terminates correctly', () => {
    const players = ['x', 'y', 'z'];
    const state = playFullGame(players, 'smoke-3p');
    expect(state.phase).toBe('GAME_OVER');
    expect(state.rankings).not.toBeNull();
    for (const r of state.rankings!) {
      expect(players).toContain(r);
    }
  });

  it('multiple seeds produce identical replays', () => {
    const runFull = (seed: number | string): GameState => {
      let state = createGame(['a', 'b', 'c'], seed);
      while (state.phase !== 'GAME_OVER') {
        const moves = legalMoves(state, state.turn!);
        const res = applyMove(state, state.turn!, moves[0]!);
        if (!res.ok) throw new Error(res.error);
        state = res.state;
      }
      return state;
    };
    expect(runFull('replay-full')).toEqual(runFull('replay-full'));
    expect(runFull(42)).toEqual(runFull(42));
  });
});
