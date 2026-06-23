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
  oauthAccounts,
  authSessions,
  rooms,
  games,
  gamePlayers,
  gameEvents,
  playerStats,
  userBlocks,
} from '../schema';

// ---------------------------------------------------------------------------
// Row & insert types (inferred from schema)
// ---------------------------------------------------------------------------

export type UserRow = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type OAuthAccountRow = typeof oauthAccounts.$inferSelect;
export type AuthSessionRow = typeof authSessions.$inferSelect;
export type RoomRow = typeof rooms.$inferSelect;
export type GameRow = typeof games.$inferSelect;
export type GamePlayerRow = typeof gamePlayers.$inferSelect;
export type GameEventRow = typeof gameEvents.$inferSelect;
export type PlayerStatsRow = typeof playerStats.$inferSelect;
export type UserBlockRow = typeof userBlocks.$inferSelect;

export type RoomStatus = RoomRow['status'];

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

// ---------------------------------------------------------------------------
// Auth (OAuth + sessions)
// ---------------------------------------------------------------------------

/** Input to resolve/create a user from a federated OAuth login. */
export interface UpsertOAuthUserInput {
  /** Provider key, e.g. 'google'. */
  provider: string;
  /** Stable per-provider subject identifier. */
  providerUserId: string;
  /** Verified email if the provider supplied one, else null. */
  email: string | null;
  displayName: string;
  avatarUrl?: string | null;
}

/** Input to create a durable auth session. */
export interface CreateAuthSessionInput {
  userId: string;
  /** SHA-256 hex digest of the opaque session token. */
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string | null;
}

// ---------------------------------------------------------------------------
// Game history (list + score-card detail)
// ---------------------------------------------------------------------------

/** A single player's outcome within a game (subset of `game_players`). */
export interface GameHistoryPlayer {
  userId: string | null;
  displayNameSnapshot: string;
  seatIndex: number;
  finalRank: number | null;
  result: string | null;
  captureCount: number;
  wasCut: boolean;
}

/** One row of a user's game history: the game, their result, and all players. */
export interface GameHistoryEntry {
  game: {
    id: string;
    startedAt: Date;
    endedAt: Date | null;
    durationMs: number | null;
    playerCount: number;
    isAbandoned: boolean;
    winnerId: string | null;
  };
  /** The requesting user's own game_players row. */
  you: GameHistoryPlayer;
  /** Every player in the game, ordered by seatIndex. */
  players: GameHistoryPlayer[];
}

/** One leaderboard row: a ranked account with its aggregate win record. */
export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  /** gamesWon / gamesPlayed in [0,1]; 0 when gamesPlayed === 0. */
  winRate: number;
}

/** A leaderboard entry with an explicit global rank attached. */
export interface RankedLeaderboardEntry extends LeaderboardEntry {
  rank: number; // 1-based global rank
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
  sumFinishPositions?: number;
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

  /** Update a registered user's display name. No-op if the user does not exist. */
  updateUserDisplayName(userId: string, newDisplayName: string): Promise<void>;

  // Auth (OAuth + sessions) -------------------------------------------------

  /**
   * Resolve (or create) a user from a federated OAuth login. Resolution order:
   * (a) existing oauth_accounts row for (provider, providerUserId) -> its user;
   * (b) else an existing user matching `email` (when non-null) -> link account;
   * (c) else create a new (non-guest) user + oauth_accounts row.
   * Idempotent across repeat logins. Always returns the resolved UserRow.
   */
  upsertOAuthUser(input: UpsertOAuthUserInput): Promise<UserRow>;

  /** Create a durable auth session row. */
  createAuthSession(input: CreateAuthSessionInput): Promise<void>;

  /**
   * Look up the user owning a session token hash, but only when the matching
   * session is not revoked and has not expired. Returns null otherwise.
   */
  getUserBySessionTokenHash(tokenHash: string): Promise<UserRow | null>;

  /** Mark a session revoked (no-op if the token hash is unknown). */
  revokeAuthSession(tokenHash: string): Promise<void>;

  // History -----------------------------------------------------------------

  /**
   * A user's games, newest first (games.started_at DESC), with their own result
   * (`you`) and every player's result (`players`). Serves both the list view
   * and the per-game score card.
   */
  getUserGameHistory(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<GameHistoryEntry[]>;

  // Retention ---------------------------------------------------------------

  /** Delete game_events with ts < cutoff; returns the number deleted. */
  pruneGameEventsBefore(cutoff: Date): Promise<number>;

  /**
   * Delete abandoned games whose ended_at < cutoff (cascading their events and
   * player rows first). Returns the number of games deleted.
   */
  pruneAbandonedGamesBefore(cutoff: Date): Promise<number>;

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
   * Top accounts by win record, strongest first. Ordering:
   * gamesWon DESC, winRate DESC, gamesPlayed DESC, userId ASC (stable).
   * Excludes guests and users with zero games played. Joins `users` for the
   * display name + avatar. Paginated.
   * When `timeWindow` is set, dynamically aggregates from `game_players JOIN
   * games` filtered by `games.ended_at >= cutoff` instead of `player_stats`.
   */
  getLeaderboard(limit?: number, offset?: number, timeWindow?: 'week' | 'month'): Promise<LeaderboardEntry[]>;

  /**
   * Return the given user's own leaderboard entry with their global rank, or
   * null if the user is a guest, has zero games played, or does not exist.
   * Used to surface the viewer's position when they are outside the top page.
   * When `timeWindow` is set, aggregates dynamically from the recent window.
   */
  getMyLeaderboardRank(userId: string, timeWindow?: 'week' | 'month'): Promise<RankedLeaderboardEntry | null>;

  /**
   * Merge a guest user's game history and stats into a registered account.
   * Re-points all game_players rows from guestUserId to registeredUserId,
   * sums incremental stats, takes the max of streaks, then removes the
   * guest's player_stats row and users row.
   * No-op when: guestUserId === registeredUserId, guest not found, or
   * the "guest" is already a registered user (isGuest = false).
   */
  mergeGuestIntoUser(guestUserId: string, registeredUserId: string): Promise<void>;

  // Recovery reads ----------------------------------------------------------

  /** Games whose room is still PLAYING (for restart rehydration). */
  loadActiveGames(): Promise<GameWithPlayers[]>;

  /** Events for a game, ordered by seq ascending. */
  loadGameEvents(gameId: string): Promise<GameEventRow[]>;

  loadGameWithPlayers(gameId: string): Promise<GameWithPlayers | null>;

  // Phase 8: co-player queries and blocks -----------------------------------

  /**
   * Players this user has shared at least one completed game with, ordered by
   * shared-game count DESC. Excludes guests and the requesting user themselves.
   */
  getFrequentCoPlayers(userId: string, limit?: number): Promise<CoPlayerEntry[]>;

  /** Persist a block. Idempotent — double-block is a no-op. */
  blockUser(blockerId: string, blockedId: string): Promise<void>;

  /** Remove a block. No-op if the block does not exist. */
  unblockUser(blockerId: string, blockedId: string): Promise<void>;

  /** All userIds that `userId` has blocked. */
  getBlockedUserIds(userId: string): Promise<string[]>;

  /** Full user details for every user that `userId` has blocked. */
  getBlockedUsers(userId: string): Promise<BlockedUserEntry[]>;

  /** True if blockerId has blocked blockedId (one-directional). */
  isBlocked(blockerId: string, blockedId: string): Promise<boolean>;

  /**
   * Historical KPI stats for the admin dashboard. Aggregates games that ended
   * within the last `windowDays` days. Default window is 7 days.
   */
  getAdminKpiStats(windowDays?: number): Promise<AdminKpiStats>;
}

// ---------------------------------------------------------------------------
// Phase 8 output types
// ---------------------------------------------------------------------------

export interface CoPlayerEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  gamesPlayedTogether: number;
}

export interface BlockedUserEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

// ---------------------------------------------------------------------------
// Admin KPI stats (Phase 6h)
// ---------------------------------------------------------------------------

export interface AdminKpiStats {
  /** How many days the window covers (default 7). */
  windowDays: number;
  /** completed + abandoned games ended in window */
  totalGames: number;
  /** non-abandoned games ended in window */
  completedGames: number;
  /** abandoned games ended in window */
  abandonedGames: number;
  /** abandonedGames / totalGames; 0 when totalGames === 0 */
  abandonmentRate: number;
  /** avg durationMs for completed games; null when no completed games */
  avgDurationMs: number | null;
  dailyBreakdown: Array<{
    /** "YYYY-MM-DD" UTC date */
    date: string;
    total: number;
    completed: number;
    abandoned: number;
  }>;
}
