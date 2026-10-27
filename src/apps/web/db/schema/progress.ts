import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { lesson, stage } from './curriculum';
import { hanzi } from './reference';

const userId = () =>
  text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' });

export const userSettings = pgTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  dailyGoalMinutes: smallint('daily_goal_minutes').notNull().default(10),
  /** 'always' | 'new' | 'never' */
  showPinyin: text('show_pinyin').notNull().default('always'),
  showHanViet: boolean('show_han_viet').notNull().default(true),
  toneColors: boolean('tone_colors').notNull().default(true),
  traditional: boolean('traditional').notNull().default(false),
  reviewButtons: smallint('review_buttons').notNull().default(4),
  reviewCardTypes: text('review_card_types').array().notNull().default(['recognize']),
  /** 'female' | 'male' */
  voice: text('voice').notNull().default('female'),
  /** 'hold' | 'toggle' */
  recordMode: text('record_mode').notNull().default('hold'),
});

/** `locked`/`available` không lưu: tính bằng computeUnlockState. */
export const lessonProgress = pgTable(
  'lesson_progress',
  {
    userId: userId(),
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lesson.id),
    /** 'in_progress' | 'completed' (bài ôn chủ đề chỉ completed khi đạt ≥ 70%). */
    status: text('status').notNull().default('in_progress'),
    currentStep: integer('current_step').notNull().default(0),
    stepState: jsonb('step_state').notNull().default({}),
    bestScore: smallint('best_score'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    contentVersion: integer('content_version'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);

export const stageProgress = pgTable(
  'stage_progress',
  {
    userId: userId(),
    stageId: text('stage_id')
      .notNull()
      .references(() => stage.id),
    /** 'available' | 'completed' */
    status: text('status').notNull().default('available'),
    /** 'lessons' | 'exam_skip' */
    completedVia: text('completed_via'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.stageId] })],
);

export const dailyActivity = pgTable(
  'daily_activity',
  {
    userId: userId(),
    /** Ngày theo múi giờ của người dùng. */
    date: date('date', { mode: 'string' }).notNull(),
    /** Tích lũy chính xác theo giây, hiển thị theo phút. */
    seconds: integer('seconds').notNull().default(0),
    lessonsCompleted: integer('lessons_completed').notNull().default(0),
    reviewsDone: integer('reviews_done').notNull().default(0),
    streakFreezeUsed: boolean('streak_freeze_used').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

/** Chữ đã đạt ở chế độ Tự viết (thống kê trang Tôi). */
export const charWritten = pgTable(
  'char_written',
  {
    userId: userId(),
    char: text('char')
      .notNull()
      .references(() => hanzi.char),
    firstPassedAt: timestamp('first_passed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.char] })],
);

export const toneDrillStat = pgTable(
  'tone_drill_stat',
  {
    userId: userId(),
    tone: smallint('tone').notNull(),
    correct: integer('correct').notNull().default(0),
    total: integer('total').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.tone] })],
);

