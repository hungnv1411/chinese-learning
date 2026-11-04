import { describe, expect, test } from 'vitest';
import { MAX_RECENT, RECENT_KEY, addRecent, readRecent, writeRecent } from './recent';

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};

describe('addRecent', () => {
  test('từ mới lên đầu, trùng thì đưa lên đầu, không lặp', () => {
    expect(addRecent(['b', 'c'], 'a')).toEqual(['a', 'b', 'c']);
    expect(addRecent(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
  });

  test('giữ tối đa 20 từ gần nhất', () => {
    const list = Array.from({ length: MAX_RECENT }, (_, i) => `w${i}`);
    const next = addRecent(list, 'mới');
    expect(next).toHaveLength(MAX_RECENT);
    expect(next[0]).toBe('mới');
    expect(next).not.toContain(`w${MAX_RECENT - 1}`);
  });

  test('bỏ qua từ rỗng', () => {
    expect(addRecent(['a'], '   ')).toEqual(['a']);
  });
});

describe('readRecent / writeRecent', () => {
  test('ghi rồi đọc lại', () => {
    const s = memory();
    writeRecent(s, ['好', '吃']);
    expect(s.getItem(RECENT_KEY)).toBe('["好","吃"]');
    expect(readRecent(s)).toEqual(['好', '吃']);
  });

  test('dữ liệu hỏng hoặc sai kiểu thì trả mảng rỗng', () => {
    for (const bad of ['{', '"x"', '{"a":1}', '[1,2]', '[]x']) {
      const s = memory();
      s.setItem(RECENT_KEY, bad);
      expect(readRecent(s)).toEqual([]);
    }
  });

  test('lọc bỏ phần tử không phải chuỗi và cắt còn 20', () => {
    const s = memory();
    s.setItem(RECENT_KEY, JSON.stringify(['a', 3, 'b', ...Array(30).fill('z')]));
    const r = readRecent(s);
    expect(r.slice(0, 2)).toEqual(['a', 'b']);
    expect(r).toHaveLength(MAX_RECENT);
  });

  test('storage ném lỗi (chế độ riêng tư, bị chặn) thì không làm hỏng trang', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(readRecent(broken)).toEqual([]);
    expect(() => writeRecent(broken, ['a'])).not.toThrow();
    expect(readRecent(null)).toEqual([]);
    expect(() => writeRecent(null, ['a'])).not.toThrow();
  });
});
