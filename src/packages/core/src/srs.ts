import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';
import type { Rating as RatingName } from './types';

/** Độ nhớ mục tiêu của FSRS (spec 09 §1). */
export const REQUEST_RETENTION = 0.9;
/** Stability từ ngưỡng này (ngày) trở lên là “Đã thuộc” (spec 09 §6). */
export const MASTERED_STABILITY_DAYS = 21;
/** Số lần quên từ ngưỡng này (khi chưa thuộc) là “Hay quên”. */
export const LEECH_LAPSES = 3;
/** Thẻ ôn tối đa mỗi ngày theo mục tiêu học (phút/ngày). */
export const DAILY_REVIEW_LIMITS = { 5: 50, 10: 100, 20: 200 } as const;

export type StudyGoal = keyof typeof DAILY_REVIEW_LIMITS;
/** Trạng thái FSRS, cùng số với cột `srs_card.state`. */
export type SrsState = 0 | 1 | 2 | 3;

/**
 * Thẻ SRS thuần dữ liệu (không phụ thuộc ts-fsrs). Khớp cột `srs_card`, cộng `learningSteps`:
 * FSRS cần giá trị này để biết đang ở bước học nào (cột chưa có, xem 09-curriculum decisions).
 */
export type SrsCard = {
  due: Date;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: SrsState;
  lastReview: Date | null;
};

export type ReviewLogEntry = {
  rating: RatingName;
  /** Trạng thái của thẻ trước lần ôn này. */
  state: SrsState;
  due: Date;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  review: Date;
};

export type MasteryLevel = 'new' | 'leech' | 'learning' | 'mastered';

// Fuzz bật; ts-fsrs tự lấy seed từ (giờ ôn, reps, độ khó × stability), nên cùng đầu vào cho cùng lịch.
const scheduler = fsrs({ request_retention: REQUEST_RETENTION, enable_fuzz: true });

const GRADE: Record<RatingName, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

const toLib = (c: SrsCard): Card => ({
  due: c.due,
  stability: c.stability,
  difficulty: c.difficulty,
  scheduled_days: c.scheduledDays,
  learning_steps: c.learningSteps,
  reps: c.reps,
  lapses: c.lapses,
  state: c.state as State,
  ...(c.lastReview ? { last_review: c.lastReview } : {}),
});

const fromLib = (c: Card): SrsCard => ({
  due: c.due,
  stability: c.stability,
  difficulty: c.difficulty,
  scheduledDays: c.scheduled_days,
  learningSteps: c.learning_steps,
  reps: c.reps,
  lapses: c.lapses,
  state: c.state as SrsState,
  lastReview: c.last_review ?? null,
});

export const newCard = (now: Date): SrsCard => fromLib(createEmptyCard(now));

export function review(
  card: SrsCard,
  rating: RatingName,
  now: Date,
): { card: SrsCard; log: ReviewLogEntry } {
  const { card: next, log } = scheduler.next(toLib(card), now, GRADE[rating]);
  return {
    card: fromLib(next),
    log: {
      rating,
      state: card.state,
      due: log.due,
      stability: log.stability,
      difficulty: log.difficulty,
      scheduledDays: log.scheduled_days,
      review: log.review,
    },
  };
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** “10 phút”, “3 giờ”, “3 ngày”, “2 tháng”, “1 năm” (tháng = 30 ngày). Tối thiểu 1 phút. */
export function formatInterval(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MIN))} phút`;
  if (ms < DAY) return `${Math.round(ms / HOUR)} giờ`;
  const days = ms / DAY;
  if (days < 30) return `${Math.round(days)} ngày`;
  if (days < 365) return `${Math.round(days / 30)} tháng`;
  return `${Math.round(days / 365)} năm`;
}

/** Khoảng đến lần ôn sau cho từng nút: 2 nút (Quên/Nhớ) hoặc 4 nút. */
export function previewIntervals(
  card: SrsCard,
  now: Date,
  buttons: 2 | 4,
): { rating: RatingName; label: string }[] {
  const ratings: RatingName[] = buttons === 2 ? ['again', 'good'] : ['again', 'hard', 'good', 'easy'];
  return ratings.map((rating) => ({
    rating,
    label: formatInterval(review(card, rating, now).card.due.getTime() - now.getTime()),
  }));
}

export const dailyReviewLimit = (goal: StudyGoal): number => DAILY_REVIEW_LIMITS[goal];

const WEAKNESS: MasteryLevel[] = ['new', 'leech', 'learning', 'mastered'];

function masteryOfCard(c: Pick<SrsCard, 'reps' | 'lapses' | 'stability'>): MasteryLevel {
  if (c.reps === 0) return 'new';
  if (c.stability >= MASTERED_STABILITY_DAYS) return 'mastered';
  return c.lapses >= LEECH_LAPSES ? 'leech' : 'learning';
}

/**
 * Mức độ thuộc của một từ: gộp các thẻ không `suspended`, lấy mức yếu nhất.
 * Không còn thẻ nào (chưa có hoặc đều tắt) thì trả `null`.
 */
export function masteryOfWord(
  cards: readonly (Pick<SrsCard, 'reps' | 'lapses' | 'stability'> & { suspended: boolean })[],
): MasteryLevel | null {
  const levels = cards.filter((c) => !c.suspended).map(masteryOfCard);
  if (levels.length === 0) return null;
  return levels.reduce((w, l) => (WEAKNESS.indexOf(l) < WEAKNESS.indexOf(w) ? l : w));
}
