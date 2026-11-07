import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { runMigrations } from '@/db/migrate';
import {
  addFromDictionary,
  bumpDue,
  createCardsForLesson,
  recordExerciseReview,
  speakingFail,
} from './cards';

// Cần Postgres thật (xem db/schema.test.ts). Không có TEST_DATABASE_URL thì bỏ qua.
const adminUrl = process.env.TEST_DATABASE_URL;
const NOW = new Date('2026-11-07T08:00:00Z');
const H = 3_600_000;

describe.skipIf(!adminUrl)('lib/srs/cards (Postgres thật)', () => {
  const dbName = `clp_srs_${randomBytes(4).toString('hex')}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  // id của các mục từ điển dùng trong test
  const id: Record<string, number> = {};

  beforeAll(async () => {
    admin = postgres(adminUrl as string, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl as string);
    url.pathname = `/${dbName}`;
    await runMigrations(url.toString());
    sql = postgres(url.toString(), { max: 2, onnotice: () => {} });
    await sql`INSERT INTO "user" (id, name, email) VALUES ('u1', 'A', 'a@x.test'), ('u2', 'B', 'b@x.test')`;
    const entries: [string, string][] = [
      ['你', 'ni3'],
      ['好', 'hao3'],
      ['吃', 'chi1'],
      ['好吃', 'hao3 chi1'],
      ['你好吗', 'ni3 hao3 ma5'],
      ['行', 'xing2'],
    ];
    for (const [s, p] of entries) {
      const [r] = await sql<{ id: number }[]>`
        INSERT INTO dict_entry (simplified, traditional, pinyin_numbered, pinyin_marked, pinyin_plain, definitions)
        VALUES (${s}, ${s}, ${p}, ${p}, ${p.replace(/\d/g, '')}, ${['x']}) RETURNING id`;
      id[s] = (r as { id: number }).id;
    }
    // “好”: thêm một mục họ/biến thể không được chọn khi tìm theo chữ đơn
    await sql`INSERT INTO dict_entry (simplified, traditional, pinyin_numbered, pinyin_marked, pinyin_plain, definitions, is_variant_or_surname)
              VALUES ('好', '好', 'hao4', 'hào', 'hao', ${['x']}, true)`;
  }, 60_000);

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.end();
  });

  beforeEach(async () => {
    await sql`TRUNCATE srs_card, user_settings CASCADE`;
  });

  const cards = (userId = 'u1') =>
    sql<{ dict_entry_id: number; card_type: string; source: string; reps: number; state: number; due: Date; suspended: boolean; lapses: number }[]>`
      SELECT * FROM srs_card WHERE user_id = ${userId} ORDER BY id`;
  const word = (s: string, chars: string[], wrong = false) => ({
    dictEntryId: id[s] as number,
    hskWordId: null,
    chars,
    wrong,
  });

  describe('createCardsForLesson', () => {
    test('mỗi từ, mỗi kiểu đang bật; từ làm đúng đã qua một lần good', async () => {
      await createCardsForLesson(sql, 'u1', [word('好吃', ['好', '吃'])], ['recognize', 'listen'], NOW);
      const rows = await cards();
      expect(rows.map((r) => r.card_type).sort()).toEqual(['listen', 'recognize']);
      expect(rows.every((r) => r.source === 'lesson' && r.reps === 1 && r.due > NOW)).toBe(true);
      const logs = await sql`SELECT rating FROM srs_review_log`;
      expect(logs.map((l) => l.rating)).toEqual(['good', 'good']);
    });

    test('từ làm sai: lần ôn đầu là again (lapses 0, đến hạn sớm hơn good)', async () => {
      await createCardsForLesson(sql, 'u1', [word('好', ['好'], true), word('吃', ['吃'])], ['recognize'], NOW);
      const logs = await sql`SELECT c.dict_entry_id, l.rating FROM srs_review_log l JOIN srs_card c ON c.id = l.card_id`;
      expect(logs.find((l) => l.dict_entry_id === id['好'])?.rating).toBe('again');
      expect(logs.find((l) => l.dict_entry_id === id['吃'])?.rating).toBe('good');
      const rows = await cards();
      const due = (s: string) => rows.find((r) => r.dict_entry_id === id[s])!.due.getTime();
      expect(due('好')).toBeLessThan(due('吃'));
    });

    test('write: từ 1–2 chữ → một thẻ cho cả từ', async () => {
      await createCardsForLesson(sql, 'u1', [word('好吃', ['好', '吃'])], ['write'], NOW);
      expect((await cards()).map((r) => r.dict_entry_id)).toEqual([id['好吃']]);
    });

    test('write: từ 3 chữ → thẻ cho từng chữ (mục chữ đơn, bỏ mục họ/biến thể)', async () => {
      await createCardsForLesson(sql, 'u1', [word('你好吗', ['你', '好', '吗'])], ['write'], NOW);
      const rows = await cards();
      // “吗” không có mục từ điển trong dữ liệu thử → bỏ qua, không lỗi
      expect(rows.map((r) => r.dict_entry_id).sort()).toEqual([id['你'], id['好']].sort());
      const [hao] = await sql`SELECT is_variant_or_surname FROM dict_entry WHERE id = ${id['好']!}`;
      expect(hao?.is_variant_or_surname).toBe(false);
    });

    test('gọi hai lần không tạo thẻ trùng và không đổi thẻ cũ', async () => {
      const w = [word('好吃', ['好', '吃']), word('你好吗', ['你', '好', '吗'])];
      await createCardsForLesson(sql, 'u1', w, ['recognize', 'listen', 'write'], NOW);
      const first = await cards();
      const res = await createCardsForLesson(sql, 'u1', w, ['recognize', 'listen', 'write'], new Date(NOW.getTime() + H));
      expect(res.created).toBe(0);
      expect(await cards()).toEqual(first);
    });

    test('không có kiểu nào bật → không tạo gì', async () => {
      await createCardsForLesson(sql, 'u1', [word('好吃', ['好', '吃'])], [], NOW);
      expect(await cards()).toHaveLength(0);
    });
  });

  describe('recordExerciseReview', () => {
    const seed = async (dueOffsetMs: number) => {
      await sql`INSERT INTO srs_card (user_id, dict_entry_id, card_type, due, source)
                VALUES ('u1', ${id['好吃']!}, 'listen', ${new Date(NOW.getTime() + dueOffsetMs)}, 'lesson')`;
    };
    const logCount = async () => (await sql`SELECT count(*)::int AS n FROM srs_review_log`)[0]!.n as number;

    test('thẻ đến hạn sau 3 giờ → có log ôn và thẻ được xếp lịch lại', async () => {
      await seed(3 * H);
      expect(await recordExerciseReview(sql, 'u1', id['好吃']!, 'listen', 'good', NOW)).toBe(true);
      expect(await logCount()).toBe(1);
      expect((await cards())[0]!.reps).toBe(1);
    });

    test('thẻ đến hạn sau 2 ngày → không đổi', async () => {
      await seed(48 * H);
      expect(await recordExerciseReview(sql, 'u1', id['好吃']!, 'listen', 'good', NOW)).toBe(false);
      expect(await logCount()).toBe(0);
      expect((await cards())[0]!.reps).toBe(0);
    });

    test('chưa có thẻ hoặc thẻ bị tắt → không ghi, không tạo thẻ', async () => {
      expect(await recordExerciseReview(sql, 'u1', id['好吃']!, 'listen', 'good', NOW)).toBe(false);
      expect(await cards()).toHaveLength(0);
      await seed(0);
      await sql`UPDATE srs_card SET suspended = true`;
      expect(await recordExerciseReview(sql, 'u1', id['好吃']!, 'listen', 'again', NOW)).toBe(false);
      expect(await logCount()).toBe(0);
    });
  });

  describe('speakingFail', () => {
    test('thẻ listen có sẵn → due = now; chưa có → tạo mới nguồn speaking_fail', async () => {
      await sql`INSERT INTO srs_card (user_id, dict_entry_id, card_type, due, source, reps)
                VALUES ('u1', ${id['好']!}, 'listen', ${new Date(NOW.getTime() + 5 * 24 * H)}, 'lesson', 2)`;
      await speakingFail(sql, 'u1', [id['好']!, id['吃']!], NOW);
      const rows = await cards();
      const old = rows.find((r) => r.dict_entry_id === id['好'])!;
      expect(old.due.getTime()).toBe(NOW.getTime());
      expect(old.source).toBe('lesson');
      const made = rows.find((r) => r.dict_entry_id === id['吃'])!;
      expect(made).toMatchObject({ card_type: 'listen', source: 'speaking_fail', reps: 0 });
    });

    test('người học đã tắt kiểu listen và chưa có thẻ → không tạo', async () => {
      await sql`INSERT INTO user_settings (user_id, review_card_types) VALUES ('u1', ${['recognize']})`;
      await speakingFail(sql, 'u1', [id['好']!], NOW);
      expect(await cards()).toHaveLength(0);
    });
  });

  describe('addFromDictionary', () => {
    test('mặc định tạo recognize + listen (nguồn dictionary), lần hai trả already', async () => {
      const a = await addFromDictionary(sql, 'u1', id['好吃']!, NOW);
      expect(a).toEqual({ already: false, created: 2 });
      expect((await cards()).every((r) => r.source === 'dictionary' && r.reps === 0)).toBe(true);
      expect(await addFromDictionary(sql, 'u1', id['好吃']!, NOW)).toEqual({ already: true, created: 0 });
    });

    test('theo kiểu thẻ trong user_settings, kể cả write', async () => {
      await sql`INSERT INTO user_settings (user_id, review_card_types) VALUES ('u1', ${['write']})`;
      await addFromDictionary(sql, 'u1', id['好吃']!, NOW);
      expect((await cards()).map((r) => r.card_type)).toEqual(['write']);
    });
  });

  describe('bumpDue', () => {
    test('đặt due = now cho thẻ đã có, không tạo mới, không đụng thẻ người khác', async () => {
      const later = new Date(NOW.getTime() + 9 * 24 * H);
      for (const u of ['u1', 'u2'])
        await sql`INSERT INTO srs_card (user_id, dict_entry_id, card_type, due, source)
                  VALUES (${u}, ${id['好']!}, 'recognize', ${later}, 'lesson')`;
      const n = await bumpDue(sql, 'u1', [id['好']!, id['吃']!], NOW);
      expect(n).toBe(1);
      expect((await cards('u1'))[0]!.due.getTime()).toBe(NOW.getTime());
      expect((await cards('u2'))[0]!.due.getTime()).toBe(later.getTime());
      expect(await cards('u1')).toHaveLength(1);
    });
  });
});
