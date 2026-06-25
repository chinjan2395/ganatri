/**
 * @ganatri/db — database schema, client, and persistence layer.
 *
 * Public exports:
 * - DB client helpers (`getDb`, `ping`, `closeDb`) — node-postgres + Drizzle.
 * - Schema tables/enums for type inference.
 * - `GamePersistence` durable repository interface + Postgres/Memory impls.
 * - Legacy runtime `GameStore`/`SessionData`/`RoomData` types (server's own
 *   in-memory store still defines its own; these are kept for compatibility).
 */

export { getDb, ping, closeDb } from './db';
export type { Database } from './db';

export {
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
  roomStatusEnum,
  gameEventTypeEnum,
  scoreLedgerKindEnum,
  scoreLedgerReasonEnum,
} from './schema';

// Legacy runtime store types (unused by the server today; kept for compat).
export type { GameStore, SessionData, RoomData } from './store';

// Durable persistence layer (Stage B).
export type {
  AdminKpiStats,
  AdminUserStats,
  ExportGameRow,
  ExportGamePlayer,
  GamePersistence,
  UserRow,
  UserBlockRow,
  NewUser,
  OAuthAccountRow,
  AuthSessionRow,
  RoomRow,
  GameRow,
  GamePlayerRow,
  GameEventRow,
  PlayerStatsRow,
  PlayerProgressionRow,
  ScoreLedgerRow,
  RecordGameStartedInput,
  RecordGameFinishedInput,
  FinalPlayerResult,
  AppendEventInput,
  GameWithPlayers,
  PlayerStatsDelta,
  MatchScoreBreakdown,
  MatchScoreBreakdownRow,
  RankedRatingChange,
  XpAward,
  PlayerProgression,
  ScoredGamePlayerResult,
  ScoreLedgerEntry,
  ScoreHistoryEntry,
  ApplyGameScoringInput,
  UpsertOAuthUserInput,
  CreateAuthSessionInput,
  GameHistoryEntry,
  GameHistoryPlayer,
  LeaderboardEntry,
  RankedLeaderboardEntry,
  CoPlayerEntry,
  BlockedUserEntry,
  UserSearchResult,
} from './persistence/types';
export { PgPersistence, PostgresStore } from './persistence/pg';
export { MemoryPersistence } from './persistence/memory';
export { createPersistence } from './persistence/memory';
export * as mappers from './persistence/mappers';
