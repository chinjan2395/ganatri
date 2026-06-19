/**
 * GamePersistence — the durable repository interface for Ganatri.
 *
 * This is the *durable* data-access contract (users, rooms, completed games,
 * the event log, and aggregate stats). It is intentionally separate from the
 * server's in-memory runtime store (`store.ts` `GameStore`), which holds
 * transient state (socket ids, timers) that must never be persisted.
 *
 * All methods are async so a Postgres-backed implementation and an in-memory
 * one share a single contract. Row/input types are inferred from the Drizzle
 * schema so the persistence layer is as type-safe as the engine.
 */

import type {
  users,
  rooms,
  games,
  gamePlayers,
  gameEvents,
  playerStats,
} from '../schema';

// ---------------------------------------------------------------------------
// Row & insert types (inferred from schema)
// ---------------------------------------------------------------------------

export type UserRow = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type RoomRow = typeof rooms.$inferSelect;
export type GameRow = typeof games.$inferSelect;
export type GamePlayerRow = typeof gamePlayers.$inferSelect;
export type GameEventRow = typeof gameEvents.$inferSelect;
export type PlayerStatsRow = typeof playerStats.$inferSelect;

export type RoomStatus = RoomRow['status'];

/**
 * A player's aggregate stats row enriched with derived metrics computed on read
 * (no schema/migration changes). Rates are raw ratios in `[0, 1]`; `0` when the
 * player has never finished a game. `averageFinishPosition` is the mean of the
 * user's non-null `game_players.final_rank` values, or `null` when they have no
 * ranked games.
 */
export interface PlayerStatsView extends PlayerStatsRow {
  /** `gamesWon / gamesPlayed`, or `0` when `gamesPlayed === 0`. */
  winRate: number;
  /** `gamesLost / gamesPlayed`, or `0` when `gamesPlayed === 0`. */
  lossRate: number;
  /** `gamesAbandoned / gamesPlayed`, or `0` when `gamesPlayed === 0`. */
  abandonRate: number;
  /** Mean of non-null `final_rank` across the user's games; `null` if none. */
  averageFinishPosition: number | null;
}

/**
 * Derive a `PlayerStatsView` from a raw stats row plus a pre-computed average
 * finishing position. Shared by both persistence implementations so the rate
 * math (and the `gamesPlayed === 0` guard) stays identical.
 */
export function toPlayerStatsView(
  stats: PlayerStatsRow,
  averageFinishPosition: number | null
): PlayerStatsView {
  const played = stats.gamesPlayed;
  const rate = (n: number): number => (played === 0 ? 0 : n / played);
  return {
    ...stats,
    winRate: rate(stats.gamesWon),
    lossRate: rate(stats.gamesLost),
    abandonRate: rate(stats.gamesAbandoned),
    averageFinishPosition,
  };
}

// ---------------------------------------------------------------------------
// Composite input types
// ---------------------------------------------------------------------------

/** Input to record a game that has just started. */
export interface RecordGameStartedInput {
  roomId: string;
  /** Engine seed (`number | string`); stored as text. */
  seed: number | string;
  /** Seating order as user IDs, in clockwise play order. */
  seatingOrder: readonly string[];
  configSnapshot?: unknown;
  startedAt?: Date;
  /** Optional explicit player count; defaults to `seatingOrder.length`. */
  playerCount?: number;
}

/** Per-player final result, written into `game_players` on game finish. */
export interface FinalPlayerResult {
  /** Null for guests with no durable account row. */
  userId: string | null;
  seatIndex: number;
  displayName: string;
  /** 1-based; 1 = winner. Null when abandoned. */
  finalRank: number | null;
  wasCut: boolean;
  captureCount: number;
  /** 'WIN' | 'LOSS' | 'ABANDONED' | ... */
  result: string | null;
}

/** Input to record a game finishing (or being abandoned). */
export interface RecordGameFinishedInput {
  gameId: string;
  endedAt?: Date;
  durationMs?: number | null;
  /** Winner user id (rankings[0] mapped to a user), or null. */
  winnerId?: string | null;
  isAbandoned?: boolean;
  players: readonly FinalPlayerResult[];
}

/** Input to append a single event to the log. */
export interface AppendEventInput {
  gameId: string;
  seq: number;
  ts?: Date;
  actorUserId?: string | null;
  eventType: GameEventRow['eventType'];
  payload: unknown;
}

/** Aggregate read: a game plus its player rows. */
export interface GameWithPlayers {
  game: GameRow;
  players: GamePlayerRow[];
}

/** Increment-style delta applied to a player's aggregate stats. */
export interface PlayerStatsDelta {
  userId: string;
  gamesPlayed?: number;
  gamesWon?: number;
  gamesLost?: number;
  gamesAbandoned?: number;
  totalCaptures?: number;
  cutsGiven?: number;
  cutsReceived?: number;
  timesSafe?: number;
  totalPlayTimeMs?: number;
  /** Absolute value to set (not incremented). */
  longestWinStreak?: number;
  /** Absolute value to set (not incremented). */
  currentWinStreak?: number;
}

// ---------------------------------------------------------------------------
// The interface
// ---------------------------------------------------------------------------

export interface GamePersistence {
  // Users -------------------------------------------------------------------

  /** Insert or update a user by id; returns the stored row. */
  upsertUser(user: NewUser & { id: string }): Promise<UserRow>;

  /** Ensure a guest user row exists for the given id; returns it. */
  ensureGuest(id: string, displayName: string): Promise<UserRow>;

  // Rooms -------------------------------------------------------------------

  recordRoomCreated(input: {
    roomCode: string;
    hostUserId: string;
    configSnapshot?: unknown;
    status?: RoomStatus;
  }): Promise<RoomRow>;

  updateRoomStatus(
    roomId: string,
    status: RoomStatus,
    closedAt?: Date | null
  ): Promise<RoomRow | null>;

  // Games -------------------------------------------------------------------

  recordGameStarted(input: RecordGameStartedInput): Promise<GameRow>;

  /** Update the game row and write all `game_players` rows in one transaction. */
  recordGameFinished(input: RecordGameFinishedInput): Promise<GameWithPlayers>;

  // Events ------------------------------------------------------------------

  appendGameEvent(input: AppendEventInput): Promise<GameEventRow>;

  /** Append a contiguous batch of events atomically (one transaction). */
  appendGameEvents(events: readonly AppendEventInput[]): Promise<GameEventRow[]>;

  // Stats -------------------------------------------------------------------

  /** Insert-or-increment aggregate stats for a user. */
  upsertPlayerStats(delta: PlayerStatsDelta): Promise<PlayerStatsRow>;

  getPlayerStats(userId: string): Promise<PlayerStatsRow | null>;

  /**
   * Like `getPlayerStats` but enriched with derived metrics (win/loss/abandon
   * rate, average finishing position). Computed on read; returns `null` when no
   * `player_stats` row exists for the user.
   */
  getPlayerStatsView(userId: string): Promise<PlayerStatsView | null>;

  // Recovery reads ----------------------------------------------------------

  /** Games whose room is still PLAYING (for restart rehydration). */
  loadActiveGames(): Promise<GameWithPlayers[]>;

  /** Events for a game, ordered by seq ascending. */
  loadGameEvents(gameId: string): Promise<GameEventRow[]>;

  loadGameWithPlayers(gameId: string): Promise<GameWithPlayers | null>;
}
