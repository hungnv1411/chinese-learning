import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { runMigrations } from '@/db/migrate';

// Cần Postgres thật (xem db/schema.test.ts). Không có TEST_DATABASE_URL thì bỏ qua.
const adminUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!adminUrl)('stageProgress (Postgres thật)', () => {
  const dbName = `clp_stageprog_${randomBytes(4).toString('hex')}`;
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
    const dict: Record<string, number> = {};
    for (const s of ['你好', '好', '谢谢', '旧']) {
      const [r] = await sql`
        INSERT INTO dict_entry (simplified, traditional, pinyin_numbered, pinyin_marked, pinyin_plain, definitions)
        VALUES (${s}, ${s}, 'x1', 'x', 'x', ${['x']}) RETURNING id`;
      dict[s] = (r as { id: number }).id;
    }
    const word: Record<string, number> = {};
    for (const [s, level, deprecated] of [
      ['你好', 1, false], ['好', 1, false], ['谢谢', 1, false], ['旧', 1, true], ['好', 2, false],
    ] as const) {
      const [r] = await sql`
        INSERT INTO hsk_word (level, simplified, pinyin, dict_entry_id, deprecated)
        VALUES (${level}, ${s}, ${'p' + level + s}, ${dict[s]!}, ${deprecated}) RETURNING id`;
      word[`${s}${level}`] = (r as { id: number }).id;
    }
    for (const c of ['你', '好', '谢', '吃']) await sql`INSERT INTO hanzi (char) VALUES (${c})`;
    await sql`INSERT INTO hsk_char (level, char) VALUES (1, '你'), (1, '好'), (1, '谢'), (1, '吃'), (2, '旧')`;

    const card = (user: string, w: string, type: string, stability: number, over: { reps?: number; suspended?: boolean } = {}) =>
      sql`INSERT INTO srs_card (user_id, dict_entry_id, hsk_word_id, card_type, due, stability, reps, lapses, state, source, suspended)
          VALUES (${user}, ${dict[w.slice(0, -1)]!}, ${word[w]!}, ${type}, now(), ${stability}, ${over.reps ?? 3}, 0, 2, 'lesson', ${over.suspended ?? false})`;
    // 你好: mọi thẻ ≥ 21 ngày → đã thuộc (3 chữ: 你, 好).
    await card('u1', '你好1', 'recognize', 30);
    await card('u1', '你好1', 'listen', 25);
    // 好: một thẻ yếu kéo cả từ xuống → chưa thuộc.
    await card('u1', '好1', 'recognize', 40);
    await card('u1', '好1', 'listen', 5);
    // 谢谢: chỉ có thẻ tắt → không tính.
    await card('u1', '谢谢1', 'recognize', 90, { suspended: true });
    // Người khác không ảnh hưởng.
    await card('u2', '好1', 'recognize', 90);
  }, 60_000);

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.end();
  });

  test('đếm từ và chữ đã thuộc trên tổng của cấp (bỏ từ deprecated)', async () => {
    const { stageProgress } = await import('./progress');
    expect(await stageProgress(sql, 'u1', 'hsk1')).toEqual({
      words: { mastered: 1, total: 3 },
      chars: { mastered: 2, total: 4 },
    });
  });

  test('cấp chưa có thẻ nào thuộc → 0 trên tổng', async () => {
    const { stageProgress } = await import('./progress');
    expect(await stageProgress(sql, 'u1', 'hsk2')).toEqual({
      words: { mastered: 0, total: 1 },
      chars: { mastered: 0, total: 1 },
    });
  });

  test('lộ trình Phát âm không có từ HSK → null', async () => {
    const { stageProgress } = await import('./progress');
    expect(await stageProgress(sql, 'u1', 'pron')).toBeNull();
  });

  test('người chưa có thẻ → 0, không lỗi', async () => {
    const { stageProgress } = await import('./progress');
    await sql`INSERT INTO "user" (id, name, email) VALUES ('u3', 'C', 'c@x.test')`;
    expect((await stageProgress(sql, 'u3', 'hsk1'))?.words).toEqual({ mastered: 0, total: 3 });
  });
});
