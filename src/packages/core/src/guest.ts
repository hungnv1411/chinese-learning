import { z } from 'zod';

/** Tiến độ khách lưu ở `localStorage['guest_progress_v1']` (spec 03 §4). Không tin dữ liệu này. */

const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid date');
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nonNegInt = z.number().int().min(0);

/** Khách được hoàn thành tối đa bấy nhiêu bài thường (spec 03 §2). */
export const GUEST_LESSON_LIMIT = 3;

/** Mục tiêu mỗi ngày (phút), cùng tập giá trị với `StudyGoal` ở srs.ts. */
export const GUEST_GOALS = [5, 10, 20] as const;

const SETTING_FIELDS = {
  dailyGoalMinutes: z.union([z.literal(5), z.literal(10), z.literal(20)]),
  showPinyin: z.enum(['always', 'new', 'never']),
  showHanViet: z.boolean(),
  toneColors: z.boolean(),
  traditional: z.boolean(),
  reviewButtons: z.union([z.literal(2), z.literal(4)]),
  reviewCardTypes: z.array(z.enum(['recognize', 'listen', 'write'])).min(1),
  voice: z.enum(['female', 'male']),
  recordMode: z.enum(['hold', 'toggle']),
} as const;

export type GuestSettings = {
  [K in keyof typeof SETTING_FIELDS]?: z.infer<(typeof SETTING_FIELDS)[K]>;
};

export const GuestLessonSchema = z.object({
  status: z.enum(['in_progress', 'completed']),
  currentStep: nonNegInt,
  stepState: z.unknown(),
  bestScore: z.number().int().min(0).max(100).nullable(),
  contentVersion: z.string().min(1),
  completedAt: iso.optional(),
});
export type GuestLesson = z.infer<typeof GuestLessonSchema>;

export const GuestCardSchema = z.object({
  /** `${dictEntryId}:${cardType}` */
  cardKey: z.string().min(1),
  dictEntryId: z.number().int().positive(),
  cardType: z.enum(['recognize', 'listen', 'write']),
  due: iso,
  stability: z.number().min(0),
  difficulty: z.number().min(0),
  scheduledDays: z.number().min(0),
  learningSteps: nonNegInt,
  reps: nonNegInt,
  lapses: nonNegInt,
  state: z.number().int().min(0).max(3),
  lastReview: iso.nullable(),
});
export type GuestCard = z.infer<typeof GuestCardSchema>;

export const GuestReviewLogSchema = z.object({
  cardKey: z.string().min(1),
  rating: z.enum(['again', 'hard', 'good', 'easy']),
  at: iso,
  ms: z.number().min(0),
});

export const GuestDailySchema = z.object({
  minutes: z.number().min(0),
  lessonsCompleted: nonNegInt,
  reviewsDone: nonNegInt,
});

/** Mảng: phần tử sai kiểu bị bỏ, không bỏ cả mảng. */
const lenientArray = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((xs) =>
      xs.flatMap((x) => (item.safeParse(x).success ? [item.parse(x) as z.infer<T>] : [])),
    );

/** Bản đồ: mục sai kiểu (hoặc khóa sai) bị bỏ. */
const lenientRecord = <T extends z.ZodTypeAny>(item: T, key: z.ZodString = z.string().min(1)) =>
  z
    .record(z.string(), z.unknown())
    .catch({})
    .transform((rec) => {
      const out: Record<string, z.infer<T>> = {};
      for (const [k, v] of Object.entries(rec)) {
        if (key.safeParse(k).success && item.safeParse(v).success) out[k] = item.parse(v);
      }
      return out;
    });

const lenientSettings = z
  .record(z.string(), z.unknown())
  .catch({})
  .transform((rec) => {
    const out: Record<string, unknown> = {};
    for (const [k, schema] of Object.entries(SETTING_FIELDS)) {
      const r = schema.safeParse(rec[k]);
      if (r.success) out[k] = r.data;
    }
    return out as GuestSettings;
  });

export const GuestProgressV1Schema = z.object({
  v: z.literal(1),
  /** Id ngẫu nhiên dùng làm seed “Chữ của ngày” cho khách. */
  guestId: z.string().min(1).max(64).optional(),
  start: z.enum(['zero', 'pinyin']).nullable().catch(null),
  settings: lenientSettings,
  pinyinTest: z.object({ passed: z.boolean(), at: iso }).nullable().catch(null),
  lessons: lenientRecord(GuestLessonSchema),
  cards: lenientArray(GuestCardSchema),
  reviewLog: lenientArray(GuestReviewLogSchema),
  daily: lenientRecord(GuestDailySchema, dateKey),
});
export type GuestProgressV1 = z.infer<typeof GuestProgressV1Schema>;

export function emptyGuestProgress(): GuestProgressV1 {
  return {
    v: 1,
    start: null,
    settings: {},
    pinyinTest: null,
    lessons: {},
    cards: [],
    reviewLog: [],
    daily: {},
  };
}

/** Đọc dữ liệu thô (chuỗi JSON hoặc object). Không dùng được → null. */
export function parseGuestProgress(raw: unknown): GuestProgressV1 | null {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const r = GuestProgressV1Schema.safeParse(value);
  return r.success ? r.data : null;
}
