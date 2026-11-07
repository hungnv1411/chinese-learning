'use client';

import { Pinyin } from '@/components/ui/Pinyin';
import { WritingPad, type WritingResult } from './WritingPad';

export type WritingQuizResult = { char: string } & Pick<WritingResult, 'misses' | 'usedHint' | 'score'>;

type Props = {
  char: string;
  strokesBaseUrl: string;
  /** Đề: pinyin dạng số thanh (ni3) và nghĩa tiếng Anh; không hiện chữ. */
  prompt?: { pinyin: string; meaning: string };
  onDone: (r: WritingQuizResult) => void;
  onUnavailable?: (char: string) => void;
};

/** Chỉ chế độ Tự viết: bài ôn chủ đề, bài kiểm tra cuối, thẻ ôn `write`. */
export function WritingQuiz({ char, strokesBaseUrl, prompt, onDone, onUnavailable }: Props) {
  return (
    <div className="stack-4">
      {prompt && (
        <div className="stack-2" style={{ textAlign: 'center' }}>
          <Pinyin numbered={prompt.pinyin} keep />
          <p>{prompt.meaning}</p>
        </div>
      )}
      <WritingPad
        char={char}
        mode="recall"
        strokesBaseUrl={strokesBaseUrl}
        onUnavailable={onUnavailable}
        onDone={({ misses, usedHint, score }) => onDone({ char, misses, usedHint, score })}
      />
    </div>
  );
}
