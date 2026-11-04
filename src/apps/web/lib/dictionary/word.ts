import { splitSyllables } from '@clp/core';
import type postgres from 'postgres';
import { wordAudioKey } from '@/lib/audio/keys';

export type CharInfo = {
  char: string;
  pinyinNumbered: string | null;
  hanViet: string[];
  radical: { radical: string; nameVi: string; meaningVi: string } | null;
};

export type WordEntry = {
  id: number;
  simplified: string;
  traditional: string;
  pinyinNumbered: string;
  pinyinMarked: string;
  definitions: string[];
  hskLevel: number | null;
  pos: string | null;
  /** Ghép từ âm đầu tiên của từng chữ; null nếu thiếu chữ nào. */
  hanViet: string | null;
  /** Đã có file audio (giọng mặc định) trong `audio_asset`. */
  hasAudio: boolean;
  chars: CharInfo[];
};

export type SentenceItem = {
  id: number;
  zh: string;
  pinyin: string;
  en: string;
  source: string;
  sourceRef: string | null;
  maxHskLevel: number | null;
  audioUrl: string | null;
};

export type RelatedWord = { simplified: string; hskLevel: number | null };

export type WordPage = { entries: WordEntry[]; sentences: SentenceItem[]; related: RelatedWord[] };

export const MAX_SENTENCES = 5;
export const MAX_RELATED = 12;
const DEFAULT_VOICE = 'xiaoxiao' as const;
const isHan = (c: string) => /\p{Script=Han}/u.test(c);

type EntryRow = {
  id: number;
  simplified: string;
  traditional: string;
  pinyin_numbered: string;
  pinyin_marked: string;
  definitions: string[];
  hsk_level: number | null;
  pos: string | null;
};

/** Dữ liệu trang `/tu/{simplified}`; null nếu không có mục nào. */
export async function getWordPage(sql: postgres.Sql, word: string): Promise<WordPage | null> {
  const rows = await sql<EntryRow[]>`
    SELECT d.id, d.simplified, d.traditional, d.pinyin_numbered, d.pinyin_marked, d.definitions,
           d.hsk_level,
           (SELECT hw.pos FROM hsk_word hw
             WHERE hw.dict_entry_id = d.id AND hw.pos IS NOT NULL ORDER BY hw.level LIMIT 1) AS pos
    FROM dict_entry d
    WHERE d.simplified = ${word}
    ORDER BY (d.hsk_level IS NULL), d.hsk_level, d.is_variant_or_surname, d.cedict_order, d.id`;
  if (rows.length === 0) return null;

  const hanChars = [...new Set([...word].filter(isHan))];
  const [charRows, assets, sentenceRows, relatedRows] = await Promise.all([
    sql<
      {
        char: string;
        han_viet: string[];
        radical: string | null;
        name_vi: string | null;
        meaning_vi: string | null;
      }[]
    >`
      SELECT h.char, h.han_viet, r.radical, r.name_vi, r.meaning_vi
      FROM hanzi h LEFT JOIN radical_vi r ON r.radical = h.radical
      WHERE h.char = ANY(${hanChars})`,
    sql<{ key: string }[]>`
      SELECT key FROM audio_asset
      WHERE key = ANY(${rows.map((r) => wordAudioKey(r.simplified, r.pinyin_numbered, DEFAULT_VOICE))})`,
    sql<
      {
        id: number;
        zh: string;
        pinyin: string;
        en: string;
        source: string;
        source_ref: string | null;
        max_hsk_level: number | null;
        audio_url: string | null;
      }[]
    >`
      SELECT s.id, s.zh, s.pinyin, s.en, s.source, s.source_ref, s.max_hsk_level, s.audio_url
      FROM sentence s
      WHERE s.id IN (SELECT sentence_id FROM sentence_word WHERE dict_entry_id = ANY(${rows.map((r) => r.id)}))
      ORDER BY (s.max_hsk_level IS NULL), s.max_hsk_level, char_length(s.zh), s.id
      LIMIT ${MAX_SENTENCES}`,
    sql<{ simplified: string; hsk_level: number | null }[]>`
      SELECT d.simplified, min(d.hsk_level) AS hsk_level
      FROM dict_entry d
      WHERE d.simplified <> ${word} AND NOT d.is_variant_or_surname
        AND EXISTS (SELECT 1 FROM unnest(${hanChars}::text[]) c WHERE position(c in d.simplified) > 0)
      GROUP BY d.simplified
      ORDER BY (min(d.hsk_level) IS NULL), min(d.hsk_level), char_length(d.simplified),
               min(d.cedict_order)
      LIMIT ${MAX_RELATED}`,
  ]);

  const info = new Map(charRows.map((c) => [c.char, c]));
  const audioKeys = new Set(assets.map((a) => a.key));

  const entries: WordEntry[] = rows.map((r) => {
    const syllables = splitSyllables(r.pinyin_numbered);
    const han = [...r.simplified].filter(isHan);
    const aligned = syllables.length === han.length;
    const chars: CharInfo[] = han.map((ch, i) => {
      const c = info.get(ch);
      return {
        char: ch,
        pinyinNumbered: aligned ? (syllables[i] as string) : null,
        hanViet: c?.han_viet ?? [],
        radical:
          c?.radical && c.name_vi
            ? { radical: c.radical, nameVi: c.name_vi, meaningVi: c.meaning_vi ?? '' }
            : null,
      };
    });
    const firsts = chars.map((c) => c.hanViet[0]);
    return {
      id: r.id,
      simplified: r.simplified,
      traditional: r.traditional,
      pinyinNumbered: r.pinyin_numbered,
      pinyinMarked: r.pinyin_marked,
      definitions: r.definitions,
      hskLevel: r.hsk_level,
      pos: r.pos,
      hanViet: firsts.length > 0 && firsts.every(Boolean) ? firsts.join(' ') : null,
      hasAudio: audioKeys.has(wordAudioKey(r.simplified, r.pinyin_numbered, DEFAULT_VOICE)),
      chars,
    };
  });

  return {
    entries,
    sentences: sentenceRows.map((s) => ({
      id: s.id,
      zh: s.zh,
      pinyin: s.pinyin,
      en: s.en,
      source: s.source,
      sourceRef: s.source_ref,
      maxHskLevel: s.max_hsk_level,
      audioUrl: s.audio_url,
    })),
    related: relatedRows.map((r) => ({ simplified: r.simplified, hskLevel: r.hsk_level })),
  };
}
