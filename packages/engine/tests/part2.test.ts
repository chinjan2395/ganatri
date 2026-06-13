/**
 * Part 2 (trick/cut phase) test suite.
 * Builds GameState objects directly with phase: 'PART_2'.
 *
 * IMPORTANT: When building states with a non-empty `trick`, cards already
 * played into the trick must NOT appear in `hands` — the trick and hands are
 * disjoint, just as they are in a live game (applyMove removes each card from
 * hands when it is played to the trick).
 *
 * Rule references: GAME_RULES.md §4 + §7 Clarifications 7–10.
 */

import { describe, expect, it } from 'vitest';
import type { Card } from '../src/cards';
import { cardId } from '../src/cards';
import { applyMove, legalMoves, legalPart2Cards } from '../src/game';
import type { GameEvent, GameState, TrickPlay } from '../src/types';
import { c, deepFreeze, p1, p2, sortedIds } from './helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function trick(player: string, card: string, isCut = false): TrickPlay {
  return { player, card: c(card), isCut };
}

function playTrick(state: GameState, player: string, card: string) {
  return applyMove(state, player, { type: 'PLAY_TRICK', card });
}

function eventTypes(events: readonly GameEvent[]): string[] {
  return events.map((e) => e.type);
}

// ---------------------------------------------------------------------------
// Follow-suit enforcement
// ---------------------------------------------------------------------------

describe('Part 2 — follow-suit enforcement', () => {
  it('leader (empty trick) may play any card; sets ledSuit', () => {
    const state = p2({ hands: { a: '2S 3H', b: '4D' } });
    const res = playTrick(state, 'a', '2S');
    expect(res).toMatchObject({ ok: true });
    if (!res.ok) throw new Error('expected ok');
    expect(res.state.part2!.ledSuit).toBe('S');
    expect(res.state.part2!.trick).toHaveLength(1);
    expect(res.state.part2!.trick[0]).toMatchObject({ player: 'a', isCut: false });
  });

  it('leader plays a Heart; ledSuit becomes H', () => {
    const state = p2({ hands: { a: '3H', b: '4D' } });
    const res = playTrick(state, 'a', '3H');
    expect(res).toMatchObject({ ok: true });
    if (!res.ok) throw new Error('expected ok');
    expect(res.state.part2!.ledSuit).toBe('H');
  });

  it('follower holding led-suit must play it — MUST_FOLLOW_SUIT if they do not', () => {
    // a led 2S (removed from a's hand, in trick). b has KS and KH. Must play KS.
    const state = p2({
      // a's hand after leading: a played 2S so a has nothing left (or other cards)
      hands: { a: '9H', b: 'KS KH' },
      trick: [trick('a', '2S')],
      ledSuit: 'S',
      turn: 'b',
    });
    const res = playTrick(state, 'b', 'KH'); // wrong suit
    expect(res).toMatchObject({ ok: false, error: 'MUST_FOLLOW_SUIT' });
  });

  it('follower holding led-suit: playing the correct suit is accepted', () => {
    const state = p2({
      hands: { a: '9H', b: 'KS KH' },
      trick: [trick('a', '2S')],
      ledSuit: 'S',
      turn: 'b',
    });
    const res = playTrick(state, 'b', 'KS');
    expect(res).toMatchObject({ ok: true });
  });

  it('follower with zero led-suit cards may play any card (cut)', () => {
    const state = p2({
      hands: { a: '9H', b: 'KH QD' }, // b has no Spades
      trick: [trick('a', '2S')],
      ledSuit: 'S',
      turn: 'b',
    });
    const resH = playTrick(state, 'b', 'KH');
    expect(resH).toMatchObject({ ok: true });
    const resD = playTrick(state, 'b', 'QD');
    expect(resD).toMatchObject({ ok: true });
  });

  it('legalPart2Cards returns only led-suit cards when follower holds some', () => {
    const state = p2({
      hands: { a: '9H', b: 'KS KH QD' },
      trick: [trick('a', '2S')],
      ledSuit: 'S',
      turn: 'b',
    });
    const legal = [...legalPart2Cards(state, 'b')].sort();
    expect(legal).toEqual(['KS']);
  });

  it('legalPart2Cards returns entire hand when follower has no led-suit cards', () => {
    const state = p2({
      hands: { a: '9H', b: 'KH QD JC' },
      trick: [trick('a', '2S')],
      ledSuit: 'S',
      turn: 'b',
    });
    const legal = [...legalPart2Cards(state, 'b')].sort();
    expect(legal).toEqual(['JC', 'KH', 'QD'].sort());
  });

  it('legalPart2Cards returns [] when not your turn', () => {
    const state = p2({ hands: { a: '2S', b: '3H' }, turn: 'a' });
    expect(legalPart2Cards(state, 'b')).toEqual([]);
  });

  it('legalPart2Cards returns [] for safe player', () => {
    const state = p2({ hands: { a: '2S', b: '3H' }, safeOrder: ['a'] });
    expect(legalPart2Cards(state, 'a')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Rejection conditions
// ---------------------------------------------------------------------------

describe('Part 2 — rejection conditions', () => {
  it('WRONG_PHASE when phase is PART_1', () => {
    const state = p1({ hands: { a: '2S', b: '3H' } });
    const res = applyMove(state, 'a', { type: 'PLAY_TRICK', card: '2S' });
    expect(res).toMatchObject({ ok: false, error: 'WRONG_PHASE' });
  });

  it('NOT_YOUR_TURN', () => {
    const state = p2({ hands: { a: '2S', b: '3H' }, turn: 'a' });
    expect(playTrick(state, 'b', '3H')).toMatchObject({ ok: false, error: 'NOT_YOUR_TURN' });
  });

  it('CARD_NOT_IN_HAND', () => {
    const state = p2({ hands: { a: '2S', b: '3H' } });
    expect(playTrick(state, 'a', 'KD')).toMatchObject({ ok: false, error: 'CARD_NOT_IN_HAND' });
  });
});

// ---------------------------------------------------------------------------
// Trick won (all followed suit)
// ---------------------------------------------------------------------------

describe('Part 2 — trick won (all followed suit)', () => {
  it('Ace beats King (highest wins): AS vs KS → AS wins', () => {
    // a leads KS (KS removed from a's hand). b has AS. AS wins.
    const state = p2({
      hands: { a: '2H', b: 'AS 3H' }, // a played KS already (in trick), has 2H left
      trick: [trick('a', 'KS')],
      ledSuit: 'S',
      turn: 'b',
    });
    const res = playTrick(state, 'b', 'AS');
    if (!res.ok) throw new Error(`expected ok: ${res.error}`);
    const ev = res.events.find((e) => e.type === 'TRICK_WON');
    expect(ev).toBeDefined();
    if (ev?.type === 'TRICK_WON') expect(ev.winner).toBe('b');
  });

  it('King beats Queen: KS vs QS → KS wins', () => {
    const state = p2({
      hands: { a: '2H', b: 'KS 3H' },
      trick: [trick('a', 'QS')],
      ledSuit: 'S',
      turn: 'b',
    });
    const res = playTrick(state, 'b', 'KS');
    if (!res.ok) throw new Error(`expected ok: ${res.error}`);
    const ev = res.events.find((e) => e.type === 'TRICK_WON');
    if (ev?.type === 'TRICK_WON') expect(ev.winner).toBe('b');
  });

  it('10 beats 9: 10S vs 9S → 10S wins', () => {
    const state = p2({
      hands: { a: '2H', b: '10S 3H' },
      trick: [trick('a', '9S')],
      ledSuit: 'S',
      turn: 'b',
    });
    const res = playTrick(state, 'b', '10S');
    if (!res.ok) throw new Error(`expected ok: ${res.error}`);
    const ev = res.events.find((e) => e.type === 'TRICK_WON');
    if (ev?.type === 'TRICK_WON') expect(ev.winner).toBe('b');
  });

  it('leader 3S wins against follower 2S', () => {
    const state = p2({
      hands: { a: '4H', b: '2S 5H' },
      trick: [trick('a', '3S')],
      ledSuit: 'S',
      turn: 'b',
    });
    const res = playTrick(state, 'b', '2S');
    if (!res.ok) throw new Error(`expected ok: ${res.error}`);
    const ev = res.events.find((e) => e.type === 'TRICK_WON');
    if (ev?.type === 'TRICK_WON') expect(ev.winner).toBe('a'); // 3S beats 2S
  });

  it('cancelled cards leave the game permanently (card conservation)', () => {
    // a has 5S 2H, b has 8S 3H. a leads 5S, b follows 8S → trick won by b (8>5).
    // After: 5S and 8S cancelled. a has 2H, b has 3H.
    const beforeState = p2({ hands: { a: '5S 2H', b: '8S 3H' } });
    // a leads
    const afterLead = playTrick(beforeState, 'a', '5S');
    if (!afterLead.ok) throw new Error('lead rejected');
    // b follows
    const afterFollow = playTrick(afterLead.state, 'b', '8S');
    if (!afterFollow.ok) throw new Error('follow rejected');
    // Card conservation: 5S and 8S were cancelled, 2H and 3H remain.
    const part2 = afterFollow.state.part2!;
    expect(sortedIds(part2.hands['a']!)).toEqual(['2H']);
    expect(sortedIds(part2.hands['b']!)).toEqual(['3H']);
    // Neither S card should appear anywhere.
    const allCards = [...part2.hands['a']!, ...part2.hands['b']!];
    expect(allCards.every((card) => card.suit !== 'S')).toBe(true);
  });

  it('winner (b) leads next trick', () => {
    // a leads KS, b plays AS → b wins
    const beforeState = p2({ hands: { a: 'KS 2H', b: 'AS 3H' } });
    const r1 = playTrick(beforeState, 'a', 'KS');
    if (!r1.ok) throw new Error('lead rejected');
    const r2 = playTrick(r1.state, 'b', 'AS');
    if (!r2.ok) throw new Error('follow rejected');
    expect(r2.state.turn).toBe('b');
    expect(r2.state.part2!.trick).toEqual([]);
    expect(r2.state.part2!.ledSuit).toBeNull();
  });

  it('leader (a) wins when their card is highest', () => {
    const state = p2({
      hands: { a: '2H', b: 'KS 3H' },
      trick: [trick('a', 'AS')],
      ledSuit: 'S',
      turn: 'b',
    });
    const res = playTrick(state, 'b', 'KS');
    if (!res.ok) throw new Error(`expected ok: ${res.error}`);
    const ev = res.events.find((e) => e.type === 'TRICK_WON');
    if (ev?.type === 'TRICK_WON') expect(ev.winner).toBe('a');
    expect(res.state.turn).toBe('a');
  });

  it('winner empties their hand on the win → PLAYER_SAFE, next clockwise non-safe leads', () => {
    // a has 5S (played into trick already). b has 3S only.
    // After trick: 5S wins, both 5S and 3S cancelled. b empties → b safe.
    // a also empties (a's 5S was in trick, a's remaining hand is []).
    // But wait: a wins; a's 5S was already removed when a played it. So a has [].
    // Actually: let's set up: a has 5S (only), b has 3S (only).
    // a leads 5S → a's hand = []. b plays 3S → both cancelled. a already empty.
    // After trick: a is safe (played first), b is safe. 0 active → GAME_OVER.
    //
    // Let's use a scenario where winner empties but other player still holds cards:
    // a has 5S (only), b has 3S 2H. a leads 5S, b follows 3S. a wins (5>3).
    // After: 5S and 3S cancelled. a had only 5S → a empty → PLAYER_SAFE for a.
    // b has 2H → b is the only active player → GAME_OVER, b loses.
    // So "next clockwise leads" doesn't apply here; game ends.
    //
    // For the "next clockwise leads" scenario, we need 3 players:
    // a has 5S, b has 3S 2H, c has 4D. a leads 5S, b follows 3S, c follows 4D? No, 4D is Hearts/Diamond.
    // Let's use: seating [a, b, c], a has 5S, b has 3S, c has 2S 4H.
    // a leads 5S, b plays 3S, c plays 2S. Trick complete. a wins (5>3>2).
    // a had only 5S → empty → safe. c has 4H. b has []. → b is also safe.
    // c is the only active player → GAME_OVER, c loses? That's game-over, not "next leads".
    //
    // Correct minimal scenario: a has 5S (only), b has 3S 4H, c has 2S 7D.
    // a leads 5S → empty. b plays 3S → empty would need b to have only 3S.
    // Let me just test the PLAYER_SAFE event and then check next turn properly.
    // 3 players: a has 5S (only), b has 3S 2H, c has 2S 4D.
    // a leads 5S → a.hand=[]. b plays 3S → b.hand=[2H]. c plays 2S → c.hand=[4D].
    // Trick: 5S, 3S, 2S. 5S wins → a wins. a empty → a safe. PLAYER_SAFE(a).
    // 2 active remain (b, c) → b leads next (next clockwise after safe a).
    const state0 = p2({
      seating: ['a', 'b', 'c'],
      hands: { a: '5S', b: '3S 2H', c: '2S 4D' },
    });
    const r1 = playTrick(state0, 'a', '5S'); // a leads (a's hand now [])
    if (!r1.ok) throw new Error(`r1: ${r1.error}`);
    const r2 = playTrick(r1.state, 'b', '3S');
    if (!r2.ok) throw new Error(`r2: ${r2.error}`);
    const r3 = playTrick(r2.state, 'c', '2S');
    if (!r3.ok) throw new Error(`r3: ${r3.error}`);

    // a wins, a is safe, next clockwise from a is b → b leads.
    expect(eventTypes(r3.events)).toContain('TRICK_WON');
    expect(eventTypes(r3.events)).toContain('PLAYER_SAFE');
    const safeEv = r3.events.find((e) => e.type === 'PLAYER_SAFE');
    if (safeEv?.type === 'PLAYER_SAFE') expect(safeEv.player).toBe('a');
    expect(r3.state.turn).toBe('b');
    expect(r3.state.part2!.safeOrder).toEqual(['a']);
  });

  it('TRICK_WON event contains all played cards as cancelled', () => {
    // a played 5S (in trick), b plays 3S.
    const state = p2({
      hands: { a: '2H', b: '3S 4H' },
      trick: [trick('a', '5S')],
      ledSuit: 'S',
      turn: 'b',
    });
    const res = playTrick(state, 'b', '3S');
    if (!res.ok) throw new Error(`expected ok: ${res.error}`);
    const ev = res.events.find((e) => e.type === 'TRICK_WON');
    if (!ev || ev.type !== 'TRICK_WON') throw new Error('missing TRICK_WON');
    expect(sortedIds(ev.cancelled as readonly Card[])).toEqual(['3S', '5S']);
  });
});

// ---------------------------------------------------------------------------
// Cut
// ---------------------------------------------------------------------------

describe('Part 2 — cut', () => {
  it('cut ends trick immediately; later players do not play (Clarification 7)', () => {
    // 3 players: a led 2S (in trick), b has no S so cuts with KH. c never plays.
    // a's remaining hand after leading: a played 2S so a has 9H left.
    const state = p2({
      seating: ['a', 'b', 'c'],
      hands: { a: '9H', b: 'KH', c: 'QS 3H' }, // c would be next but shouldn't
      trick: [trick('a', '2S')],
      ledSuit: 'S',
      turn: 'b',
    });
    const res = playTrick(state, 'b', 'KH'); // b cuts
    if (!res.ok) throw new Error(`expected ok: ${res.error}`);
    // Trick resolved (CUT event), c's hand unchanged
    expect(eventTypes(res.events)).toContain('CUT');
    expect(sortedIds(res.state.part2!.hands['c']!)).toEqual(['3H', 'QS']);
  });

  it('CUT event has cutter set correctly', () => {
    const state = p2({
      hands: { a: '9H', b: 'KH 3D' },
      trick: [trick('a', '2S')],
      ledSuit: 'S',
      turn: 'b',
    });
    const res = playTrick(state, 'b', 'KH');
    if (!res.ok) throw new Error(`expected ok: ${res.error}`);
    const cutEv = res.events.find((e) => e.type === 'CUT');
    expect(cutEv).toBeDefined();
    if (cutEv?.type === 'CUT') {
      expect(cutEv.cutter).toBe('b');
    }
  });

  it('pickerUpper is holder of highest led-suit card on the table', () => {
    // 3 players: a led 3S (in trick, a has 9H left). b played KS (in trick, b has 9D left).
    // c cuts with 2H (only card). KS > 3S → b picks up.
    const state = p2({
      seating: ['a', 'b', 'c'],
      hands: { a: '9H', b: '9D', c: '2H' },
      trick: [trick('a', '3S'), trick('b', 'KS')],
      ledSuit: 'S',
      turn: 'c',
    });
    const res = playTrick(state, 'c', '2H');
    if (!res.ok) throw new Error(`expected ok: ${res.error}`);
    const cutEv = res.events.find((e) => e.type === 'CUT');
    if (!cutEv || cutEv.type !== 'CUT') throw new Error('no CUT event');
    expect(cutEv.pickerUpper).toBe('b');
    expect(sortedIds(cutEv.pickedUp as readonly Card[])).toEqual(['2H', '3S', 'KS']);
  });

  it('after cut, all trick cards (including cut card) go to pickerUpper; other hands intact', () => {
    // a: 9H (remaining after playing 3S into trick). b: 9D (remaining after playing KS).
    // c: plays 2H (cuts). After cut: b gets 3S + KS + 2H = 3 cards added to b's existing 9D.
    const state = p2({
      seating: ['a', 'b', 'c'],
      hands: { a: '9H', b: '9D', c: '2H' },
      trick: [trick('a', '3S'), trick('b', 'KS')],
      ledSuit: 'S',
      turn: 'c',
    });
    const res = playTrick(state, 'c', '2H');
    if (!res.ok) throw new Error(`expected ok: ${res.error}`);
    // b gets their existing 9D + 3S + KS + 2H = 4 cards.
    expect(sortedIds(res.state.part2!.hands['b']!)).toEqual(['2H', '3S', '9D', 'KS']);
    // a keeps 9H.
    expect(sortedIds(res.state.part2!.hands['a']!)).toEqual(['9H']);
    // c played their only card, c is now empty.
    expect(res.state.part2!.hands['c']!).toEqual([]);
  });

  it('cutter leads next trick', () => {
    // c cuts, c should lead next.
    const state = p2({
      seating: ['a', 'b', 'c'],
      hands: { a: '9H', b: '9D', c: '2H 5D' }, // c has 5D left after playing 2H
      trick: [trick('a', '3S'), trick('b', 'KS')],
      ledSuit: 'S',
      turn: 'c',
    });
    const res = playTrick(state, 'c', '2H');
    if (!res.ok) throw new Error(`expected ok: ${res.error}`);
    expect(res.state.turn).toBe('c');
    expect(res.state.part2!.trick).toEqual([]);
    expect(res.state.part2!.ledSuit).toBeNull();
  });

  it('cutter plays last card → PLAYER_SAFE for cutter, next non-safe clockwise leads (Clarification 8)', () => {
    // seating: a, b, c. a led 3S (a.hand=[9H]). b played KS (b.hand=[5H]).
    // c has only 2H (cuts). c empty → safe. Next non-safe clockwise after c: a.
    // But a has 9H → a leads.
    const state = p2({
      seating: ['a', 'b', 'c'],
      hands: { a: '9H', b: '5H', c: '2H' },
      trick: [trick('a', '3S'), trick('b', 'KS')],
      ledSuit: 'S',
      turn: 'c',
    });
    const res = playTrick(state, 'c', '2H');
    if (!res.ok) throw new Error(`expected ok: ${res.error}`);
    // c became safe (played their last card).
    expect(res.state.part2!.safeOrder).toContain('c');
    expect(eventTypes(res.events)).toContain('PLAYER_SAFE');
    const safeEv = res.events.find((e) => e.type === 'PLAYER_SAFE');
    if (safeEv?.type === 'PLAYER_SAFE') expect(safeEv.player).toBe('c');
    // Next non-safe after c (seating: a, b, c): a is next.
    expect(res.state.turn).toBe('a');
  });

  it('after a cut, pickerUpper holds cards and is NOT safe', () => {
    // b is pickerUpper; b's hand grows with the picked-up cards.
    const state = p2({
      seating: ['a', 'b', 'c'],
      hands: { a: '9H', b: '9D', c: '2H 5D' },
      trick: [trick('a', '3S'), trick('b', 'KS')],
      ledSuit: 'S',
      turn: 'c',
    });
    const res = playTrick(state, 'c', '2H');
    if (!res.ok) throw new Error(`expected ok: ${res.error}`);
    expect(res.state.part2!.safeOrder).not.toContain('b');
    // b's hand: 9D (original remaining) + 3S + KS + 2H (picked up) = 4 cards.
    expect(res.state.part2!.hands['b']!.length).toBe(4);
  });

  it('CUT: pickerUpper is the holder of highest led-suit card (Ace > King)', () => {
    // a led 3S (a.hand=[9H]). b played AS (b.hand=[9D]). c cuts with 2H.
    // AS (b) > 3S (a) → b picks up.
    const state = p2({
      seating: ['a', 'b', 'c'],
      hands: { a: '9H', b: '9D', c: '2H' },
      trick: [trick('a', '3S'), trick('b', 'AS')],
      ledSuit: 'S',
      turn: 'c',
    });
    const res = playTrick(state, 'c', '2H');
    if (!res.ok) throw new Error(`expected ok: ${res.error}`);
    const cutEv = res.events.find((e) => e.type === 'CUT');
    if (!cutEv || cutEv.type !== 'CUT') throw new Error('no CUT');
    expect(cutEv.pickerUpper).toBe('b');
  });

  it('2-player cut: leader leads, follower cuts immediately', () => {
    // a leads 3S. b has no S, cuts with 2H. a holds 3S on table → a picks up.
    const state = p2({
      seating: ['a', 'b'],
      hands: { a: '9H', b: '2H' }, // a played 3S into trick
      trick: [trick('a', '3S')],
      ledSuit: 'S',
      turn: 'b',
    });
    const res = playTrick(state, 'b', '2H');
    if (!res.ok) throw new Error(`expected ok: ${res.error}`);
    expect(eventTypes(res.events)).toContain('CUT');
    const cutEv = res.events.find((e) => e.type === 'CUT');
    if (cutEv?.type === 'CUT') {
      expect(cutEv.cutter).toBe('b');
      expect(cutEv.pickerUpper).toBe('a');
    }
    // a gets 3S + 2H back, and still has 9H → a has 9H + 3S + 2H = 3 cards.
    expect(sortedIds(res.state.part2!.hands['a']!)).toEqual(['2H', '3S', '9H']);
    // b played their only card → b empty → b is safe.
    expect(res.state.part2!.safeOrder).toContain('b');
    // b is safe; only a holds cards. Next cutter should lead but b is safe →
    // game over? Let's check: 1 active player (a) → GAME_OVER, a loses.
    expect(res.state.phase).toBe('GAME_OVER');
  });
});

// ---------------------------------------------------------------------------
// Multi-player active-player tracking
// ---------------------------------------------------------------------------

describe('Part 2 — multi-player active-player tracking', () => {
  it('safe players are skipped in turn rotation after trick', () => {
    // 4 players: a, b, c, d. c is safe (zero cards).
    // a leads AS, b follows KS, d follows 5S (c is skipped), a wins.
    const state0 = p2({
      seating: ['a', 'b', 'c', 'd'],
      hands: { a: 'AS 2H', b: 'KS 3H', c: '', d: '5S 4H' },
      safeOrder: ['c'],
      turn: 'a',
    });
    // a leads AS
    const r1 = playTrick(state0, 'a', 'AS');
    if (!r1.ok) throw new Error(`r1: ${r1.error}`);
    expect(r1.state.turn).toBe('b'); // b is next non-safe

    // b plays KS
    const r2 = playTrick(r1.state, 'b', 'KS');
    if (!r2.ok) throw new Error(`r2: ${r2.error}`);
    expect(r2.state.turn).toBe('d'); // c is safe, skip to d

    // d plays 5S → trick complete (AS, KS, 5S). AS wins → a leads.
    const r3 = playTrick(r2.state, 'd', '5S');
    if (!r3.ok) throw new Error(`r3: ${r3.error}`);
    expect(r3.state.turn).toBe('a');
    const wonEv = r3.events.find((e) => e.type === 'TRICK_WON');
    if (wonEv?.type === 'TRICK_WON') expect(wonEv.winner).toBe('a');
  });

  it('trick is complete only once all non-safe players have played (not fixed count)', () => {
    // 3 players: a, b are active; c is safe. Trick completes after a and b play.
    const state = p2({
      seating: ['a', 'b', 'c'],
      hands: { a: '5S 2H', b: '3S 4H', c: '' },
      safeOrder: ['c'],
      turn: 'a',
    });
    const r1 = playTrick(state, 'a', '5S'); // a leads
    if (!r1.ok) throw new Error('r1 failed');
    expect(r1.state.part2!.trick).toHaveLength(1); // not yet complete
    expect(r1.state.turn).toBe('b'); // c skipped

    const r2 = playTrick(r1.state, 'b', '3S'); // b follows → trick complete
    if (!r2.ok) throw new Error('r2 failed');
    expect(eventTypes(r2.events)).toContain('TRICK_WON');
    expect(r2.state.part2!.trick).toEqual([]); // reset
  });
});

// ---------------------------------------------------------------------------
// Game-over conditions
// ---------------------------------------------------------------------------

describe('Part 2 — game-over conditions', () => {
  it('one holder left after trick cancellation → they lose; GAME_OVER with correct rankings', () => {
    // a has 5S (only), b has 3S 2H. a leads 5S, b follows 3S.
    // Trick won by a (5>3). Both 5S and 3S cancelled. a had only 5S → a empty → safe.
    // b has 2H → only active player → GAME_OVER, b loses.
    const state = p2({
      seating: ['a', 'b'],
      hands: { a: '5S', b: '3S 2H' },
    });
    // a leads 5S → a.hand = []
    const r1 = playTrick(state, 'a', '5S');
    if (!r1.ok) throw new Error(`r1: ${r1.error}`);
    // b follows 3S → trick complete, a wins, a safe, b still has 2H → GAME_OVER
    const r2 = playTrick(r1.state, 'b', '3S');
    if (!r2.ok) throw new Error(`r2: ${r2.error}`);
    expect(r2.state.phase).toBe('GAME_OVER');
    // a safe first; b loses.
    expect(r2.state.rankings).toEqual(['a', 'b']);
    expect(eventTypes(r2.events)).toContain('GAME_OVER');
    const gev = r2.events.find((e) => e.type === 'GAME_OVER');
    if (gev?.type === 'GAME_OVER') expect(gev.rankings).toEqual(['a', 'b']);
  });

  it('zero holders after cancelled trick → no loser; GAME_OVER with safeOrder only', () => {
    // Both players have exactly one spade each. Both empty after trick → no loser.
    const state = p2({
      seating: ['a', 'b'],
      hands: { a: '5S', b: '3S' },
    });
    const r1 = playTrick(state, 'a', '5S'); // a leads
    if (!r1.ok) throw new Error('lead rejected');
    const r2 = playTrick(r1.state, 'b', '3S'); // b follows → trick, both empty
    if (!r2.ok) throw new Error('follow rejected');
    expect(r2.state.phase).toBe('GAME_OVER');
    // Both empty simultaneously → both safe. No loser.
    // a played first → a safe first, then b.
    const gev = r2.events.find((e) => e.type === 'GAME_OVER');
    if (gev?.type === 'GAME_OVER') {
      expect(gev.rankings).toEqual(['a', 'b']); // ordered by trick play order
    }
  });

  it('game continues when ≥2 players still hold cards after trick', () => {
    const state = p2({
      seating: ['a', 'b'],
      hands: { a: '5S 2H', b: '3S 4H' },
    });
    const r1 = playTrick(state, 'a', '5S');
    if (!r1.ok) throw new Error('r1 failed');
    const r2 = playTrick(r1.state, 'b', '3S');
    if (!r2.ok) throw new Error('r2 failed');
    expect(r2.state.phase).toBe('PART_2');
  });

  it('rankings ordering: pre-safe players come before Part-2 finishers', () => {
    // c was safe from Part 1 start (zero captures), ranked first in safeOrder.
    // a has 5S (only), b has 3S (only). a leads, b follows → both cancel → both safe.
    // Order in trick: a first, b second. Expected rankings: c, a, b.
    const state = p2({
      seating: ['a', 'b', 'c'],
      hands: { a: '5S', b: '3S', c: '' },
      safeOrder: ['c'],
    });
    // Next active after c (seating: a, b, c, safeOrder: [c]) is a.
    // But turn defaults to seating[0] = a. Let's verify turn is set to a correctly.
    // Actually p2 helper defaults turn to seating[0] if safeOrder doesn't contain it.
    const r1 = playTrick(state, 'a', '5S');
    if (!r1.ok) throw new Error(`r1 failed: ${r1.error}`);
    const r2 = playTrick(r1.state, 'b', '3S');
    if (!r2.ok) throw new Error(`r2 failed: ${r2.error}`);
    expect(r2.state.phase).toBe('GAME_OVER');
    // c was pre-safe, then a (first in trick), then b (second in trick).
    expect(r2.state.rankings).toEqual(['c', 'a', 'b']);
  });

  it('cut game-over: all three empty on the cut — cutter and pre-cut players safe, picker-upper loses', () => {
    // Setup: a and b each played their last cards into the trick already.
    // c cuts with their last card (2H, no Spades). Trick so far: [a:5S, b:KS].
    // resolveCut iterates over ALL trick participants:
    //   - a: hand empty, not picker-upper → safe (first in trick)
    //   - b: picker-upper (holds highest S = KS) → gains 5S+KS+2H, not safe
    //   - c: hand empty after cutting, not picker-upper → safe
    // b is the only active player → GAME_OVER, b loses.
    // safeOrder = [a, c] (trick order: a then c; b skipped as picker-upper).
    // rankings = ['a', 'c', 'b'].
    const state = p2({
      seating: ['a', 'b', 'c'],
      hands: { a: '', b: '', c: '2H' },
      trick: [trick('a', '5S'), trick('b', 'KS')],
      ledSuit: 'S',
      turn: 'c',
    });
    const res = playTrick(state, 'c', '2H');
    if (!res.ok) throw new Error(`expected ok: ${res.error}`);

    expect(res.state.phase).toBe('GAME_OVER');
    expect(res.state.rankings).toEqual(['a', 'c', 'b']);

    const evTypes = res.events.map((e) => e.type);
    expect(evTypes).toContain('CUT');
    expect(evTypes.filter((t) => t === 'PLAYER_SAFE')).toHaveLength(2);
    expect(evTypes).toContain('GAME_OVER');

    // b picked up all 3 cards; a and c have empty hands
    expect(res.state.part2!.hands['b']).toHaveLength(3);
    expect(res.state.part2!.hands['a']).toHaveLength(0);
    expect(res.state.part2!.hands['c']).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2-player edge cases
// ---------------------------------------------------------------------------

describe('Part 2 — 2-player edge cases', () => {
  it('2 players: one cuts with their last card — cutter becomes safe, picker-up loses', () => {
    // a has 3S (only). b has 2H (only, no Spades). a leads 3S → a.hand=[].
    // b has 2H (no S) → b cuts. b empty → b safe.
    // a picks up (3S + 2H) → a has 2 cards. Only a active → GAME_OVER, a loses.
    const state = p2({
      seating: ['a', 'b'],
      hands: { a: '3S', b: '2H' },
      turn: 'a',
    });
    const r1 = playTrick(state, 'a', '3S'); // a leads; a.hand now []
    if (!r1.ok) throw new Error(`lead rejected: ${r1.error}`);
    expect(r1.state.part2!.ledSuit).toBe('S');

    const r2 = playTrick(r1.state, 'b', '2H'); // b cuts (b has no S)
    if (!r2.ok) throw new Error(`cut rejected: ${r2.error}`);
    expect(r2.state.phase).toBe('GAME_OVER');
    const gev = r2.events.find((e) => e.type === 'GAME_OVER');
    if (gev?.type === 'GAME_OVER') {
      expect(gev.rankings[0]).toBe('b'); // b safe (first)
      expect(gev.rankings[1]).toBe('a'); // a loses
    }
  });

  it('2 players: final two empty simultaneously on cancelled trick → no loser', () => {
    // a has AS only, b has KS only. a leads, b follows (both S). Both cancel. Both safe.
    const state = p2({
      seating: ['a', 'b'],
      hands: { a: 'AS', b: 'KS' },
      turn: 'a',
    });
    const r1 = playTrick(state, 'a', 'AS');
    if (!r1.ok) throw new Error('lead rejected');
    const r2 = playTrick(r1.state, 'b', 'KS');
    if (!r2.ok) throw new Error('follow rejected');
    expect(r2.state.phase).toBe('GAME_OVER');
    expect(r2.state.rankings).toHaveLength(2); // both in rankings, no loser
    const gev = r2.events.find((e) => e.type === 'GAME_OVER');
    if (gev?.type === 'GAME_OVER') {
      expect(gev.rankings).toContain('a');
      expect(gev.rankings).toContain('b');
    }
  });

  it('2 players: multi-trick progression terminates correctly', () => {
    // a has 5S 3H, b has 2S 4H. a leads 5S, b plays 2S → a wins, 5S/2S cancelled.
    // a now leads 3H, b plays 4H → b wins (4 > 3), 3H/4H cancelled. Both empty → no loser.
    const state = p2({ seating: ['a', 'b'], hands: { a: '5S 3H', b: '2S 4H' } });
    const r1 = playTrick(state, 'a', '5S');
    if (!r1.ok) throw new Error('r1 failed');
    const r2 = playTrick(r1.state, 'b', '2S'); // a wins
    if (!r2.ok) throw new Error('r2 failed');
    expect(r2.state.turn).toBe('a');

    const r3 = playTrick(r2.state, 'a', '3H'); // a leads
    if (!r3.ok) throw new Error('r3 failed');
    const r4 = playTrick(r3.state, 'b', '4H'); // b wins (4 > 3)
    if (!r4.ok) throw new Error('r4 failed');
    expect(r4.state.phase).toBe('GAME_OVER');
    // Both empty after trick 2, no loser.
    expect(r4.state.rankings).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Rank ordering exhaustive
// ---------------------------------------------------------------------------

describe('Part 2 — rank ordering (A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3 > 2)', () => {
  // Helper: 2-player state where a already played `first` into trick, b follows `second`.
  // Returns the winner player id.
  function whoWins(first: string, second: string): string {
    // b needs an extra card so they don't empty and end the game.
    const state = p2({
      seating: ['a', 'b'],
      hands: { a: '2H', b: `${second} 3D` }, // a has 2H left after playing first
      trick: [trick('a', first)],
      ledSuit: 'S',
      turn: 'b',
    });
    const res = playTrick(state, 'b', second);
    if (!res.ok) throw new Error(`rejected: ${res.error} (${first} vs ${second})`);
    const ev = res.events.find((e) => e.type === 'TRICK_WON');
    if (!ev || ev.type !== 'TRICK_WON') throw new Error('no TRICK_WON');
    return ev.winner;
  }

  it('AS beats KS', () => expect(whoWins('KS', 'AS')).toBe('b'));
  it('KS beats QS', () => expect(whoWins('QS', 'KS')).toBe('b'));
  it('QS beats JS', () => expect(whoWins('JS', 'QS')).toBe('b'));
  it('JS beats 10S', () => expect(whoWins('10S', 'JS')).toBe('b'));
  it('10S beats 9S', () => expect(whoWins('9S', '10S')).toBe('b'));
  it('9S beats 8S', () => expect(whoWins('8S', '9S')).toBe('b'));
  it('8S beats 7S', () => expect(whoWins('7S', '8S')).toBe('b'));
  it('7S beats 6S', () => expect(whoWins('6S', '7S')).toBe('b'));
  it('6S beats 5S', () => expect(whoWins('5S', '6S')).toBe('b'));
  it('5S beats 4S', () => expect(whoWins('4S', '5S')).toBe('b'));
  it('4S beats 3S', () => expect(whoWins('3S', '4S')).toBe('b'));
  it('3S beats 2S', () => expect(whoWins('2S', '3S')).toBe('b'));
  it('leader AS wins when b plays KS', () => expect(whoWins('AS', 'KS')).toBe('a'));
});

// ---------------------------------------------------------------------------
// legalMoves Part 2
// ---------------------------------------------------------------------------

describe('Part 2 — legalMoves', () => {
  it('enumerates PLAY_TRICK for each legal card', () => {
    const state = p2({ hands: { a: '2S 3H', b: '4D' } });
    const moves = legalMoves(state, 'a');
    expect(moves).toHaveLength(2);
    expect(moves).toContainEqual({ type: 'PLAY_TRICK', card: '2S' });
    expect(moves).toContainEqual({ type: 'PLAY_TRICK', card: '3H' });
  });

  it('every enumerated Part 2 move is accepted by applyMove', () => {
    const state = p2({ hands: { a: '2S 3H 4D', b: '5S KH' } });
    for (const move of legalMoves(state, 'a')) {
      expect(applyMove(state, 'a', move)).toMatchObject({ ok: true });
    }
  });

  it('follow-suit restriction reflected in legalMoves', () => {
    const state = p2({
      hands: { a: '2H', b: 'KS 2H' }, // b has 2H extra so won't go empty
      trick: [trick('a', '5S')],
      ledSuit: 'S',
      turn: 'b',
    });
    const moves = legalMoves(state, 'b');
    expect(moves).toHaveLength(1);
    expect(moves[0]).toEqual({ type: 'PLAY_TRICK', card: 'KS' });
  });
});
