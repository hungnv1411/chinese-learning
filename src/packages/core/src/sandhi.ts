import { parseNumbered } from './pinyin';
import type { SandhiSyllable, Tone } from './types';

export type SandhiOptions = { wordLengths?: number[]; ordinalIndexes?: number[] };

/**
 * Tính thanh đọc thật của chuỗi âm tiết (plan 00 §10 bước 6).
 * Thuật toán: thanh 3 liên tiếp trong từ (trái → phải trên thanh viết), thanh 3 cuối từ trước khi
 * từ sau vẫn đọc thanh 3 (xử lý phải → trái), 不 và 一.
 */
export function applyToneSandhi(syllables: SandhiSyllable[], opts: SandhiOptions = {}): Tone[] {
  const n = syllables.length;
  const written = syllables.map((s) => parseNumbered(s.pinyin).tone);
  const out = [...written];
  const lengths = opts.wordLengths ?? [n];
  const ordinals = new Set(opts.ordinalIndexes ?? []);

  const starts: number[] = [];
  let pos = 0;
  for (const len of lengths) {
    starts.push(pos);
    pos += len;
  }

  for (let w = lengths.length - 1; w >= 0; w--) {
    const start = starts[w] as number;
    const end = start + (lengths[w] as number);
    for (let i = start; i < end - 1; i++) {
      if (written[i] === 3 && written[i + 1] === 3) out[i] = 2;
    }
    const prevLast = start - 1;
    if (w > 0 && written[prevLast] === 3 && out[start] === 3) out[prevLast] = 2;
  }

  for (let i = 0; i < n; i++) {
    const hanzi = syllables[i]?.hanzi;
    const next = i + 1 < n ? written[i + 1] : undefined;
    if (hanzi === '不' && next === 4) out[i] = 2;
    if (hanzi === '一') {
      if (ordinals.has(i) || next === undefined) out[i] = 1;
      else if (next === 4) out[i] = 2;
      else if (next === 5) out[i] = 1;
      else out[i] = 4;
    }
  }
  return out;
}
