import { index, jsonb, pgTable, serial, smallint, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

/** Không lưu file ghi âm. */
export const speakingAttempt = pgTable(
  'speaking_attempt',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    itemRef: text('item_ref').notNull(),
    score: smallint('score').notNull(),
    detail: jsonb('detail').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('speaking_attempt_user_idx').on(t.userId, t.createdAt)],
);
