import type postgres from 'postgres';
import { characterOfDay } from '@clp/core';

export type CharOfDay = {
  char: string;
  pinyinMarked: string | null;
  definitions: string[];
  hanViet: string[];
  decomposition: string | null;
  strokeCount: number | null;
  radical: { radical: string; nameVi: string; meaningVi: string } | null;
  /** true khi người học chưa hoàn thành bài nào và chữ lấy từ bài tiếp theo. */
  fromNextLesson: boolean;
};

/**
 * Chữ của ngày (plan 04 bước 4). Pool = chữ của các bài đã hoàn thành; rỗng thì chữ của bài
 * tiếp theo (`nextLessonId`); vẫn rỗng thì null.
 * `seed` là userId (khách: id ngẫu nhiên lưu ở `guest_progress_v1`).
 */
export async function getCharOfDay(
  sql: postgres.Sql,
  opts: { seed: string; userId: string; date: string; nextLessonId?: string },
): Promise<CharOfDay | null> {
  let rows = await sql<{ char: string }[]>`
    SELECT DISTINCT lc.char
    FROM lesson_char lc
    JOIN lesson_progress lp ON lp.lesson_id = lc.lesson_id
    WHERE lp.user_id = ${opts.userId} AND lp.status = 'completed'
    ORDER BY lc.char`;
  let fromNextLesson = false;
  if (rows.length === 0 && opts.nextLessonId) {
    rows = await sql<{ char: string }[]>`
      SELECT DISTINCT char FROM lesson_char WHERE lesson_id = ${opts.nextLessonId} ORDER BY char`;
    fromNextLesson = true;
  }
  if (rows.length === 0) return null;

  const char = characterOfDay(
    opts.seed,
    opts.date,
    rows.map((r) => r.char),
  );
  const [info] = await sql<
    {
      han_viet: string[];
      decomposition: string | null;
      stroke_count: number | null;
      radical: string | null;
      name_vi: string | null;
      meaning_vi: string | null;
    }[]
  >`
    SELECT h.han_viet, h.decomposition, h.stroke_count, r.radical, r.name_vi, r.meaning_vi
    FROM hanzi h LEFT JOIN radical_vi r ON r.radical = h.radical
    WHERE h.char = ${char}`;
  const [entry] = await sql<{ pinyin_marked: string; definitions: string[] }[]>`
    SELECT pinyin_marked, definitions
    FROM dict_entry
    WHERE simplified = ${char} AND NOT is_variant_or_surname
    ORDER BY cedict_order NULLS LAST, id
    LIMIT 1`;

  return {
    char,
    pinyinMarked: entry?.pinyin_marked ?? null,
    definitions: entry?.definitions ?? [],
    hanViet: info?.han_viet ?? [],
    decomposition: info?.decomposition ?? null,
    strokeCount: info?.stroke_count ?? null,
    radical:
      info?.radical && info.name_vi
        ? { radical: info.radical, nameVi: info.name_vi, meaningVi: info.meaning_vi ?? '' }
        : null,
    fromNextLesson,
  };
}
