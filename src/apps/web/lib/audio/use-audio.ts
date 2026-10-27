'use client';

import { useCallback, useEffect, useRef } from 'react';

type AudioLike = Pick<HTMLAudioElement, 'src' | 'play' | 'pause' | 'load'> & {
  playbackRate: number;
  currentTime: number;
  preload: string;
};

/**
 * Một HTMLAudioElement dùng chung, `preload` giữ cache theo URL.
 * iOS: không tự phát trước thao tác chạm đầu tiên — `unlocked` được đặt ở `pointerdown` đầu tiên.
 */
export function useAudio(create: () => AudioLike = () => new Audio()) {
  const player = useRef<AudioLike | null>(null);
  const cache = useRef(new Map<string, AudioLike>());
  const unlocked = useRef(false);

  useEffect(() => {
    const unlock = () => {
      unlocked.current = true;
    };
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    return () => window.removeEventListener('pointerdown', unlock, { capture: true });
  }, []);

  const play = useCallback(
    async (src: string, rate = 1): Promise<boolean> => {
      if (!unlocked.current) return false; // chưa có thao tác chạm: không phát
      const a = (player.current ??= create());
      a.pause();
      a.src = src;
      a.playbackRate = rate;
      a.currentTime = 0;
      try {
        await a.play();
        return true;
      } catch {
        return false; // trình duyệt từ chối: không làm hỏng bài học
      }
    },
    [create],
  );

  const preload = useCallback(
    (srcs: string[]) => {
      for (const src of srcs) {
        if (cache.current.has(src)) continue;
        const a = create();
        a.preload = 'auto';
        a.src = src;
        a.load();
        cache.current.set(src, a);
      }
    },
    [create],
  );

  return { play, preload, isUnlocked: () => unlocked.current };
}
