import type { Tone } from './types';

const MARKS: Record<string, string> = {
  a: 'āáǎà',
  e: 'ēéěè',
  i: 'īíǐì',
  o: 'ōóǒò',
  u: 'ūúǔù',
  ü: 'ǖǘǚǜ',
};

const MARKED_TO_PLAIN: Record<string, string> = {};
for (const [plain, marked] of Object.entries(MARKS)) {
  for (const ch of marked) {
    MARKED_TO_PLAIN[ch] = plain;
    MARKED_TO_PLAIN[ch.toUpperCase()] = plain.toUpperCase();
  }
}

const normalizeU = (s: string): string =>
  s.replace(/u:/g, 'ü').replace(/U:/g, 'Ü').replace(/v/g, 'ü').replace(/V/g, 'Ü');

/** 'hao3' → { base: 'hao', tone: 3 }. Không có số thanh thì là thanh nhẹ (5). 'u:' và 'v' thành 'ü'. */
export function parseNumbered(s: string): { base: string; tone: Tone } {
  const m = /^(.*?)([1-5])?$/.exec(s.trim());
  const base = normalizeU(m?.[1] ?? '');
  const tone = (m?.[2] ? Number(m[2]) : 5) as Tone;
  return { base, tone };
}

/** Tách chuỗi pinyin có số thanh thành từng âm tiết: 'hao3chi1' → ['hao3', 'chi1']. */
export function splitSyllables(numbered: string): string[] {
  const out: string[] = [];
  for (const chunk of numbered.trim().split(/\s+/)) {
    if (!chunk) continue;
    const parts = chunk.match(/[^1-5]*[1-5]|[^1-5]+/g);
    if (parts) out.push(...parts);
  }
  return out;
}

function markSyllable(base: string, tone: Tone): string {
  if (tone === 5) return base;
  const lower = base.toLowerCase();
  let idx = lower.search(/[ae]/);
  if (idx < 0) idx = lower.indexOf('ou') >= 0 ? lower.indexOf('o') : -1;
  if (idx < 0) {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ('iouü'.includes(lower[i] as string)) {
        idx = i;
        break;
      }
    }
  }
  if (idx < 0) return base;
  const ch = lower[idx] as string;
  const marked = (MARKS[ch] as string)[tone - 1] as string;
  const isUpper = base[idx] !== ch;
  return base.slice(0, idx) + (isUpper ? marked.toUpperCase() : marked) + base.slice(idx + 1);
}

/** 'hao3 chi1' → 'hǎo chī'; với { join: true } → 'hǎochī'. */
export function numberedToMarked(s: string, opts: { join?: boolean } = {}): string {
  const parts = splitSyllables(s).map((syl) => {
    const { base, tone } = parseNumbered(syl);
    return markSyllable(base, tone);
  });
  return parts.join(opts.join ? '' : ' ');
}

/** Bỏ dấu, số thanh, khoảng trắng; ü → u. Dùng để tìm kiếm: 'hǎo chī' → 'haochi'. */
export function toPlain(s: string): string {
  let out = '';
  for (const ch of normalizeU(s.normalize('NFC'))) {
    if (/[\s1-5]/.test(ch)) continue;
    const p = MARKED_TO_PLAIN[ch] ?? ch;
    out += p === 'ü' ? 'u' : p === 'Ü' ? 'U' : p;
  }
  return out.toLowerCase();
}
