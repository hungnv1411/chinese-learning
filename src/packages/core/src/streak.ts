export type DailyActivity = {
  /** `YYYY-MM-DD` theo múi giờ của người học. */
  date: string;
  lessonsCompleted: number;
  reviewsDone: number;
};

export type StreakInfo = {
  /** Số ngày học liên tiếp (ngày nghỉ tự động không tính). */
  current: number;
  activeToday: boolean;
  /** Các ngày nghỉ tự động nằm trong chuỗi hiện tại, mới nhất trước. */
  freezeDates: string[];
};

/** Ngày học: xong ít nhất 1 bài, hoặc ôn từ 10 thẻ. */
export const ACTIVE_REVIEWS = 10;

export function isActiveDay(d: DailyActivity): boolean {
  return d.lessonsCompleted >= 1 || d.reviewsDone >= ACTIVE_REVIEWS;
}

const DAY_MS = 86_400_000;
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Thứ Hai của tuần ISO chứa ngày này. */
function weekStart(ms: number): number {
  const dow = (new Date(ms).getUTCDay() + 6) % 7; // thứ Hai = 0
  return ms - dow * DAY_MS;
}

/**
 * Chuỗi ngày học (plan 04, bước 1). Đi lùi từ hôm qua; hôm nay chưa học thì chưa mất chuỗi.
 * Mỗi tuần (thứ Hai–Chủ Nhật) có 1 ngày nghỉ tự động; nghỉ thêm ngày thứ hai trong tuần thì dừng.
 */
export function computeStreak(days: DailyActivity[], today: string): StreakInfo {
  const todayMs = toMs(today);
  const merged = new Map<string, DailyActivity>();
  for (const d of days) {
    if (toMs(d.date) > todayMs) continue;
    const prev = merged.get(d.date);
    merged.set(
      d.date,
      prev
        ? {
            date: d.date,
            lessonsCompleted: prev.lessonsCompleted + d.lessonsCompleted,
            reviewsDone: prev.reviewsDone + d.reviewsDone,
          }
        : d,
    );
  }
  const active = new Set([...merged.values()].filter(isActiveDay).map((d) => d.date));
  const activeToday = active.has(today);
  const earliest = Math.min(...[...active].map(toMs));

  let current = activeToday ? 1 : 0;
  const freezeDates: string[] = [];
  let pending: string[] = []; // chỉ tính vào chuỗi khi sau đó gặp ngày học
  const usedWeeks = new Set<number>();

  for (let t = todayMs - DAY_MS; t >= earliest; t -= DAY_MS) {
    const iso = toIso(t);
    if (active.has(iso)) {
      current += 1;
      freezeDates.push(...pending);
      pending = [];
      continue;
    }
    const wk = weekStart(t);
    if (usedWeeks.has(wk)) break;
    usedWeeks.add(wk);
    pending.push(iso);
  }
  return { current, activeToday, freezeDates };
}
