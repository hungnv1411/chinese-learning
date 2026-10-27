import { numberedToMarked, parseNumbered, splitSyllables } from '@clp/core';

/**
 * Pinyin luôn có dấu thanh (dùng numberedToMarked), tô màu từng âm tiết. `keep` giữ hiện
 * khi người dùng ẩn pinyin (class `.py.keep` của design).
 */
export function Pinyin({ numbered, keep }: { numbered: string; keep?: boolean }) {
  return (
    <span className={keep ? 'py keep' : 'py'}>
      {splitSyllables(numbered).map((syl, i) => (
        <span key={i} className={`t${parseNumbered(syl).tone}`}>
          {i > 0 && ' '}
          {numberedToMarked(syl)}
        </span>
      ))}
    </span>
  );
}
