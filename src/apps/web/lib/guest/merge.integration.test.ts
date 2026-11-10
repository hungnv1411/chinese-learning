import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { emptyGuestProgress, type GuestCard, type GuestProgressV1 } from '@clp/core';
import { runMigrations } from '@/db/migrate';
import { clearCurriculumCache } from '@/lib/path/load';
import { mergeGuestIntoAccount } from './merge';

// Cần Postgres thật (xem db/schema.test.ts). Không có TEST_DATABASE_URL thì bỏ qua.
const adminUrl = process.env.TEST_DATABASE_URL;
const NOW = new Date('2026-11-10T08:00:00Z');

describe.skipIf(!adminUrl)('mergeGuestIntoAccount (Postgres thật)', () => {
  const dbName = `clp_merge_${randomBytes(4).toString('hex')}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  const entry: Record<string, number> = {};

  beforeAll(async () => {
    admin = postgres(adminUrl as string, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl as string);
    url.pathname = `/${dbName}`;
    await runMigrations(url.toString());
    sql = postgres(url.toString(), { max: 3, onnotice: () => {} });
    await sql`INSERT INTO "user" (id, name, email) VALUES ('u1', 'A', 'a@x.test'), ('u2', 'B', 'b@x.test')`;
    await sql`INSERT INTO stage (id, "order", title, exam_open) VALUES ('pron', 0, 'Phát âm', false), ('hsk1', 1, 'HSK 1', true)`;
    await sql`INSERT INTO unit (id, stage_id, "order", title, published) VALUES
      ('pron-u01', 'pron', 1, 'P', true), ('hsk1-u01', 'hsk1', 1, 'H', true), ('hsk1-u05', 'hsk1', 2, 'H5', true)`;
    const lessons: [string, string, number][] = [
      ['p1', 'pron-u01', 1],
      ['p2', 'pron-u01', 2],
      ['p3', 'pron-u01', 3],
      ['p4', 'pron-u01', 4],
      ['h1', 'hsk1-u01', 1],
      ['h2', 'hsk1-u01', 2],
      ['h3', 'hsk1-u01', 3],
      ['h4', 'hsk1-u01', 4],
      ['hsk1-u05-l02', 'hsk1-u05', 2],
    ];
    for (const [id, unit, order] of lessons) {
      await sql`INSERT INTO lesson (id, unit_id, "order", title, kind, content)
                VALUES (${id}, ${unit}, ${order}, ${id}, 'normal', ${sql.json({})})`;
    }
    await sql`INSERT INTO content_meta (key, value) VALUES ('content_version', 'v1')`;
    // Từ của p1 và p2; một mục từ điển cho mỗi từ
    for (const [i, [word, lesson]] of (
      [
        ['你', 'p1'],
        ['好', 'p1'],
        ['吃', 'p2'],
        ['水', 'p2'],
        ['书', 'h1'],
      ] as const
    ).entries()) {
      const [d] = await sql<{ id: number }[]>`
        INSERT INTO dict_entry (simplified, traditional, pinyin_numbered, pinyin_marked, pinyin_plain, definitions, cedict_order)
        VALUES (${word}, ${word}, 'x1', 'x', 'x', ${['x']}, ${i}) RETURNING id`;
      entry[word] = (d as { id: number }).id;
      const [h] = await sql<{ id: number }[]>`
        INSERT INTO hsk_word (level, simplified, pinyin, dict_entry_id) VALUES (1, ${word}, 'x1', ${entry[word]!}) RETURNING id`;
      await sql`INSERT INTO lesson_word (lesson_id, hsk_word_id) VALUES (${lesson}, ${(h as { id: number }).id})`;
    }
  }, 60_000);

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.end();
  });

  beforeEach(async () => {
    clearCurriculumCache();
    await sql`TRUNCATE lesson_progress, stage_progress, srs_card, daily_activity, user_settings CASCADE`;
  });

  const card = (word: string, type: GuestCard['cardType'] = 'recognize'): GuestCard => ({
    cardKey: `${entry[word]}:${type}`,
    dictEntryId: entry[word]!,
    cardType: type,
    due: '2026-11-11T08:00:00.000Z',
    stability: 2.5,
    difficulty: 5,
    scheduledDays: 1,
    learningSteps: 0,
    reps: 1,
    lapses: 0,
    state: 2,
    lastReview: '2026-11-10T07:00:00.000Z',
  });
  const lessonOf = (status: 'completed' | 'in_progress', over = {}) => ({
    status,
    currentStep: 3,
    stepState: { done: [0, 1] },
    bestScore: 85,
    contentVersion: 'v1',
    completedAt: '2026-11-09T08:00:00.000Z',
    ...over,
  });
  const guest = (over: Partial<GuestProgressV1>): GuestProgressV1 => ({
    ...emptyGuestProgress(),
    ...over,
  });

  test('tài khoản mới nhận bài, thẻ, ngày, cài đặt', async () => {
    const g = guest({
      settings: { dailyGoalMinutes: 20, voice: 'male', reviewCardTypes: ['recognize', 'write'] },
      lessons: { p1: lessonOf('completed'), p2: lessonOf('in_progress') },
      cards: [card('你'), card('好'), card('吃', 'listen')],
      daily: { '2026-11-10': { minutes: 7, lessonsCompleted: 1, reviewsDone: 2 } },
    });
    expect(await mergeGuestIntoAccount(sql, 'u1', g, NOW)).toEqual({
      lessons: 2,
      cards: 3,
      days: 1,
    });

    const lessons =
      await sql`SELECT lesson_id, status, current_step, best_score, content_version, step_state
                              FROM lesson_progress WHERE user_id = 'u1' ORDER BY lesson_id`;
    expect(lessons.map((l) => [l.lesson_id, l.status, l.best_score, l.content_version])).toEqual([
      ['p1', 'completed', 85, 1],
      ['p2', 'in_progress', 85, 1],
    ]);
    expect(lessons[0]?.step_state).toEqual({ done: [0, 1] });
    expect((await sql`SELECT count(*)::int AS n FROM srs_card WHERE user_id = 'u1'`)[0]?.n).toBe(3);
    const [day] =
      await sql`SELECT seconds, lessons_completed, reviews_done FROM daily_activity WHERE user_id = 'u1'`;
    expect(day).toEqual({ seconds: 420, lessons_completed: 1, reviews_done: 2 });
    const [s] =
      await sql`SELECT daily_goal_minutes, voice, review_card_types FROM user_settings WHERE user_id = 'u1'`;
    expect(s).toEqual({
      daily_goal_minutes: 20,
      voice: 'male',
      review_card_types: ['recognize', 'write'],
    });
  });

  test('tài khoản đã có tiến độ: bài tiến xa hơn, thẻ trùng giữ, ngày cộng dồn, cài đặt giữ', async () => {
    await sql`INSERT INTO lesson_progress (user_id, lesson_id, status, current_step, best_score)
              VALUES ('u1', 'p1', 'in_progress', 1, 95)`;
    await sql`INSERT INTO srs_card (user_id, dict_entry_id, card_type, due, reps, source)
              VALUES ('u1', ${entry['你']!}, 'recognize', ${NOW}, 9, 'lesson')`;
    await sql`INSERT INTO daily_activity (user_id, date, seconds, lessons_completed) VALUES ('u1', '2026-11-10', 100, 1)`;
    await sql`INSERT INTO user_settings (user_id, daily_goal_minutes) VALUES ('u1', 5)`;

    const g = guest({
      settings: { dailyGoalMinutes: 20 },
      lessons: { p1: lessonOf('completed', { bestScore: 80 }) },
      cards: [card('你'), card('好')],
      daily: { '2026-11-10': { minutes: 2, lessonsCompleted: 1, reviewsDone: 4 } },
    });
    expect(await mergeGuestIntoAccount(sql, 'u1', g, NOW)).toEqual({
      lessons: 1,
      cards: 1,
      days: 1,
    });

    const [l] =
      await sql`SELECT status, best_score FROM lesson_progress WHERE user_id = 'u1' AND lesson_id = 'p1'`;
    expect(l).toEqual({ status: 'completed', best_score: 95 });
    const kept =
      await sql`SELECT reps FROM srs_card WHERE user_id = 'u1' AND dict_entry_id = ${entry['你']!}`;
    expect(kept[0]?.reps).toBe(9);
    const [day] =
      await sql`SELECT seconds, lessons_completed, reviews_done FROM daily_activity WHERE user_id = 'u1'`;
    expect(day).toEqual({ seconds: 220, lessons_completed: 2, reviews_done: 4 });
    expect(
      (await sql`SELECT daily_goal_minutes FROM user_settings WHERE user_id = 'u1'`)[0]
        ?.daily_goal_minutes,
    ).toBe(5);
  });

  test('dữ liệu sửa tay: bài ngoài tập thử, vượt giới hạn, sai thứ tự, thẻ ngoài bài đều bị bỏ', async () => {
    const g = guest({
      pinyinTest: { passed: true, at: '2026-11-09T00:00:00.000Z' },
      lessons: {
        p1: lessonOf('completed'),
        p2: lessonOf('completed'),
        p3: lessonOf('completed'),
        h1: lessonOf('completed'), // vượt 3 bài
        'hsk1-u05-l02': lessonOf('completed'), // ngoài tập thử
        p4: lessonOf('completed'), // ngoài tập thử
      },
      cards: [card('你'), card('吃'), card('书') /* thuộc h1, không được nhận */],
    });
    const r = await mergeGuestIntoAccount(sql, 'u1', g, NOW);
    expect(r.lessons).toBe(3);
    const rows =
      await sql`SELECT lesson_id FROM lesson_progress WHERE user_id = 'u1' ORDER BY lesson_id`;
    expect(rows.map((x) => x.lesson_id)).toEqual(['p1', 'p2', 'p3']);
    const cards = await sql`SELECT dict_entry_id FROM srs_card WHERE user_id = 'u1'`;
    expect(cards.map((c) => c.dict_entry_id).sort()).toEqual([entry['你']!, entry['吃']!].sort());
    expect((await sql`SELECT count(*)::int AS n FROM certificate`)[0]?.n).toBe(0);
  });

  test('đạt bài kiểm tra pinyin → stage_progress(pron) completed, exam_skip', async () => {
    const g = guest({ pinyinTest: { passed: true, at: '2026-11-09T00:00:00.000Z' } });
    await mergeGuestIntoAccount(sql, 'u1', g, NOW);
    const [s] =
      await sql`SELECT status, completed_via FROM stage_progress WHERE user_id = 'u1' AND stage_id = 'pron'`;
    expect(s).toEqual({ status: 'completed', completed_via: 'exam_skip' });
  });

  test('gộp hai lần liên tiếp không nhân đôi dữ liệu thẻ và bài (ngày thì cộng, theo thiết kế)', async () => {
    const g = guest({ lessons: { p1: lessonOf('completed') }, cards: [card('你')] });
    await mergeGuestIntoAccount(sql, 'u1', g, NOW);
    const again = await mergeGuestIntoAccount(sql, 'u1', g, NOW);
    expect(again).toMatchObject({ lessons: 0, cards: 0 });
    expect((await sql`SELECT count(*)::int AS n FROM srs_card WHERE user_id = 'u1'`)[0]?.n).toBe(1);
  });

  test('lỗi giữa chừng thì không ghi gì (transaction)', async () => {
    const bad: GuestCard = { ...card('你'), dictEntryId: 424242, cardKey: '424242:recognize' };
    // thẻ ngoài bài bị lọc nên không gây lỗi; ép lỗi bằng mục từ điển có thật trong bài nhưng sai khóa ngoại cho cài đặt
    const g = guest({
      lessons: { p1: lessonOf('completed') },
      cards: [card('你'), bad],
      settings: { voice: 'male' },
    });
    await sql`ALTER TABLE user_settings ADD CONSTRAINT tmp_fail CHECK (voice <> 'male')`;
    await expect(mergeGuestIntoAccount(sql, 'u1', g, NOW)).rejects.toThrow();
    await sql`ALTER TABLE user_settings DROP CONSTRAINT tmp_fail`;
    expect(
      (await sql`SELECT count(*)::int AS n FROM lesson_progress WHERE user_id = 'u1'`)[0]?.n,
    ).toBe(0);
    expect((await sql`SELECT count(*)::int AS n FROM srs_card WHERE user_id = 'u1'`)[0]?.n).toBe(0);
  });

  test('tiến độ của tài khoản khác không bị đụng tới', async () => {
    await sql`INSERT INTO lesson_progress (user_id, lesson_id, status) VALUES ('u2', 'p1', 'in_progress')`;
    await mergeGuestIntoAccount(sql, 'u1', guest({ lessons: { p1: lessonOf('completed') } }), NOW);
    expect((await sql`SELECT status FROM lesson_progress WHERE user_id = 'u2'`)[0]?.status).toBe(
      'in_progress',
    );
  });
});
