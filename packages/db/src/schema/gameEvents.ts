import { pgTable, uuid, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { games } from "./games";

/**
 * Move-by-move event log for completed games.
 * Mirrors the engine's GameEvent union (CAPTURED, CUT, TRICK_WON, PLAYER_SAFE, etc.).
 * Enables replay, analytics, and debugging.
 *
 * This table is only populated if full event logging is enabled (Phase 6b decision).
 */
export const gameEvents = pgTable(
  "game_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(), // 0-indexed sequence number
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    /**
     * Actor: user ID of the player who caused the event, or null if non-player-initiated.
     * Nullable to support system events (e.g. stock depletion).
     */
    actorUserId: text("actor_user_id"), // JSON-serialized user_id for flexibility
    /**
     * Event type: PLAYED_CARD, CAPTURED, CUT, TRICK_WON, PLAYER_SAFE, etc.
     * Must match the engine's GameEvent type names.
     */
    eventType: text("event_type").notNull(),
    /**
     * Full event payload as JSONB (mirrors engine GameEvent).
     * Example: {type: "CAPTURED", cardId: "2H", tableCardIds: ["3D", "4C"], capturer: "p1"}
     */
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    gameIdIdx: index("idx_game_events_game_id").on(table.gameId),
    seqIdx: index("idx_game_events_seq").on(table.seq),
    eventTypeIdx: index("idx_game_events_event_type").on(table.eventType),
    tsIdx: index("idx_game_events_ts").on(table.ts),
  })
);

export type GameEvent = typeof gameEvents.$inferSelect;
export type NewGameEvent = typeof gameEvents.$inferInsert;
