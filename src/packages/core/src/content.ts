import { z } from 'zod';

/**
 * Hợp đồng `lesson.content` giữa pipeline (Pydantic, `clp/content/models.py`) và web (zod).
 * YAML là định dạng soạn; `import_content` chuẩn hóa thành JSON này. Danh sách mã bài tập phải
 * khớp `fixtures/exercise-types.json` (cả hai phía đều có test so khớp).
 */
export const EXERCISE_TYPES = [
  'listen_pick_hanzi',
  'listen_pick_meaning',
  'listen_pick_pinyin',
  'pick_tone',
  'listen_dictation_pinyin',
  'hanzi_to_meaning',
  'meaning_to_hanzi',
  'hanzi_to_pinyin',
  'arrange',
  'fill_blank',
  'match_pairs',
  'read_sentence',
  'write_char',
  'speak',
  'pinyin_pick_audio',
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

const nonEmpty = z.string().min(1);
const ToneSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

export const StepSpecSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('intro'), word: nonEmpty }),
  z.object({ kind: z.literal('sound_intro'), sound: nonEmpty }),
  z.object({ kind: z.literal('tone_contour_intro'), tone: ToneSchema }),
  z.object({ kind: z.literal('writing'), char: nonEmpty }),
  z.object({ kind: z.literal('grammar'), grammarId: nonEmpty }),
  z.object({
    kind: z.literal('exercise'),
    type: z.enum(EXERCISE_TYPES),
    target: nonEmpty.optional(),
    sentence: nonEmpty.optional(),
  }),
  z.object({ kind: z.literal('exercise_auto'), count: z.number().int().min(1) }),
  z.object({
    kind: z.literal('speaking'),
    mode: z.enum(['syllable', 'word', 'sentence', 'answer']),
    ref: nonEmpty,
  }),
]);
export type StepSpec = z.infer<typeof StepSpecSchema>;

export const LessonContentSchema = z
  .object({
    /** sha256 rút gọn 12 ký tự hex của JSON chuẩn hóa của bài (không tính chính trường này). */
    contentVersion: z.string().regex(/^[0-9a-f]{12}$/),
    type: z.enum(['normal', 'checkpoint']),
    newWords: z.array(
      z.object({
        word: nonEmpty,
        hskWordId: z.number().int().nullable(),
        extra: z.boolean(),
        /** Cách đọc khi chữ có nhiều cách đọc (số thanh hoặc có dấu). */
        pinyin: nonEmpty.optional(),
      }),
    ),
    newChars: z.array(nonEmpty),
    sentences: z.array(
      z.object({
        id: nonEmpty,
        zh: nonEmpty,
        en: nonEmpty,
        pinyin: nonEmpty,
        tatoebaId: z.number().int().optional(),
      }),
    ),
    tips: z.record(z.string(), z.string()),
    /** Rỗng với checkpoint (sinh lúc chạy). */
    steps: z.array(StepSpecSchema),
  })
  .superRefine((lesson, ctx) => {
    if (lesson.type === 'checkpoint' && lesson.steps.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['steps'],
        message: 'Bài checkpoint phải có steps rỗng.',
      });
    }
    if (lesson.type === 'normal' && lesson.steps.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['steps'],
        message: 'Bài thường phải có ít nhất một bước.',
      });
    }
  });
export type LessonContent = z.infer<typeof LessonContentSchema>;
