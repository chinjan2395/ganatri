import { pgTable, uuid, text, integer, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { games } from "./games";
import { users } from "./users";

/**
 * Join table: links games to players and records per-player outcome data.
 * Stores seat, rank, captures, safe order, and whether the player was cut.
 */
export const gamePlayers = pgTable(
  "game_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    /**
     * User ID; nullable to support guest players who delete their accounts
     * (the name snapshot is preserved separately).
     */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    seatIndex: integer("seat_index").notNull(), // 0-3
    /**
     * Display name snapshot at game time (immutable record of what name was used).
     */
    displayNameSnapshot: text("display_name_snapshot").notNull(),
    finalRank: integer("final_rank").notNull(), // 1=winner, 2=2nd, etc.
    /**
     * Order in which player became safe in Part 2 (null if never safe).
     * Used for tie-breaking and analytics.
     */
    safeOrder: integer("safe_order"), // 1=first safe, 2=second, etc.
    /**
     * Whether this player was cut during Part 2.
     */
    wasCut: boolean("was_cut").notNull().default(false),
    /**
     * Total cards captured in Part 1.
     */
    captureCount: integer("capture_count").notNull().default(0),
    /**
     * Result: 'win' | 'loss' | 'abandon'
     */
    result: text("result").notNull(), // 'win' | 'loss' | 'abandon'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    gameIdIdx: index("idx_game_players_game_id").on(table.gameId),
    userIdIdx: index("idx_game_players_user_id").on(table.userId),
    seatIndexIdx: index("idx_game_players_seat_index").on(table.seatIndex),
  })
);

export type GamePlayer = typeof gamePlayers.$inferSelect;
export type NewGamePlayer = typeof gamePlayers.$inferInsert;
