import { pgTable, uuid, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

/**
 * User accounts. Guests have is_guest=true and email=null.
 * Registered users can update display_name and avatar.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayName: text("display_name").notNull(),
    email: text("email"), // nullable for guests
    avatar: text("avatar"), // URL to avatar image
    isGuest: boolean("is_guest").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index("idx_users_email").on(table.email),
    createdAtIdx: index("idx_users_created_at").on(table.createdAt),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
