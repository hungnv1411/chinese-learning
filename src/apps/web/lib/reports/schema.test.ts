import { describe, expect, test } from 'vitest';
import { MAX_DESCRIPTION, REPORT_KINDS, displayLength, reportBody } from './schema';

const base = { target: { kind: 'word', id: '好吃' }, kind: 'pinyin' } as const;

describe('displayLength', () => {
  test('đếm ký tự hiển thị, không phải đơn vị UTF-16', () => {
    expect(displayLength('abc')).toBe(3);
    expect(displayLength('好吃')).toBe(2);
    expect(displayLength('ế')).toBe(1); // ê + dấu sắc rời = 1 ký tự
    expect(displayLength('👍🏽')).toBe(1);
  });
});

describe('reportBody', () => {
  test('mô tả 500 ký tự hiển thị được, 501 bị từ chối', () => {
    expect(
      reportBody.safeParse({ ...base, description: 'a'.repeat(MAX_DESCRIPTION) }).success,
    ).toBe(true);
    expect(
      reportBody.safeParse({ ...base, description: 'a'.repeat(MAX_DESCRIPTION + 1) }).success,
    ).toBe(false);
    // 500 ký tự gồm dấu rời vẫn hợp lệ dù dài hơn 500 đơn vị UTF-16
    expect(reportBody.safeParse({ ...base, description: 'ế'.repeat(500) }).success).toBe(true);
  });

  test('mô tả không bắt buộc, mặc định rỗng và được cắt khoảng trắng', () => {
    expect(reportBody.parse(base).description).toBe('');
    expect(reportBody.parse({ ...base, description: '  sai nghĩa  ' }).description).toBe(
      'sai nghĩa',
    );
  });

  test('đối tượng: general không cần id; word/lesson/sentence bắt buộc id', () => {
    expect(reportBody.safeParse({ target: { kind: 'general' }, kind: 'other' }).success).toBe(true);
    for (const kind of ['word', 'lesson', 'sentence']) {
      expect(reportBody.safeParse({ target: { kind }, kind: 'other' }).success).toBe(false);
      expect(reportBody.safeParse({ target: { kind, id: 'x' }, kind: 'other' }).success).toBe(true);
    }
    expect(reportBody.safeParse({ target: { kind: 'user', id: 'x' }, kind: 'other' }).success).toBe(
      false,
    );
  });

  test('loại lỗi theo spec, có "Chấm sai"', () => {
    expect([...REPORT_KINDS]).toEqual([
      'pinyin',
      'meaning',
      'hanviet',
      'audio',
      'sentence',
      'grading',
      'other',
    ]);
    expect(reportBody.safeParse({ ...base, kind: 'zzz' }).success).toBe(false);
  });
});
