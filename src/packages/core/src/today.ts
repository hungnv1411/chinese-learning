export type LessonRef = {
  id: string;
  title: string;
  /** Bước đang dở (chỉ có khi `continue`). */
  currentStep?: number;
};

export type TodayInput = {
  inProgress?: LessonRef;
  dueCount: number;
  dailyLimit: number;
  nextLesson?: LessonRef;
  waiting?: { kind: 'exam_cooldown'; until: string };
};

export type MainCard =
  | { kind: 'continue'; lesson: LessonRef }
  | { kind: 'review' }
  | { kind: 'next'; lesson: LessonRef }
  | {
      kind: 'waiting';
      reason: 'exam_cooldown' | 'nothing_open';
      until?: string;
      suggestReview: boolean;
    };

/** Thẻ ôn đến hạn nhiều hơn giới hạn ngày × hệ số này thì ưu tiên Ôn tập. */
export const REVIEW_BACKLOG_FACTOR = 1.5;

/** Thẻ chính của màn Hôm nay (home §2): bài dở > ôn dồn > bài tiếp theo > chờ. */
export function pickMainCard(input: TodayInput): MainCard {
  if (input.inProgress) return { kind: 'continue', lesson: input.inProgress };
  if (input.dueCount > input.dailyLimit * REVIEW_BACKLOG_FACTOR) return { kind: 'review' };
  if (input.nextLesson) return { kind: 'next', lesson: input.nextLesson };
  const suggestReview = input.dueCount > 0;
  if (input.waiting) {
    return {
      kind: 'waiting',
      reason: input.waiting.kind,
      until: input.waiting.until,
      suggestReview,
    };
  }
  return { kind: 'waiting', reason: 'nothing_open', suggestReview };
}

/** FNV-1a 32 bit trên UTF-8. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(s)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Chữ của ngày: ổn định cho cùng `seed` (userId hoặc id khách) và ngày. Pool được khử trùng và
 * sắp xếp trước nên thứ tự đầu vào không ảnh hưởng. Pool rỗng thì ném RangeError — nơi gọi tự
 * chọn pool khác (chữ của bài tiếp theo) trước khi gọi.
 */
export function characterOfDay(seed: string, date: string, pool: string[]): string {
  const chars = [...new Set(pool)].sort();
  if (chars.length === 0) throw new RangeError('characterOfDay: empty pool');
  return chars[fnv1a(seed + date) % chars.length] as string;
}
