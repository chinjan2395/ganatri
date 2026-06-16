CREATE TABLE IF NOT EXISTS "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anonymous_user_id" text NOT NULL,
	"event_name" text NOT NULL,
	"properties" jsonb,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"device_info" text,
	"expires_at" timestamp with time zone NOT NULL,
	"refresh_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" text,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" uuid,
	"seat_index" integer NOT NULL,
	"display_name_snapshot" text NOT NULL,
	"final_rank" integer NOT NULL,
	"safe_order" integer,
	"was_cut" boolean DEFAULT false NOT NULL,
	"capture_count" integer DEFAULT 0 NOT NULL,
	"result" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"seed" integer NOT NULL,
	"seating_json" text NOT NULL,
	"player_count" integer NOT NULL,
	"config_snapshot" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_ms" integer,
	"outcome_json" text,
	"abandoned" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"avatar" text,
	"is_guest" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_code" varchar(6) NOT NULL,
	"host_user_id" uuid NOT NULL,
	"status" text DEFAULT 'lobby' NOT NULL,
	"config_snapshot" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "rooms_room_code_unique" UNIQUE("room_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_stats" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"games_won" integer DEFAULT 0 NOT NULL,
	"games_lost" integer DEFAULT 0 NOT NULL,
	"games_abandoned" integer DEFAULT 0 NOT NULL,
	"total_finish_position" integer DEFAULT 0 NOT NULL,
	"total_captures" integer DEFAULT 0 NOT NULL,
	"times_cut" integer DEFAULT 0 NOT NULL,
	"times_safe" integer DEFAULT 0 NOT NULL,
	"total_play_time_ms" integer DEFAULT 0 NOT NULL,
	"current_win_streak" integer DEFAULT 0 NOT NULL,
	"max_win_streak" integer DEFAULT 0 NOT NULL,
	"rating" numeric(7, 1) DEFAULT '1600.0' NOT NULL,
	"rating_uncertainty" numeric(7, 1) DEFAULT '350.0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analytics_events_anonymous_user_id" ON "analytics_events" ("anonymous_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analytics_events_event_name" ON "analytics_events" ("event_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analytics_events_ts" ON "analytics_events" ("ts");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auth_sessions_user_id" ON "auth_sessions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auth_sessions_access_token" ON "auth_sessions" ("access_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auth_sessions_expires_at" ON "auth_sessions" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_game_events_game_id" ON "game_events" ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_game_events_seq" ON "game_events" ("seq");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_game_events_event_type" ON "game_events" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_game_events_ts" ON "game_events" ("ts");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_game_players_game_id" ON "game_players" ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_game_players_user_id" ON "game_players" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_game_players_seat_index" ON "game_players" ("seat_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_games_room_id" ON "games" ("room_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_games_started_at" ON "games" ("started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_games_ended_at" ON "games" ("ended_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_created_at" ON "users" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rooms_code" ON "rooms" ("room_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rooms_host_user_id" ON "rooms" ("host_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rooms_status" ON "rooms" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rooms_created_at" ON "rooms" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_player_stats_games_won" ON "player_stats" ("games_won");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_player_stats_rating" ON "player_stats" ("rating");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_player_stats_updated_at" ON "player_stats" ("updated_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_events" ADD CONSTRAINT "game_events_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_players" ADD CONSTRAINT "game_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "games" ADD CONSTRAINT "games_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rooms" ADD CONSTRAINT "rooms_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
