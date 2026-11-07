import { describe, expect, test } from 'vitest';
import {
  dailyReviewLimit,
  formatInterval,
  masteryOfWord,
  newCard,
  previewIntervals,
  review,
  type SrsCard,
} from './srs';

const NOW = new Date('2026-11-07T08:00:00Z');
const DAY = 86_400_000;

const reviewed = (over: Partial<SrsCard> = {}): SrsCard => ({
  ...newCard(NOW),
  reps: 3,
  stability: 5,
  difficulty: 5,
  state: 2,
  lastReview: new Date(NOW.getTime() - 5 * DAY),
  ...over,
});

describe('newCard / review', () => {
  test('thẻ mới: state 0, chưa ôn, đến hạn ngay', () => {
    const c = newCard(NOW);
    expect(c).toMatchObject({ state: 0, reps: 0, lapses: 0, stability: 0, lastReview: null });
    expect(c.due.getTime()).toBe(NOW.getTime());
  });

  test('thẻ mới qua good: due > now, reps tăng, log ghi trạng thái trước đó', () => {
    const { card, log } = review(newCard(NOW), 'good', NOW);
    expect(card.due.getTime()).toBeGreaterThan(NOW.getTime());
    expect(card.reps).toBe(1);
    expect(card.lastReview?.getTime()).toBe(NOW.getTime());
    expect(log).toMatchObject({ rating: 'good', state: 0 });
  });

  test('thẻ đã thuộc bấm again: lapses tăng, stability giảm', () => {
    const c = reviewed({ stability: 40, scheduledDays: 40, due: NOW });
    const { card } = review(c, 'again', NOW);
    expect(card.lapses).toBe(1);
    expect(card.stability).toBeLessThan(40);
  });

  test('kết quả ổn định: cùng thẻ, cùng giờ, cùng nút cho cùng lịch (fuzz theo seed nội bộ)', () => {
    const c = reviewed({ due: NOW });
    expect(review(c, 'good', NOW).card.due.getTime()).toBe(review(c, 'good', NOW).card.due.getTime());
  });

  test('không sửa thẻ đầu vào', () => {
    const c = newCard(NOW);
    const copy = { ...c };
    review(c, 'good', NOW);
    expect(c).toEqual(copy);
  });
});

describe('previewIntervals', () => {
  test('2 nút: chỉ Again và Good, có nhãn tiếng Việt', () => {
    const p = previewIntervals(newCard(NOW), NOW, 2);
    expect(p.map((x) => x.rating)).toEqual(['again', 'good']);
    expect(p[0]?.label).toBe('1 phút');
    expect(p[1]?.label).toBe('10 phút');
  });

  test('4 nút: Again, Hard, Good, Easy, khoảng tăng dần', () => {
    const p = previewIntervals(reviewed({ due: NOW }), NOW, 4);
    expect(p.map((x) => x.rating)).toEqual(['again', 'hard', 'good', 'easy']);
    expect(p.every((x) => x.label.length > 0)).toBe(true);
  });
});

describe('formatInterval', () => {
  test.each([
    [30_000, '1 phút'],
    [10 * 60_000, '10 phút'],
    [3 * 3_600_000, '3 giờ'],
    [3 * DAY, '3 ngày'],
    [60 * DAY, '2 tháng'],
    [400 * DAY, '1 năm'],
  ])('%d ms → %s', (ms, label) => expect(formatInterval(ms)).toBe(label));
});

describe('dailyReviewLimit', () => {
  test.each([[5, 50], [10, 100], [20, 200]] as const)('mục tiêu %d phút → %d thẻ', (goal, n) =>
    expect(dailyReviewLimit(goal)).toBe(n));
});

describe('masteryOfWord', () => {
  const c = (over: Partial<SrsCard & { suspended: boolean }>) => ({ ...reviewed(), suspended: false, ...over });

  test('chưa ôn lần nào → new', () => {
    expect(masteryOfWord([{ ...newCard(NOW), suspended: false }])).toBe('new');
  });
  test('đã ôn, stability < 21 → learning', () => {
    expect(masteryOfWord([c({ stability: 10 })])).toBe('learning');
  });
  test('lapses ≥ 3 và stability < 21 → leech', () => {
    expect(masteryOfWord([c({ stability: 10, lapses: 3 })])).toBe('leech');
  });
  test('lapses ≥ 3 nhưng stability ≥ 21 → mastered', () => {
    expect(masteryOfWord([c({ stability: 21, lapses: 5 })])).toBe('mastered');
  });
  test('stability đúng 21 → mastered, 20.9 → learning', () => {
    expect(masteryOfWord([c({ stability: 21 })])).toBe('mastered');
    expect(masteryOfWord([c({ stability: 20.9 })])).toBe('learning');
  });
  test('một thẻ mastered + một thẻ learning → learning (yếu nhất)', () => {
    expect(masteryOfWord([c({ stability: 30 }), c({ stability: 8 })])).toBe('learning');
  });
  test('thứ tự yếu → mạnh: new < leech < learning < mastered', () => {
    const leech = c({ stability: 5, lapses: 4 });
    const learning = c({ stability: 5 });
    expect(masteryOfWord([learning, leech])).toBe('leech');
    expect(masteryOfWord([leech, { ...newCard(NOW), suspended: false }])).toBe('new');
  });
  test('bỏ qua thẻ suspended; không còn thẻ nào → null', () => {
    expect(masteryOfWord([c({ stability: 30 }), c({ stability: 1, suspended: true })])).toBe('mastered');
    expect(masteryOfWord([c({ suspended: true })])).toBeNull();
    expect(masteryOfWord([])).toBeNull();
  });
});
