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
  playerProgression,
  scoreLedger,
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
export type PlayerProgressionRow = typeof playerProgression.$inferSelect;
export type ScoreLedgerRow = typeof scoreLedger.$inferSelect;
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
  /** Room code for this game (only populated by loadActiveGames). */
  roomCode?: string;
  /** Host user id (only populated by loadActiveGames). Null when the host account was deleted. */
  hostUserId?: string | null;
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

export interface ResolvedAuthSession {
  session: AuthSessionRow;
  user: UserRow;
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
  matchScore: number | null;
  xpEarned: number | null;
  rankedRatingDelta: number | null;
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
  matchScore: number | null;
  xpEarned: number | null;
  rankedRatingDelta: number | null;
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
  highestMatchScore?: number;
  totalMatchScore?: number;
  ghostFinishes?: number;
}

export type ScoreLedgerKind = ScoreLedgerRow['kind'];
export type ScoreLedgerReason = ScoreLedgerRow['reason'];

export interface MatchScoreBreakdownRow {
  kind: ScoreLedgerKind | 'MATCH_SCORE';
  reason: ScoreLedgerReason;
  delta: number;
  meta?: Record<string, unknown> | null;
}

export interface MatchScoreBreakdown {
  rows: MatchScoreBreakdownRow[];
  total: number;
}

export interface RankedRatingChange {
  delta: number;
  breakdown: MatchScoreBreakdownRow[];
}

export interface XpAward {
  earned: number;
  breakdown: MatchScoreBreakdownRow[];
}

export interface PlayerProgression {
  userId: string;
  rankedRating: number;
  totalXp: number;
  level: number;
  highestMatchScore: number;
  totalMatchScore: number;
  ghostFinishes: number;
  updatedAt: Date;
}

export interface ScoredGamePlayerResult {
  seatIndex: number;
  userId: string | null;
  matchScore: number;
  xpEarned: number;
  rankedRatingDelta: number;
  matchScoreBreakdown: MatchScoreBreakdownRow[];
  ratingBreakdown: MatchScoreBreakdownRow[];
  xpBreakdown: MatchScoreBreakdownRow[];
  ghostFinish: boolean;
  progressionAfter: PlayerProgression | null;
}

export interface ScoreLedgerEntry {
  id: string;
  userId: string;
  gameId: string;
  kind: ScoreLedgerKind;
  reason: ScoreLedgerReason;
  delta: number;
  createdAt: Date;
  metaJson: Record<string, unknown> | null;
}

export interface ScoreHistoryEntry {
  gameId: string;
  createdAt: Date;
  matchScore: number;
  xpEarned: number;
  rankedRatingDelta: number;
  rows: ScoreLedgerEntry[];
}

export interface ApplyGameScoringInput {
  gameId: string;
  scoredPlayers: readonly ScoredGamePlayerResult[];
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

  /** Update a user's avatar URL. Accepts null (clear), preset key, or HTTPS URL. No-op if user does not exist. */
  updateUserAvatarUrl(userId: string, avatarUrl: string | null): Promise<void>;

  /**
   * Permanently delete a user and anonymize all their historical records.
   * Runs in a single transaction. No-op for unknown userId.
   */
  deleteUser(userId: string): Promise<void>;

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
  createAuthSession(input: CreateAuthSessionInput): Promise<AuthSessionRow>;

  /**
   * Look up the active auth session + owning user for a token hash. Returns
   * null when the session is revoked, expired, or unknown.
   */
  getAuthSessionByTokenHash(tokenHash: string): Promise<ResolvedAuthSession | null>;

  /** Refresh an auth session's activity timestamps / expiry. */
  touchAuthSession(tokenHash: string, expiresAt: Date): Promise<AuthSessionRow | null>;

  /** List the user's active sessions, newest activity first. */
  listAuthSessions(userId: string): Promise<AuthSessionRow[]>;

  /** Mark a session revoked (no-op if the token hash is unknown). */
  revokeAuthSession(tokenHash: string): Promise<void>;

  /** Revoke one of the user's active sessions by id. No-op if not found. */
  revokeAuthSessionById(userId: string, sessionId: string): Promise<void>;

  /** Revoke every active session for the user except the current session. */
  revokeOtherAuthSessions(userId: string, currentSessionId: string): Promise<number>;

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
  getPlayerProgression(userId: string): Promise<PlayerProgression | null>;
  getScoreHistory(userId: string, limit?: number, offset?: number): Promise<ScoreHistoryEntry[]>;
  applyGameScoring(input: ApplyGameScoringInput): Promise<void>;

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

  /**
   * Search users by partial display name or email (case-insensitive).
   * Returns up to `limit` results (default 20), ordered by displayName ASC.
   * Includes isGuest and basic stats counts from player_stats (may be null → 0 for guests).
   */
  searchUsers(query: string, limit?: number): Promise<UserSearchResult[]>;

  /**
   * Full admin-level stats for a single user (by userId).
   * Returns null when the user does not exist.
   */
  adminGetUserStats(userId: string): Promise<AdminUserStats | null>;

  /**
   * Admin data export: returns up to `limit` completed/abandoned games
   * (most recent first), each with their player rows.
   * Default limit 500; max enforced by callers.
   */
  exportGamesData(limit?: number): Promise<ExportGameRow[]>;
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
// Admin user management (Phase 6h)
// ---------------------------------------------------------------------------

export interface UserSearchResult {
  userId: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  isGuest: boolean;
  gamesPlayed: number;
  gamesWon: number;
}

export interface AdminUserStats {
  userId: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  isGuest: boolean;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesAbandoned: number;
  winRate: number; // gamesWon / gamesPlayed, 0-guarded
  totalCaptures: number;
  cutsGiven: number;
  cutsReceived: number;
  timesSafe: number;
  totalPlayTimeMs: number;
  longestWinStreak: number;
  currentWinStreak: number;
  highestMatchScore: number;
  totalMatchScore: number;
  ghostFinishes: number;
  progression: PlayerProgression | null;
  updatedAt: string | null; // ISO string from player_stats.updated_at, null when no row
}

// ---------------------------------------------------------------------------
// Admin data export (Phase 6h)
// ---------------------------------------------------------------------------

/** One player row within an exported game. */
export interface ExportGamePlayer {
  userId: string | null;
  displayName: string;
  seatIndex: number;
  finalRank: number | null;
  captureCount: number;
  wasCut: boolean;
  result: string | null;
  matchScore: number | null;
  xpEarned: number | null;
  rankedRatingDelta: number | null;
}

/** One game row for the admin data export. */
export interface ExportGameRow {
  id: string;
  roomCode: string | null;
  seed: string;
  startedAt: string; // ISO string
  endedAt: string | null; // ISO string
  durationMs: number | null;
  playerCount: number;
  isAbandoned: boolean;
  winnerId: string | null;
  players: ExportGamePlayer[];
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
  /**
   * Average XP granted per day across completed games in the window.
   * Computed as totalXpGranted / windowDays. Null when no completed games have scoring data.
   */
  avgXpGrantedPerDay: number | null;
  /**
   * Average match score broken down by player count for completed games in the window.
   * Only player counts that have at least one scored game are included.
   */
  avgMatchScoreByPlayerCount: Array<{ playerCount: number; avgMatchScore: number; gameCount: number }>;
  /**
   * Average ranked_rating_delta for completed vs abandoned games in the window.
   * Null when no games of that type have rating data.
   */
  abandonRatingImpact: { avgRatingDeltaCompleted: number | null; avgRatingDeltaAbandoned: number | null };
}
