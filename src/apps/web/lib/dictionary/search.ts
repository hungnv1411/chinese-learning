import type postgres from 'postgres';
import { classifyQuery, parsePinyinSyllables, type Chip, type QueryKind } from '@clp/core';

export const PAGE_SIZE = 30;

export type DictItem = {
  id: number;
  simplified: string;
  traditional: string;
  pinyinNumbered: string;
  pinyinMarked: string;
  /** Tối đa 2 nghĩa đầu (nghĩa đầy đủ ở trang từ). */
  definitions: string[];
  /** Hán Việt ghép từ âm đầu tiên của từng chữ; null nếu thiếu chữ nào. */
  hanViet: string | null;
  hskLevel: number | null;
  isVariantOrSurname: boolean;
};

export type SearchGroup = { kind: QueryKind; items: DictItem[]; hasMore: boolean };

type Params = { q: string; chip: Chip; offset: number; limit: number };
type Row = {
  id: number;
  simplified: string;
  traditional: string;
  pinyin_numbered: string;
  pinyin_marked: string;
  definitions: string[];
  hsk_level: number | null;
  is_variant_or_surname: boolean;
};

const likeEscape = (s: string) => s.replace(/[\\%_]/g, '\\$&');

const COLUMNS = (sql: postgres.Sql) => sql`d.id, d.simplified, d.traditional, d.pinyin_numbered,
  d.pinyin_marked, d.definitions, d.hsk_level, d.is_variant_or_surname`;

// Thứ tự chung: loại khớp (tier) → có cấp HSK, cấp thấp trước → từ ngắn → không phải họ/biến thể → thứ tự CC-CEDICT.
const ORDER = (sql: postgres.Sql) => sql`ORDER BY tier, (d.hsk_level IS NULL), d.hsk_level,
  char_length(d.simplified), d.is_variant_or_surname, d.cedict_order, d.id`;

function searchHanzi(sql: postgres.Sql, q: string, limit: number, offset: number) {
  const esc = likeEscape(q);
  return sql<Row[]>`
    SELECT ${COLUMNS(sql)},
      CASE WHEN d.simplified = ${q} OR d.traditional = ${q} THEN 0
           WHEN d.simplified LIKE ${esc + '%'} OR d.traditional LIKE ${esc + '%'} THEN 1
           ELSE 2 END AS tier
    FROM dict_entry d
    WHERE d.simplified LIKE ${'%' + esc + '%'} OR d.traditional LIKE ${'%' + esc + '%'}
    ${ORDER(sql)} LIMIT ${limit} OFFSET ${offset}`;
}

function searchPinyin(sql: postgres.Sql, q: string, limit: number, offset: number) {
  const { plain, syllables, tones } = parsePinyinSyllables(q);
  if (!plain) return Promise.resolve([] as Row[]);
  // Có thanh thì lọc thêm theo pinyin_numbered (so từng âm tiết; 'u' khớp cả 'u:' của CC-CEDICT).
  const tonePattern = tones.some((t) => t !== null)
    ? '^' + syllables.map((s, i) => s.replace(/u/g, 'u:?') + (tones[i] ?? '[1-5]')).join(' ')
    : null;
  const toneFilter = tonePattern ? sql`AND lower(d.pinyin_numbered) ~ ${tonePattern}` : sql``;
  return sql<Row[]>`
    SELECT ${COLUMNS(sql)}, CASE WHEN d.pinyin_plain = ${plain} THEN 0 ELSE 1 END AS tier
    FROM dict_entry d
    WHERE d.pinyin_plain LIKE ${likeEscape(plain) + '%'} ${toneFilter}
    ${ORDER(sql)} LIMIT ${limit} OFFSET ${offset}`;
}

function searchEnglish(sql: postgres.Sql, q: string, limit: number, offset: number) {
  // Không có tầng "khớp đúng" riêng: đã khớp tsquery thì xếp theo HSK để từ thông dụng lên đầu.
  return sql<Row[]>`
    SELECT ${COLUMNS(sql)}, 0 AS tier
    FROM dict_entry d
    WHERE d.definitions_tsv @@ websearch_to_tsquery('english', ${q})
    ${ORDER(sql)} LIMIT ${limit} OFFSET ${offset}`;
}

function searchHanViet(sql: postgres.Sql, q: string, limit: number, offset: number) {
  const key = q.normalize('NFC').toLowerCase();
  // Không dấu (chỉ xảy ra khi chọn chip Hán Việt) thì so sánh bỏ dấu.
  const accentless = !/[^\u0020-\u007e]/.test(key);
  const match = accentless ? sql`unaccent(h) = unaccent(${key})` : sql`h = ${key}`;
  return sql<Row[]>`
    WITH m AS (
      SELECT char FROM hanzi WHERE EXISTS (SELECT 1 FROM unnest(han_viet) h WHERE ${match})
    )
    SELECT ${COLUMNS(sql)},
      CASE WHEN EXISTS (SELECT 1 FROM m WHERE m.char = d.simplified) THEN 0 ELSE 1 END AS tier
    FROM dict_entry d
    WHERE EXISTS (SELECT 1 FROM m WHERE position(m.char in d.simplified) > 0)
    ${ORDER(sql)} LIMIT ${limit} OFFSET ${offset}`;
}

const SEARCHERS: Record<
  QueryKind,
  (sql: postgres.Sql, q: string, limit: number, offset: number) => Promise<Row[]>
> = {
  hanzi: searchHanzi,
  pinyin: searchPinyin,
  english: searchEnglish,
  hanviet: searchHanViet,
};

async function toItems(sql: postgres.Sql, rows: Row[]): Promise<DictItem[]> {
  const chars = [...new Set(rows.flatMap((r) => [...r.simplified]))];
  const first = new Map<string, string>();
  if (chars.length > 0) {
    const hv = await sql<{ char: string; first: string | null }[]>`
      SELECT char, han_viet[1] AS first FROM hanzi WHERE char = ANY(${chars})`;
    for (const h of hv) if (h.first) first.set(h.char, h.first);
  }
  return rows.map((r) => {
    const parts = [...r.simplified].map((c) => first.get(c));
    return {
      id: r.id,
      simplified: r.simplified,
      traditional: r.traditional,
      pinyinNumbered: r.pinyin_numbered,
      pinyinMarked: r.pinyin_marked,
      definitions: r.definitions.slice(0, 2),
      hanViet: parts.every(Boolean) ? parts.join(' ') : null,
      hskLevel: r.hsk_level,
      isVariantOrSurname: r.is_variant_or_surname,
    };
  });
}

/** Tìm từ điển: nhận biết loại từ khóa, mỗi loại một nhóm; lấy `limit + 1` dòng để biết còn trang sau. */
export async function searchDictionary(
  sql: postgres.Sql,
  { q, chip, offset, limit }: Params,
): Promise<{ groups: SearchGroup[] }> {
  const query = q.trim();
  if (!query) return { groups: [] };
  const groups: SearchGroup[] = [];
  for (const kind of classifyQuery(query, chip)) {
    const rows = await SEARCHERS[kind](sql, query, limit + 1, offset);
    groups.push({
      kind,
      items: await toItems(sql, rows.slice(0, limit)),
      hasMore: rows.length > limit,
    });
  }
  return { groups };
}
