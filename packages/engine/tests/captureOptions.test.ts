import { describe, expect, it } from 'vitest';
import { captureOptions } from '../src/game';
import { asSets, p1 } from './helpers';

/** Build a one-player PART_1 state with the given table; hand is irrelevant here. */
function tableState(table: string) {
  return p1({ hands: { a: '', b: '' }, table });
}

describe('captureOptions — doc examples (§3, adjusted by §7 clarifications)', () => {
  const state = tableState('2S 5H 6D 8C 9S');

  it('table 2,5,6,8,9: play 7 → {2,5}', () => {
    expect(asSets(captureOptions(state, '7H'))).toEqual(['2S 5H']);
  });

  it('table 2,5,6,8,9: play 8 → {2,6} plus the mandatory same-rank 8 (Clarification 2)', () => {
    // §3's bare "plays 8 → captures 2+6" example predates Clarification 2,
    // which makes the table 8 mandatory in the same move.
    expect(asSets(captureOptions(state, '8H'))).toEqual(['2S 6D 8C']);
  });

  it('table 2,5,6,8,9: play 10 → {2,8}', () => {
    expect(asSets(captureOptions(state, '10H'))).toEqual(['2S 8C']);
  });

  it('table A,2,3,5,6,7,10: play 6 → {A,2,3}+6 or {A,5}+6 (same-rank 6 forced)', () => {
    const s = tableState('AS 2H 3D 5C 6S 7H 10D');
    expect(asSets(captureOptions(s, '6H'))).toEqual(['2H 3D 6S AS', '5C 6S AS']);
  });
});

describe('captureOptions — same-rank rules', () => {
  it('same-rank capture is forced alongside the combination', () => {
    const s = tableState('7H 3H 4D');
    expect(asSets(captureOptions(s, '7S'))).toEqual(['3H 4D 7H']);
  });

  it('ALL same-rank table cards are taken, not just one', () => {
    const s = tableState('9H 9D 4S 5C');
    expect(asSets(captureOptions(s, '9C'))).toEqual(['4S 5C 9D 9H']);
  });

  it('a single table card equal to the played value is same-rank, never a combination', () => {
    expect(asSets(captureOptions(tableState('5H'), '5S'))).toEqual(['5H']);
    expect(asSets(captureOptions(tableState('5H 2D 3C'), '5S'))).toEqual(['2D 3C 5H']);
  });

  it('same-rank only (no combinations available)', () => {
    const s = tableState('8H 9D KS');
    expect(asSets(captureOptions(s, '8C'))).toEqual(['8H']);
  });
});

describe('captureOptions — A/J/Q/K behavior', () => {
  it('played K captures only a table K', () => {
    expect(asSets(captureOptions(tableState('KS 5C 8D'), 'KH'))).toEqual(['KS']);
    expect(captureOptions(tableState('5C 8D'), 'KH')).toEqual([]);
  });

  it('played Q/J capture only same rank', () => {
    expect(asSets(captureOptions(tableState('QD 2S'), 'QH'))).toEqual(['QD']);
    expect(captureOptions(tableState('QD 2S'), 'JH')).toEqual([]);
  });

  it('played Ace never sums — captures table Ace(s) only', () => {
    // A 1-value sum target could never have a 2-card combo anyway, but ensure
    // the ace also ignores any same-rank-plus-combo style logic.
    expect(asSets(captureOptions(tableState('AH AD 9C'), 'AS'))).toEqual(['AD AH']);
    expect(captureOptions(tableState('9C 2D'), 'AS')).toEqual([]);
  });

  it('table Ace counts as 1 inside other ranks’ sums', () => {
    expect(asSets(captureOptions(tableState('AH 6D'), '7S'))).toEqual(['6D AH']);
  });

  it('table J/Q/K never participate in sums', () => {
    expect(asSets(captureOptions(tableState('JS 4D 6C'), '10H'))).toEqual(['4D 6C']);
    expect(captureOptions(tableState('JS QD KC'), '10H')).toEqual([]);
  });
});

describe('captureOptions — maximal disjoint combinations (Clarification 3)', () => {
  it('play 7 onto 3,4,2,5 → must take both combinations (all four cards)', () => {
    const s = tableState('3H 4D 2C 5S');
    expect(asSets(captureOptions(s, '7H'))).toEqual(['2C 3H 4D 5S']);
  });

  it('play 6 onto A,2,3,4 → max count is 1; both {2,4} and {A,2,3} are legal', () => {
    const s = tableState('AS 2C 3D 4H');
    expect(asSets(captureOptions(s, '6H'))).toEqual(['2C 3D AS', '2C 4H']);
  });

  it('a single-combination choice is illegal when two disjoint combos exist', () => {
    // play 6 onto A,5,2,4: combos {A,5} and {2,4} are disjoint → must take both.
    const s = tableState('AS 5H 2C 4D');
    expect(asSets(captureOptions(s, '6H'))).toEqual(['2C 4D 5H AS']);
  });

  it('dedupes different partitions of the same card set', () => {
    // play 4 onto A,3,A,3: {A1,3a}+{A2,3b} and {A1,3b}+{A2,3a} are the same card set.
    const s = tableState('AH 3D AC 3S');
    expect(asSets(captureOptions(s, '4S'))).toEqual(['3D 3S AC AH']);
  });

  it('combinations are capped at 3 cards — no 4-card combos', () => {
    // 1+2+3+4 = 10 but uses 4 cards → no capture.
    expect(captureOptions(tableState('AH 2D 3C 4S'), '10S')).toEqual([]);
  });

  it('3-card combinations work', () => {
    expect(asSets(captureOptions(tableState('2H 3D 5C 9S'), '10H'))).toEqual(['2H 3D 5C']);
  });

  it('maximality is by combination count, offering all maximal selections', () => {
    // play 8 onto 2,6,3,5,A,7: combos {2,6},{3,5},{A,7},{A,2,5},{A,3,...}? values 2,6,3,5,1,7.
    // Disjoint pairs of 2-card combos: {2,6}+{3,5}, {2,6}+{A,7}, {3,5}+{A,7} → max 3? No:
    // {2,6},{3,5},{A,7} are mutually disjoint → max count is 3, single union of all 6 cards.
    const s = tableState('2H 6D 3C 5S AH 7D');
    expect(asSets(captureOptions(s, '8C'))).toEqual(['2H 3C 5S 6D 7D AH']);
  });

  it('empty table → no options', () => {
    expect(captureOptions(tableState(''), '7H')).toEqual([]);
  });

  it('returns [] outside PART_1', () => {
    const s = { ...tableState('2S 5H'), phase: 'PART_2' as const };
    expect(captureOptions(s, '7H')).toEqual([]);
  });

  it('returns [] for an unparseable CardId (code-review fix)', () => {
    const s = tableState('2S 5H');
    expect(captureOptions(s, 'BOGUS')).toEqual([]);
    expect(captureOptions(s, '')).toEqual([]);
    expect(captureOptions(s, '1X')).toEqual([]);
  });
});

describe('captureOptions — regression tests (Phase 2 review)', () => {
  it('play 6 onto A,2,3,4,5: {A,5}+{2,4} (2 combos) beats {A,2,3} (1 combo)', () => {
    // The 2-combo option must win; {A,2,3} path excluded by maximality-by-count.
    // {A,5} and {2,4} are disjoint — 2 combinations. {A,2,3} is only 1.
    const s = tableState('AS 2H 3D 4C 5S');
    const result = asSets(captureOptions(s, '6H'));
    expect(result).toEqual(['2H 4C 5S AS']); // union of {A,5} + {2,4}
  });

  it('play 7 onto 3a,3b,4a,4b: both {3a,4a}+{3b,4b} partitions deduplicate to one option', () => {
    // Two 3s and two 4s: {3S,4S}+{3H,4H} and {3S,4H}+{3H,4S} cover the same four cards.
    const s = tableState('3S 3H 4S 4H');
    const result = asSets(captureOptions(s, '7D'));
    // All four cards in one union, deduplicated to a single option.
    expect(result).toEqual(['3H 3S 4H 4S']);
  });
});
