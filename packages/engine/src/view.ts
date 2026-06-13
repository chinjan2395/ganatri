/** Redaction: build the per-player view the server is allowed to send. */

import type { Card } from './cards';
import type { GameState, PlayerId, PlayerView } from './types';

/**
 * The redacted view for `player`: own hand visible; opponents, stock, and
 * capture piles as counts only. Safe to serialize and send to that client.
 */
export function viewFor(state: GameState, player: PlayerId): PlayerView {
  const { part1, part2 } = state;
  const handCounts: Record<PlayerId, number> = {};
  const captureCounts: Record<PlayerId, number> = {};
  for (const p of state.seating) {
    const h = part1 ? part1.hands[p] : part2 ? part2.hands[p] : undefined;
    handCounts[p] = h?.length ?? 0;
    captureCounts[p] = part1 ? (part1.capturePiles[p]?.length ?? 0) : 0;
  }
  let hand: readonly Card[] = [];
  if (part1) hand = part1.hands[player] ?? [];
  else if (part2) hand = part2.hands[player] ?? [];

  return {
    phase: state.phase,
    you: player,
    seating: state.seating,
    turn: state.turn,
    hand,
    handCounts,
    table: part1?.table ?? [],
    stockCount: part1?.stock.length ?? 0,
    captureCounts,
    myCapturedCards: part1?.capturePiles[player] ?? [],
    trick: part2?.trick ?? [],
    ledSuit: part2?.ledSuit ?? null,
    safeOrder: part2?.safeOrder ?? [],
    rankings: state.rankings,
  };
}
