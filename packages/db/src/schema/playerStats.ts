import { pgTable, uuid, integer, timestamp, index, decimal } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Aggregate player statistics, computed from game records.
 * Updated on game completion; can be recomputed via a batch job.
 */
export const playerStats = pgTable(
  "player_stats",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    gamesPlayed: integer("games_played").notNull().default(0),
    gamesWon: integer("games_won").notNull().default(0),
    gamesLost: integer("games_lost").notNull().default(0),
    gamesAbandoned: integer("games_abandoned").notNull().default(0),
    /**
     * Sum of final positions (1=first, 2=second, etc.).
     * Divide by gamesPlayed for average finishing position.
     */
    totalFinishPosition: integer("total_finish_position").notNull().default(0),
    /**
     * Total cards captured across all games (Part 1).
     */
    totalCaptures: integer("total_captures").notNull().default(0),
    /**
     * Number of times the player was cut during Part 2.
     */
    timesCut: integer("times_cut").notNull().default(0),
    /**
     * Number of times the player reached safe status in Part 2.
     */
    timesSafe: integer("times_safe").notNull().default(0),
    /**
     * Total play time across all games (milliseconds).
     */
    totalPlayTimeMs: integer("total_play_time_ms").notNull().default(0),
    /**
     * Win streak: consecutive games won (reset on loss/abandon).
     */
    currentWinStreak: integer("current_win_streak").notNull().default(0),
    /**
     * Longest win streak achieved.
     */
    maxWinStreak: integer("max_win_streak").notNull().default(0),
    /**
     * ELO or Glicko rating (optional, Phase 6e). Start at 1600 for new players.
     */
    rating: decimal("rating", { precision: 7, scale: 1 }).notNull().default("1600.0"),
    /**
     * Rating uncertainty (Glicko RD). Only used if using Glicko-2.
     */
    ratingUncertainty: decimal("rating_uncertainty", { precision: 7, scale: 1 }).notNull().default("350.0"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    gamesWonIdx: index("idx_player_stats_games_won").on(table.gamesWon),
    ratingIdx: index("idx_player_stats_rating").on(table.rating),
    updatedAtIdx: index("idx_player_stats_updated_at").on(table.updatedAt),
  })
);

export type PlayerStats = typeof playerStats.$inferSelect;
export type NewPlayerStats = typeof playerStats.$inferInsert;
