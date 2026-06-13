/**
 * Client-side legality helpers for highlighting. Server remains authoritative.
 */

import { cardId, captureSetsFor, type Card, type CardId, type PlayerView } from '@ganatri/engine';

/**
 * Part 2 follow-suit: if no trick in progress, the whole hand is legal; if you
 * hold the led suit, only those cards are legal; otherwise the whole hand is
 * legal (a cut). Mirrors the engine without needing full GameState.
 */
export function legalPart2CardIds(view: PlayerView): Set<CardId> {
  const ids = new Set<CardId>();
  if (view.ledSuit === null || view.trick.length === 0) {
    for (const c of view.hand) ids.add(cardId(c));
    return ids;
  }
  const ledSuit = view.ledSuit;
  const hasLed = view.hand.some((c) => c.suit === ledSuit);
  for (const c of view.hand) {
    if (!hasLed || c.suit === ledSuit) ids.add(cardId(c));
  }
  return ids;
}

/** All legal capture sets for playing `card` onto the current Part 1 table. */
export function captureOptionsFor(card: Card, table: readonly Card[]): readonly (readonly CardId[])[] {
  return captureSetsFor(card, table);
}
