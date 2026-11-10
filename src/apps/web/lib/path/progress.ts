import type postgres from 'postgres';
import { masteryOfWord, type StageId } from '@clp/core';

type CardRow = { word_id: number; simplified: string; reps: number; lapses: number; stability: number; suspended: boolean };

export type StageProgress = {
  words: { mastered: number; total: number };
  chars: { mastered: number; total: number };
};

/** Lộ trình HSK n ↔ cấp `hsk_word.level` / `hsk_char.level` = n. Phát âm không có từ HSK. */
export const hskLevelOf = (stageId: StageId): number | null => {
  const m = /^hsk(\d)$/.exec(stageId);
  return m ? Number(m[1]) : null;
};

/**
 * Tiến độ một lộ trình: số từ và số chữ “Đã thuộc” (09-review §6) trên tổng của cấp.
 * Từ `deprecated` không tính vào tổng. Số chữ đã thuộc là số chữ khác nhau, thuộc cấp này,
 * xuất hiện trong các từ đã thuộc. Lộ trình không có cấp HSK (Phát âm) trả `null`.
 */
export async function stageProgress(
  sql: postgres.Sql,
  userId: string,
  stageId: StageId,
): Promise<StageProgress | null> {
  const level = hskLevelOf(stageId);
  if (level === null) return null;

  const [words, chars, cards] = await Promise.all([
    sql<{ id: number }[]>`SELECT id FROM hsk_word WHERE level = ${level} AND NOT deprecated`,
    sql<{ char: string }[]>`SELECT char FROM hsk_char WHERE level = ${level}`,
    sql<CardRow[]>`
      SELECT c.hsk_word_id AS word_id, w.simplified, c.reps, c.lapses, c.stability, c.suspended
      FROM srs_card c JOIN hsk_word w ON w.id = c.hsk_word_id
      WHERE c.user_id = ${userId} AND w.level = ${level} AND NOT w.deprecated`,
  ]);

  const byWord = new Map<number, { simplified: string; cards: CardRow[] }>();
  for (const c of cards) {
    const e = byWord.get(c.word_id) ?? { simplified: c.simplified, cards: [] };
    e.cards.push(c);
    byWord.set(c.word_id, e);
  }
  const levelChars = new Set(chars.map((c) => c.char));
  const masteredChars = new Set<string>();
  let masteredWords = 0;
  for (const { simplified, cards: wc } of byWord.values()) {
    if (masteryOfWord(wc) !== 'mastered') continue;
    masteredWords++;
    for (const ch of simplified) if (levelChars.has(ch)) masteredChars.add(ch);
  }
  return {
    words: { mastered: masteredWords, total: words.length },
    chars: { mastered: masteredChars.size, total: levelChars.size },
  };
}
