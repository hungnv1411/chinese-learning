'use client';
import { useCallback, useEffect, useRef } from 'react';

/** Quá khoảng này kể từ thao tác cuối thì coi là rời máy (plan 04, bước 2). */
export const IDLE_LIMIT_MS = 60_000;

/**
 * Đếm giây học thật: chỉ đếm khi `active`, tab đang hiện, và có thao tác trong 60 giây gần nhất.
 * `drain()` trả số giây tích lũy từ lần gọi trước rồi đặt về 0 (gửi kèm API ghi tiến độ);
 * `touch()` báo có thao tác không qua sự kiện của trang (ví dụ phát audio).
 */
export function useActiveTimer({ active }: { active: boolean }) {
  const seconds = useRef(0);
  const lastTouch = useRef<number | null>(null);

  const touch = useCallback(() => {
    lastTouch.current = Date.now();
  }, []);
  const drain = useCallback(() => {
    const s = seconds.current;
    seconds.current = 0;
    return s;
  }, []);

  useEffect(() => {
    document.addEventListener('pointerdown', touch);
    document.addEventListener('keydown', touch);
    return () => {
      document.removeEventListener('pointerdown', touch);
      document.removeEventListener('keydown', touch);
    };
  }, [touch]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (lastTouch.current === null) return;
      if (Date.now() - lastTouch.current <= IDLE_LIMIT_MS) seconds.current += 1;
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  return { drain, touch };
}
