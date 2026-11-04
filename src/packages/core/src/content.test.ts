import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import exerciseTypes from '../fixtures/exercise-types.json';
import { EXERCISE_TYPES, LessonContentSchema, StepSpecSchema } from './content';

// Hợp đồng với pipeline (Python): mọi file do pipeline xuất phải parse được bằng schema này.
const FIXTURES = resolve(__dirname, '../../../pipeline/tests/fixtures/lesson_content');
const files = readdirSync(FIXTURES).filter((f) => f.endsWith('.json'));

const valid = () => JSON.parse(readFileSync(resolve(FIXTURES, 'normal.json'), 'utf8'));

describe('hợp đồng lesson.content', () => {
  test('có fixture từ pipeline', () => {
    expect(files).toEqual(expect.arrayContaining(['normal.json', 'checkpoint.json', 'pron.json']));
  });

  test.each(files)('%s parse được bằng LessonContentSchema', (f) => {
    const data = JSON.parse(readFileSync(resolve(FIXTURES, f), 'utf8'));
    expect(() => LessonContentSchema.parse(data)).not.toThrow();
  });

  test('15 mã bài tập: 14 của exercise-types.md + pinyin_pick_audio', () => {
    expect([...EXERCISE_TYPES]).toEqual(exerciseTypes);
    expect(EXERCISE_TYPES).toHaveLength(15);
    expect(EXERCISE_TYPES).toContain('pinyin_pick_audio');
  });
});

describe('LessonContentSchema từ chối dữ liệu sai', () => {
  const bad = (mutate: (d: Record<string, unknown>) => void) => {
    const d = valid();
    mutate(d);
    return LessonContentSchema.safeParse(d).success;
  };

  test('contentVersion phải là 12 ký tự hex', () => {
    expect(bad((d) => (d.contentVersion = 'xyz'))).toBe(false);
    expect(bad((d) => (d.contentVersion = 'ABCDEF012345'))).toBe(false);
    expect(bad((d) => (d.contentVersion = 'abcdef012345'))).toBe(true);
  });

  test('bài thường phải có bước; checkpoint phải rỗng', () => {
    expect(bad((d) => (d.steps = []))).toBe(false);
    const cp = JSON.parse(readFileSync(resolve(FIXTURES, 'checkpoint.json'), 'utf8'));
    expect(
      LessonContentSchema.safeParse({ ...cp, steps: [{ kind: 'writing', char: '好' }] }).success,
    ).toBe(false);
  });

  test('loại bài lạ, câu thiếu pinyin, từ thiếu cờ extra', () => {
    expect(bad((d) => (d.type = 'weird'))).toBe(false);
    expect(bad((d) => ((d.sentences as { pinyin?: string }[])[0]!.pinyin = ''))).toBe(false);
    expect(bad((d) => delete (d.newWords as { extra?: boolean }[])[0]!.extra)).toBe(false);
  });
});

describe('StepSpecSchema', () => {
  test.each([
    { kind: 'intro', word: '你好' },
    { kind: 'sound_intro', sound: 'init-zh' },
    { kind: 'tone_contour_intro', tone: 3 },
    { kind: 'writing', char: '好' },
    { kind: 'grammar', grammarId: 'hsk1-g012' },
    { kind: 'exercise', type: 'pick_tone', target: '你好' },
    { kind: 'exercise', type: 'arrange', sentence: 's-hsk1-u03-001' },
    { kind: 'exercise_auto', count: 3 },
    { kind: 'speaking', mode: 'word', ref: '你好' },
    { kind: 'speaking', mode: 'syllable', ref: 'ma1' },
  ])('hợp lệ: %j', (step) => {
    expect(StepSpecSchema.safeParse(step).success).toBe(true);
  });

  test.each([
    { kind: 'exercise', type: 'khong_co', target: 'x' },
    { kind: 'tone_contour_intro', tone: 6 },
    { kind: 'exercise_auto', count: 0 },
    { kind: 'speaking', mode: 'shout', ref: 'x' },
    { kind: 'intro' },
    { kind: 'unknown' },
  ])('không hợp lệ: %j', (step) => {
    expect(StepSpecSchema.safeParse(step).success).toBe(false);
  });
});
