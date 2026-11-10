import { describe, expect, test } from 'vitest';
import { computeStreak, isActiveDay, type DailyActivity } from './streak';

// Tháng 11/2026: 02 = thứ Hai … 08 = Chủ Nhật; 09 = thứ Hai tuần sau.
const day = (d: number, lessons = 1, reviews = 0): DailyActivity => ({
  date: `2026-11-${String(d).padStart(2, '0')}`,
  lessonsCompleted: lessons,
  reviewsDone: reviews,
});
const D = (d: number) => `2026-11-${String(d).padStart(2, '0')}`;

describe('isActiveDay', () => {
  test('1 bài hoàn thành là ngày học', () => {
    expect(isActiveDay({ date: D(2), lessonsCompleted: 1, reviewsDone: 0 })).toBe(true);
  });
  test('ôn 10 thẻ là ngày học, 9 thẻ thì không', () => {
    expect(isActiveDay({ date: D(2), lessonsCompleted: 0, reviewsDone: 10 })).toBe(true);
    expect(isActiveDay({ date: D(2), lessonsCompleted: 0, reviewsDone: 9 })).toBe(false);
  });
});

describe('computeStreak', () => {
  test('không có dữ liệu → 0', () => {
    expect(computeStreak([], D(5))).toEqual({ current: 0, activeToday: false, freezeDates: [] });
  });

  test('học 5 ngày liền tới hôm qua, hôm nay chưa học → 5, activeToday=false', () => {
    const days = [2, 3, 4, 5, 6].map((d) => day(d));
    expect(computeStreak(days, D(7))).toEqual({ current: 5, activeToday: false, freezeDates: [] });
  });

  test('hôm nay học rồi thì cộng thêm 1', () => {
    const days = [2, 3, 4, 5, 6, 7].map((d) => day(d));
    expect(computeStreak(days, D(7))).toEqual({ current: 6, activeToday: true, freezeDates: [] });
  });

  test('hôm nay ôn 10 thẻ tính là học, ôn 9 thẻ thì không', () => {
    const before = [3, 4, 5].map((d) => day(d));
    expect(computeStreak([...before, day(6, 0, 10)], D(6)).current).toBe(4);
    const nine = computeStreak([...before, day(6, 0, 9)], D(6));
    expect(nine.current).toBe(3);
    expect(nine.activeToday).toBe(false);
  });

  test('nghỉ 1 ngày giữa tuần → chuỗi giữ, freezeDates có ngày đó, không tính vào số ngày', () => {
    const days = [2, 3, 5, 6].map((d) => day(d)); // nghỉ thứ Tư 04
    expect(computeStreak(days, D(7))).toEqual({
      current: 4,
      activeToday: false,
      freezeDates: [D(4)],
    });
  });

  test('nghỉ 2 ngày trong cùng một tuần → chuỗi dừng ở ngày nghỉ thứ hai', () => {
    const days = [2, 3, 6, 7].map((d) => day(d)); // nghỉ 04 và 05
    // đi lùi: 07, 06 học; 05 nghỉ (freeze); 04 nghỉ cùng tuần → dừng
    expect(computeStreak(days, D(8))).toEqual({ current: 2, activeToday: false, freezeDates: [] });
  });

  test('nghỉ Chủ Nhật rồi thứ Hai liền nhau (hai tuần khác nhau) → chuỗi giữ', () => {
    const days = [3, 4, 5, 6, 7].map((d) => day(d)); // học 03–07, nghỉ 08 (CN) và 09 (T2)
    expect(computeStreak(days, D(10))).toEqual({
      current: 5,
      activeToday: false,
      freezeDates: [D(9), D(8)],
    });
  });

  test('chuỗi mất rồi → 0, không ghi freezeDates', () => {
    const days = [2].map((d) => day(d));
    expect(computeStreak(days, D(5))).toEqual({ current: 0, activeToday: false, freezeDates: [] });
  });

  test('hôm nay chưa học không dùng ngày nghỉ của hôm nay', () => {
    // hôm qua học, hôm nay (thứ Sáu) chưa học: chuỗi vẫn 1, chưa có freeze
    expect(computeStreak([day(5)], D(6))).toEqual({
      current: 1,
      activeToday: false,
      freezeDates: [],
    });
  });

  test('hôm nay học nhưng hôm qua nghỉ → hôm qua dùng ngày nghỉ của tuần', () => {
    const days = [2, 3, 4, 6].map((d) => day(d)); // nghỉ 05, hôm nay 06
    expect(computeStreak(days, D(6))).toEqual({
      current: 4,
      activeToday: true,
      freezeDates: [D(5)],
    });
  });

  test('nhiều bản ghi cùng ngày được cộng lại; ngày tương lai bị bỏ qua', () => {
    const days = [day(5, 0, 6), day(5, 0, 6), day(9)];
    expect(computeStreak(days, D(6)).current).toBe(1);
  });

  test('chuỗi dài qua nhiều tuần, mỗi tuần nghỉ 1 ngày', () => {
    // học mọi ngày 02..30 trừ thứ Tư mỗi tuần (04, 11, 18, 25)
    const wed = new Set([4, 11, 18, 25]);
    const days = Array.from({ length: 29 }, (_, i) => i + 2)
      .filter((d) => !wed.has(d))
      .map((d) => day(d));
    const r = computeStreak(days, D(30));
    expect(r.current).toBe(25);
    expect(r.activeToday).toBe(true);
    expect(r.freezeDates).toEqual([D(25), D(18), D(11), D(4)]);
  });

  test('không lặp vô hạn khi lịch sử trống và không có ngày học', () => {
    expect(computeStreak([day(2, 0, 3)], D(30))).toEqual({
      current: 0,
      activeToday: false,
      freezeDates: [],
    });
  });
});
