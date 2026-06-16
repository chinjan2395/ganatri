import { pgTable, uuid, text, timestamp, varchar, index } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Room lifecycle records.
 * Tracks room codes, host, status, and when the room was created/closed.
 */
export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomCode: varchar("room_code", { length: 6 }).notNull().unique(),
    hostUserId: uuid("host_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    /**
     * Status: 'lobby' (waiting), 'playing' (game in progress), 'done' (completed), 'abandoned'
     */
    status: text("status").notNull().default("lobby"),
    /**
     * Config snapshot at room creation time (JSON: turnTimeoutMs, maxPlayers, etc.)
     * Allows replaying games with their original settings even after config changes.
     */
    configSnapshot: text("config_snapshot"), // JSON serialized
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => ({
    codeIdx: index("idx_rooms_code").on(table.roomCode),
    hostUserIdIdx: index("idx_rooms_host_user_id").on(table.hostUserId),
    statusIdx: index("idx_rooms_status").on(table.status),
    createdAtIdx: index("idx_rooms_created_at").on(table.createdAt),
  })
);

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
