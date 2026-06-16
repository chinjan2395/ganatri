import { pgTable, uuid, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Persisted session tokens (access + refresh).
 * Replaces the purely in-memory session UUID from Phase 2.
 * Supports device tracking and token revocation.
 */
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token").notNull(), // signed JWT or opaque token
    refreshToken: text("refresh_token").notNull(),
    deviceInfo: text("device_info"), // JSON: browser, OS, etc. for security
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }), // null if active
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("idx_auth_sessions_user_id").on(table.userId),
    accessTokenIdx: index("idx_auth_sessions_access_token").on(table.accessToken),
    expiresAtIdx: index("idx_auth_sessions_expires_at").on(table.expiresAt),
  })
);

export type AuthSession = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;
