/**
 * Pure (DB-free) mapping functions: engine types -> persistence inputs.
 *
 * These are unit-testable in isolation and contain no Drizzle/pg imports. They
 * translate the engine's `GameState`/`GameEvent`/`Part*State` shapes into the
 * row inputs consumed by `GamePersistence`.
 *
 * Mappings (verified against `packages/engine/src/types.ts`):
 *  - seating -> `seating_order` jsonb + `player_count`
 *  - rankings -> per-player 1-based `final_rank` (winner = 1); winnerId = rankings[0]
 *  - Part1State.capturePiles[p].length -> `capture_count`
 *  - Part2State.safeOrder -> times_safe / result ordering
 *  - CUT events {cutter, pickerUpper} -> was_cut=true for pickerUpper;
 *    cuts_given (cutter) / cuts_received (pickerUpper)
 *  - GameEvent.type -> event_type; whole event -> payload jsonb;
 *    actor_user_id from the event's player/cutter/winner field.
 */

import type {
  GameEvent,
  GameState,
  Part1State,
  Part2State,
  PlayerId,
} from '@ganatri/engine';
import type { FinalPlayerResult, GameEventRow } from './types';

// ---------------------------------------------------------------------------
// Seating / player count
// ---------------------------------------------------------------------------

export interface SeatingMapping {
  seatingOrder: PlayerId[];
  playerCount: number;
}

export function mapSeating(seating: readonly PlayerId[]): SeatingMapping {
  return {
    seatingOrder: [...seating],
    playerCount: seating.length,
  };
}

// ---------------------------------------------------------------------------
// Rankings -> final ranks + winner
// ---------------------------------------------------------------------------

/** Returns a player -> 1-based rank map (winner = 1). */
export function mapRankings(
  rankings: readonly PlayerId[] | null | undefined
): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {};
  if (!rankings) return out;
  rankings.forEach((pid, i) => {
    out[pid] = i + 1;
  });
  return out;
}

/** Winner is rankings[0], or null if no rankings. */
export function mapWinner(
  rankings: readonly PlayerId[] | null | undefined
): PlayerId | null {
  return rankings && rankings.length > 0 ? rankings[0]! : null;
}

// ---------------------------------------------------------------------------
// Capture counts (Part 1)
// ---------------------------------------------------------------------------

export function captureCountFor(
  part1: Part1State | null | undefined,
  player: PlayerId
): number {
  if (!part1) return 0;
  return part1.capturePiles[player]?.length ?? 0;
}

export function mapCaptureCounts(
  part1: Part1State | null | undefined
): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {};
  if (!part1) return out;
  for (const [pid, pile] of Object.entries(part1.capturePiles)) {
    out[pid] = pile.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cuts (Part 2)
// ---------------------------------------------------------------------------

export interface CutTallies {
  /** cutter -> count of cuts given. */
  cutsGiven: Record<PlayerId, number>;
  /** pickerUpper -> count of cuts received. */
  cutsReceived: Record<PlayerId, number>;
  /** Set of players who were cut at least once (pickerUppers). */
  wasCut: Set<PlayerId>;
}

/** Tally cut events from an event log into per-player cut stats. */
export function tallyCuts(events: readonly GameEvent[]): CutTallies {
  const cutsGiven: Record<PlayerId, number> = {};
  const cutsReceived: Record<PlayerId, number> = {};
  const wasCut = new Set<PlayerId>();
  for (const ev of events) {
    if (ev.type === 'CUT') {
      cutsGiven[ev.cutter] = (cutsGiven[ev.cutter] ?? 0) + 1;
      cutsReceived[ev.pickerUpper] = (cutsReceived[ev.pickerUpper] ?? 0) + 1;
      wasCut.add(ev.pickerUpper);
    }
  }
  return { cutsGiven, cutsReceived, wasCut };
}

// ---------------------------------------------------------------------------
// Safe order (Part 2)
// ---------------------------------------------------------------------------

/** Players who emptied their hand (became safe), in order. */
export function mapSafeOrder(
  part2: Part2State | null | undefined
): PlayerId[] {
  return part2 ? [...part2.safeOrder] : [];
}

// ---------------------------------------------------------------------------
// Full final-results assembly (used at GAME_OVER)
// ---------------------------------------------------------------------------

export interface FinalResultsContext {
  state: GameState;
  events: readonly GameEvent[];
  /** Map engine PlayerId -> durable user id (null = guest, no row). */
  userIdOf?: (player: PlayerId) => string | null;
  /** Map engine PlayerId -> display name snapshot. */
  displayNameOf?: (player: PlayerId) => string;
  isAbandoned?: boolean;
}

/**
 * Build the per-player `game_players` rows from a finished `GameState`.
 * Seat index follows `state.seating`. final_rank from rankings (winner = 1).
 */
export function mapFinalPlayers(ctx: FinalResultsContext): FinalPlayerResult[] {
  const { state, events, userIdOf, displayNameOf, isAbandoned } = ctx;
  const ranks = mapRankings(state.rankings);
  const cuts = tallyCuts(events);
  const safe = new Set(mapSafeOrder(state.part2));

  return state.seating.map((pid, seatIndex) => {
    const finalRank = ranks[pid] ?? null;
    let result: string | null;
    if (isAbandoned) {
      result = 'ABANDONED';
    } else if (finalRank === 1) {
      result = 'WIN';
    } else if (finalRank != null) {
      result = 'LOSS';
    } else {
      result = null;
    }
    return {
      userId: userIdOf ? userIdOf(pid) : null,
      seatIndex,
      displayName: displayNameOf ? displayNameOf(pid) : pid,
      finalRank,
      wasCut: cuts.wasCut.has(pid),
      captureCount: captureCountFor(state.part1, pid),
      result,
    } satisfies FinalPlayerResult & { _safe?: boolean };
  }).map((r) => {
    // `safe` participation is reflected via stats (times_safe), not a column.
    void safe;
    return r;
  });
}

// ---------------------------------------------------------------------------
// Event -> row mapping
// ---------------------------------------------------------------------------

/** The actor user id for an event = its player/cutter/winner field, if any. */
export function actorOfEvent(ev: GameEvent): PlayerId | null {
  switch (ev.type) {
    case 'CARD_PLAYED':
    case 'CAPTURED':
    case 'CARD_DRAWN':
    case 'PLAYER_SAFE':
      return ev.player;
    case 'CUT':
      return ev.cutter;
    case 'TRICK_WON':
      return ev.winner;
    case 'PART1_ENDED':
      return ev.sweeper;
    case 'GAME_OVER':
      return ev.rankings[0] ?? null;
    case 'HANDS_REDISTRIBUTED':
      return null;
    default: {
      // Exhaustiveness guard.
      const _never: never = ev;
      return _never;
    }
  }
}

/**
 * Map a single engine event to an `AppendEventInput`-shaped object (minus
 * gameId/seq, which the caller supplies). `actorUserId` resolves the engine
 * player to a durable user id via the optional map.
 */
export function mapEvent(
  ev: GameEvent,
  opts?: { userIdOf?: (player: PlayerId) => string | null }
): {
  eventType: GameEventRow['eventType'];
  payload: GameEvent;
  actorUserId: string | null;
} {
  const actorPlayer = actorOfEvent(ev);
  const actorUserId =
    actorPlayer == null
      ? null
      : opts?.userIdOf
        ? opts.userIdOf(actorPlayer)
        : actorPlayer;
  return {
    eventType: ev.type,
    payload: ev,
    actorUserId,
  };
}
