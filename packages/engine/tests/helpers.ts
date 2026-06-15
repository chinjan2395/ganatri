/** Test helpers: build cards and targeted GameStates directly. */

import { type Card, type Suit, parseCardId } from '../src/cards';
import type { GameState, Part2State, PlayerId, TrickPlay } from '../src/types';

/** Parse a single card id, e.g. c('10H'). */
export function c(id: string): Card {
  return parseCardId(id);
}

/** Parse space-separated card ids, e.g. cs('2S 5H 6D'). */
export function cs(idList: string): Card[] {
  return idList.length === 0 ? [] : idList.split(' ').map(parseCardId);
}

/** Sorted card ids of a card array, for order-insensitive assertions. */
export function sortedIds(cards: readonly Card[]): string[] {
  return cards.map((card) => `${card.rank}${card.suit}`).sort();
}

/** Normalize captureOptions output: each option sorted, options sorted. */
export function asSets(options: readonly (readonly string[])[]): string[] {
  return options.map((o) => [...o].sort().join(' ')).sort();
}

export interface P1Opts {
  /** Card-id strings per player; key order defines seating unless overridden. */
  hands: Record<PlayerId, string>;
  seating?: readonly PlayerId[];
  firstPlayer?: PlayerId;
  turn?: PlayerId | null;
  stock?: string;
  table?: string;
  capturePiles?: Record<PlayerId, string>;
  lastCapturer?: PlayerId | null;
}

/** Build a targeted PART_1 GameState. */
export function p1(opts: P1Opts): GameState {
  const seating = opts.seating ?? Object.keys(opts.hands);
  const firstPlayer = opts.firstPlayer ?? seating[0]!;
  const hands: Record<PlayerId, readonly Card[]> = {};
  const capturePiles: Record<PlayerId, readonly Card[]> = {};
  for (const p of seating) {
    hands[p] = cs(opts.hands[p] ?? '');
    capturePiles[p] = cs(opts.capturePiles?.[p] ?? '');
  }
  return {
    phase: 'PART_1',
    seating,
    firstPlayer,
    turn: opts.turn !== undefined ? opts.turn : firstPlayer,
    part1: {
      hands,
      stock: cs(opts.stock ?? ''),
      table: cs(opts.table ?? ''),
      capturePiles,
      lastCapturer: opts.lastCapturer ?? null,
    },
    part2: null,
    rankings: null,
    seed: 0,
  };
}

export interface P2Opts {
  /** Card-id strings per player; key order defines seating unless overridden. */
  hands: Record<PlayerId, string>;
  seating?: readonly PlayerId[];
  firstPlayer?: PlayerId;
  turn?: PlayerId | null;
  safeOrder?: readonly PlayerId[];
  trick?: readonly TrickPlay[];
  ledSuit?: Suit | null;
  removedPool?: string;
  cutStreak?: number;
  redistributionCount?: number;
}

/** Build a targeted PART_2 GameState. */
export function p2(optsOrHands: P2Opts | Record<PlayerId, string>, turn?: PlayerId | null): GameState {
  // Support legacy signature: p2({ a: '2S', b: '3H' }, 'a')
  // If the object has a `hands` key that is a Record<string,string>, it's P2Opts.
  // Otherwise treat the whole object as the hands map.
  let opts: P2Opts;
  const hasHandsKey = 'hands' in optsOrHands && typeof (optsOrHands as P2Opts).hands === 'object';
  if (hasHandsKey) {
    opts = optsOrHands as P2Opts;
    // allow turn override from second parameter if not set in opts
    if (opts.turn === undefined && turn !== undefined) {
      opts = { ...opts, turn };
    }
  } else {
    opts = { hands: optsOrHands as Record<PlayerId, string>, turn };
  }

  const seating = opts.seating ?? Object.keys(opts.hands);
  const firstPlayer = opts.firstPlayer ?? seating[0]!;
  const part2Hands: Record<PlayerId, readonly Card[]> = {};
  for (const p of seating) part2Hands[p] = cs(opts.hands[p] ?? '');
  const part2: Part2State = {
    hands: part2Hands,
    trick: opts.trick ?? [],
    ledSuit: opts.ledSuit ?? null,
    safeOrder: opts.safeOrder ?? [],
    removedPool: cs(opts.removedPool ?? ''),
    cutStreak: opts.cutStreak ?? 0,
    redistributionCount: opts.redistributionCount ?? 0,
  };
  const derivedTurn = opts.turn !== undefined ? opts.turn : seating[0]!;
  return {
    phase: 'PART_2',
    seating,
    firstPlayer,
    turn: derivedTurn,
    part1: null,
    part2,
    rankings: null,
    seed: 0,
  };
}

/** Recursively freeze a state so any mutation throws (strict mode). */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}
