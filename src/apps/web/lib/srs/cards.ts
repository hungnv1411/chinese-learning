import type postgres from 'postgres';
import { newCard, review, type CardType, type Rating, type SrsCard, type SrsState } from '@clp/core';

/** Kiểu thẻ bật mặc định khi người học chưa có `user_settings` (spec 09 §2). */
export const DEFAULT_CARD_TYPES: CardType[] = ['recognize', 'listen'];
/** Bài tập chỉ ghi vào SRS khi thẻ đến hạn trong khoảng này (spec 06 §7). */
export const EXERCISE_REVIEW_WINDOW_MS = 24 * 3_600_000;

type Sql = postgres.Sql;
type CardRow = {
  id: number;
  due: Date;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: Date | null;
  suspended: boolean;
};

export type LessonWord = {
  dictEntryId: number;
  hskWordId: number | null;
  /** Các chữ Hán của từ, theo thứ tự. */
  chars: string[];
  /** Làm sai trong bài: lần ôn đầu tính là `again`. */
  wrong: boolean;
};

const toCard = (r: CardRow): SrsCard => ({
  due: r.due,
  stability: r.stability,
  difficulty: r.difficulty,
  scheduledDays: r.scheduled_days,
  learningSteps: r.learning_steps,
  reps: r.reps,
  lapses: r.lapses,
  state: r.state as SrsState,
  lastReview: r.last_review,
});

export async function getEnabledCardTypes(sql: Sql, userId: string): Promise<CardType[]> {
  const [row] = await sql<{ t: CardType[] }[]>`
    SELECT review_card_types AS t FROM user_settings WHERE user_id = ${userId}`;
  return row?.t ?? DEFAULT_CARD_TYPES;
}

/** Ghi một dòng log ôn tập. */
async function writeLog(sql: Sql, cardId: number, rating: Rating, at: Date) {
  await sql`INSERT INTO srs_review_log (card_id, rating, review_time) VALUES (${cardId}, ${rating}, ${at})`;
}

async function insertCard(
  sql: Sql,
  userId: string,
  dictEntryId: number,
  hskWordId: number | null,
  cardType: CardType,
  card: SrsCard,
  source: 'lesson' | 'dictionary' | 'speaking_fail',
): Promise<number | null> {
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO srs_card
      (user_id, dict_entry_id, hsk_word_id, card_type, due, stability, difficulty, scheduled_days,
       learning_steps, reps, lapses, state, last_review, source)
    VALUES (${userId}, ${dictEntryId}, ${hskWordId}, ${cardType}, ${card.due}, ${card.stability},
            ${card.difficulty}, ${card.scheduledDays}, ${card.learningSteps}, ${card.reps},
            ${card.lapses}, ${card.state}, ${card.lastReview}, ${source})
    ON CONFLICT (user_id, dict_entry_id, card_type) DO NOTHING
    RETURNING id`;
  return row?.id ?? null;
}

/** Mục từ điển của một chữ đơn (bỏ mục họ/biến thể, ưu tiên mục có cấp HSK). */
async function singleCharEntry(sql: Sql, ch: string): Promise<number | null> {
  const [row] = await sql<{ id: number }[]>`
    SELECT id FROM dict_entry
    WHERE simplified = ${ch}
    ORDER BY is_variant_or_surname, hsk_level NULLS LAST, cedict_order NULLS LAST, id
    LIMIT 1`;
  return row?.id ?? null;
}

/** Các (mục từ điển, hsk_word) cần có thẻ `write` cho một từ. */
async function writeTargets(
  sql: Sql,
  w: Pick<LessonWord, 'dictEntryId' | 'hskWordId' | 'chars'>,
): Promise<{ dictEntryId: number; hskWordId: number | null }[]> {
  if (w.chars.length <= 2) return [{ dictEntryId: w.dictEntryId, hskWordId: w.hskWordId }];
  const out: { dictEntryId: number; hskWordId: number | null }[] = [];
  for (const ch of new Set(w.chars)) {
    const dictEntryId = await singleCharEntry(sql, ch);
    if (dictEntryId !== null) out.push({ dictEntryId, hskWordId: null });
  }
  return out;
}

/**
 * Hoàn thành bài: tạo thẻ cho từ mới theo các kiểu đang bật. Thẻ có sẵn thì giữ nguyên.
 * Từ vừa học đã qua một lần ôn: `good`, hoặc `again` nếu làm sai trong bài (spec 06 §8).
 */
export async function createCardsForLesson(
  sql: Sql,
  userId: string,
  words: LessonWord[],
  enabledTypes: CardType[],
  now: Date,
): Promise<{ created: number }> {
  let created = 0;
  for (const w of words) {
    const { card, log } = review(newCard(now), w.wrong ? 'again' : 'good', now);
    for (const type of enabledTypes) {
      const targets =
        type === 'write' ? await writeTargets(sql, w) : [{ dictEntryId: w.dictEntryId, hskWordId: w.hskWordId }];
      for (const t of targets) {
        const cardId = await insertCard(sql, userId, t.dictEntryId, t.hskWordId, type, card, 'lesson');
        if (cardId === null) continue;
        created += 1;
        await writeLog(sql, cardId, log.rating, now);
      }
    }
  }
  return { created };
}

/**
 * Bài tập ghi vào SRS: chỉ khi thẻ đã có, đang bật và đến hạn trong 24 giờ tới.
 * Trả `true` nếu đã ghi.
 */
export async function recordExerciseReview(
  sql: Sql,
  userId: string,
  dictEntryId: number,
  cardType: CardType,
  rating: Rating,
  now: Date,
): Promise<boolean> {
  const [row] = await sql<CardRow[]>`
    SELECT * FROM srs_card
    WHERE user_id = ${userId} AND dict_entry_id = ${dictEntryId} AND card_type = ${cardType}`;
  if (!row || row.suspended) return false;
  if (row.due.getTime() > now.getTime() + EXERCISE_REVIEW_WINDOW_MS) return false;
  const { card } = review(toCard(row), rating, now);
  await sql`
    UPDATE srs_card SET due = ${card.due}, stability = ${card.stability}, difficulty = ${card.difficulty},
      scheduled_days = ${card.scheduledDays}, learning_steps = ${card.learningSteps}, reps = ${card.reps},
      lapses = ${card.lapses}, state = ${card.state}, last_review = ${card.lastReview}
    WHERE id = ${row.id}`;
  await writeLog(sql, row.id, rating, now);
  return true;
}

/**
 * Nói chưa đạt sau 3 lần: thẻ `listen` có sẵn thì đến hạn ngay; chưa có thì tạo mới
 * (`source = speaking_fail`), trừ khi người học đã tắt kiểu `listen`.
 */
export async function speakingFail(
  sql: Sql,
  userId: string,
  dictEntryIds: number[],
  now: Date,
): Promise<void> {
  const enabled = (await getEnabledCardTypes(sql, userId)).includes('listen');
  for (const entryId of dictEntryIds) {
    const [existing] = await sql<{ id: number }[]>`
      UPDATE srs_card SET due = ${now}
      WHERE user_id = ${userId} AND dict_entry_id = ${entryId} AND card_type = 'listen' AND NOT suspended
      RETURNING id`;
    if (existing || !enabled) continue;
    const [hsk] = await sql<{ id: number }[]>`
      SELECT id FROM hsk_word WHERE dict_entry_id = ${entryId} AND NOT deprecated ORDER BY level LIMIT 1`;
    await insertCard(sql, userId, entryId, hsk?.id ?? null, 'listen', newCard(now), 'speaking_fail');
  }
}

/** “Thêm vào ôn tập” trong từ điển: tạo thẻ các kiểu đang bật, chưa ôn lần nào. */
export async function addFromDictionary(
  sql: Sql,
  userId: string,
  dictEntryId: number,
  now: Date,
): Promise<{ already: boolean; created: number }> {
  const types = await getEnabledCardTypes(sql, userId);
  const [entry] = await sql<{ simplified: string }[]>`
    SELECT simplified FROM dict_entry WHERE id = ${dictEntryId}`;
  if (!entry) return { already: false, created: 0 };
  const [hsk] = await sql<{ id: number }[]>`
    SELECT id FROM hsk_word WHERE dict_entry_id = ${dictEntryId} AND NOT deprecated ORDER BY level LIMIT 1`;
  const chars = [...entry.simplified];
  let created = 0;
  for (const type of types) {
    const targets =
      type === 'write'
        ? await writeTargets(sql, { dictEntryId, hskWordId: hsk?.id ?? null, chars })
        : [{ dictEntryId, hskWordId: hsk?.id ?? null }];
    for (const t of targets) {
      const id = await insertCard(sql, userId, t.dictEntryId, t.hskWordId, type, newCard(now), 'dictionary');
      if (id !== null) created += 1;
    }
  }
  return { already: created === 0, created };
}

/** Bài kiểm tra cuối: các từ sai đến hạn ngay. Chỉ thẻ đã có và đang bật; không tạo mới. Trả số thẻ đổi. */
export async function bumpDue(
  sql: Sql,
  userId: string,
  dictEntryIds: number[],
  now: Date,
): Promise<number> {
  if (dictEntryIds.length === 0) return 0;
  const rows = await sql`
    UPDATE srs_card SET due = ${now}
    WHERE user_id = ${userId} AND dict_entry_id IN ${sql(dictEntryIds)} AND NOT suspended
    RETURNING id`;
  return rows.length;
}
