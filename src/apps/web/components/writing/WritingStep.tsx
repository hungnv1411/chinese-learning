'use client';

import { useRef, useState } from 'react';
import { isWritingPass } from '@clp/core';
import { vi } from '@/lib/strings/vi';
import { WritingPad, type WritingMode, type WritingResult } from './WritingPad';

const ORDER: WritingMode[] = ['watch', 'trace', 'recall'];

type Props = {
  char: string;
  strokesBaseUrl: string;
  /** Tự viết xong (đạt hay không); bước cha gọi `completeStep`. */
  onComplete: (r: WritingResult) => void;
  /** Tự viết đạt lần đầu trong bước này: nơi gọi ghi `char_written`. */
  onCharWritten?: (char: string) => void;
  onUnavailable?: (char: string) => void;
};

/** Chữ mới trong bài: Xem → Viết theo → Tự viết; chế độ sau khóa tới khi xong chế độ trước. */
export function WritingStep({ char, strokesBaseUrl, onComplete, onCharWritten, onUnavailable }: Props) {
  const [mode, setMode] = useState<WritingMode>('watch');
  const [done, setDone] = useState<ReadonlySet<WritingMode>>(new Set());
  const written = useRef(false);

  const unlocked = (m: WritingMode) => {
    const i = ORDER.indexOf(m);
    return i === 0 || done.has(ORDER[i - 1]!);
  };

  const handleDone = (r: WritingResult) => {
    setDone((prev) => new Set(prev).add(r.mode));
    if (r.mode !== 'recall') return;
    if (isWritingPass(r.score) && !written.current) {
      written.current = true;
      onCharWritten?.(char);
    }
    onComplete(r);
  };

  return (
    <div className="stack-4">
      <div className="seg" role="tablist" aria-label={vi.writing.modesLabel}>
        {ORDER.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            disabled={!unlocked(m)}
            onClick={() => setMode(m)}
          >
            {vi.writing.modes[m]}
          </button>
        ))}
      </div>
      <WritingPad
        key={mode}
        char={char}
        mode={mode}
        strokesBaseUrl={strokesBaseUrl}
        onDone={handleDone}
        onUnavailable={onUnavailable}
      />
    </div>
  );
}
