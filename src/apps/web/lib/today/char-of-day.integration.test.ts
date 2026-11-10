import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { characterOfDay } from '@clp/core';
import { runMigrations } from '@/db/migrate';
import { getCharOfDay } from './char-of-day';

// Cần Postgres thật (xem db/schema.test.ts). Không có TEST_DATABASE_URL thì bỏ qua.
const adminUrl = process.env.TEST_DATABASE_URL;
const DATE = '2026-11-10';

describe.skipIf(!adminUrl)('getCharOfDay (Postgres thật)', () => {
  const dbName = `clp_cod_${randomBytes(4).toString('hex')}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;

  beforeAll(async () => {
    admin = postgres(adminUrl as string, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl as string);
    url.pathname = `/${dbName}`;
    await runMigrations(url.toString());
    sql = postgres(url.toString(), { max: 2, onnotice: () => {} });
    await sql`INSERT INTO "user" (id, name, email) VALUES ('u1', 'A', 'a@x.test'), ('u2', 'B', 'b@x.test')`;
    await sql`INSERT INTO radical_vi (radical, number, name_vi, meaning_vi) VALUES ('女', 38, 'nữ', 'phụ nữ')`;
    for (const [ch, hv, rad, strokes] of [
      ['好', ['hảo', 'hiếu'], '女', 6],
      ['你', ['nễ'], null, 7],
      ['吃', ['ngật'], null, 6],
    ] as const) {
      await sql`INSERT INTO hanzi (char, han_viet, radical, decomposition, stroke_count, has_stroke_data)
                VALUES (${ch}, ${[...hv]}, ${rad}, '⿰女子', ${strokes}, true)`;
    }
    const entry = (
      s: string,
      num: string,
      marked: string,
      defs: string[],
      variant: boolean,
      order: number,
    ) =>
      sql`INSERT INTO dict_entry (simplified, traditional, pinyin_numbered, pinyin_marked, pinyin_plain,
            definitions, is_variant_or_surname, cedict_order)
          VALUES (${s}, ${s}, ${num}, ${marked}, ${num.replace(/\d/g, '')}, ${defs}, ${variant}, ${order})`;
    await entry('好', 'hao4', 'hào', ['to like'], false, 2);
    await entry('好', 'hao3', 'hǎo', ['good', 'well'], false, 1);
    await entry('你', 'ni3', 'nǐ', ['you'], false, 1);
    await entry('吃', 'chi1', 'chī', ['to eat'], false, 1);
    await sql`INSERT INTO stage (id, "order", title) VALUES ('hsk1', 1, 'HSK 1')`;
    await sql`INSERT INTO unit (id, stage_id, "order", title, published) VALUES ('u1', 'hsk1', 1, 'U', true)`;
    for (const [id, order] of [
      ['l1', 1],
      ['l2', 2],
      ['l3', 3],
      ['l4', 4],
      ['l5', 5],
    ] as const) {
      await sql`INSERT INTO lesson (id, unit_id, "order", title, content)
                VALUES (${id}, 'u1', ${order}, ${id}, ${sql.json({})})`;
    }
    await sql`INSERT INTO lesson_char (lesson_id, char) VALUES ('l1', '好'), ('l1', '你'), ('l2', '吃'), ('l3', '吃'), ('l4', '好'), ('l5', '你')`;
  }, 60_000);

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.end();
  });

  beforeEach(async () => {
    await sql`TRUNCATE lesson_progress`;
  });

  const done = (user: string, lesson: string, status = 'completed') =>
    sql`INSERT INTO lesson_progress (user_id, lesson_id, status) VALUES (${user}, ${lesson}, ${status})`;

  test('chọn trong các chữ của bài đã hoàn thành, đúng như characterOfDay', async () => {
    await done('u1', 'l1');
    const r = await getCharOfDay(sql, { seed: 'u1', userId: 'u1', date: DATE });
    expect(r?.char).toBe(characterOfDay('u1', DATE, ['好', '你']));
    expect(r?.fromNextLesson).toBe(false);
  });

  test('không lấy chữ của bài đang dở', async () => {
    await done('u1', 'l1');
    await done('u1', 'l2', 'in_progress');
    for (const date of ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']) {
      const r = await getCharOfDay(sql, { seed: 'u1', userId: 'u1', date });
      expect(['好', '你']).toContain(r?.char);
    }
  });

  test('chữ trùng ở nhiều bài chỉ tính một lần; cùng người cùng ngày luôn cùng chữ', async () => {
    await done('u1', 'l2');
    await done('u1', 'l3');
    const a = await getCharOfDay(sql, { seed: 'u1', userId: 'u1', date: DATE });
    const b = await getCharOfDay(sql, { seed: 'u1', userId: 'u1', date: DATE });
    expect(a?.char).toBe('吃');
    expect(b).toEqual(a);
  });

  test('chưa học chữ nào → chữ của bài tiếp theo', async () => {
    const r = await getCharOfDay(sql, { seed: 'u1', userId: 'u1', date: DATE, nextLessonId: 'l2' });
    expect(r?.char).toBe('吃');
    expect(r?.fromNextLesson).toBe(true);
  });

  test('chưa học gì và không có bài tiếp theo → null', async () => {
    expect(await getCharOfDay(sql, { seed: 'u1', userId: 'u1', date: DATE })).toBeNull();
    expect(
      await getCharOfDay(sql, { seed: 'u1', userId: 'u1', date: DATE, nextLessonId: 'khong-co' }),
    ).toBeNull();
  });

  test('tiến độ của người khác không lẫn vào', async () => {
    await done('u2', 'l1');
    expect(await getCharOfDay(sql, { seed: 'u1', userId: 'u1', date: DATE })).toBeNull();
  });

  test('dữ liệu hiển thị: pinyin theo cách đọc đầu tiên, nghĩa, Hán Việt, bộ thủ, số nét', async () => {
    await done('u1', 'l4');
    expect(await getCharOfDay(sql, { seed: 'x', userId: 'u1', date: DATE })).toEqual({
      char: '好',
      pinyinMarked: 'hǎo', // cedict_order nhỏ nhất, không phải hào
      definitions: ['good', 'well'],
      hanViet: ['hảo', 'hiếu'],
      strokeCount: 6,
      decomposition: '⿰女子',
      radical: { radical: '女', nameVi: 'nữ', meaningVi: 'phụ nữ' },
      fromNextLesson: false,
    });
  });

  test('chữ không có bộ thủ trong radical_vi → radical null', async () => {
    await done('u1', 'l5');
    expect(await getCharOfDay(sql, { seed: 'x', userId: 'u1', date: DATE })).toMatchObject({
      char: '你',
      pinyinMarked: 'nǐ',
      definitions: ['you'],
      radical: null,
    });
  });
});
