import { describe, expect, test } from 'vitest';
import { GuestProgressV1Schema, emptyGuestProgress, parseGuestProgress } from './guest';

const lesson = (over: object = {}) => ({
  status: 'completed',
  currentStep: 4,
  stepState: { answers: [1, 2] },
  bestScore: 90,
  contentVersion: 'v1',
  completedAt: '2026-11-10T08:00:00.000Z',
  ...over,
});
const card = (over: object = {}) => ({
  cardKey: '12:recognize',
  dictEntryId: 12,
  cardType: 'recognize',
  due: '2026-11-11T08:00:00.000Z',
  stability: 2.5,
  difficulty: 5,
  scheduledDays: 1,
  learningSteps: 0,
  reps: 1,
  lapses: 0,
  state: 2,
  lastReview: '2026-11-10T08:00:00.000Z',
  ...over,
});
const valid = () => ({
  v: 1,
  guestId: 'g-abc',
  start: 'zero',
  settings: { dailyGoalMinutes: 10, showPinyin: 'always' },
  pinyinTest: { passed: true, at: '2026-11-10T08:00:00.000Z' },
  lessons: { 'pron-u01-l01': lesson(), 'pron-u01-l02': lesson({ status: 'in_progress' }) },
  cards: [card()],
  reviewLog: [
    { cardKey: '12:recognize', rating: 'good', at: '2026-11-10T08:00:00.000Z', ms: 3200 },
  ],
  daily: { '2026-11-10': { minutes: 12, lessonsCompleted: 2, reviewsDone: 5 } },
});

describe('GuestProgressV1Schema', () => {
  test('dữ liệu hợp lệ parse nguyên vẹn', () => {
    expect(GuestProgressV1Schema.parse(valid())).toEqual(valid());
  });

  test('một bài có status "hacked" bị bỏ, các bài khác giữ', () => {
    const data = valid();
    (data.lessons as Record<string, unknown>)['pron-u01-l03'] = lesson({ status: 'hacked' });
    const out = GuestProgressV1Schema.parse(data);
    expect(Object.keys(out.lessons)).toEqual(['pron-u01-l01', 'pron-u01-l02']);
  });

  test('thẻ sai kiểu bị bỏ, thẻ đúng giữ', () => {
    const data = {
      ...valid(),
      cards: [card(), card({ reps: -1 }), card({ cardType: 'xyz' }), 'x', null],
    };
    expect(GuestProgressV1Schema.parse(data).cards).toEqual([card()]);
  });

  test('nhật ký ôn: rating lạ, ms âm, thời điểm không phải ngày → bỏ mục đó', () => {
    const good = valid().reviewLog[0];
    const data = {
      ...valid(),
      reviewLog: [
        good,
        { ...good, rating: 'perfect' },
        { ...good, ms: -1 },
        { ...good, at: 'hôm qua' },
      ],
    };
    expect(GuestProgressV1Schema.parse(data).reviewLog).toEqual([good]);
  });

  test('daily: khóa không phải YYYY-MM-DD hoặc số âm bị bỏ', () => {
    const data = {
      ...valid(),
      daily: {
        '2026-11-10': { minutes: 5, lessonsCompleted: 1, reviewsDone: 0 },
        yesterday: { minutes: 5, lessonsCompleted: 1, reviewsDone: 0 },
        '2026-11-09': { minutes: -5, lessonsCompleted: 1, reviewsDone: 0 },
      },
    };
    expect(Object.keys(GuestProgressV1Schema.parse(data).daily)).toEqual(['2026-11-10']);
  });

  test('cài đặt: giữ trường hợp lệ, bỏ trường sai, bỏ trường lạ', () => {
    const data = {
      ...valid(),
      settings: {
        dailyGoalMinutes: 99,
        showPinyin: 'new',
        toneColors: false,
        evil: 1,
        reviewButtons: 4,
      },
    };
    expect(GuestProgressV1Schema.parse(data).settings).toEqual({
      showPinyin: 'new',
      toneColors: false,
      reviewButtons: 4,
    });
  });

  test('mục tiêu mỗi ngày chỉ nhận 5 / 10 / 20', () => {
    for (const ok of [5, 10, 20]) {
      expect(
        GuestProgressV1Schema.parse({ ...valid(), settings: { dailyGoalMinutes: ok } }).settings,
      ).toEqual({ dailyGoalMinutes: ok });
    }
    expect(
      GuestProgressV1Schema.parse({ ...valid(), settings: { dailyGoalMinutes: 15 } }).settings,
    ).toEqual({});
  });

  test('start và pinyinTest sai → mặc định null', () => {
    const out = GuestProgressV1Schema.parse({
      ...valid(),
      start: 'hacker',
      pinyinTest: { passed: 'yes' },
    });
    expect(out.start).toBeNull();
    expect(out.pinyinTest).toBeNull();
  });

  test('thiếu trường → mặc định rỗng', () => {
    expect(GuestProgressV1Schema.parse({ v: 1 })).toEqual(emptyGuestProgress());
  });

  test('bestScore ngoài 0–100 hoặc currentStep âm → bỏ bài đó', () => {
    const data = {
      ...valid(),
      lessons: { a: lesson({ bestScore: 101 }), b: lesson({ currentStep: -1 }), c: lesson() },
    };
    expect(Object.keys(GuestProgressV1Schema.parse(data).lessons)).toEqual(['c']);
  });

  test('bestScore null và thiếu completedAt đều hợp lệ', () => {
    const l = lesson({ bestScore: null, status: 'in_progress' }) as Record<string, unknown>;
    delete l.completedAt;
    expect(GuestProgressV1Schema.parse({ ...valid(), lessons: { a: l } }).lessons.a).toEqual(l);
  });

  test('v khác 1 hoặc không phải object → lỗi', () => {
    expect(() => GuestProgressV1Schema.parse({ ...valid(), v: 2 })).toThrow();
    expect(() => GuestProgressV1Schema.parse('x')).toThrow();
    expect(() => GuestProgressV1Schema.parse(null)).toThrow();
  });
});

describe('parseGuestProgress', () => {
  test('trả null khi dữ liệu không dùng được', () => {
    expect(parseGuestProgress(null)).toBeNull();
    expect(parseGuestProgress('{')).toBeNull();
    expect(parseGuestProgress({ v: 2 })).toBeNull();
    expect(parseGuestProgress([])).toBeNull();
  });
  test('nhận cả chuỗi JSON và object', () => {
    expect(parseGuestProgress(JSON.stringify(valid()))).toEqual(valid());
    expect(parseGuestProgress(valid())).toEqual(valid());
  });
});
