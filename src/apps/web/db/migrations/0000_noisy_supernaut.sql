CREATE TABLE "audio_asset" (
	"key" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"text" text NOT NULL,
	"voice" text NOT NULL,
	"hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audio_asset_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "dict_entry" (
	"id" serial PRIMARY KEY NOT NULL,
	"simplified" text NOT NULL,
	"traditional" text NOT NULL,
	"pinyin_numbered" text NOT NULL,
	"pinyin_marked" text NOT NULL,
	"pinyin_plain" text NOT NULL,
	"definitions" text[] NOT NULL,
	"hsk_level" smallint,
	"is_variant_or_surname" boolean DEFAULT false NOT NULL,
	"cedict_order" integer,
	"definitions_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', clp_array_to_text(definitions))) STORED
);
--> statement-breakpoint
CREATE TABLE "hanzi" (
	"char" text PRIMARY KEY NOT NULL,
	"han_viet" text[] DEFAULT '{}' NOT NULL,
	"han_viet_source" text,
	"decomposition" text,
	"radical" text,
	"etymology_hint" text,
	"stroke_count" smallint,
	"has_stroke_data" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hsk_char" (
	"id" serial PRIMARY KEY NOT NULL,
	"level" smallint NOT NULL,
	"char" text NOT NULL,
	CONSTRAINT "hsk_char_char_unique" UNIQUE("char")
);
--> statement-breakpoint
CREATE TABLE "hsk_grammar" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"level" smallint NOT NULL,
	"name_zh" text NOT NULL,
	CONSTRAINT "hsk_grammar_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "hsk_word" (
	"id" serial PRIMARY KEY NOT NULL,
	"level" smallint NOT NULL,
	"simplified" text NOT NULL,
	"pinyin" text NOT NULL,
	"pos" text,
	"dict_entry_id" integer,
	"deprecated" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radical_vi" (
	"radical" text PRIMARY KEY NOT NULL,
	"number" smallint NOT NULL,
	"name_vi" text NOT NULL,
	"meaning_vi" text NOT NULL,
	CONSTRAINT "radical_vi_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "sentence" (
	"id" serial PRIMARY KEY NOT NULL,
	"zh" text NOT NULL,
	"pinyin" text NOT NULL,
	"en" text NOT NULL,
	"source" text NOT NULL,
	"source_ref" text,
	"max_hsk_level" smallint,
	"audio_url" text,
	CONSTRAINT "sentence_source_ref_uq" UNIQUE("source","source_ref")
);
--> statement-breakpoint
CREATE TABLE "sentence_word" (
	"sentence_id" integer NOT NULL,
	"dict_entry_id" integer NOT NULL,
	CONSTRAINT "sentence_word_sentence_id_dict_entry_id_pk" PRIMARY KEY("sentence_id","dict_entry_id")
);
--> statement-breakpoint
CREATE TABLE "content_meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"stage_id" text NOT NULL,
	"skill" text NOT NULL,
	"kind" text NOT NULL,
	"content" jsonb NOT NULL,
	"answer" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grammar_point" (
	"id" text PRIMARY KEY NOT NULL,
	"hsk_code" text,
	"title" text NOT NULL,
	"body_md" text NOT NULL,
	"examples" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson" (
	"id" text PRIMARY KEY NOT NULL,
	"unit_id" text NOT NULL,
	"order" smallint NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'normal' NOT NULL,
	"estimated_minutes" smallint,
	"content" jsonb NOT NULL,
	CONSTRAINT "lesson_unit_order_uq" UNIQUE("unit_id","order")
);
--> statement-breakpoint
CREATE TABLE "lesson_char" (
	"lesson_id" text NOT NULL,
	"char" text NOT NULL,
	CONSTRAINT "lesson_char_lesson_id_char_pk" PRIMARY KEY("lesson_id","char")
);
--> statement-breakpoint
CREATE TABLE "lesson_word" (
	"lesson_id" text NOT NULL,
	"hsk_word_id" integer NOT NULL,
	CONSTRAINT "lesson_word_lesson_id_hsk_word_id_pk" PRIMARY KEY("lesson_id","hsk_word_id")
);
--> statement-breakpoint
CREATE TABLE "stage" (
	"id" text PRIMARY KEY NOT NULL,
	"order" smallint NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"has_certificate" boolean DEFAULT false NOT NULL,
	"exam_open" boolean DEFAULT false NOT NULL,
	CONSTRAINT "stage_order_unique" UNIQUE("order")
);
--> statement-breakpoint
CREATE TABLE "unit" (
	"id" text PRIMARY KEY NOT NULL,
	"stage_id" text NOT NULL,
	"order" smallint NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image" text,
	"published" boolean DEFAULT false NOT NULL,
	CONSTRAINT "unit_stage_order_uq" UNIQUE("stage_id","order")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"display_name" text,
	"certificate_name" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "char_written" (
	"user_id" text NOT NULL,
	"char" text NOT NULL,
	"first_passed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "char_written_user_id_char_pk" PRIMARY KEY("user_id","char")
);
--> statement-breakpoint
CREATE TABLE "daily_activity" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"seconds" integer DEFAULT 0 NOT NULL,
	"lessons_completed" integer DEFAULT 0 NOT NULL,
	"reviews_done" integer DEFAULT 0 NOT NULL,
	"streak_freeze_used" boolean DEFAULT false NOT NULL,
	CONSTRAINT "daily_activity_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"user_id" text NOT NULL,
	"lesson_id" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"step_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"best_score" smallint,
	"completed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"content_version" integer,
	CONSTRAINT "lesson_progress_user_id_lesson_id_pk" PRIMARY KEY("user_id","lesson_id")
);
--> statement-breakpoint
CREATE TABLE "stage_progress" (
	"user_id" text NOT NULL,
	"stage_id" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"completed_via" text,
	"completed_at" timestamp with time zone,
	CONSTRAINT "stage_progress_user_id_stage_id_pk" PRIMARY KEY("user_id","stage_id")
);
--> statement-breakpoint
CREATE TABLE "tone_drill_stat" (
	"user_id" text NOT NULL,
	"tone" smallint NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tone_drill_stat_user_id_tone_pk" PRIMARY KEY("user_id","tone")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"daily_goal_minutes" smallint DEFAULT 10 NOT NULL,
	"show_pinyin" text DEFAULT 'always' NOT NULL,
	"show_han_viet" boolean DEFAULT true NOT NULL,
	"tone_colors" boolean DEFAULT true NOT NULL,
	"traditional" boolean DEFAULT false NOT NULL,
	"review_buttons" smallint DEFAULT 4 NOT NULL,
	"review_card_types" text[] DEFAULT '{"recognize"}' NOT NULL,
	"voice" text DEFAULT 'female' NOT NULL,
	"record_mode" text DEFAULT 'hold' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srs_card" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"dict_entry_id" integer NOT NULL,
	"hsk_word_id" integer,
	"card_type" text NOT NULL,
	"due" timestamp with time zone NOT NULL,
	"stability" real DEFAULT 0 NOT NULL,
	"difficulty" real DEFAULT 0 NOT NULL,
	"elapsed_days" integer DEFAULT 0 NOT NULL,
	"scheduled_days" integer DEFAULT 0 NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"state" smallint DEFAULT 0 NOT NULL,
	"last_review" timestamp with time zone,
	"source" text NOT NULL,
	"suspended" boolean DEFAULT false NOT NULL,
	CONSTRAINT "srs_card_user_entry_type_uq" UNIQUE("user_id","dict_entry_id","card_type")
);
--> statement-breakpoint
CREATE TABLE "srs_review_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"card_id" integer NOT NULL,
	"rating" text NOT NULL,
	"review_time" timestamp with time zone DEFAULT now() NOT NULL,
	"answer_ms" integer
);
--> statement-breakpoint
CREATE TABLE "speaking_attempt" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"item_ref" text NOT NULL,
	"score" smallint NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"user_id" text,
	"stage_id" text NOT NULL,
	"exam_attempt_id" uuid,
	"name_on_certificate" text NOT NULL,
	"score" smallint NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pdf_url" text,
	"revoked" boolean DEFAULT false NOT NULL,
	CONSTRAINT "certificate_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "certificate_name_change" (
	"id" serial PRIMARY KEY NOT NULL,
	"certificate_id" uuid NOT NULL,
	"old_name" text NOT NULL,
	"new_name" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"stage_id" text NOT NULL,
	"item_ids" integer[] NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sections" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"section_scores" jsonb,
	"total_score" smallint,
	"passed" boolean,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "content_report" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"kind" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tts_daily_counter" (
	"date" date PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hsk_word" ADD CONSTRAINT "hsk_word_dict_entry_id_dict_entry_id_fk" FOREIGN KEY ("dict_entry_id") REFERENCES "public"."dict_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentence_word" ADD CONSTRAINT "sentence_word_sentence_id_sentence_id_fk" FOREIGN KEY ("sentence_id") REFERENCES "public"."sentence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentence_word" ADD CONSTRAINT "sentence_word_dict_entry_id_dict_entry_id_fk" FOREIGN KEY ("dict_entry_id") REFERENCES "public"."dict_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_item" ADD CONSTRAINT "exam_item_stage_id_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stage"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_char" ADD CONSTRAINT "lesson_char_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_char" ADD CONSTRAINT "lesson_char_char_hanzi_char_fk" FOREIGN KEY ("char") REFERENCES "public"."hanzi"("char") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_word" ADD CONSTRAINT "lesson_word_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_word" ADD CONSTRAINT "lesson_word_hsk_word_id_hsk_word_id_fk" FOREIGN KEY ("hsk_word_id") REFERENCES "public"."hsk_word"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit" ADD CONSTRAINT "unit_stage_id_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stage"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "char_written" ADD CONSTRAINT "char_written_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "char_written" ADD CONSTRAINT "char_written_char_hanzi_char_fk" FOREIGN KEY ("char") REFERENCES "public"."hanzi"("char") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_activity" ADD CONSTRAINT "daily_activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_progress" ADD CONSTRAINT "stage_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_progress" ADD CONSTRAINT "stage_progress_stage_id_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stage"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tone_drill_stat" ADD CONSTRAINT "tone_drill_stat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_card" ADD CONSTRAINT "srs_card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_card" ADD CONSTRAINT "srs_card_dict_entry_id_dict_entry_id_fk" FOREIGN KEY ("dict_entry_id") REFERENCES "public"."dict_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_card" ADD CONSTRAINT "srs_card_hsk_word_id_hsk_word_id_fk" FOREIGN KEY ("hsk_word_id") REFERENCES "public"."hsk_word"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_review_log" ADD CONSTRAINT "srs_review_log_card_id_srs_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."srs_card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speaking_attempt" ADD CONSTRAINT "speaking_attempt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_stage_id_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stage"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_exam_attempt_id_exam_attempt_id_fk" FOREIGN KEY ("exam_attempt_id") REFERENCES "public"."exam_attempt"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_name_change" ADD CONSTRAINT "certificate_name_change_certificate_id_certificate_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempt" ADD CONSTRAINT "exam_attempt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempt" ADD CONSTRAINT "exam_attempt_stage_id_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stage"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_report" ADD CONSTRAINT "content_report_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dict_entry_simplified_idx" ON "dict_entry" USING btree ("simplified");--> statement-breakpoint
CREATE INDEX "dict_entry_pinyin_plain_idx" ON "dict_entry" USING btree ("pinyin_plain" text_pattern_ops);--> statement-breakpoint
CREATE INDEX "dict_entry_simplified_trgm_idx" ON "dict_entry" USING gin ("simplified" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "dict_entry_definitions_tsv_idx" ON "dict_entry" USING gin ("definitions_tsv");--> statement-breakpoint
CREATE INDEX "hsk_word_level_idx" ON "hsk_word" USING btree ("level");--> statement-breakpoint
CREATE INDEX "hsk_word_simplified_idx" ON "hsk_word" USING btree ("simplified");--> statement-breakpoint
CREATE INDEX "sentence_word_entry_idx" ON "sentence_word" USING btree ("dict_entry_id");--> statement-breakpoint
CREATE INDEX "exam_item_stage_skill_idx" ON "exam_item" USING btree ("stage_id","skill");--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "srs_card_due_idx" ON "srs_card" USING btree ("user_id","due") WHERE NOT "srs_card"."suspended";--> statement-breakpoint
CREATE INDEX "srs_review_log_card_idx" ON "srs_review_log" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "speaking_attempt_user_idx" ON "speaking_attempt" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "certificate_user_stage_active_uq" ON "certificate" USING btree ("user_id","stage_id") WHERE NOT "certificate"."revoked";--> statement-breakpoint
CREATE INDEX "exam_attempt_user_stage_idx" ON "exam_attempt" USING btree ("user_id","stage_id");