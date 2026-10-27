import { describe, expect, test } from 'vitest';
import { GUEST_STORAGE_KEY, GuestStore } from './guest-store';

function fakeStorage(opts: { failSet?: boolean; failGet?: boolean } = {}): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => {
      if (opts.failGet) throw new Error('blocked');
      return m.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (opts.failSet) throw new Error('QuotaExceededError');
      m.set(k, v);
    },
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

describe('GuestStore', () => {
  test('khóa là guest_progress_v1; ghi rồi đọc lại được, persistent = true', () => {
    const st = fakeStorage();
    const s = new GuestStore(() => st);
    expect(GUEST_STORAGE_KEY).toBe('guest_progress_v1');
    s.write({ a: 1 });
    expect(s.read()).toEqual({ a: 1 });
    expect(s.persistent).toBe(true);
  });

  test('setItem ném lỗi: vẫn đọc lại được trong phiên và persistent === false', () => {
    const s = new GuestStore(() => fakeStorage({ failSet: true }));
    s.write({ lessons: ['l1'] });
    expect(s.read()).toEqual({ lessons: ['l1'] });
    expect(s.persistent).toBe(false);
  });

  test('getItem ném lỗi: trả null, không ném, persistent === false', () => {
    const s = new GuestStore(() => fakeStorage({ failGet: true }));
    expect(s.read()).toBeNull();
    expect(s.persistent).toBe(false);
  });

  test('không có localStorage (SSR) cũng không ném lỗi', () => {
    const s = new GuestStore(() => undefined);
    expect(s.read()).toBeNull();
    s.write({ x: 1 });
    expect(s.read()).toEqual({ x: 1 });
    expect(s.persistent).toBe(false);
  });

  test('JSON hỏng thì coi như chưa có', () => {
    const st = fakeStorage();
    st.setItem(GUEST_STORAGE_KEY, '{oops');
    expect(new GuestStore(() => st).read()).toBeNull();
  });
});
