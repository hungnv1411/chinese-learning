import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { stage } from './curriculum';

export const examAttempt = pgTable(
  'exam_attempt',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    stageId: text('stage_id')
      .notNull()
      .references(() => stage.id),
    itemIds: integer('item_ids').array().notNull(),
    answers: jsonb('answers').notNull().default({}),
    /** Thời điểm bắt đầu/kết thúc từng phần. */
    sections: jsonb('sections').notNull().default({}),
    sectionScores: jsonb('section_scores'),
    totalScore: smallint('total_score'),
    passed: boolean('passed'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    /** Giờ hết hạn do server giữ. */
    deadlineAt: timestamp('deadline_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('exam_attempt_user_stage_idx').on(t.userId, t.stageId)],
);

export const certificate = pgTable(
  'certificate',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Ví dụ HSK1-7F3K-92QD. */
    code: text('code').notNull().unique(),
    // Xóa tài khoản không xóa chứng nhận (03-auth xử lý riêng): chỉ gỡ liên kết.
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    stageId: text('stage_id')
      .notNull()
      .references(() => stage.id),
    examAttemptId: uuid('exam_attempt_id').references(() => examAttempt.id, {
      onDelete: 'set null',
    }),
    nameOnCertificate: text('name_on_certificate').notNull(),
    score: smallint('score').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    pdfUrl: text('pdf_url'),
    revoked: boolean('revoked').notNull().default(false),
  },
  (t) => [
    uniqueIndex('certificate_user_stage_active_uq')
      .on(t.userId, t.stageId)
      .where(sql`NOT ${t.revoked}`),
  ],
);

export const certificateNameChange = pgTable('certificate_name_change', {
  id: serial('id').primaryKey(),
  certificateId: uuid('certificate_id')
    .notNull()
    .references(() => certificate.id, { onDelete: 'cascade' }),
  oldName: text('old_name').notNull(),
  newName: text('new_name').notNull(),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
});
