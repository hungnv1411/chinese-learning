import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  index,
  integer,
  pgTable,
  real,
  serial,
  smallint,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { dictEntry, hskWord } from './reference';

export const srsCard = pgTable(
  'srs_card',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    dictEntryId: integer('dict_entry_id')
      .notNull()
      .references(() => dictEntry.id),
    hskWordId: integer('hsk_word_id').references(() => hskWord.id),
    /** 'recognize' | 'listen' | 'write' */
    cardType: text('card_type').notNull(),
    // Trạng thái FSRS (ts-fsrs)
    due: timestamp('due', { withTimezone: true }).notNull(),
    stability: real('stability').notNull().default(0),
    difficulty: real('difficulty').notNull().default(0),
    elapsedDays: integer('elapsed_days').notNull().default(0),
    scheduledDays: integer('scheduled_days').notNull().default(0),
    reps: integer('reps').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    state: smallint('state').notNull().default(0),
    lastReview: timestamp('last_review', { withTimezone: true }),
    /** 'lesson' | 'dictionary' | 'speaking_fail' */
    source: text('source').notNull(),
    suspended: boolean('suspended').notNull().default(false),
  },
  (t) => [
    unique('srs_card_user_entry_type_uq').on(t.userId, t.dictEntryId, t.cardType),
    index('srs_card_due_idx')
      .on(t.userId, t.due)
      .where(sql`NOT ${t.suspended}`),
  ],
);

export const srsReviewLog = pgTable(
  'srs_review_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    cardId: integer('card_id')
      .notNull()
      .references(() => srsCard.id, { onDelete: 'cascade' }),
    rating: text('rating').notNull(),
    reviewTime: timestamp('review_time', { withTimezone: true }).notNull().defaultNow(),
    answerMs: integer('answer_ms'),
  },
  (t) => [index('srs_review_log_card_idx').on(t.cardId)],
);
