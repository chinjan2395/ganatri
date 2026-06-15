# `packages/engine` — Public API Contract (approved 2026-06-13)

Approved by the game owner before implementation. Implementations must match these
signatures; rule semantics come from `docs/GAME_RULES.md` **including §7 Clarifications**.

Constraints: pure TypeScript (no React/socket/node imports), strict mode, immutable
state (functions never mutate inputs), seedable RNG so the same seed replays the same game.

```ts
// ---------- cards ----------
export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 'A'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K';
export interface Card { readonly rank: Rank; readonly suit: Suit; }
export type CardId = string;            // `${rank}${suit}` — unique, single deck
export function cardId(card: Card): CardId;
export function summationValue(card: Card): number | null;  // A=1, 2–10 face, J/Q/K → null

// ---------- players & phases ----------
export type PlayerId = string;
export type Phase = 'LOBBY' | 'PART_1' | 'PART_2' | 'GAME_OVER';

// ---------- full (server-only) state ----------
export interface GameState {
  readonly phase: Phase;
  readonly seating: readonly PlayerId[];          // clockwise order
  readonly firstPlayer: PlayerId;                 // leads Part 1 and Part 2
  readonly turn: PlayerId | null;
  readonly part1: Part1State | null;
  readonly part2: Part2State | null;
  readonly rankings: readonly PlayerId[] | null;  // winner → loser, set at GAME_OVER
  readonly seed: number | string;                 // retained for deterministic §4.6 redistribution sub-seeds
}

export interface Part1State {
  readonly hands: Readonly<Record<PlayerId, readonly Card[]>>;
  readonly stock: readonly Card[];
  readonly table: readonly Card[];
  readonly capturePiles: Readonly<Record<PlayerId, readonly Card[]>>;
  readonly lastCapturer: PlayerId | null;
}

export interface TrickPlay { readonly player: PlayerId; readonly card: Card; readonly isCut: boolean; }

export interface Part2State {
  readonly hands: Readonly<Record<PlayerId, readonly Card[]>>;
  readonly trick: readonly TrickPlay[];
  readonly ledSuit: Suit | null;
  readonly safeOrder: readonly PlayerId[];        // order players emptied (safe)
  readonly removedPool: readonly Card[];          // cards out of play (Part 1 discards + cancelled tricks); §4.6 redeal source
  readonly cutStreak: number;                     // consecutive no-cancel cuts; resets on a cancellation
  readonly redistributionCount: number;           // §4.6 redistributions performed (sub-seed counter)
}

// ---------- moves (client intents) ----------
export type Move =
  | { type: 'PLAY_CAPTURE'; card: CardId; capture: readonly CardId[] }  // Part 1; [] = card stays on table
  | { type: 'PLAY_TRICK';   card: CardId };                             // Part 2

// ---------- events (server relays; client animates) ----------
export type GameEvent =
  | { type: 'CARD_PLAYED';  player: PlayerId; card: Card }
  | { type: 'CAPTURED';     player: PlayerId; cards: readonly Card[] }   // includes the played card
  | { type: 'CARD_DRAWN';   player: PlayerId }                           // card identity redacted
  | { type: 'PART1_ENDED';  sweeper: PlayerId | null; swept: readonly Card[] }  // sweeper null → discarded
  | { type: 'TRICK_WON';    winner: PlayerId; cancelled: readonly Card[] }
  | { type: 'CUT';          cutter: PlayerId; pickerUpper: PlayerId; pickedUp: readonly Card[] }
  | { type: 'PLAYER_SAFE';  player: PlayerId }
  | { type: 'HANDS_REDISTRIBUTED'; dealt: Readonly<Record<PlayerId, number>>; poolRemaining: number }  // §4.6 stalemate top-up; per-player counts only
  | { type: 'GAME_OVER';    rankings: readonly PlayerId[] };

// ---------- results ----------
export type MoveError =
  | 'WRONG_PHASE' | 'NOT_YOUR_TURN' | 'CARD_NOT_IN_HAND'
  | 'INVALID_CAPTURE' | 'CAPTURE_REQUIRED' | 'MUST_FOLLOW_SUIT';

export type MoveResult =
  | { ok: true;  state: GameState; events: readonly GameEvent[] }
  | { ok: false; error: MoveError; message: string };

// ---------- core API ----------
export function createGame(seating: readonly PlayerId[], seed: number | string): GameState;
export function applyMove(state: GameState, player: PlayerId, move: Move): MoveResult;  // pure, never mutates

// ---------- legality helpers (server validation + UI highlighting) ----------
// All legal full capture sets for playing `card` now. Each set = all same-rank table
// cards + one maximal disjoint-combination selection (see GAME_RULES §7 #1–#3).
// Empty result ⇒ no capture possible; the only legal `capture` is [].
export function captureOptions(state: GameState, card: CardId): readonly (readonly CardId[])[];
export function legalPart2Cards(state: GameState, player: PlayerId): readonly CardId[];  // follow-suit filter
export function legalMoves(state: GameState, player: PlayerId): readonly Move[];         // exhaustive; for tests/bots

// ---------- redaction (what the server sends each client) ----------
export interface PlayerView {
  readonly phase: Phase;
  readonly you: PlayerId;
  readonly seating: readonly PlayerId[];
  readonly turn: PlayerId | null;
  readonly hand: readonly Card[];                              // your cards only
  readonly handCounts: Readonly<Record<PlayerId, number>>;
  // Part 1
  readonly table: readonly Card[];
  readonly stockCount: number;
  readonly captureCounts: Readonly<Record<PlayerId, number>>;
  // Part 2
  readonly trick: readonly TrickPlay[];
  readonly ledSuit: Suit | null;
  readonly safeOrder: readonly PlayerId[];
  readonly rankings: readonly PlayerId[] | null;
  readonly removedCount: number;                              // §4.6 removed-pool size (count only, never identities)
}
export function viewFor(state: GameState, player: PlayerId): PlayerView;
```

Notes:
- `createGame` performs the seeded shuffle, deal, and random first-player pick.
- The client submits its **chosen capture set explicitly** (`PLAY_CAPTURE.capture`); the
  server validates it against `captureOptions` — the same helper the UI uses for highlighting.
- Part 1 → Part 2 transition happens inside `applyMove` when all hands empty; GAME_OVER
  is reached from Part 2 (or immediately if ≤1 player holds cards when Part 2 starts).
