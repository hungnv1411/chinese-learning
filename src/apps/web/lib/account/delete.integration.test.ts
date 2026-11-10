import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { runMigrations } from '@/db/migrate';
import { deleteAccount } from './delete';

// Cần Postgres thật (xem db/schema.test.ts). Không có TEST_DATABASE_URL thì bỏ qua.
const adminUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!adminUrl)('deleteAccount (Postgres thật)', () => {
  const dbName = `clp_del_${randomBytes(4).toString('hex')}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  let dictId: number;

  beforeAll(async () => {
    admin = postgres(adminUrl as string, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl as string);
    url.pathname = `/${dbName}`;
    await runMigrations(url.toString());
    sql = postgres(url.toString(), { max: 3, onnotice: () => {} });
    await sql`INSERT INTO stage (id, "order", title, has_certificate) VALUES ('hsk1', 1, 'HSK 1', true), ('hsk2', 2, 'HSK 2', true)`;
    await sql`INSERT INTO unit (id, stage_id, "order", title, published) VALUES ('hsk1-u01', 'hsk1', 1, 'U', true)`;
    await sql`INSERT INTO lesson (id, unit_id, "order", title, content) VALUES ('l1', 'hsk1-u01', 1, 'L', ${sql.json({})})`;
    const [d] = await sql<{ id: number }[]>`
      INSERT INTO dict_entry (simplified, traditional, pinyin_numbered, pinyin_marked, pinyin_plain, definitions)
      VALUES ('好', '好', 'hao3', 'hǎo', 'hao', ${['good']}) RETURNING id`;
    dictId = (d as { id: number }).id;
    await sql`INSERT INTO hanzi (char) VALUES ('好')`;
  }, 60_000);

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.end();
  });

  beforeEach(async () => {
    await sql`TRUNCATE "user" CASCADE`;
    await sql`TRUNCATE content_report, verification`;
    for (const [id, email] of [
      ['u1', 'a@x.test'],
      ['u2', 'b@x.test'],
    ] as const) {
      await sql`INSERT INTO "user" (id, name, email) VALUES (${id}, ${'Tên ' + id}, ${email})`;
    }
  });

  /** Tạo dữ liệu ở mọi bảng người dùng cho `uid`. */
  async function populate(uid: string, email: string) {
    await sql`INSERT INTO session (id, expires_at, token, user_id) VALUES (${'s' + uid}, now() + interval '1 day', ${'t' + uid}, ${uid})`;
    await sql`INSERT INTO account (id, account_id, provider_id, user_id) VALUES (${'a' + uid}, 'g', 'google', ${uid})`;
    await sql`INSERT INTO verification (id, identifier, value, expires_at) VALUES (${'v' + uid}, ${email}, 'x', now() + interval '1 day')`;
    await sql`INSERT INTO user_settings (user_id) VALUES (${uid})`;
    await sql`INSERT INTO lesson_progress (user_id, lesson_id, status) VALUES (${uid}, 'l1', 'completed')`;
    await sql`INSERT INTO stage_progress (user_id, stage_id, status, completed_via) VALUES (${uid}, 'hsk1', 'completed', 'lessons')`;
    await sql`INSERT INTO daily_activity (user_id, date, seconds) VALUES (${uid}, '2026-11-10', 60)`;
    await sql`INSERT INTO tone_drill_stat (user_id, tone, correct, total) VALUES (${uid}, 1, 3, 5)`;
    await sql`INSERT INTO char_written (user_id, char) VALUES (${uid}, '好')`;
    const [c] = await sql<{ id: number }[]>`
      INSERT INTO srs_card (user_id, dict_entry_id, card_type, due, source) VALUES (${uid}, ${dictId}, 'recognize', now(), 'lesson') RETURNING id`;
    await sql`INSERT INTO srs_review_log (card_id, rating) VALUES (${(c as { id: number }).id}, 'good')`;
    await sql`INSERT INTO speaking_attempt (user_id, item_ref, score) VALUES (${uid}, 'x', 80)`;
    const [a] = await sql<{ id: string }[]>`
      INSERT INTO exam_attempt (user_id, stage_id, item_ids, deadline_at) VALUES (${uid}, 'hsk1', ${[1, 2]}, now()) RETURNING id`;
    await sql`INSERT INTO content_report (user_id, target_type, target_id, kind) VALUES (${uid}, 'word', '1', 'Sai nghĩa')`;
    const [cert] = await sql<{ id: string }[]>`
      INSERT INTO certificate (code, user_id, stage_id, exam_attempt_id, name_on_certificate, score, pdf_url)
      VALUES (${'HSK1-' + uid.toUpperCase()}, ${uid}, 'hsk1', ${(a as { id: string }).id}, 'Nguyen Van A', 88, ${'https://r2/certificates/x.pdf'})
      RETURNING id`;
    await sql`INSERT INTO certificate_name_change (certificate_id, old_name, new_name) VALUES (${(cert as { id: string }).id}, 'A', 'B')`;
  }

  async function userTables(): Promise<string[]> {
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'user_id' AND table_name <> 'certificate'`;
    return rows.map((r) => r.table_name);
  }

  test('không còn dòng nào có user_id đó ở mọi bảng người dùng, và không còn user', async () => {
    await populate('u1', 'a@x.test');
    await deleteAccount(sql, 'u1');
    for (const t of await userTables()) {
      const [r] = await sql.unsafe(`SELECT count(*)::int AS n FROM "${t}" WHERE user_id = 'u1'`);
      expect(r?.n, t).toBe(0);
    }
    expect((await sql`SELECT count(*)::int AS n FROM "user" WHERE id = 'u1'`)[0]?.n).toBe(0);
    expect((await sql`SELECT count(*)::int AS n FROM srs_review_log`)[0]?.n).toBe(0);
    expect(
      (await sql`SELECT count(*)::int AS n FROM verification WHERE identifier = 'a@x.test'`)[0]?.n,
    ).toBe(0);
  });

  test('chứng nhận còn code, stage_id, issued_at, revoked = true; mọi cột khác null', async () => {
    await populate('u1', 'a@x.test');
    const [before] = await sql`SELECT issued_at FROM certificate WHERE code = 'HSK1-U1'`;
    const out = await deleteAccount(sql, 'u1');
    const rows = await sql`SELECT * FROM certificate`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      code: 'HSK1-U1',
      stage_id: 'hsk1',
      revoked: true,
      user_id: null,
      name_on_certificate: null,
      score: null,
      pdf_url: null,
      exam_attempt_id: null,
    });
    expect(rows[0]?.issued_at).toEqual(before?.issued_at);
    expect((await sql`SELECT count(*)::int AS n FROM certificate_name_change`)[0]?.n).toBe(0);
    expect(out.certificateCodes).toEqual(['HSK1-U1']);
  });

  test('báo lỗi nội dung giữ lại nhưng không còn gắn với người dùng', async () => {
    await populate('u1', 'a@x.test');
    await deleteAccount(sql, 'u1');
    const rows = await sql`SELECT user_id FROM content_report`;
    expect(rows).toEqual([{ user_id: null }]);
  });

  test('không đụng tới dữ liệu của người dùng khác', async () => {
    await populate('u1', 'a@x.test');
    await populate('u2', 'b@x.test');
    await deleteAccount(sql, 'u1');
    for (const t of await userTables()) {
      const [r] = await sql.unsafe(`SELECT count(*)::int AS n FROM "${t}" WHERE user_id = 'u2'`);
      expect(r?.n, t).toBeGreaterThan(0);
    }
    const [c] =
      await sql`SELECT revoked, name_on_certificate FROM certificate WHERE code = 'HSK1-U2'`;
    expect(c).toEqual({ revoked: false, name_on_certificate: 'Nguyen Van A' });
  });

  test('nhiều chứng nhận (hai giai đoạn): tất cả đều bị thu hồi', async () => {
    await populate('u1', 'a@x.test');
    await sql`INSERT INTO certificate (code, user_id, stage_id, name_on_certificate, score)
              VALUES ('HSK2-U1', 'u1', 'hsk2', 'Nguyen Van A', 90)`;
    const out = await deleteAccount(sql, 'u1');
    expect(out.certificateCodes.sort()).toEqual(['HSK1-U1', 'HSK2-U1']);
    expect((await sql`SELECT count(*)::int AS n FROM certificate WHERE revoked`)[0]?.n).toBe(2);
  });

  test('người dùng không tồn tại → ném lỗi, không đổi gì', async () => {
    await populate('u2', 'b@x.test');
    await expect(deleteAccount(sql, 'ghost')).rejects.toThrow();
    expect((await sql`SELECT count(*)::int AS n FROM lesson_progress`)[0]?.n).toBe(1);
  });

  test('lỗi giữa chừng thì không mất gì (transaction)', async () => {
    await populate('u1', 'a@x.test');
    await sql`ALTER TABLE certificate ADD CONSTRAINT tmp_fail CHECK (revoked = false)`;
    await expect(deleteAccount(sql, 'u1')).rejects.toThrow();
    await sql`ALTER TABLE certificate DROP CONSTRAINT tmp_fail`;
    expect((await sql`SELECT count(*)::int AS n FROM "user" WHERE id = 'u1'`)[0]?.n).toBe(1);
    expect(
      (await sql`SELECT name_on_certificate FROM certificate WHERE code = 'HSK1-U1'`)[0]
        ?.name_on_certificate,
    ).toBe('Nguyen Van A');
  });
});
