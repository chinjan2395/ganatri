import { describe, expect, it } from 'vitest';
import { applyMove } from '../src/game';
import type { Move } from '../src/types';
import { deepFreeze, p1, p2, sortedIds } from './helpers';

function play(card: string, capture: string[] = []): Move {
  return { type: 'PLAY_CAPTURE', card, capture };
}

describe('applyMove — rejections', () => {
  it('PLAY_CAPTURE outside PART_1 → WRONG_PHASE', () => {
    const state = p2({ a: '2S', b: '3H' });
    const res = applyMove(state, 'a', play('2S'));
    expect(res).toMatchObject({ ok: false, error: 'WRONG_PHASE' });
  });

  it('PLAY_TRICK during PART_2 with a legal card → ok (Part 2 is now implemented)', () => {
    const state = p2({ a: '2S', b: '3H' });
    const res = applyMove(state, 'a', { type: 'PLAY_TRICK', card: '2S' });
    expect(res).toMatchObject({ ok: true });
  });

  it('PLAY_TRICK during PART_1 → WRONG_PHASE', () => {
    const state = p1({ hands: { a: '2S', b: '3H' } });
    const res = applyMove(state, 'a', { type: 'PLAY_TRICK', card: '2S' });
    expect(res).toMatchObject({ ok: false, error: 'WRONG_PHASE' });
  });

  it('not your turn → NOT_YOUR_TURN', () => {
    const state = p1({ hands: { a: '2S', b: '3H' }, turn: 'a' });
    expect(applyMove(state, 'b', play('3H'))).toMatchObject({ ok: false, error: 'NOT_YOUR_TURN' });
  });

  it('card not in hand → CARD_NOT_IN_HAND', () => {
    const state = p1({ hands: { a: '2S', b: '3H' } });
    expect(applyMove(state, 'a', play('9D'))).toMatchObject({
      ok: false,
      error: 'CARD_NOT_IN_HAND',
    });
  });

  it('capture exists but [] submitted → CAPTURE_REQUIRED', () => {
    const state = p1({ hands: { a: '7S', b: '3H' }, table: '3D 4C' });
    expect(applyMove(state, 'a', play('7S'))).toMatchObject({
      ok: false,
      error: 'CAPTURE_REQUIRED',
    });
  });

  it('capture set not among legal options → INVALID_CAPTURE', () => {
    const state = p1({ hands: { a: '7S', b: '3H' }, table: '3D 4C' });
    expect(applyMove(state, 'a', play('7S', ['3D']))).toMatchObject({
      ok: false,
      error: 'INVALID_CAPTURE',
    });
    expect(applyMove(state, 'a', play('7S', ['3D', '4C', '9H']))).toMatchObject({
      ok: false,
      error: 'INVALID_CAPTURE',
    });
  });

  it('omitting the mandatory same-rank card → INVALID_CAPTURE', () => {
    const state = p1({ hands: { a: '7S', b: '3H' }, table: '7H 3D 4C' });
    expect(applyMove(state, 'a', play('7S', ['3D', '4C']))).toMatchObject({
      ok: false,
      error: 'INVALID_CAPTURE',
    });
    expect(applyMove(state, 'a', play('7S', ['7H', '3D', '4C']))).toMatchObject({ ok: true });
  });

  it('capture submitted when no capture exists → INVALID_CAPTURE', () => {
    const state = p1({ hands: { a: '7S', b: '3H' }, table: '9D' });
    expect(applyMove(state, 'a', play('7S', ['9D']))).toMatchObject({
      ok: false,
      error: 'INVALID_CAPTURE',
    });
  });
});

describe('applyMove — playing without capture', () => {
  it('card joins the table, CARD_PLAYED emitted, turn advances', () => {
    const state = p1({ hands: { a: '7S 2H', b: '3H 4D' }, table: '9D' });
    const res = applyMove(state, 'a', play('7S'));
    if (!res.ok) throw new Error('expected ok');
    expect(sortedIds(res.state.part1!.table)).toEqual(['7S', '9D']);
    expect(sortedIds(res.state.part1!.hands['a']!)).toEqual(['2H']);
    expect(res.state.turn).toBe('b');
    expect(res.events).toEqual([
      { type: 'CARD_PLAYED', player: 'a', card: { rank: '7', suit: 'S' } },
    ]);
    expect(res.state.part1!.lastCapturer).toBeNull();
  });

  it('capture order is irrelevant (set comparison)', () => {
    const state = p1({ hands: { a: '7S', b: '3H' }, table: '4C 3D' });
    expect(applyMove(state, 'a', play('7S', ['3D', '4C']))).toMatchObject({ ok: true });
    expect(applyMove(state, 'a', play('7S', ['4C', '3D']))).toMatchObject({ ok: true });
  });
});

describe('applyMove — capturing', () => {
  it('captured cards + played card go to capture pile; lastCapturer set; CAPTURED emitted', () => {
    const state = p1({
      hands: { a: '7S 2H', b: '3H 4D' },
      table: '3D 4C 9D',
      capturePiles: { a: 'KH' },
    });
    const res = applyMove(state, 'a', play('7S', ['3D', '4C']));
    if (!res.ok) throw new Error('expected ok');
    const part1 = res.state.part1!;
    expect(sortedIds(part1.table)).toEqual(['9D']);
    expect(sortedIds(part1.capturePiles['a']!)).toEqual(['3D', '4C', '7S', 'KH']);
    expect(part1.lastCapturer).toBe('a');
    const captured = res.events.find((e) => e.type === 'CAPTURED');
    expect(captured).toBeDefined();
    if (captured?.type === 'CAPTURED') {
      expect(sortedIds(captured.cards)).toEqual(['3D', '4C', '7S']);
    }
  });

  it('lastCapturer is preserved when a later play captures nothing', () => {
    const state = p1({
      hands: { a: '2H', b: '3H' },
      stock: '5C 6D',
      lastCapturer: 'b',
    });
    const res = applyMove(state, 'a', play('2H'));
    if (!res.ok) throw new Error('expected ok');
    expect(res.state.part1!.lastCapturer).toBe('b');
  });
});

describe('applyMove — drawing', () => {
  it('draws 1 from stock after playing; CARD_DRAWN emitted without card identity', () => {
    const state = p1({ hands: { a: '7S', b: '3H' }, stock: 'KD QC' });
    const res = applyMove(state, 'a', play('7S'));
    if (!res.ok) throw new Error('expected ok');
    expect(sortedIds(res.state.part1!.hands['a']!)).toEqual(['KD']);
    expect(sortedIds(res.state.part1!.stock)).toEqual(['QC']);
    const drawn = res.events.find((e) => e.type === 'CARD_DRAWN');
    expect(drawn).toEqual({ type: 'CARD_DRAWN', player: 'a' });
  });

  it('no draw and no CARD_DRAWN when stock is empty', () => {
    const state = p1({ hands: { a: '7S 2H', b: '3H' } });
    const res = applyMove(state, 'a', play('7S'));
    if (!res.ok) throw new Error('expected ok');
    expect(sortedIds(res.state.part1!.hands['a']!)).toEqual(['2H']);
    expect(res.events.some((e) => e.type === 'CARD_DRAWN')).toBe(false);
  });
});

describe('applyMove — turn order and empty-hand skipping (Clarification 6)', () => {
  it('skips players whose hands are empty', () => {
    const state = p1({ hands: { a: '2S 3H', b: '', c: '4D' }, turn: 'a' });
    const res = applyMove(state, 'a', play('2S'));
    if (!res.ok) throw new Error('expected ok');
    expect(res.state.turn).toBe('c');
  });

  it('turn wraps back to the sole remaining holder', () => {
    const state = p1({ hands: { a: '2S 3H', b: '' }, turn: 'a' });
    const res = applyMove(state, 'a', play('2S'));
    if (!res.ok) throw new Error('expected ok');
    expect(res.state.turn).toBe('a');
  });
});

describe('applyMove — duplicate capture ids (Phase 1 code review fix)', () => {
  it('duplicate ids in capture array → INVALID_CAPTURE', () => {
    const state = p1({ hands: { a: '7S', b: '3H' }, table: '3D 4C' });
    const res = applyMove(state, 'a', { type: 'PLAY_CAPTURE', card: '7S', capture: ['3D', '4C', '3D'] });
    expect(res).toMatchObject({ ok: false, error: 'INVALID_CAPTURE' });
    if (!res.ok) {
      expect(res.message).toContain('duplicate');
    }
  });
});

describe('applyMove — immutability', () => {
  it('never mutates the input state for Part 1 (deep-frozen input, JSON compare)', () => {
    const state = p1({
      hands: { a: '7S 2H', b: '3H 4D' },
      table: '3D 4C',
      stock: 'KD',
      capturePiles: { b: '9S' },
      lastCapturer: 'b',
    });
    const before = JSON.stringify(state);
    deepFreeze(state);
    const res = applyMove(state, 'a', play('7S', ['3D', '4C']));
    expect(res.ok).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('never mutates the input state for Part 2 PLAY_TRICK (deep-frozen input)', () => {
    const state = p2({ hands: { a: '2S 5H', b: '3H' } });
    const before = JSON.stringify(state);
    deepFreeze(state);
    const res = applyMove(state, 'a', { type: 'PLAY_TRICK', card: '2S' });
    expect(res.ok).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });
});
