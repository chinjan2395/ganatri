import type { GameEvent, GameState, PlayerId } from '@ganatri/engine';
import type {
  MatchScoreBreakdownRow,
  PlayerProgression,
  ScoredGamePlayerResult,
} from '@ganatri/db';

const PLACEMENT_MATCH_BONUS: Record<number, number[]> = {
  2: [30, 0],
  3: [30, 20, 0],
  4: [30, 20, 10, 0],
};

const PLACEMENT_RATING_DELTA: Record<number, number[]> = {
  2: [20, -20],
  3: [24, 4, -16],
  4: [28, 10, -4, -18],
};

const XP_MATCH_BASE = 10;
const ABANDON_PENALTY = -15;

export interface ScoreFinishedGameInput {
  state: GameState;
  events: readonly GameEvent[];
  isAbandoned: boolean;
  userIdByPlayerId: Readonly<Record<string, string | null>>;
  previousProgressionByUserId: Readonly<Record<string, PlayerProgression | undefined>>;
}

export interface MatchScoringSnapshot {
  totals: Record<string, number>;
  breakdowns: Record<string, MatchScoreBreakdownRow[]>;
  initialSafePlayers: Set<string>;
}

export function levelFromXp(totalXp: number): number {
  return Math.floor(Math.sqrt(Math.max(totalXp, 0) / 25)) + 1;
}

export function computeMatchScoringSnapshot(
  state: GameState,
  events: readonly GameEvent[]
): MatchScoringSnapshot {
  const seating = [...state.seating];
  const totals = Object.fromEntries(seating.map((pid) => [pid, 0])) as Record<string, number>;
  const breakdowns = Object.fromEntries(
    seating.map((pid) => [pid, [] as MatchScoreBreakdownRow[]])
  ) as Record<string, MatchScoreBreakdownRow[]>;

  const captureCounts = state.part1?.capturePiles ?? {};
  for (const pid of seating) {
    const captureCount = captureCounts[pid]?.length ?? 0;
    if (captureCount > 0) {
      pushRow(breakdowns, totals, pid, {
        kind: 'MATCH_SCORE',
        reason: 'CAPTURE_CARD',
        delta: captureCount,
      });
    }
  }

  let tableCount = 0;
  let pendingPlayedCard: { player: PlayerId; card: { rank: string } } | null = null;
  let sawPart1Ended = false;
  const initialSafePlayers = new Set<string>();
  let collectingInitialSafe = false;

  for (const event of events) {
    if (event.type === 'CARD_PLAYED') {
      if (pendingPlayedCard !== null) {
        tableCount += 1;
      }
      pendingPlayedCard = { player: event.player, card: event.card };
      collectingInitialSafe = false;
      continue;
    }

    if (event.type === 'CAPTURED') {
      const played = pendingPlayedCard;
      const capturedCount = event.cards.length - 1;
      tableCount = Math.max(0, tableCount - Math.max(capturedCount, 0));
      if (played && hasSameRankCapture(played.card.rank, event.cards)) {
        pushRow(breakdowns, totals, event.player, {
          kind: 'MATCH_SCORE',
          reason: 'SAME_RANK_BONUS',
          delta: 2,
        });
      }
      if (capturedCount > 0 && tableCount === 0) {
        pushRow(breakdowns, totals, event.player, {
          kind: 'MATCH_SCORE',
          reason: 'TABLE_CLEAR',
          delta: 5,
        });
      }
      pendingPlayedCard = null;
      continue;
    }

    if (pendingPlayedCard !== null) {
      tableCount += 1;
      pendingPlayedCard = null;
    }

    if (event.type === 'CUT') {
      pushRow(breakdowns, totals, event.cutter, {
        kind: 'MATCH_SCORE',
        reason: 'CUT',
        delta: 3,
      });
      collectingInitialSafe = false;
      continue;
    }

    if (event.type === 'PART1_ENDED') {
      tableCount = 0;
      sawPart1Ended = true;
      collectingInitialSafe = true;
      continue;
    }

    if (event.type === 'PLAYER_SAFE' && sawPart1Ended && collectingInitialSafe) {
      initialSafePlayers.add(event.player);
      continue;
    }

    collectingInitialSafe = false;
  }

  if (state.phase === 'GAME_OVER' && state.rankings) {
    const placementBonuses = PLACEMENT_MATCH_BONUS[state.seating.length] ?? [];
    for (let i = 0; i < state.rankings.length; i += 1) {
      const pid = state.rankings[i]!;
      const placementBonus = placementBonuses[i] ?? 0;
      if (placementBonus > 0) {
        pushRow(breakdowns, totals, pid, {
          kind: 'MATCH_SCORE',
          reason: 'PLACEMENT_BONUS',
          delta: placementBonus,
        });
      }
      const captureCount = captureCounts[pid]?.length ?? 0;
      if (captureCount === 0 && initialSafePlayers.has(pid)) {
        pushRow(breakdowns, totals, pid, {
          kind: 'MATCH_SCORE',
          reason: 'GHOST_BONUS',
          delta: 5,
        });
      }
    }
  }

  return { totals, breakdowns, initialSafePlayers };
}

export function scoreFinishedGame(input: ScoreFinishedGameInput): ScoredGamePlayerResult[] {
  const { state, events, isAbandoned, userIdByPlayerId, previousProgressionByUserId } = input;
  const snapshot = computeMatchScoringSnapshot(state, events);
  const rankingDeltas = placementRatingDeltas(state.rankings ?? [], state.seating.length, isAbandoned);

  return state.seating.map((pid, seatIndex) => {
    const userId = userIdByPlayerId[pid] ?? null;
    const previous = userId ? (previousProgressionByUserId[userId] ?? zeroProgression(userId)) : null;
    const matchScore = snapshot.totals[pid] ?? 0;
    const xpEarned = XP_MATCH_BASE + matchScore;
    const rankedRatingDelta = rankingDeltas.get(pid) ?? 0;
    const ghostFinish = snapshot.initialSafePlayers.has(pid) && ((state.part1?.capturePiles[pid]?.length ?? 0) === 0);
    const progressionAfter: PlayerProgression | null = previous && userId
      ? {
          userId,
          rankedRating: previous.rankedRating + rankedRatingDelta,
          totalXp: previous.totalXp + xpEarned,
          level: levelFromXp(previous.totalXp + xpEarned),
          highestMatchScore: Math.max(previous.highestMatchScore, matchScore),
          totalMatchScore: previous.totalMatchScore + matchScore,
          ghostFinishes: previous.ghostFinishes + (ghostFinish ? 1 : 0),
          updatedAt: new Date(),
        }
      : null;

    const ratingBreakdown: MatchScoreBreakdownRow[] = [
      {
        kind: 'RANKED_RATING',
        reason: 'RANKED_PLACEMENT',
        delta: rankedRatingDelta - (isAbandoned ? ABANDON_PENALTY : 0),
      },
    ];
    if (isAbandoned) {
      ratingBreakdown.push({
        kind: 'RANKED_RATING',
        reason: 'ABANDON_PENALTY',
        delta: ABANDON_PENALTY,
      });
    }

    const xpBreakdown: MatchScoreBreakdownRow[] = [
      { kind: 'XP', reason: 'XP_MATCH_BASE', delta: XP_MATCH_BASE },
      { kind: 'XP', reason: 'XP_MATCH_SCORE', delta: matchScore },
    ];

    return {
      seatIndex,
      userId,
      matchScore,
      xpEarned,
      rankedRatingDelta,
      matchScoreBreakdown: snapshot.breakdowns[pid] ?? [],
      ratingBreakdown,
      xpBreakdown,
      ghostFinish,
      progressionAfter,
    };
  });
}

function pushRow(
  breakdowns: Record<string, MatchScoreBreakdownRow[]>,
  totals: Record<string, number>,
  pid: string,
  row: MatchScoreBreakdownRow
): void {
  breakdowns[pid] ??= [];
  breakdowns[pid].push(row);
  totals[pid] = (totals[pid] ?? 0) + row.delta;
}

function hasSameRankCapture(rank: string, cards: readonly { rank: string }[]): boolean {
  const matched = cards.filter((card) => card.rank === rank).length;
  return matched > 1;
}

function placementRatingDeltas(
  rankings: readonly PlayerId[],
  playerCount: number,
  isAbandoned: boolean
): Map<string, number> {
  const base = PLACEMENT_RATING_DELTA[playerCount] ?? [];
  const out = new Map<string, number>();
  for (let i = 0; i < rankings.length; i += 1) {
    out.set(rankings[i]!, (base[i] ?? 0) + (isAbandoned ? ABANDON_PENALTY : 0));
  }
  return out;
}

function zeroProgression(userId: string): PlayerProgression {
  return {
    userId,
    rankedRating: 0,
    totalXp: 0,
    level: 1,
    highestMatchScore: 0,
    totalMatchScore: 0,
    ghostFinishes: 0,
    updatedAt: new Date(0),
  };
}
