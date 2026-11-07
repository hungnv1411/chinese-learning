ALTER TABLE "user_settings" ALTER COLUMN "review_buttons" SET DEFAULT 2;--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "review_card_types" SET DEFAULT '{"recognize","listen"}';--> statement-breakpoint
ALTER TABLE "srs_card" ADD COLUMN "learning_steps" smallint DEFAULT 0 NOT NULL;