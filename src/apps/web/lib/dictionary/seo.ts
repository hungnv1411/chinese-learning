import type { WordEntry } from './word';

const unique = (xs: string[]) => [...new Set(xs)];

export function titleFor(entries: WordEntry[], siteName: string): string {
  const first = entries[0] as WordEntry;
  const pinyin = unique(entries.map((e) => e.pinyinMarked)).join(', ');
  const hv = entries.find((e) => e.hanViet)?.hanViet;
  return `${first.simplified} ${pinyin} – nghĩa, cách đọc${hv ? `, Hán Việt ${hv}` : ''} | ${siteName}`;
}

export function descriptionFor(entries: WordEntry[]): string {
  const first = entries[0] as WordEntry;
  const pinyin = unique(entries.map((e) => e.pinyinMarked)).join(', ');
  const text = `${first.simplified} (${pinyin}): ${first.definitions.join('; ')}`;
  return text.length <= 160 ? text : `${text.slice(0, 159).trimEnd()}…`;
}

/** JSON-LD `DefinedTerm`. Thoát "<" để nội dung không đóng thẻ script sớm. */
export function jsonLdFor(entries: WordEntry[], siteUrl: string): string {
  const first = entries[0] as WordEntry;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: first.simplified,
    description: unique(entries.flatMap((e) => e.definitions)).join('; '),
    termCode: unique(entries.map((e) => e.pinyinMarked)).join(', '),
    inDefinedTermSet: 'CC-CEDICT',
    url: `${siteUrl.replace(/\/+$/, '')}/tu/${encodeURIComponent(first.simplified)}`,
  };
  return JSON.stringify(ld).replace(/</g, '\\u003c');
}
