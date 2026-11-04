import { describe, expect, test } from 'vitest';
import {
  WRITING_HINT_CAP,
  WRITING_PASS,
  isWritingPass,
  writingRating,
  writingScore,
} from './scoring';

describe('writingScore', () => {
  test.each([
    [{ misses: 0, usedHint: false }, 100],
    [{ misses: 3, usedHint: false }, 70],
    [{ misses: 5, usedHint: false }, 50],
    [{ misses: 0, usedHint: true }, 50],
    [{ misses: 12, usedHint: false }, 0],
    [{ misses: 2, usedHint: false }, 80],
    [{ misses: 4, usedHint: true }, 50], // trần 50 áp dụng khi dùng gợi ý, 60 > 50 nên bị chặn
    [{ misses: 8, usedHint: true }, 20], // dưới trần thì giữ nguyên
    [{ misses: 100, usedHint: true }, 0],
  ])('%j → %i', (input, expected) => {
    expect(writingScore(input)).toBe(expected);
  });

  test('dùng gợi ý không bao giờ đạt', () => {
    for (let misses = 0; misses <= 12; misses++) {
      expect(isWritingPass(writingScore({ misses, usedHint: true }))).toBe(false);
    }
  });

  test('số lần sai không hợp lệ thì lỗi, không âm thầm cho điểm', () => {
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => writingScore({ misses: bad, usedHint: false })).toThrow(RangeError);
    }
  });
});

describe('đạt / không đạt', () => {
  test('ngưỡng 60 nằm ở hằng số, đạt khi ≥ 60', () => {
    expect(WRITING_PASS).toBe(60);
    expect(WRITING_HINT_CAP).toBe(50);
    expect(isWritingPass(60)).toBe(true);
    expect(isWritingPass(59)).toBe(false);
    expect(isWritingPass(writingScore({ misses: 4, usedHint: false }))).toBe(true); // 60
    expect(isWritingPass(writingScore({ misses: 5, usedHint: false }))).toBe(false); // 50
  });

  test('SRS: đạt = good, không đạt = again', () => {
    expect(writingRating(80)).toBe('good');
    expect(writingRating(60)).toBe('good');
    expect(writingRating(50)).toBe('again');
    expect(writingRating(0)).toBe('again');
  });
});
