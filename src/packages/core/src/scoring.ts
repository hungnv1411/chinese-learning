import type { Rating } from './types';

/** Điểm tối thiểu để một chữ viết đạt (spec 07 §4). Đổi ngưỡng chỉ sửa ở đây. */
export const WRITING_PASS = 60;
/** Điểm tối đa khi đã dùng gợi ý; thấp hơn ngưỡng đạt nên có gợi ý thì không đạt. */
export const WRITING_HINT_CAP = 50;
const WRITING_PENALTY_PER_MISS = 10;

/**
 * Điểm một chữ: `100 − 10 × tổng số lần sai`, tối thiểu 0; đã dùng gợi ý thì tối đa 50.
 * `misses` phải là số nguyên không âm.
 */
export function writingScore({ misses, usedHint }: { misses: number; usedHint: boolean }): number {
  if (!Number.isInteger(misses) || misses < 0) {
    throw new RangeError(`misses phải là số nguyên không âm, nhận ${misses}`);
  }
  const score = Math.max(0, 100 - WRITING_PENALTY_PER_MISS * misses);
  return usedHint ? Math.min(score, WRITING_HINT_CAP) : score;
}

export const isWritingPass = (score: number): boolean => score >= WRITING_PASS;

/** Thẻ ôn `write`: đạt = good, không đạt = again. */
export function writingRating(score: number): Extract<Rating, 'good' | 'again'> {
  return isWritingPass(score) ? 'good' : 'again';
}
