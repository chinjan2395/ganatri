import { pgTable, uuid, text, integer, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { rooms } from "./rooms";

/**
 * Completed or in-progress game records.
 * Stores seed, seating order, duration, and final outcome.
 * Game events (moves, captures) are stored in game_events table.
 */
export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    seed: integer("seed").notNull(), // RNG seed for reproducibility
    /**
     * Seating order: JSON array of user_ids in turn order.
     * Enables replay and stat calculation (e.g. who led third trick in fourth seat).
     */
    seatingJson: text("seating_json").notNull(), // JSON: [userId, userId, userId, userId]
    playerCount: integer("player_count").notNull(), // 2-4
    /**
     * Config snapshot at game start (JSON: turnTimeoutMs, gracePeriodMs, etc.)
     */
    configSnapshot: text("config_snapshot"), // JSON serialized
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    /**
     * Duration in milliseconds (endedAt - startedAt)
     */
    durationMs: integer("duration_ms"),
    /**
     * Outcome summary: JSON with {winnerId, finishOrder, abandoned, safeOrder}
     */
    outcomeJson: text("outcome_json"), // JSON
    abandoned: boolean("abandoned").notNull().default(false),
  },
  (table) => ({
    roomIdIdx: index("idx_games_room_id").on(table.roomId),
    startedAtIdx: index("idx_games_started_at").on(table.startedAt),
    endedAtIdx: index("idx_games_ended_at").on(table.endedAt),
  })
);

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
