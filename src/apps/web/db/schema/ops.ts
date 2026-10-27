import { date, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const contentReport = pgTable('content_report', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
  /** 'lesson' | 'word' | 'sentence' | ... */
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  kind: text('kind').notNull(),
  description: text('description').notNull().default(''),
  /** 'open' | 'resolved' | 'dismissed' */
  status: text('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Giới hạn tạo audio từ điển theo yêu cầu (500/ngày). */
export const ttsDailyCounter = pgTable('tts_daily_counter', {
  date: date('date', { mode: 'string' }).primaryKey(),
  count: integer('count').notNull().default(0),
});
