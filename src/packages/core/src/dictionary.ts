import type { Tone } from './types';
import { splitSyllables, toPlain } from './pinyin';
import syllableList from './syllables.json';

export type Chip = 'all' | 'hanzi' | 'pinyin' | 'english' | 'hanviet';
export type QueryKind = 'hanzi' | 'pinyin' | 'english' | 'hanviet';

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
// Dấu kết hợp chỉ tiếng Việt dùng: hỏi, ngã, nặng, móc (ơ ư), mũ (â ê ô), trăng (ă).
const VIET_ONLY_MARKS = /[\u0309\u0303\u0323\u031b\u0302\u0306]/;
// Dấu thanh pinyin: ngang, sắc, caron, huyền, và ü (diaeresis). Sắc/huyền dùng chung với tiếng Việt.
const PINYIN_MARKS = /[\u0304\u0301\u030c\u0300\u0308]/;
const TONE_OF_MARK: Record<string, Tone> = {
  '\u0304': 1,
  '\u0301': 2,
  '\u030c': 3,
  '\u0300': 4,
};

// Âm tiết ở dạng "plain" (ü → u), dùng để tách chuỗi không dấu.
const PLAIN_SYLLABLES = new Set(syllableList.map((s) => s.replace(/ü/g, 'u')));
const MAX_SYLLABLE = Math.max(...[...PLAIN_SYLLABLES].map((s) => s.length));

/** Tách chuỗi pinyin không dấu, không số thành âm tiết hợp lệ; ít âm tiết nhất, trùng thì âm đầu dài nhất. 'v' coi như ü (thành 'u'). Không tách được thì null. Dấu ' ngăn cách tường minh. */
export function segmentPinyin(input: string): string[] | null {
  const out: string[] = [];
  for (const part of input
    .toLowerCase()
    .replace(/v/g, 'u')
    .replace(/ü/g, 'u')
    .split(/['’\s]+/)) {
    if (!part) continue;
    const seg = segmentRun(part);
    if (!seg) return null;
    out.push(...seg);
  }
  return out.length > 0 ? out : null;
}

function segmentRun(s: string): string[] | null {
  const n = s.length;
  const best: (number | null)[] = Array(n + 1).fill(null); // số âm tiết ít nhất cho s[i..]
  const take: number[] = Array(n + 1).fill(0);
  best[n] = 0;
  for (let i = n - 1; i >= 0; i--) {
    for (let len = Math.min(MAX_SYLLABLE, n - i); len >= 1; len--) {
      const rest = best[i + len];
      if (rest == null || !PLAIN_SYLLABLES.has(s.slice(i, i + len))) continue;
      if (best[i] == null || rest + 1 < (best[i] as number)) {
        best[i] = rest + 1;
        take[i] = len;
      }
    }
  }
  if (best[0] == null) return null;
  const res: string[] = [];
  for (let i = 0; i < n; i += take[i] as number) res.push(s.slice(i, i + (take[i] as number)));
  return res;
}

/** Phân loại từ khóa tìm kiếm. Chip khác "Tất cả" thì dùng đúng loại đó. */
export function classifyQuery(q: string, chip: Chip): QueryKind[] {
  if (chip !== 'all') return [chip];
  const s = q.trim().normalize('NFD');
  if (CJK.test(s)) return ['hanzi'];
  if (VIET_ONLY_MARKS.test(s) || /[đĐ]/.test(s)) return ['hanviet'];
  if (PINYIN_MARKS.test(s) || /[a-zA-Zü]+:?[1-5](?![0-9])/.test(s)) return ['pinyin'];
  if (/^[a-zA-Z'’\s]+$/.test(s) && segmentPinyin(s)) return ['pinyin', 'english'];
  return ['english'];
}

type Letter = { ch: string; tone: Tone | null };

function lettersOf(token: string): Letter[] {
  const out: Letter[] = [];
  const nfd = token.toLowerCase().replace(/u:/g, 'ü').normalize('NFD');
  for (const ch of nfd) {
    const tone = TONE_OF_MARK[ch];
    if (tone) {
      const last = out[out.length - 1];
      if (last) last.tone = tone;
    } else if (ch === '\u0308') {
      continue; // ü: chữ cái cơ sở đã là u
    } else if (/[a-z]/.test(ch)) {
      out.push({ ch, tone: null });
    }
  }
  return out;
}

/** 'hao3 chi' → { plain: 'haochi', syllables: ['hao', 'chi'], tones: [3, null] }. Số thanh hoặc dấu thanh đều được. */
export function parsePinyinSyllables(q: string): {
  plain: string;
  syllables: string[];
  tones: (Tone | null)[];
} {
  const syllables: string[] = [];
  const tones: (Tone | null)[] = [];
  for (const token of q.trim().split(/[\s'’]+/)) {
    if (!token) continue;
    if (/[1-5]/.test(token)) {
      for (const syl of splitSyllables(token.replace(/u:/gi, 'ü'))) {
        const m = /^(.*?)([1-5])?$/.exec(syl);
        const base = toPlain(m?.[1] ?? '');
        if (!base) continue;
        syllables.push(base);
        tones.push(m?.[2] ? (Number(m[2]) as Tone) : null);
      }
      continue;
    }
    const letters = lettersOf(token);
    const flat = letters.map((l) => l.ch).join('');
    const seg = segmentPinyin(flat) ?? [flat];
    let pos = 0;
    for (const syl of seg) {
      const span = letters.slice(pos, pos + syl.length);
      pos += syl.length;
      syllables.push(syl);
      tones.push(span.find((l) => l.tone)?.tone ?? null);
    }
  }
  return { plain: syllables.join(''), syllables, tones };
}

/** 'hao3 chi' → { plain: 'haochi', tones: [3, null] }. */
export function parsePinyinQuery(q: string): { plain: string; tones: (Tone | null)[] } {
  const { plain, tones } = parsePinyinSyllables(q);
  return { plain, tones };
}
