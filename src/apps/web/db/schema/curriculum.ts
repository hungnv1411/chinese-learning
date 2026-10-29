import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  unique,
} from 'drizzle-orm/pg-core';
import { hanzi, hskWord } from './reference';

export const stage = pgTable('stage', {
  /** 'pron' | 'hsk1' | 'hsk2' | 'hsk3' */
  id: text('id').primaryKey(),
  order: smallint('order').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  hasCertificate: boolean('has_certificate').notNull().default(false),
  /** Lộ trình đủ điều kiện phát hành thì mở bài kiểm tra cuối. */
  examOpen: boolean('exam_open').notNull().default(false),
});

export const unit = pgTable(
  'unit',
  {
    id: text('id').primaryKey(),
    stageId: text('stage_id')
      .notNull()
      .references(() => stage.id),
    order: smallint('order').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    image: text('image'),
    /** false = “Sắp ra mắt”. */
    published: boolean('published').notNull().default(false),
  },
  (t) => [unique('unit_stage_order_uq').on(t.stageId, t.order)],
);

export const lesson = pgTable(
  'lesson',
  {
    /** Cố định, ví dụ `hsk1-u03-l02`. Không đổi, không xóa khi đã phát hành. */
    id: text('id').primaryKey(),
    unitId: text('unit_id')
      .notNull()
      .references(() => unit.id),
    order: smallint('order').notNull(),
    title: text('title').notNull(),
    /** 'normal' | 'checkpoint' */
    kind: text('kind').notNull().default('normal'),
    estimatedMinutes: smallint('estimated_minutes'),
    content: jsonb('content').notNull(),
  },
  (t) => [unique('lesson_unit_order_uq').on(t.unitId, t.order)],
);

export const lessonWord = pgTable(
  'lesson_word',
  {
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lesson.id),
    hskWordId: integer('hsk_word_id')
      .notNull()
      .references(() => hskWord.id),
  },
  (t) => [primaryKey({ columns: [t.lessonId, t.hskWordId] })],
);

export const lessonChar = pgTable(
  'lesson_char',
  {
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lesson.id),
    char: text('char')
      .notNull()
      .references(() => hanzi.char),
  },
  (t) => [primaryKey({ columns: [t.lessonId, t.char] })],
);

export const grammarPoint = pgTable('grammar_point', {
  id: text('id').primaryKey(),
  hskCode: text('hsk_code'),
  title: text('title').notNull(),
  bodyMd: text('body_md').notNull(),
  examples: jsonb('examples').notNull().default([]),
});

export const examItem = pgTable(
  'exam_item',
  {
    id: serial('id').primaryKey(),
    stageId: text('stage_id')
      .notNull()
      .references(() => stage.id),
    skill: text('skill').notNull(),
    kind: text('kind').notNull(),
    content: jsonb('content').notNull(),
    /** Không bao giờ gửi xuống client. */
    answer: jsonb('answer').notNull(),
  },
  (t) => [index('exam_item_stage_skill_idx').on(t.stageId, t.skill)],
);

export const contentMeta = pgTable('content_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
