/** Core engine API: createGame, applyMove, legality helpers. Pure & immutable. */

import { type Card, type CardId, type Rank, type Suit, buildDeck, cardId, parseCardId } from './cards';
import { captureSetsFor } from './capture';
import { createRng, shuffle } from './rng';
import type {
  GameEvent,
  GameState,
  Move,
  MoveResult,
  Part1State,
  Part2State,
  PlayerId,
  TrickPlay,
} from './types';

const HAND_SIZE = 5;

/**
 * Rank order for Part 2 trick comparison: A > K > Q > J > 10 > 9 > … > 3 > 2.
 * Returns a numeric value: higher = beats lower.
 */
const RANK_ORDER: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 11,
  'Q': 12,
  'K': 13,
  'A': 14,
};

/**
 * Creates a fresh game: seeded shuffle, 5 cards to each player in seating
 * order, remainder as stock, seeded random first player (who also leads
 * Part 2). Fully deterministic per seed. Throws on invalid seating
 * (must be 2–4 unique players).
 */
export function createGame(seating: readonly PlayerId[], seed: number | string): GameState {
  if (seating.length < 2 || seating.length > 4) {
    throw new Error(`Ganatri requires 2-4 players, got ${seating.length}`);
  }
  if (new Set(seating).size !== seating.length) {
    throw new Error('Duplicate player ids in seating');
  }
  const rng = createRng(seed);
  const deck = shuffle(buildDeck(), rng);

  const hands: Record<PlayerId, readonly Card[]> = {};
  const capturePiles: Record<PlayerId, readonly Card[]> = {};
  let next = 0;
  for (const p of seating) {
    hands[p] = deck.slice(next, next + HAND_SIZE);
    capturePiles[p] = [];
    next += HAND_SIZE;
  }
  const stock = deck.slice(next);
  const firstPlayer = seating[Math.floor(rng() * seating.length)]!;

  return {
    phase: 'PART_1',
    seating: [...seating],
    firstPlayer,
    turn: firstPlayer,
    part1: { hands, stock, table: [], capturePiles, lastCapturer: null },
    part2: null,
    rankings: null,
    seed,
  };
}

/**
 * All legal full capture sets for playing `card` onto the current table
 * (see GAME_RULES §7 #1–#3). Empty result ⇒ no capture possible; the only
 * legal `capture` is `[]`. Returns [] outside Part 1.
 * Returns [] (not throwing) for unparseable card ids.
 */
export function captureOptions(state: GameState, card: CardId): readonly (readonly CardId[])[] {
  if (state.phase !== 'PART_1' || state.part1 === null) return [];
  let parsed: Card;
  try {
    parsed = parseCardId(card);
  } catch {
    return [];
  }
  return captureSetsFor(parsed, state.part1.table);
}

/**
 * Applies a move, returning a new state plus emitted events. Pure: never
 * mutates the input state. Handles the Part 1 → Part 2 transition (and
 * immediate GAME_OVER edge cases) when all Part 1 hands empty.
 */
export function applyMove(state: GameState, player: PlayerId, move: Move): MoveResult {
  if (move.type === 'PLAY_TRICK') {
    return applyTrick(state, player, move.card);
  }

  if (state.phase !== 'PART_1' || state.part1 === null) {
    return {
      ok: false,
      error: 'WRONG_PHASE',
      message: `PLAY_CAPTURE is only legal in PART_1 (phase is ${state.phase})`,
    };
  }
  if (state.turn !== player) {
    return { ok: false, error: 'NOT_YOUR_TURN', message: `It is ${state.turn ?? 'nobody'}'s turn` };
  }
  const part1 = state.part1;
  const hand = part1.hands[player] ?? [];
  const played = hand.find((c) => cardId(c) === move.card);
  if (played === undefined) {
    return { ok: false, error: 'CARD_NOT_IN_HAND', message: `${move.card} is not in your hand` };
  }

  // Reject duplicate ids in the capture array (Phase 1 review fix).
  if (move.capture.length !== new Set(move.capture).size) {
    return {
      ok: false,
      error: 'INVALID_CAPTURE',
      message: 'Capture array contains duplicate card ids',
    };
  }

  const options = captureSetsFor(played, part1.table);
  const chosen = [...move.capture];
  if (chosen.length === 0) {
    if (options.length > 0) {
      return {
        ok: false,
        error: 'CAPTURE_REQUIRED',
        message: 'A capture exists for this card and capturing is mandatory',
      };
    }
  } else {
    const key = setKey(chosen);
    if (!options.some((o) => setKey(o) === key)) {
      return {
        ok: false,
        error: 'INVALID_CAPTURE',
        message: 'Chosen cards are not a legal capture set for this card',
      };
    }
  }

  const events: GameEvent[] = [{ type: 'CARD_PLAYED', player, card: played }];
  let newHand = hand.filter((c) => cardId(c) !== move.card);
  const capturePiles: Record<PlayerId, readonly Card[]> = { ...part1.capturePiles };
  let table: readonly Card[];
  let lastCapturer = part1.lastCapturer;

  if (chosen.length > 0) {
    const chosenSet = new Set(chosen);
    const capturedTable = part1.table.filter((c) => chosenSet.has(cardId(c)));
    table = part1.table.filter((c) => !chosenSet.has(cardId(c)));
    const gained = [...capturedTable, played];
    capturePiles[player] = [...(capturePiles[player] ?? []), ...gained];
    lastCapturer = player;
    events.push({ type: 'CAPTURED', player, cards: gained });
  } else {
    table = [...part1.table, played];
  }

  let stock = part1.stock;
  if (stock.length > 0) {
    newHand = [...newHand, stock[0]!];
    stock = stock.slice(1);
    events.push({ type: 'CARD_DRAWN', player });
  }

  const hands: Record<PlayerId, readonly Card[]> = { ...part1.hands, [player]: newHand };
  const newPart1: Part1State = { hands, stock, table, capturePiles, lastCapturer };

  const everyoneEmpty = state.seating.every((p) => (hands[p] ?? []).length === 0);
  if (!everyoneEmpty) {
    const turn = nextWithCards(state.seating, player, hands);
    return { ok: true, state: { ...state, turn, part1: newPart1 }, events };
  }
  return endPart1(state, newPart1, events);
}

/** Part 1 end: sweep table to last capturer (or discard), build Part 2 state. */
function endPart1(state: GameState, part1: Part1State, events: GameEvent[]): MoveResult {
  const swept = part1.table;
  const piles: Record<PlayerId, readonly Card[]> = { ...part1.capturePiles };
  const sweeper = part1.lastCapturer; // null ⇒ nobody captured all game ⇒ discard (Clarification 5)
  // Discarded sweep cards (no-capturer case) seed the Part 2 removed pool so
  // they can re-enter play via stalemate redistribution (§4.6). When there is
  // a sweeper, those cards go into their pile instead and the pool starts empty.
  let removedPool: readonly Card[] = [];
  if (sweeper !== null && swept.length > 0) {
    piles[sweeper] = [...(piles[sweeper] ?? []), ...swept];
  } else if (sweeper === null && swept.length > 0) {
    removedPool = [...swept];
  }
  events.push({ type: 'PART1_ENDED', sweeper, swept });

  const hands: Record<PlayerId, readonly Card[]> = {};
  for (const p of state.seating) hands[p] = piles[p] ?? [];

  // Seating order starting from the Part 1 first player (Clarification 10).
  const order = rotateFrom(state.seating, state.firstPlayer);
  const safeOrder = order.filter((p) => hands[p]!.length === 0);
  for (const p of safeOrder) events.push({ type: 'PLAYER_SAFE', player: p });
  const holders = order.filter((p) => hands[p]!.length > 0);

  const part2: Part2State = {
    hands,
    trick: [],
    ledSuit: null,
    safeOrder,
    removedPool,
    cutStreak: 0,
    redistributionCount: 0,
  };

  if (holders.length <= 1) {
    // One holder ⇒ they lose immediately; zero holders ⇒ no loser.
    const rankings = holders.length === 1 ? [...safeOrder, holders[0]!] : safeOrder;
    events.push({ type: 'GAME_OVER', rankings });
    return {
      ok: true,
      state: { ...state, phase: 'GAME_OVER', turn: null, part1: null, part2, rankings },
      events,
    };
  }
  // First lead: firstPlayer if they hold cards, else next clockwise holder
  // (Clarification 9). `holders` preserves the rotated order, so index 0 is it.
  return {
    ok: true,
    state: { ...state, phase: 'PART_2', turn: holders[0]!, part1: null, part2 },
    events,
  };
}

// ---------------------------------------------------------------------------
// Part 2 trick resolution
// ---------------------------------------------------------------------------

/**
 * Apply a PLAY_TRICK move during PART_2.
 * Enforces follow-suit, detects cuts, resolves completed tricks and cuts,
 * advances safe tracking and game-over conditions.
 */
function applyTrick(state: GameState, player: PlayerId, cardStr: CardId): MoveResult {
  if (state.phase !== 'PART_2' || state.part2 === null) {
    return {
      ok: false,
      error: 'WRONG_PHASE',
      message: `PLAY_TRICK is only legal in PART_2 (phase is ${state.phase})`,
    };
  }
  if (state.turn !== player) {
    return { ok: false, error: 'NOT_YOUR_TURN', message: `It is ${state.turn ?? 'nobody'}'s turn` };
  }

  const part2 = state.part2;
  const hand = part2.hands[player] ?? [];
  const played = hand.find((c) => cardId(c) === cardStr);
  if (played === undefined) {
    return { ok: false, error: 'CARD_NOT_IN_HAND', message: `${cardStr} is not in your hand` };
  }

  const events: GameEvent[] = [{ type: 'CARD_PLAYED', player, card: played }];
  const newHand = hand.filter((c) => cardId(c) !== cardStr);

  const isLeader = part2.trick.length === 0;

  // Determine if this is a cut (follower with no led-suit cards).
  let isCut = false;
  if (!isLeader && part2.ledSuit !== null) {
    const handHasLedSuit = hand.some((c) => c.suit === part2.ledSuit);
    if (handHasLedSuit && played.suit !== part2.ledSuit) {
      return {
        ok: false,
        error: 'MUST_FOLLOW_SUIT',
        message: `You must follow suit ${part2.ledSuit}`,
      };
    }
    if (!handHasLedSuit) {
      isCut = true;
    }
  }

  const ledSuit: Suit | null = isLeader ? played.suit : part2.ledSuit;
  const trickPlay: TrickPlay = { player, card: played, isCut };
  const newTrick = [...part2.trick, trickPlay];

  if (isCut) {
    return resolveCut(state, part2, newTrick, ledSuit!, newHand, player, events);
  }

  // Not a cut. Update hands.
  const updatedHands: Record<PlayerId, readonly Card[]> = { ...part2.hands, [player]: newHand };

  if (isLeader) {
    // Leader played; wait for followers. Advance turn clockwise to next active player.
    const nextTurn = nextActivePart2(state.seating, player, part2.safeOrder);
    // If the leader is the only active player (no other active players),
    // the trick is complete immediately (all-followed trivially).
    if (nextTurn === player) {
      // Only one active player; trick completes as won.
      return resolveTrickWon(
        state,
        { ...part2, hands: updatedHands },
        newTrick,
        ledSuit!,
        events,
      );
    }
    const newPart2: Part2State = {
      ...part2,
      hands: updatedHands,
      trick: newTrick,
      ledSuit,
    };
    return { ok: true, state: { ...state, turn: nextTurn, part2: newPart2 }, events };
  }

  // Follower (no cut). Check if trick is complete (all active players have played).
  const activePlayers = state.seating.filter((p) => !part2.safeOrder.includes(p));
  const playersInTrick = new Set(newTrick.map((tp) => tp.player));
  const trickComplete = activePlayers.every((p) => playersInTrick.has(p));

  if (trickComplete) {
    return resolveTrickWon(
      state,
      { ...part2, hands: updatedHands },
      newTrick,
      ledSuit!,
      events,
    );
  }

  // Trick not yet complete; advance turn.
  const nextTurn = nextActivePart2(state.seating, player, part2.safeOrder);
  const newPart2: Part2State = {
    ...part2,
    hands: updatedHands,
    trick: newTrick,
    ledSuit,
  };
  return { ok: true, state: { ...state, turn: nextTurn, part2: newPart2 }, events };
}

/**
 * Resolve a cut: the holder of the highest led-suit card on the current
 * trick picks up ALL trick cards into their hand. The cutter leads next
 * (or the next non-safe player clockwise if the cutter just emptied their hand).
 */
function resolveCut(
  state: GameState,
  part2: Part2State,
  trick: readonly TrickPlay[],
  ledSuit: Suit,
  cutterNewHand: readonly Card[],
  cutter: PlayerId,
  events: GameEvent[],
): MoveResult {
  // Build updated hands (cutter's hand already has the played card removed).
  const handsAfterPlay: Record<PlayerId, readonly Card[]> = {
    ...part2.hands,
    [cutter]: cutterNewHand,
  };

  // Find the holder of the highest led-suit card in the current trick.
  let pickerUpper: PlayerId | null = null;
  let bestRank = -1;
  for (const tp of trick) {
    if (tp.card.suit === ledSuit) {
      const rv = RANK_ORDER[tp.card.rank];
      if (rv > bestRank) {
        bestRank = rv;
        pickerUpper = tp.player;
      }
    }
  }

  if (pickerUpper === null) {
    // No led-suit card on the table (cutter played before any led-suit card —
    // impossible since leader always plays led suit, but guard defensively).
    // This shouldn't happen in a valid game; treat as cutter keeps cards.
    pickerUpper = cutter;
  }

  // All trick cards go to pickerUpper.
  const pickedUp = trick.map((tp) => tp.card);
  const handsAfterPickup: Record<PlayerId, readonly Card[]> = { ...handsAfterPlay };
  handsAfterPickup[pickerUpper] = [
    ...(handsAfterPlay[pickerUpper] ?? []),
    ...pickedUp,
  ];

  events.push({ type: 'CUT', cutter, pickerUpper, pickedUp });

  // Check ALL trick participants for empty hands (not just the cutter).
  // Players who played in this trick had their cards removed when they played.
  // The picker-upper just gained cards so they cannot be empty from this trick.
  let safeOrder = [...part2.safeOrder];
  for (const tp of trick) {
    const p = tp.player;
    if (p === pickerUpper) continue; // picker-upper just gained cards, cannot be safe now
    const handAfter = handsAfterPickup[p] ?? [];
    if (handAfter.length === 0 && !safeOrder.includes(p)) {
      safeOrder = [...safeOrder, p];
      events.push({ type: 'PLAYER_SAFE', player: p });
    }
  }

  // Reset trick and ledSuit.
  const newPart2: Part2State = {
    ...part2,
    hands: handsAfterPickup,
    trick: [],
    ledSuit: null,
    safeOrder,
    cutStreak: part2.cutStreak + 1,
  };

  // Check game-over conditions.
  const activeAfter = state.seating.filter((p) => !safeOrder.includes(p));
  if (activeAfter.length <= 1) {
    return resolveGameOver(state, newPart2, safeOrder, activeAfter, events);
  }

  // Cutter leads next (or next non-safe clockwise if cutter is now safe).
  const nextLeader = safeOrder.includes(cutter)
    ? nextNonSafeClockwise(state.seating, cutter, safeOrder)
    : cutter;

  // Stalemate detection (§4.6): a long run of no-cancel cuts means the remaining
  // active players keep cutting and no hand ever drains, so the game can loop
  // forever. `activeAfter` here is ≥2 (the ≤1 game-over case returned above) and
  // each such player still holds cards. Top them all back up to 5 from the
  // removed pool; the current leader continues.
  const threshold = Math.max(2, activeAfter.length);
  if (newPart2.cutStreak >= threshold) {
    if (newPart2.removedPool.length === 0) {
      // Nothing left to redeal — the stalemate cannot be broken. End as a draw
      // (no loser), matching the zero-active outcome in resolveGameOver.
      return resolveGameOver(state, newPart2, safeOrder, activeAfter, events);
    }
    return redistributeHands(state, newPart2, nextLeader, events);
  }

  return {
    ok: true,
    state: { ...state, turn: nextLeader, part2: newPart2 },
    events,
  };
}

/**
 * Stalemate redistribution (§4.6). Reshuffle the removed pool with a seeded RNG
 * (deterministic per game seed + redistribution count) and deal round-robin, one
 * card at a time clockwise from `leader`, to each active player holding fewer
 * than 5 cards, until every active player reaches 5 or the pool is exhausted.
 * Players already at ≥5 are skipped (top-up floor, not a cap). The current leader
 * continues; safeOrder and rankings are unchanged.
 */
function redistributeHands(
  state: GameState,
  part2: Part2State,
  leader: PlayerId,
  events: GameEvent[],
): MoveResult {
  const rng = createRng(`${state.seed}#redeal${part2.redistributionCount}`);
  const pool = shuffle(part2.removedPool, rng);
  const hands: Record<PlayerId, readonly Card[]> = { ...part2.hands };
  const active = state.seating.filter((p) => !part2.safeOrder.includes(p));
  // Round-robin order: active players clockwise starting from the leader.
  const ordered = rotateFrom(state.seating, leader).filter((p) => active.includes(p));
  const dealt: Record<PlayerId, number> = {};
  for (const p of ordered) dealt[p] = 0;

  let idx = 0;
  let progressed = true;
  while (idx < pool.length && progressed) {
    progressed = false;
    for (const p of ordered) {
      if (idx >= pool.length) break;
      if ((hands[p] ?? []).length < HAND_SIZE) {
        hands[p] = [...(hands[p] ?? []), pool[idx]!];
        dealt[p] = (dealt[p] ?? 0) + 1;
        idx++;
        progressed = true;
      }
    }
  }

  const remaining = pool.slice(idx);
  const newPart2: Part2State = {
    ...part2,
    hands,
    trick: [],
    ledSuit: null,
    removedPool: remaining,
    cutStreak: 0,
    redistributionCount: part2.redistributionCount + 1,
  };
  events.push({ type: 'HANDS_REDISTRIBUTED', dealt, poolRemaining: remaining.length });
  return { ok: true, state: { ...state, turn: leader, part2: newPart2 }, events };
}

/**
 * Resolve a completed trick (all active players followed suit):
 * highest led-suit card wins; all played cards are cancelled permanently.
 * Winner leads next. Empty-hand players become safe.
 */
function resolveTrickWon(
  state: GameState,
  part2: Part2State,
  trick: readonly TrickPlay[],
  ledSuit: Suit,
  events: GameEvent[],
): MoveResult {
  // Find winner: highest led-suit card in the trick.
  let winner: PlayerId | null = null;
  let bestRank = -1;
  for (const tp of trick) {
    if (tp.card.suit === ledSuit) {
      const rv = RANK_ORDER[tp.card.rank];
      if (rv > bestRank) {
        bestRank = rv;
        winner = tp.player;
      }
    }
  }

  if (winner === null) {
    // Defensive: no led-suit card found; pick the last player in the trick.
    winner = trick[trick.length - 1]!.player;
  }

  const cancelled = trick.map((tp) => tp.card);
  events.push({ type: 'TRICK_WON', winner, cancelled });

  // All trick cards are cancelled (permanently removed — not returned to any hand).
  // Hands were already updated before this call (each player's card removed from hand).
  let safeOrder = [...part2.safeOrder];

  // Players who emptied their hands on this trick become safe.
  // Order: by their position in the trick (Clarification 10).
  for (const tp of trick) {
    const p = tp.player;
    if (!safeOrder.includes(p) && (part2.hands[p] ?? []).length === 0) {
      safeOrder = [...safeOrder, p];
      events.push({ type: 'PLAYER_SAFE', player: p });
    }
  }

  // Reset trick and ledSuit.
  const newPart2: Part2State = {
    ...part2,
    hands: part2.hands,
    trick: [],
    ledSuit: null,
    safeOrder,
    removedPool: [...part2.removedPool, ...cancelled],
    cutStreak: 0,
  };

  // Check game-over conditions.
  const activeAfter = state.seating.filter((p) => !safeOrder.includes(p));
  if (activeAfter.length <= 1) {
    return resolveGameOver(state, newPart2, safeOrder, activeAfter, events);
  }

  // Winner leads next (or next non-safe clockwise if winner is now safe).
  const nextLeader = safeOrder.includes(winner)
    ? nextNonSafeClockwise(state.seating, winner, safeOrder)
    : winner;

  return {
    ok: true,
    state: { ...state, turn: nextLeader, part2: newPart2 },
    events,
  };
}

/**
 * Handle end-of-trick game-over: 0 or 1 active players remaining.
 * - 1 active: they lose. rankings = [...safeOrder, loser].
 * - 0 active: no loser. rankings = [...safeOrder].
 */
function resolveGameOver(
  state: GameState,
  part2: Part2State,
  safeOrder: readonly PlayerId[],
  activeAfter: readonly PlayerId[],
  events: GameEvent[],
): MoveResult {
  const rankings =
    activeAfter.length === 1
      ? [...safeOrder, activeAfter[0]!]
      : [...safeOrder];
  events.push({ type: 'GAME_OVER', rankings });
  return {
    ok: true,
    state: { ...state, phase: 'GAME_OVER', turn: null, part2, rankings },
    events,
  };
}

// ---------------------------------------------------------------------------
// Legality helpers
// ---------------------------------------------------------------------------

/**
 * Cards `player` may legally play to the current trick (follow-suit filter).
 * Returns [] if wrong phase, player not seated/active, or not player's turn.
 */
export function legalPart2Cards(state: GameState, player: PlayerId): readonly CardId[] {
  if (state.phase !== 'PART_2' || state.part2 === null) return [];
  if (!state.seating.includes(player)) return [];
  if (state.part2.safeOrder.includes(player)) return [];
  if (state.turn !== player) return [];

  const hand = state.part2.hands[player] ?? [];
  const ledSuit = state.part2.ledSuit;

  // Empty trick (this player is the leader): any card is legal.
  if (ledSuit === null || state.part2.trick.length === 0) {
    return hand.map(cardId);
  }

  // Follower: must follow suit if possible.
  const suitCards = hand.filter((c) => c.suit === ledSuit);
  if (suitCards.length > 0) {
    return suitCards.map(cardId);
  }
  // No led-suit cards: any card is legal (cut).
  return hand.map(cardId);
}

/**
 * Every legal move for `player` right now (exhaustive; for server validation,
 * tests, and bots). Empty unless it is the player's turn.
 */
export function legalMoves(state: GameState, player: PlayerId): readonly Move[] {
  if (state.turn !== player) return [];
  if (state.phase === 'PART_1' && state.part1 !== null) {
    const moves: Move[] = [];
    for (const c of state.part1.hands[player] ?? []) {
      const id = cardId(c);
      const options = captureSetsFor(c, state.part1.table);
      if (options.length === 0) {
        moves.push({ type: 'PLAY_CAPTURE', card: id, capture: [] });
      } else {
        for (const capture of options) moves.push({ type: 'PLAY_CAPTURE', card: id, capture });
      }
    }
    return moves;
  }
  if (state.phase === 'PART_2') {
    return legalPart2Cards(state, player).map((card) => ({ type: 'PLAY_TRICK', card }));
  }
  return [];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Order-insensitive key for comparing capture sets. */
function setKey(ids: readonly CardId[]): string {
  return [...ids].sort().join('|');
}

/** Next player clockwise after `from` whose hand is non-empty (may wrap to `from`). */
function nextWithCards(
  seating: readonly PlayerId[],
  from: PlayerId,
  hands: Readonly<Record<PlayerId, readonly Card[]>>,
): PlayerId {
  const start = seating.indexOf(from);
  for (let step = 1; step <= seating.length; step++) {
    const p = seating[(start + step) % seating.length]!;
    if ((hands[p] ?? []).length > 0) return p;
  }
  throw new Error('nextWithCards called with all hands empty');
}

/** Seating rotated so that `from` comes first. */
function rotateFrom(seating: readonly PlayerId[], from: PlayerId): PlayerId[] {
  const i = seating.indexOf(from);
  return [...seating.slice(i), ...seating.slice(0, i)];
}

/**
 * Next active (non-safe) player clockwise after `from` in Part 2.
 * Wraps around; never returns a safe player.
 * If `from` itself is the only active player, returns `from`.
 */
function nextActivePart2(
  seating: readonly PlayerId[],
  from: PlayerId,
  safeOrder: readonly PlayerId[],
): PlayerId {
  const start = seating.indexOf(from);
  for (let step = 1; step <= seating.length; step++) {
    const p = seating[(start + step) % seating.length]!;
    if (!safeOrder.includes(p)) return p;
  }
  // All other players are safe; the caller is the only active player.
  return from;
}

/**
 * First non-safe player clockwise AFTER `from` (not including `from` itself).
 * Used when the would-be leader just became safe.
 */
function nextNonSafeClockwise(
  seating: readonly PlayerId[],
  from: PlayerId,
  safeOrder: readonly PlayerId[],
): PlayerId {
  const start = seating.indexOf(from);
  for (let step = 1; step <= seating.length; step++) {
    const p = seating[(start + step) % seating.length]!;
    if (!safeOrder.includes(p)) return p;
  }
  // Should not happen if game-over is checked first.
  throw new Error('nextNonSafeClockwise: all players are safe');
}
