/** Card primitives: suits, ranks, ids, summation values, deck construction. */

export const SUITS = ['S', 'H', 'D', 'C'] as const;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];

export interface Card {
  readonly rank: Rank;
  readonly suit: Suit;
}

/** `${rank}${suit}` — unique within a single 52-card deck (e.g. "10H", "AS"). */
export type CardId = string;

/** Canonical id for a card: `${rank}${suit}`. */
export function cardId(card: Card): CardId {
  return `${card.rank}${card.suit}`;
}

/** Parses a CardId back into a Card. Throws on malformed ids (internal helper). */
export function parseCardId(id: CardId): Card {
  const suit = id.slice(-1) as Suit;
  const rank = id.slice(0, -1) as Rank;
  if (!SUITS.includes(suit) || !RANKS.includes(rank)) {
    throw new Error(`Invalid card id: ${id}`);
  }
  return { rank, suit };
}

/**
 * Part 1 summation value: A=1, number cards at face value, J/Q/K have no
 * numeric value and return null (they never participate in sums).
 */
export function summationValue(card: Card): number | null {
  if (card.rank === 'A') return 1;
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return null;
  return Number(card.rank);
}

/** The full 52-card deck in a fixed canonical order (pre-shuffle). */
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}
