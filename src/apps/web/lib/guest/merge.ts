import type postgres from 'postgres';
import {
  mergeGuestProgress,
  trialLessonIds,
  type AccountSnapshot,
  type GuestProgressV1,
  type MergePlan,
} from '@clp/core';
import { loadCurriculum, loadProgressSnapshot } from '@/lib/path/load';

type Sql = postgres.Sql;
type Tx = postgres.TransactionSql;

export type MergeResult = { lessons: number; cards: number; days: number };

async function loadAccountSnapshot(sql: Sql, userId: string): Promise<AccountSnapshot> {
  const [progress, lessons, cards] = await Promise.all([
    loadProgressSnapshot(sql, userId),
    sql<
      {
        lesson_id: string;
        status: 'in_progress' | 'completed';
        current_step: number;
        step_state: unknown;
        best_score: number | null;
        content_version: number | null;
        completed_at: Date | null;
      }[]
    >`SELECT lesson_id, status, current_step, step_state, best_score, content_version, completed_at
      FROM lesson_progress WHERE user_id = ${userId}`,
    sql<{ dict_entry_id: number; card_type: string }[]>`
      SELECT dict_entry_id, card_type FROM srs_card WHERE user_id = ${userId}`,
  ]);
  return {
    lessons: Object.fromEntries(
      lessons.map((r) => [
        r.lesson_id,
        {
          status: r.status,
          currentStep: r.current_step,
          stepState: r.step_state,
          bestScore: r.best_score,
          contentVersion: r.content_version === null ? null : String(r.content_version),
          completedAt: r.completed_at?.toISOString() ?? null,
        },
      ]),
    ),
    stages: progress.stages,
    cardKeys: cards.map((c) => `${c.dict_entry_id}:${c.card_type}`),
  };
}

/** Mục từ điển của từ và của từng chữ trong các bài này (thẻ `write` của từ dài dùng từng chữ). */
async function loadLessonEntries(sql: Sql, lessonIds: string[]): Promise<Record<string, number[]>> {
  const out: Record<string, Set<number>> = Object.fromEntries(
    lessonIds.map((id) => [id, new Set()]),
  );
  if (lessonIds.length === 0) return {};
  const words = await sql<
    { lesson_id: string; dict_entry_id: number | null; simplified: string }[]
  >`
    SELECT lw.lesson_id, hw.dict_entry_id, hw.simplified
    FROM lesson_word lw JOIN hsk_word hw ON hw.id = lw.hsk_word_id
    WHERE lw.lesson_id = ANY(${lessonIds})`;
  const chars = await sql<{ lesson_id: string; char: string }[]>`
    SELECT lesson_id, char FROM lesson_char WHERE lesson_id = ANY(${lessonIds})`;
  const allChars = new Set([
    ...chars.map((c) => c.char),
    ...words.flatMap((w) => [...w.simplified]),
  ]);
  const charEntries = await sql<{ simplified: string; id: number }[]>`
    SELECT DISTINCT ON (simplified) simplified, id FROM dict_entry
    WHERE simplified = ANY(${[...allChars]})
    ORDER BY simplified, is_variant_or_surname, hsk_level NULLS LAST, cedict_order NULLS LAST, id`;
  const entryOfChar = new Map(charEntries.map((e) => [e.simplified, e.id]));
  for (const w of words) {
    if (w.dict_entry_id !== null) out[w.lesson_id]?.add(w.dict_entry_id);
    for (const ch of w.simplified) {
      const e = entryOfChar.get(ch);
      if (e !== undefined) out[w.lesson_id]?.add(e);
    }
  }
  for (const c of chars) {
    const e = entryOfChar.get(c.char);
    if (e !== undefined) out[c.lesson_id]?.add(e);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]]));
}

/** Cột `lesson_progress.content_version` là số nguyên; bản khách là chuỗi (`v3` → 3). */
const versionNumber = (v: string | null): number | null => {
  const m = v ? /\d+/.exec(v) : null;
  return m ? Number(m[0]) : null;
};

const SETTING_COLUMNS = {
  dailyGoalMinutes: 'daily_goal_minutes',
  showPinyin: 'show_pinyin',
  showHanViet: 'show_han_viet',
  toneColors: 'tone_colors',
  traditional: 'traditional',
  reviewButtons: 'review_buttons',
  reviewCardTypes: 'review_card_types',
  voice: 'voice',
  recordMode: 'record_mode',
} as const;

/** Áp dụng kế hoạch trong một transaction: lỗi ở đâu thì không ghi gì. */
export async function applyMergePlan(
  sql: Sql,
  userId: string,
  plan: MergePlan,
  now: Date,
): Promise<void> {
  await sql.begin(async (tx: Tx) => {
    for (const l of plan.upsertLessonProgress) {
      const completedAt = l.status === 'completed' ? new Date(l.completedAt ?? now) : null;
      await tx`
        INSERT INTO lesson_progress
          (user_id, lesson_id, status, current_step, step_state, best_score, completed_at, content_version)
        VALUES (${userId}, ${l.lessonId}, ${l.status}, ${l.currentStep}, ${tx.json((l.stepState ?? {}) as postgres.JSONValue)},
                ${l.bestScore}, ${completedAt}, ${versionNumber(l.contentVersion)})
        ON CONFLICT (user_id, lesson_id) DO UPDATE SET
          status = EXCLUDED.status, current_step = EXCLUDED.current_step,
          step_state = EXCLUDED.step_state, best_score = EXCLUDED.best_score,
          completed_at = EXCLUDED.completed_at, content_version = EXCLUDED.content_version`;
    }
    for (const s of plan.setStageCompleted) {
      await tx`
        INSERT INTO stage_progress (user_id, stage_id, status, completed_via, completed_at)
        VALUES (${userId}, ${s.stageId}, 'completed', ${s.via}, ${now})
        ON CONFLICT (user_id, stage_id) DO UPDATE SET
          status = 'completed', completed_via = EXCLUDED.completed_via, completed_at = EXCLUDED.completed_at
        WHERE stage_progress.status <> 'completed'`;
    }
    for (const c of plan.insertCards) {
      const [hsk] = await tx<{ id: number }[]>`
        SELECT id FROM hsk_word WHERE dict_entry_id = ${c.dictEntryId} AND NOT deprecated
        ORDER BY level LIMIT 1`;
      await tx`
        INSERT INTO srs_card
          (user_id, dict_entry_id, hsk_word_id, card_type, due, stability, difficulty, scheduled_days,
           learning_steps, reps, lapses, state, last_review, source)
        VALUES (${userId}, ${c.dictEntryId}, ${hsk?.id ?? null}, ${c.cardType}, ${new Date(c.due)},
                ${c.stability}, ${c.difficulty}, ${Math.round(c.scheduledDays)}, ${c.learningSteps},
                ${c.reps}, ${c.lapses}, ${c.state}, ${c.lastReview ? new Date(c.lastReview) : null}, 'lesson')
        ON CONFLICT (user_id, dict_entry_id, card_type) DO NOTHING`;
    }
    for (const d of plan.addDaily) {
      await tx`
        INSERT INTO daily_activity (user_id, date, seconds, lessons_completed, reviews_done)
        VALUES (${userId}, ${d.date}, ${d.seconds}, ${d.lessonsCompleted}, ${d.reviewsDone})
        ON CONFLICT (user_id, date) DO UPDATE SET
          seconds = daily_activity.seconds + EXCLUDED.seconds,
          lessons_completed = daily_activity.lessons_completed + EXCLUDED.lessons_completed,
          reviews_done = daily_activity.reviews_done + EXCLUDED.reviews_done`;
    }
    if (plan.setSettings) {
      await tx`INSERT INTO user_settings (user_id) VALUES (${userId}) ON CONFLICT (user_id) DO NOTHING`;
      const set: Record<string, unknown> = {};
      for (const [key, column] of Object.entries(SETTING_COLUMNS)) {
        const v = (plan.setSettings as Record<string, unknown>)[key];
        if (v !== undefined) set[column] = v;
      }
      if (Object.keys(set).length > 0) {
        await tx`UPDATE user_settings SET ${tx(set)} WHERE user_id = ${userId}`;
      }
    }
  });
}

/** `POST /api/guest/merge`: kiểm tra lại dữ liệu khách, gộp vào tài khoản, trả số lượng đã nhận. */
export async function mergeGuestIntoAccount(
  sql: Sql,
  userId: string,
  guest: GuestProgressV1,
  now: Date = new Date(),
): Promise<MergeResult> {
  const curriculum = await loadCurriculum(sql);
  const trialIds = trialLessonIds(curriculum.index);
  const [account, lessonEntries] = await Promise.all([
    loadAccountSnapshot(sql, userId),
    loadLessonEntries(sql, [...trialIds]),
  ]);
  const plan = mergeGuestProgress(account, guest, {
    curriculum: curriculum.index,
    trialIds,
    lessonEntries,
    now,
  });
  await applyMergePlan(sql, userId, plan, now);
  return {
    lessons: plan.upsertLessonProgress.length,
    cards: plan.insertCards.length,
    days: plan.addDaily.length,
  };
}
