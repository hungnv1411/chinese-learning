'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { writingScore } from '@clp/core';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { vi } from '@/lib/strings/vi';
import { loadStrokeData } from './strokes';

export type WritingMode = 'watch' | 'trace' | 'recall';
export type WritingResult = { mode: WritingMode; misses: number; usedHint: boolean; score: number };

/** Số lần sai ở một nét thì hanzi-writer tự hiện gợi ý (spec 07 §4). */
const HINT_AFTER_MISSES = 3;
const MAX_SIZE = 320;

type Writer = {
  animateCharacter(o?: { onComplete?: () => void }): void;
  animateStroke(i: number, o?: { onComplete?: () => void }): void;
  quiz(o: Record<string, unknown>): void;
  cancelQuiz(): void;
  showCharacter(): void;
  hideCharacter(): void;
};

type Props = {
  char: string;
  mode: WritingMode;
  /** `R2_PUBLIC_URL`, nơi có `strokes/{char}.json`. */
  strokesBaseUrl: string;
  onDone: (r: WritingResult) => void;
  /** Chữ không có dữ liệu nét (R2 lỗi): để bước cha cho đi tiếp và ghi log. */
  onUnavailable?: (char: string) => void;
};

export function WritingPad({ char, mode, strokesBaseUrl, onDone, onUnavailable }: Props) {
  const toast = useToast();
  const target = useRef<HTMLDivElement>(null);
  const writer = useRef<Writer | null>(null);
  const stats = useRef({ misses: 0, usedHint: false });
  const cb = useRef({ onDone, onUnavailable });
  cb.current = { onDone, onUnavailable };
  const watchDone = useRef(false);
  const stepIdx = useRef(0);

  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(0);
  const [missing, setMissing] = useState(false);

  const startQuiz = useCallback(
    (w: Writer) => {
      setCurrent(0);
      w.quiz({
        showHintAfterMisses: HINT_AFTER_MISSES,
        onMistake: (d: { strokeNum: number; mistakesOnStroke: number }) => {
          stats.current.misses += 1;
          if (d.mistakesOnStroke >= HINT_AFTER_MISSES) stats.current.usedHint = true;
          toast(vi.writing.wrongStroke(d.strokeNum + 1));
        },
        onCorrectStroke: (d: { strokeNum: number }) => setCurrent(d.strokeNum + 1),
        onComplete: () => {
          const { misses, usedHint } = stats.current;
          cb.current.onDone({ mode, misses, usedHint, score: writingScore({ misses, usedHint }) });
        },
      });
    },
    [mode, toast],
  );

  useEffect(() => {
    let cancelled = false;
    stats.current = { misses: 0, usedHint: false };
    watchDone.current = false;
    stepIdx.current = 0;
    setMissing(false);
    setCurrent(0);

    (async () => {
      let data;
      try {
        data = await loadStrokeData(strokesBaseUrl, char);
      } catch {
        if (cancelled) return;
        setMissing(true);
        cb.current.onUnavailable?.(char);
        return;
      }
      const el = target.current;
      if (cancelled || !el) return;
      setTotal(data.strokes.length);
      const { default: HanziWriter } = await import('hanzi-writer');
      if (cancelled) return;
      el.innerHTML = '';
      const size = Math.min(el.clientWidth || MAX_SIZE, MAX_SIZE);
      const w = HanziWriter.create(el, char, {
        width: size,
        height: size,
        padding: 8,
        showOutline: mode !== 'recall',
        showCharacter: false,
        charDataLoader: (_c: string, onLoad: (d: never) => void) => onLoad(data as never),
      } as never) as unknown as Writer;
      writer.current = w;
      if (mode === 'watch') {
        w.animateCharacter({
          onComplete: () => {
            if (watchDone.current) return;
            watchDone.current = true;
            cb.current.onDone({ mode, misses: 0, usedHint: false, score: 100 });
          },
        });
      } else {
        startQuiz(w);
      }
    })();

    return () => {
      cancelled = true;
      try {
        writer.current?.cancelQuiz();
      } catch {
        /* writer chưa sẵn sàng */
      }
      writer.current = null;
    };
  }, [char, mode, strokesBaseUrl, startQuiz]);

  // Chặn cuộn trang khi viết bằng ngón tay (iOS cần listener không passive).
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const stop = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener('touchmove', stop);
  }, []);

  const replay = () => writer.current?.animateCharacter();

  const stepStroke = () => {
    const w = writer.current;
    if (!w || total === 0) return;
    if (stepIdx.current === 0) w.hideCharacter();
    const i = stepIdx.current;
    stepIdx.current = (i + 1) % total;
    setCurrent(i + 1);
    w.animateStroke(i, {});
  };

  const reviewOrder = () => {
    const w = writer.current;
    if (!w) return;
    w.cancelQuiz();
    stats.current = { misses: 0, usedHint: true };
    w.animateCharacter({
      onComplete: () => {
        w.hideCharacter();
        startQuiz(w);
      },
    });
  };

  return (
    <section className="stack-4" aria-label={vi.writing.padLabel}>
      <div
        ref={target}
        className="tzg"
        style={{ touchAction: 'none' }}
        role="img"
        aria-label={`${vi.writing.padLabel}: ${char}`}
      />
      {missing ? (
        <p role="status">{vi.writing.missingStrokes}</p>
      ) : (
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="strokeinfo">
            {total > 0 ? vi.writing.strokeOf(Math.min(current + 1, total), total) : vi.writing.loading}
          </span>
          {mode === 'watch' ? (
            <span className="row">
              <button type="button" className="icon-btn" aria-label={vi.writing.replay} onClick={replay}>
                <Icon name="replay" />
              </button>
              <Button variant="secondary" size="sm" onClick={stepStroke}>
                {vi.writing.nextStroke}
              </Button>
            </span>
          ) : (
            <Button variant="secondary" size="sm" onClick={reviewOrder}>
              {vi.writing.reviewOrder}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
