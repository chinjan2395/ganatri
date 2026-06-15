/** Public state/move/event types — must match docs/ENGINE_API.md exactly. */

import type { Card, CardId, Suit } from './cards';

export type PlayerId = string;
export type Phase = 'LOBBY' | 'PART_1' | 'PART_2' | 'GAME_OVER';

/** Full server-only game state. Never send this to clients — use `viewFor`. */
export interface GameState {
  readonly phase: Phase;
  /** Clockwise seating order. */
  readonly seating: readonly PlayerId[];
  /** Leads Part 1 and Part 2 (chosen at random by `createGame`). */
  readonly firstPlayer: PlayerId;
  readonly turn: PlayerId | null;
  readonly part1: Part1State | null;
  readonly part2: Part2State | null;
  /** Winner → loser; set when phase reaches GAME_OVER. */
  readonly rankings: readonly PlayerId[] | null;
}

export interface Part1State {
  readonly hands: Readonly<Record<PlayerId, readonly Card[]>>;
  readonly stock: readonly Card[];
  readonly table: readonly Card[];
  readonly capturePiles: Readonly<Record<PlayerId, readonly Card[]>>;
  readonly lastCapturer: PlayerId | null;
}

export interface TrickPlay {
  readonly player: PlayerId;
  readonly card: Card;
  readonly isCut: boolean;
}

export interface Part2State {
  readonly hands: Readonly<Record<PlayerId, readonly Card[]>>;
  readonly trick: readonly TrickPlay[];
  readonly ledSuit: Suit | null;
  /** Order in which players emptied their hands (safe). */
  readonly safeOrder: readonly PlayerId[];
}

/** Client intents. `PLAY_CAPTURE.capture: []` means the card stays on the table. */
export type Move =
  | { type: 'PLAY_CAPTURE'; card: CardId; capture: readonly CardId[] }
  | { type: 'PLAY_TRICK'; card: CardId };

/** Server relays these to clients for animation. */
export type GameEvent =
  | { type: 'CARD_PLAYED'; player: PlayerId; card: Card }
  | { type: 'CAPTURED'; player: PlayerId; cards: readonly Card[] } // includes the played card
  | { type: 'CARD_DRAWN'; player: PlayerId } // card identity redacted
  | { type: 'PART1_ENDED'; sweeper: PlayerId | null; swept: readonly Card[] } // sweeper null → discarded
  | { type: 'TRICK_WON'; winner: PlayerId; cancelled: readonly Card[] }
  | { type: 'CUT'; cutter: PlayerId; pickerUpper: PlayerId; pickedUp: readonly Card[] }
  | { type: 'PLAYER_SAFE'; player: PlayerId }
  | { type: 'GAME_OVER'; rankings: readonly PlayerId[] };

export type MoveError =
  | 'WRONG_PHASE'
  | 'NOT_YOUR_TURN'
  | 'CARD_NOT_IN_HAND'
  | 'INVALID_CAPTURE'
  | 'CAPTURE_REQUIRED'
  | 'MUST_FOLLOW_SUIT';

export type MoveResult =
  | { ok: true; state: GameState; events: readonly GameEvent[] }
  | { ok: false; error: MoveError; message: string };

/** Redacted per-player view — what the server sends each client. */
export interface PlayerView {
  readonly phase: Phase;
  readonly you: PlayerId;
  readonly seating: readonly PlayerId[];
  readonly turn: PlayerId | null;
  readonly hand: readonly Card[]; // your cards only
  readonly handCounts: Readonly<Record<PlayerId, number>>;
  // Part 1
  readonly table: readonly Card[];
  readonly stockCount: number;
  readonly captureCounts: Readonly<Record<PlayerId, number>>;
  /** Own capture pile (Part 1 only); opponents see counts via `captureCounts` only. */
  readonly myCapturedCards: readonly Card[];
  // Part 2
  readonly trick: readonly TrickPlay[];
  readonly ledSuit: Suit | null;
  readonly safeOrder: readonly PlayerId[];
  readonly rankings: readonly PlayerId[] | null;
}
