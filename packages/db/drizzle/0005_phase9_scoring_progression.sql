CREATE TYPE "public"."score_ledger_kind" AS ENUM('MATCH_SCORE', 'RANKED_RATING', 'XP');--> statement-breakpoint
CREATE TYPE "public"."score_ledger_reason" AS ENUM('CAPTURE_CARD', 'SAME_RANK_BONUS', 'TABLE_CLEAR', 'CUT', 'PLACEMENT_BONUS', 'GHOST_BONUS', 'RANKED_PLACEMENT', 'ABANDON_PENALTY', 'XP_MATCH_BASE', 'XP_MATCH_SCORE');--> statement-breakpoint
ALTER TABLE "game_players" ADD COLUMN "match_score" integer;--> statement-breakpoint
ALTER TABLE "game_players" ADD COLUMN "xp_earned" integer;--> statement-breakpoint
ALTER TABLE "game_players" ADD COLUMN "ranked_rating_delta" integer;--> statement-breakpoint
ALTER TABLE "player_stats" ADD COLUMN "highest_match_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats" ADD COLUMN "total_match_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats" ADD COLUMN "ghost_finishes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE "player_progression" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"ranked_rating" integer DEFAULT 0 NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"highest_match_score" integer DEFAULT 0 NOT NULL,
	"total_match_score" integer DEFAULT 0 NOT NULL,
	"ghost_finishes" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "score_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"kind" "public"."score_ledger_kind" NOT NULL,
	"reason" "public"."score_ledger_reason" NOT NULL,
	"delta" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta_json" jsonb
);--> statement-breakpoint
ALTER TABLE "player_progression" ADD CONSTRAINT "player_progression_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_ledger" ADD CONSTRAINT "score_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_ledger" ADD CONSTRAINT "score_ledger_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "player_progression_user_id_idx" ON "player_progression" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "score_ledger_user_id_idx" ON "score_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "score_ledger_game_id_idx" ON "score_ledger" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "score_ledger_user_id_created_at_idx" ON "score_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
