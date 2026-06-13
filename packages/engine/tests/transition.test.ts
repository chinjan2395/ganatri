import { describe, expect, it } from 'vitest';
import { applyMove } from '../src/game';
import type { GameEvent, Move } from '../src/types';
import { p1, sortedIds } from './helpers';

function play(card: string, capture: string[] = []): Move {
  return { type: 'PLAY_CAPTURE', card, capture };
}

function eventTypes(events: readonly GameEvent[]): string[] {
  return events.map((e) => e.type);
}

describe('Part 1 end — sweep and transition to Part 2', () => {
  it('leftover table cards go to the last capturer; PART1_ENDED emitted', () => {
    const state = p1({
      hands: { a: '4S', b: '' },
      table: '9H',
      capturePiles: { a: '2S 3D', b: '5C 6H' },
      lastCapturer: 'b',
      turn: 'a',
      firstPlayer: 'a',
    });
    const res = applyMove(state, 'a', play('4S'));
    if (!res.ok) throw new Error('expected ok');
    expect(res.state.phase).toBe('PART_2');
    expect(res.state.part1).toBeNull();
    const part2 = res.state.part2!;
    expect(sortedIds(part2.hands['a']!)).toEqual(['2S', '3D']);
    expect(sortedIds(part2.hands['b']!)).toEqual(['4S', '5C', '6H', '9H']);
    expect(part2.trick).toEqual([]);
    expect(part2.ledSuit).toBeNull();
    expect(part2.safeOrder).toEqual([]);
    expect(res.state.rankings).toBeNull();
    const ended = res.events.find((e) => e.type === 'PART1_ENDED');
    if (ended?.type !== 'PART1_ENDED') throw new Error('missing PART1_ENDED');
    expect(ended.sweeper).toBe('b');
    expect(sortedIds(ended.swept)).toEqual(['4S', '9H']);
  });

  it('a capture on the final play makes that player the sweeper', () => {
    const state = p1({
      hands: { a: '7S', b: '' },
      table: '3H 4D 9C',
      capturePiles: { b: '2S 5D' },
      lastCapturer: 'b',
      turn: 'a',
      firstPlayer: 'a',
    });
    const res = applyMove(state, 'a', play('7S', ['3H', '4D']));
    if (!res.ok) throw new Error('expected ok');
    const ended = res.events.find((e) => e.type === 'PART1_ENDED');
    if (ended?.type !== 'PART1_ENDED') throw new Error('missing PART1_ENDED');
    expect(ended.sweeper).toBe('a');
    expect(sortedIds(ended.swept)).toEqual(['9C']);
    expect(sortedIds(res.state.part2!.hands['a']!)).toEqual(['3H', '4D', '7S', '9C']);
  });

  it('Part 2 leader is firstPlayer when they hold cards', () => {
    const state = p1({
      hands: { a: '', b: '4S' },
      capturePiles: { a: '2S', b: '5C' },
      lastCapturer: 'a',
      turn: 'b',
      firstPlayer: 'a',
    });
    const res = applyMove(state, 'b', play('4S'));
    if (!res.ok) throw new Error('expected ok');
    expect(res.state.phase).toBe('PART_2');
    expect(res.state.turn).toBe('a');
  });

  it('zero-capture players are immediately safe; lead passes clockwise past safe firstPlayer (Clarifications 9 & 10)', () => {
    const state = p1({
      seating: ['a', 'b', 'c'],
      hands: { a: '', b: '', c: '4S' },
      capturePiles: { a: '', b: '2S 9H', c: '5C' },
      lastCapturer: 'b',
      turn: 'c',
      firstPlayer: 'a',
    });
    const res = applyMove(state, 'c', play('4S'));
    if (!res.ok) throw new Error('expected ok');
    expect(res.state.phase).toBe('PART_2');
    expect(res.state.part2!.safeOrder).toEqual(['a']);
    expect(res.state.turn).toBe('b'); // next clockwise holder after safe firstPlayer
    expect(res.events).toContainEqual({ type: 'PLAYER_SAFE', player: 'a' });
  });

  it('safeOrder follows seating order starting from firstPlayer', () => {
    const state = p1({
      seating: ['a', 'b', 'c', 'd'],
      hands: { a: '', b: '', c: '', d: '4S' },
      capturePiles: { a: '', b: '2S', c: '', d: '5C' },
      lastCapturer: 'd',
      turn: 'd',
      firstPlayer: 'c',
    });
    const res = applyMove(state, 'd', play('4S'));
    if (!res.ok) throw new Error('expected ok');
    // Rotated seating from firstPlayer c: c, d, a, b → empty-handed: c then a.
    expect(res.state.part2!.safeOrder).toEqual(['c', 'a']);
    expect(res.state.turn).toBe('d');
  });
});

describe('Part 1 end — immediate GAME_OVER edge cases', () => {
  it('exactly one player holding cards at Part 2 start loses immediately', () => {
    const state = p1({
      hands: { a: '4S', b: '' },
      capturePiles: { a: '2S 9H', b: '' },
      lastCapturer: 'a',
      turn: 'a',
      firstPlayer: 'a',
    });
    const res = applyMove(state, 'a', play('4S'));
    if (!res.ok) throw new Error('expected ok');
    expect(res.state.phase).toBe('GAME_OVER');
    expect(res.state.turn).toBeNull();
    expect(res.state.rankings).toEqual(['b', 'a']); // safe first, loser last
    expect(eventTypes(res.events)).toEqual(['CARD_PLAYED', 'PART1_ENDED', 'PLAYER_SAFE', 'GAME_OVER']);
    const over = res.events.find((e) => e.type === 'GAME_OVER');
    if (over?.type !== 'GAME_OVER') throw new Error('missing GAME_OVER');
    expect(over.rankings).toEqual(['b', 'a']);
  });

  it('nobody captured all game: table discarded (sweeper null), no loser (Clarification 5)', () => {
    const state = p1({
      seating: ['a', 'b', 'c'],
      hands: { a: '', b: '', c: 'KS' },
      table: '2S 9H 4D',
      capturePiles: { a: '', b: '', c: '' },
      lastCapturer: null,
      turn: 'c',
      firstPlayer: 'b',
    });
    const res = applyMove(state, 'c', play('KS'));
    if (!res.ok) throw new Error('expected ok');
    expect(res.state.phase).toBe('GAME_OVER');
    const ended = res.events.find((e) => e.type === 'PART1_ENDED');
    if (ended?.type !== 'PART1_ENDED') throw new Error('missing PART1_ENDED');
    expect(ended.sweeper).toBeNull();
    expect(sortedIds(ended.swept)).toEqual(['2S', '4D', '9H', 'KS']);
    // Everyone safe, ranked by seating from firstPlayer b.
    expect(res.state.rankings).toEqual(['b', 'c', 'a']);
    expect(res.state.part2!.hands['c']).toEqual([]);
  });
});
