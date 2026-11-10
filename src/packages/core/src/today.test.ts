import { describe, expect, test } from 'vitest';
import { characterOfDay, fnv1a, pickMainCard, type LessonRef } from './today';

const lesson = (id: string): LessonRef => ({ id, title: `Bài ${id}` });

describe('pickMainCard', () => {
  test('có bài đang dở → continue, kể cả khi thẻ ôn dồn nhiều', () => {
    expect(
      pickMainCard({
        inProgress: { ...lesson('a'), currentStep: 3 },
        dueCount: 999,
        dailyLimit: 20,
        nextLesson: lesson('b'),
      }),
    ).toEqual({ kind: 'continue', lesson: { ...lesson('a'), currentStep: 3 } });
  });

  test('thẻ đến hạn > giới hạn × 1,5 → review', () => {
    expect(pickMainCard({ dueCount: 31, dailyLimit: 20, nextLesson: lesson('b') })).toEqual({
      kind: 'review',
    });
  });

  test('ca biên: 150 với giới hạn 100 → next, 151 → review', () => {
    const next = lesson('b');
    expect(pickMainCard({ dueCount: 150, dailyLimit: 100, nextLesson: next })).toEqual({
      kind: 'next',
      lesson: next,
    });
    expect(pickMainCard({ dueCount: 151, dailyLimit: 100, nextLesson: next })).toEqual({
      kind: 'review',
    });
  });

  test('có bài tiếp theo → next', () => {
    expect(pickMainCard({ dueCount: 0, dailyLimit: 20, nextLesson: lesson('b') })).toEqual({
      kind: 'next',
      lesson: lesson('b'),
    });
  });

  test('chờ thi lại 24 giờ → waiting kèm giờ mở lại, gợi ý ôn nếu còn thẻ', () => {
    const waiting = { kind: 'exam_cooldown', until: '2026-11-11T08:00:00Z' } as const;
    expect(pickMainCard({ dueCount: 4, dailyLimit: 20, waiting })).toEqual({
      kind: 'waiting',
      reason: 'exam_cooldown',
      until: '2026-11-11T08:00:00Z',
      suggestReview: true,
    });
    expect(pickMainCard({ dueCount: 0, dailyLimit: 20, waiting })).toMatchObject({
      suggestReview: false,
    });
  });

  test('không còn gì đang mở và không có lý do chờ → waiting/nothing_open', () => {
    expect(pickMainCard({ dueCount: 0, dailyLimit: 20 })).toEqual({
      kind: 'waiting',
      reason: 'nothing_open',
      suggestReview: false,
    });
  });

  test('ưu tiên: continue > review > next > waiting', () => {
    const waiting = { kind: 'exam_cooldown', until: 'x' } as const;
    const all = { dueCount: 100, dailyLimit: 20, nextLesson: lesson('n'), waiting };
    expect(pickMainCard(all).kind).toBe('review');
    expect(pickMainCard({ ...all, dueCount: 0 }).kind).toBe('next');
    expect(pickMainCard({ ...all, dueCount: 0, nextLesson: undefined }).kind).toBe('waiting');
    expect(pickMainCard({ ...all, inProgress: lesson('i') }).kind).toBe('continue');
  });
});

describe('fnv1a', () => {
  test('giá trị chuẩn FNV-1a 32 bit', () => {
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
    expect(fnv1a('foobar')).toBe(0xbf9cf968);
  });
  test('chuỗi Unicode không ném lỗi và ổn định', () => {
    expect(fnv1a('好')).toBe(fnv1a('好'));
    expect(fnv1a('好')).not.toBe(fnv1a('你'));
  });
});

describe('characterOfDay', () => {
  const pool = [...'你好我他她吃饭水茶人大小中国学校'];

  test('cùng seed + ngày → cùng chữ, dù thứ tự và bản sao trong pool khác nhau', () => {
    const a = characterOfDay('user-1', '2026-11-10', pool);
    expect(characterOfDay('user-1', '2026-11-10', pool)).toBe(a);
    expect(characterOfDay('user-1', '2026-11-10', [...pool].reverse())).toBe(a);
    expect(characterOfDay('user-1', '2026-11-10', [...pool, ...pool])).toBe(a);
  });

  test('chữ nằm trong pool', () => {
    for (let d = 1; d <= 28; d++) {
      const date = `2026-11-${String(d).padStart(2, '0')}`;
      expect(pool).toContain(characterOfDay('u', date, pool));
    }
  });

  test('ngày khác → thường khác (trong 28 ngày có ≥ 8 chữ khác nhau)', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 28; d++) {
      seen.add(characterOfDay('u', `2026-11-${String(d).padStart(2, '0')}`, pool));
    }
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });

  test('người khác nhau cùng ngày không bị ép giống nhau', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) seen.add(characterOfDay(`user-${i}`, '2026-11-10', pool));
    expect(seen.size).toBeGreaterThan(5);
  });

  test('pool một chữ → chữ đó; pool rỗng → RangeError', () => {
    expect(characterOfDay('u', '2026-11-10', ['好'])).toBe('好');
    expect(() => characterOfDay('u', '2026-11-10', [])).toThrow(RangeError);
  });
});
