/**
 * Part 1 capture-set computation (GAME_RULES.md §3 + §7 Clarifications 1–4).
 *
 * A legal full capture set for playing a card =
 *   ALL same-rank table cards (mandatory, outside the 3-card combination limit)
 *   + the union of one selection of disjoint 2–3-card summation combinations
 *     achieving the MAXIMUM possible number of combinations.
 *
 * Played A/J/Q/K never sum: they capture same-rank table cards only.
 * Table Aces count as 1 inside other ranks' sums; table J/Q/K never sum.
 */

import { type Card, type CardId, cardId, summationValue } from './cards';

/**
 * All legal full capture sets for playing `played` onto `table`.
 * Empty result ⇒ no capture is possible (the only legal `capture` is `[]`).
 * Options are deduplicated by resulting card set.
 */
export function captureSetsFor(played: Card, table: readonly Card[]): readonly (readonly CardId[])[] {
  const sameRankIds = table.filter((c) => c.rank === played.rank).map(cardId);
  const v = summationValue(played);

  // Played A/J/Q/K: rank-match only (Clarifications 2 & 4).
  if (v === null || played.rank === 'A') {
    return sameRankIds.length > 0 ? [sameRankIds] : [];
  }

  // Summation pool: numeric table cards. Same-rank cards are excluded — they are
  // mandatory anyway and can never be part of a combination (v + anything > v).
  const pool = table.filter((c) => c.rank !== played.rank && summationValue(c) !== null);
  const vals = pool.map((c) => summationValue(c)!);

  // All 2–3-card combinations (by pool index) summing exactly to v.
  const combos: number[][] = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const two = vals[i]! + vals[j]!;
      if (two === v) {
        combos.push([i, j]);
      } else if (two < v) {
        for (let k = j + 1; k < pool.length; k++) {
          if (two + vals[k]! === v) combos.push([i, j, k]);
        }
      }
    }
  }

  if (combos.length === 0) {
    return sameRankIds.length > 0 ? [sameRankIds] : [];
  }

  const unions = maxDisjointUnions(combos, pool.length);
  return unions.map((u) => [...sameRankIds, ...u.map((i) => cardId(pool[i]!))]);
}

/**
 * All distinct card-index unions over selections of disjoint combinations that
 * achieve the maximum possible number of combinations (Clarification 3:
 * maximality is in combination COUNT, not card count). Different partitions of
 * the same card set collapse to one union.
 */
function maxDisjointUnions(combos: readonly (readonly number[])[], poolSize: number): number[][] {
  let best = 0;
  const unions: number[][] = [];
  const used: boolean[] = new Array<boolean>(poolSize).fill(false);
  const chosenCards: number[] = [];
  let chosenCount = 0;

  const dfs = (i: number): void => {
    if (chosenCount + (combos.length - i) < best) return; // cannot reach current best
    if (i === combos.length) {
      if (chosenCount === 0) return;
      if (chosenCount > best) {
        best = chosenCount;
        unions.length = 0;
      }
      if (chosenCount === best) {
        unions.push([...chosenCards].sort((a, b) => a - b));
      }
      return;
    }
    const combo = combos[i]!;
    if (combo.every((ci) => !used[ci])) {
      for (const ci of combo) {
        used[ci] = true;
        chosenCards.push(ci);
      }
      chosenCount++;
      dfs(i + 1);
      chosenCount--;
      for (const ci of combo) {
        used[ci] = false;
        chosenCards.pop();
      }
    }
    dfs(i + 1);
  };
  dfs(0);

  const seen = new Set<string>();
  const out: number[][] = [];
  for (const u of unions) {
    const key = u.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      out.push(u);
    }
  }
  return out;
}
