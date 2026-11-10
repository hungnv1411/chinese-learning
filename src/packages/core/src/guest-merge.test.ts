import { describe, expect, test } from 'vitest';
import type { CurriculumIndex } from './unlock';
import {
  mergeGuestProgress,
  trialLessonIds,
  type AccountSnapshot,
  type MergeCtx,
} from './guest-merge';
import {
  emptyGuestProgress,
  type GuestCard,
  type GuestLesson,
  type GuestProgressV1,
} from './guest';

const normal = (id: string) => ({ id, type: 'normal' as const });
const curriculum: CurriculumIndex = {
  stages: [
    {
      id: 'pron',
      order: 0,
      examOpen: false,
      units: [
        {
          id: 'pron-u01',
          published: true,
          lessons: [
            normal('p1'),
            normal('p2'),
            normal('p3'),
            normal('p4'),
            { id: 'p5', type: 'checkpoint' },
          ],
        },
      ],
    },
    {
      id: 'hsk1',
      order: 1,
      examOpen: true,
      units: [
        {
          id: 'hsk1-u01',
          published: true,
          lessons: [
            normal('h1'),
            normal('h2'),
            normal('h3'),
            normal('h4'),
            { id: 'h5', type: 'checkpoint' },
          ],
        },
        {
          id: 'hsk1-u05',
          published: true,
          lessons: [normal('hsk1-u05-l01'), normal('hsk1-u05-l02')],
        },
      ],
    },
  ],
};

// Mỗi bài trong tập thử có 6 mục từ điển: p1 → 1..6, p2 → 7..12, …
const lessonEntries: Record<string, number[]> = Object.fromEntries(
  ['p1', 'p2', 'p3', 'h1', 'h2', 'h3'].map((id, i) => [
    id,
    Array.from({ length: 6 }, (_, k) => i * 6 + k + 1),
  ]),
);
const now = new Date('2026-11-10T08:00:00Z');
const ctx = (): MergeCtx => ({
  curriculum,
  trialIds: trialLessonIds(curriculum),
  lessonEntries,
  now,
});

const emptyAccount = (): AccountSnapshot => ({ lessons: {}, stages: {}, cardKeys: [] });
const gl = (over: Partial<GuestLesson> = {}): GuestLesson => ({
  status: 'completed',
  currentStep: 5,
  stepState: { a: 1 },
  bestScore: 80,
  contentVersion: 'v1',
  completedAt: '2026-11-09T08:00:00.000Z',
  ...over,
});
const gc = (entry: number, cardType: GuestCard['cardType'] = 'recognize'): GuestCard => ({
  cardKey: `${entry}:${cardType}`,
  dictEntryId: entry,
  cardType,
  due: '2026-11-11T08:00:00.000Z',
  stability: 2,
  difficulty: 5,
  scheduledDays: 1,
  learningSteps: 0,
  reps: 1,
  lapses: 0,
  state: 2,
  lastReview: '2026-11-10T07:00:00.000Z',
});
const guest = (over: Partial<GuestProgressV1> = {}): GuestProgressV1 => ({
  ...emptyGuestProgress(),
  ...over,
});
const ids = (plan: { upsertLessonProgress: { lessonId: string }[] }) =>
  plan.upsertLessonProgress.map((l) => l.lessonId);

describe('trialLessonIds', () => {
  test('3 bài thường đầu của pron và 3 bài thường đầu của hsk1 (không có bài ôn)', () => {
    expect([...trialLessonIds(curriculum)].sort()).toEqual(['h1', 'h2', 'h3', 'p1', 'p2', 'p3']);
  });
});

describe('mergeGuestProgress: tài khoản mới', () => {
  test('nhận đủ 2 bài, 12 thẻ, cài đặt của khách', () => {
    const g = guest({
      settings: { dailyGoalMinutes: 20, voice: 'male' },
      lessons: { p1: gl(), p2: gl({ status: 'in_progress', bestScore: null, currentStep: 2 }) },
      cards: Array.from({ length: 12 }, (_, i) => gc(i + 1)),
      daily: { '2026-11-10': { minutes: 12, lessonsCompleted: 1, reviewsDone: 3 } },
    });
    const plan = mergeGuestProgress(emptyAccount(), g, ctx());
    expect(ids(plan).sort()).toEqual(['p1', 'p2']);
    expect(plan.insertCards).toHaveLength(12);
    expect(plan.setSettings).toEqual({ dailyGoalMinutes: 20, voice: 'male' });
    expect(plan.addDaily).toEqual([
      { date: '2026-11-10', seconds: 720, lessonsCompleted: 1, reviewsDone: 3 },
    ]);
    expect(plan.setStageCompleted).toEqual([]);
  });

  test('bài hoàn thành không có completedAt thì lấy giờ hiện tại', () => {
    const plan = mergeGuestProgress(
      emptyAccount(),
      guest({ lessons: { p1: gl({ completedAt: undefined }) } }),
      ctx(),
    );
    expect(plan.upsertLessonProgress[0]?.completedAt).toBe(now.toISOString());
  });
});

describe('mergeGuestProgress: tài khoản đã có tiến độ', () => {
  const account = (): AccountSnapshot => ({
    lessons: {
      p1: {
        status: 'in_progress',
        currentStep: 2,
        stepState: { x: 1 },
        bestScore: 95,
        contentVersion: 'v1',
        completedAt: null,
      },
      p2: {
        status: 'completed',
        currentStep: 9,
        stepState: {},
        bestScore: 70,
        contentVersion: 'v1',
        completedAt: '2026-11-01T00:00:00.000Z',
      },
    },
    stages: {},
    cardKeys: ['1:recognize'],
  });

  test('khách completed + tài khoản in_progress → completed; bestScore lấy max', () => {
    const plan = mergeGuestProgress(
      account(),
      guest({ lessons: { p1: gl({ bestScore: 80 }) } }),
      ctx(),
    );
    expect(plan.upsertLessonProgress).toEqual([
      {
        lessonId: 'p1',
        status: 'completed',
        currentStep: 5,
        stepState: { a: 1 },
        bestScore: 95,
        contentVersion: 'v1',
        completedAt: '2026-11-09T08:00:00.000Z',
      },
    ]);
  });

  test('tài khoản completed, khách in_progress → giữ tài khoản, không ghi gì', () => {
    const plan = mergeGuestProgress(
      account(),
      guest({
        lessons: {
          p1: gl({ status: 'completed' }),
          p2: gl({ status: 'in_progress', bestScore: 50 }),
        },
      }),
      ctx(),
    );
    expect(ids(plan)).toEqual(['p1']);
  });

  test('cùng in_progress: currentStep lớn hơn thắng', () => {
    const acc = account();
    const a = mergeGuestProgress(
      acc,
      guest({ lessons: { p1: gl({ status: 'in_progress', currentStep: 4, bestScore: null }) } }),
      ctx(),
    );
    expect(a.upsertLessonProgress[0]).toMatchObject({
      currentStep: 4,
      bestScore: 95,
      stepState: { a: 1 },
    });
    const b = mergeGuestProgress(
      acc,
      guest({ lessons: { p1: gl({ status: 'in_progress', currentStep: 1, bestScore: null }) } }),
      ctx(),
    );
    expect(b.upsertLessonProgress).toEqual([]);
  });

  test('thẻ trùng giữ bản tài khoản, thẻ mới thêm vào', () => {
    const plan = mergeGuestProgress(
      account(),
      guest({ lessons: { p1: gl() }, cards: [gc(1), gc(2)] }),
      ctx(),
    );
    expect(plan.insertCards.map((c) => c.cardKey)).toEqual(['2:recognize']);
  });

  test('ngày trùng được cộng dồn (op addDaily), cài đặt giữ của tài khoản', () => {
    const plan = mergeGuestProgress(
      account(),
      guest({
        settings: { dailyGoalMinutes: 5 },
        daily: { '2026-11-10': { minutes: 4, lessonsCompleted: 0, reviewsDone: 2 } },
      }),
      ctx(),
    );
    expect(plan.setSettings).toBeNull();
    expect(plan.addDaily).toEqual([
      { date: '2026-11-10', seconds: 240, lessonsCompleted: 0, reviewsDone: 2 },
    ]);
  });
});

describe('mergeGuestProgress: dữ liệu bị sửa tay', () => {
  test('bài ngoài tập học thử bị bỏ', () => {
    const plan = mergeGuestProgress(
      emptyAccount(),
      guest({ lessons: { 'hsk1-u05-l02': gl(), p4: gl(), p5: gl(), p1: gl() } }),
      ctx(),
    );
    expect(ids(plan)).toEqual(['p1']);
  });

  test('chỉ nhận 3 bài completed hợp lệ đầu tiên', () => {
    const g = guest({
      pinyinTest: { passed: true, at: '2026-11-09T00:00:00.000Z' },
      lessons: { p1: gl(), p2: gl(), p3: gl(), h1: gl(), h2: gl() },
    });
    expect(ids(mergeGuestProgress(emptyAccount(), g, ctx()))).toEqual(['p1', 'p2', 'p3']);
  });

  test('bài 3 completed khi bài 2 chưa xong bị bỏ', () => {
    const g = guest({ lessons: { p1: gl(), p3: gl() } });
    expect(ids(mergeGuestProgress(emptyAccount(), g, ctx()))).toEqual(['p1']);
  });

  test('bài 3 in_progress khi bài 2 chưa xong cũng bị bỏ', () => {
    const g = guest({ lessons: { p1: gl(), p3: gl({ status: 'in_progress' }) } });
    expect(ids(mergeGuestProgress(emptyAccount(), g, ctx()))).toEqual(['p1']);
  });

  test('bài hsk1 chỉ hợp lệ khi đã đạt bài kiểm tra pinyin', () => {
    const g = guest({ lessons: { h1: gl({ status: 'in_progress' }) } });
    expect(ids(mergeGuestProgress(emptyAccount(), g, ctx()))).toEqual([]);
    const passed = { ...g, pinyinTest: { passed: true, at: '2026-11-09T00:00:00.000Z' } };
    expect(ids(mergeGuestProgress(emptyAccount(), passed, ctx()))).toEqual(['h1']);
  });

  test('thẻ cho từ không thuộc bài hợp lệ bị bỏ; thẻ trùng trong gói khách chỉ giữ một', () => {
    const g = guest({
      lessons: { p1: gl() },
      cards: [gc(1), gc(1), gc(7) /* thuộc p2, khách chưa học */, gc(999)],
    });
    expect(mergeGuestProgress(emptyAccount(), g, ctx()).insertCards.map((c) => c.cardKey)).toEqual([
      '1:recognize',
    ]);
  });

  test('daily: ngày tương lai bỏ, số liệu phi lý bị chặn trên', () => {
    const g = guest({
      daily: {
        '2026-11-10': { minutes: 99999, lessonsCompleted: 50, reviewsDone: 99999 },
        '2026-12-31': { minutes: 5, lessonsCompleted: 1, reviewsDone: 0 },
      },
    });
    const plan = mergeGuestProgress(emptyAccount(), g, ctx());
    expect(plan.addDaily).toEqual([
      { date: '2026-11-10', seconds: 1440 * 60, lessonsCompleted: 3, reviewsDone: 1000 },
    ]);
  });

  test('không bao giờ có thao tác nào ngoài 5 loại đã định (không tạo chứng nhận)', () => {
    const plan = mergeGuestProgress(emptyAccount(), guest(), ctx());
    expect(Object.keys(plan).sort()).toEqual([
      'addDaily',
      'insertCards',
      'setSettings',
      'setStageCompleted',
      'upsertLessonProgress',
    ]);
  });
});

describe('mergeGuestProgress: bài kiểm tra pinyin', () => {
  const passed = guest({ pinyinTest: { passed: true, at: '2026-11-09T00:00:00.000Z' } });
  test('passed → setStageCompleted(pron, exam_skip)', () => {
    expect(mergeGuestProgress(emptyAccount(), passed, ctx()).setStageCompleted).toEqual([
      { stageId: 'pron', via: 'exam_skip' },
    ]);
  });
  test('chưa đạt → không có thao tác', () => {
    const g = guest({ pinyinTest: { passed: false, at: '2026-11-09T00:00:00.000Z' } });
    expect(mergeGuestProgress(emptyAccount(), g, ctx()).setStageCompleted).toEqual([]);
  });
  test('tài khoản đã hoàn thành pron rồi thì không ghi đè', () => {
    const acc: AccountSnapshot = {
      ...emptyAccount(),
      stages: { pron: { completedVia: 'lessons' } },
    };
    expect(mergeGuestProgress(acc, passed, ctx()).setStageCompleted).toEqual([]);
  });
});
