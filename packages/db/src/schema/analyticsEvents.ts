import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

/**
 * Product analytics event log.
 * Used if self-hosting analytics (Phase 6f decision).
 * Each event is anonymous (no PII); user_id is an opaque token.
 *
 * If using external service (PostHog, Plausible), this table may be unused.
 */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Opaque user identifier (not the user_id from users table).
     * Allows analytics queries without PII exposure.
     */
    anonymousUserId: text("anonymous_user_id").notNull(),
    /**
     * Event name: 'room_created', 'game_started', 'game_finished', etc.
     */
    eventName: text("event_name").notNull(),
    /**
     * Event properties (JSONB): version, game_count, player_count, etc.
     * Structured to support product analytics queries.
     */
    properties: jsonb("properties"),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    anonymousUserIdIdx: index("idx_analytics_events_anonymous_user_id").on(table.anonymousUserId),
    eventNameIdx: index("idx_analytics_events_event_name").on(table.eventName),
    tsIdx: index("idx_analytics_events_ts").on(table.ts),
  })
);

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;
