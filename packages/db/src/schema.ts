/**
 * Ganatri database schema using Drizzle ORM.
 *
 * Core tables:
 * - users: player identity (guest or registered)
 * - rooms: game lobbies and their lifecycle
 * - games: completed or in-progress game records
 * - game_players: per-player game outcomes (join table)
 * - game_events: move-by-move event log (JSONB payloads)
 * - player_stats: aggregate statistics per user
 *
 * All types are inferred from the schema definition.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const roomStatusEnum = pgEnum('room_status', [
  'LOBBY',
  'PLAYING',
  'DONE',
  'ABANDONED',
]);

export const gameEventTypeEnum = pgEnum('game_event_type', [
  'GAME_STARTED',
  'PLAYER_PLAYED',
  'CAPTURED',
  'CARD_DRAWN',
  'TRICK_WON',
  'CUT',
  'PLAYER_SAFE',
  'GAME_OVER',
  'PLAYER_DISCONNECTED',
  'PLAYER_RECONNECTED',
]);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    displayName: varchar('display_name', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }).unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    isGuest: boolean('is_guest').notNull().default(true),
  },
  (table) => {
    return {
      emailIdx: index('users_email_idx').on(table.email),
    };
  }
);

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomCode: varchar('room_code', { length: 6 }).notNull().unique(),
    hostUserId: uuid('host_user_id')
      .notNull()
      .references(() => users.id),
    status: roomStatusEnum('status').notNull().default('LOBBY'),
    // Snapshot of game config used in this room (JSON for flexibility).
    configSnapshot: jsonb('config_snapshot'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (table) => {
    return {
      roomCodeIdx: uniqueIndex('rooms_room_code_idx').on(table.roomCode),
      statusIdx: index('rooms_status_idx').on(table.status),
    };
  }
);

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    // Random seed used to shuffle the deck (ensures deterministic replay).
    seed: integer('seed').notNull(),
    // Seating order: array of user IDs in play order.
    seatingOrder: jsonb('seating_order').notNull(),
    playerCount: integer('player_count').notNull(),
    // Snapshot of game config used (e.g., turnTimeoutMs).
    configSnapshot: jsonb('config_snapshot'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    winnerId: uuid('winner_id').references(() => users.id),
    isAbandoned: boolean('is_abandoned').notNull().default(false),
  },
  (table) => {
    return {
      roomIdIdx: index('games_room_id_idx').on(table.roomId),
      winnerIdIdx: index('games_winner_id_idx').on(table.winnerId),
      startedAtIdx: index('games_started_at_idx').on(table.startedAt),
    };
  }
);

// ---------------------------------------------------------------------------
// Game Players (join table)
// ---------------------------------------------------------------------------

export const gamePlayers = pgTable(
  'game_players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id),
    userId: uuid('user_id').references(() => users.id), // null for deleted guest accounts
    seatIndex: integer('seat_index').notNull(),
    displayNameSnapshot: varchar('display_name_snapshot', { length: 100 }).notNull(),
    finalRank: integer('final_rank'), // 1 = winner, null if game abandoned
    wasCut: boolean('was_cut').notNull().default(false),
    captureCount: integer('capture_count').notNull().default(0),
    result: varchar('result', { length: 20 }), // 'WIN', 'LOSS', 'ABANDONED', etc.
  },
  (table) => {
    return {
      gameIdIdx: index('game_players_game_id_idx').on(table.gameId),
      userIdIdx: index('game_players_user_id_idx').on(table.userId),
    };
  }
);

// ---------------------------------------------------------------------------
// Game Events (move log)
// ---------------------------------------------------------------------------

export const gameEvents = pgTable(
  'game_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id),
    seq: integer('seq').notNull(), // 0-based sequence number within the game
    ts: timestamp('ts', { withTimezone: true }).notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    eventType: gameEventTypeEnum('event_type').notNull(),
    // JSONB payload (mirrors engine GameEvent structure).
    payload: jsonb('payload').notNull(),
  },
  (table) => {
    return {
      gameIdIdx: index('game_events_game_id_idx').on(table.gameId),
      gameIdSeqIdx: uniqueIndex('game_events_game_id_seq_idx').on(table.gameId, table.seq),
      actorUserIdIdx: index('game_events_actor_user_id_idx').on(table.actorUserId),
    };
  }
);

// ---------------------------------------------------------------------------
// Player Stats (aggregate)
// ---------------------------------------------------------------------------

export const playerStats = pgTable(
  'player_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id),
    gamesPlayed: integer('games_played').notNull().default(0),
    gamesWon: integer('games_won').notNull().default(0),
    gamesLost: integer('games_lost').notNull().default(0),
    gamesAbandoned: integer('games_abandoned').notNull().default(0),
    totalCaptures: integer('total_captures').notNull().default(0),
    cutsGiven: integer('cuts_given').notNull().default(0),
    cutsReceived: integer('cuts_received').notNull().default(0),
    timesSafe: integer('times_safe').notNull().default(0),
    totalPlayTimeMs: integer('total_play_time_ms').notNull().default(0),
    longestWinStreak: integer('longest_win_streak').notNull().default(0),
    currentWinStreak: integer('current_win_streak').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => {
    return {
      userIdIdx: uniqueIndex('player_stats_user_id_idx').on(table.userId),
    };
  }
);

// Re-export schema for Drizzle configuration.
export * from 'drizzle-orm/pg-core';
