import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { runMigrations } from './migrate';

// Cần Postgres thật. Đặt TEST_DATABASE_URL trỏ tới một database bất kỳ trên server
// (test tự tạo và xóa một database riêng). Không có biến này thì bỏ qua.
const adminUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!adminUrl)('schema (Postgres thật)', () => {
  const dbName = `clp_test_${randomBytes(4).toString('hex')}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;

  beforeAll(async () => {
    admin = postgres(adminUrl as string, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl as string);
    url.pathname = `/${dbName}`;
    await runMigrations(url.toString()); // migration chạy trên DB trống không lỗi
    sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
  }, 60_000);

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.end();
  });

  async function seed() {
    await sql`INSERT INTO "user" (id, name, email) VALUES ('u1', 'A', 'a@x.test')`;
    await sql`INSERT INTO stage (id, "order", title, has_certificate) VALUES ('hsk1', 1, 'HSK 1', true)`;
    await sql`INSERT INTO unit (id, stage_id, "order", title) VALUES ('hsk1-u01', 'hsk1', 1, 'U1')`;
    await sql`INSERT INTO lesson (id, unit_id, "order", title, content) VALUES ('hsk1-u01-l01', 'hsk1-u01', 1, 'L1', '{}'::jsonb)`;
    await sql`INSERT INTO dict_entry (id, simplified, traditional, pinyin_numbered, pinyin_marked, pinyin_plain, definitions)
              VALUES (1, '好', '好', 'hao3', 'hǎo', 'hao', ARRAY['good'])`;
  }

  test('cột sinh definitions_tsv tìm được theo nghĩa tiếng Anh', async () => {
    await sql`TRUNCATE "user", stage, dict_entry CASCADE`;
    await seed();
    const rows =
      await sql`SELECT id FROM dict_entry WHERE definitions_tsv @@ plainto_tsquery('english', 'good')`;
    expect(rows).toHaveLength(1);
  });

  test('chèn trùng certificate.code bị từ chối', async () => {
    await sql`TRUNCATE "user", stage, dict_entry CASCADE`;
    await seed();
    await sql`INSERT INTO certificate (code, user_id, stage_id, name_on_certificate, score) VALUES ('HSK1-AAAA-BBBB', 'u1', 'hsk1', 'A', 90)`;
    await expect(
      sql`INSERT INTO certificate (code, user_id, stage_id, name_on_certificate, score, revoked) VALUES ('HSK1-AAAA-BBBB', 'u1', 'hsk1', 'A', 90, true)`,
    ).rejects.toThrow(/duplicate key/);
  });

  test('mỗi (user, stage) chỉ một chứng nhận chưa thu hồi', async () => {
    await sql`TRUNCATE "user", stage, dict_entry CASCADE`;
    await seed();
    await sql`INSERT INTO certificate (code, user_id, stage_id, name_on_certificate, score) VALUES ('C1', 'u1', 'hsk1', 'A', 90)`;
    await expect(
      sql`INSERT INTO certificate (code, user_id, stage_id, name_on_certificate, score) VALUES ('C2', 'u1', 'hsk1', 'A', 91)`,
    ).rejects.toThrow(/duplicate key/);
    await sql`UPDATE certificate SET revoked = true WHERE code = 'C1'`;
    await sql`INSERT INTO certificate (code, user_id, stage_id, name_on_certificate, score) VALUES ('C2', 'u1', 'hsk1', 'A', 91)`;
  });

  test('chèn trùng (user_id, dict_entry_id, card_type) bị từ chối', async () => {
    await sql`TRUNCATE "user", stage, dict_entry CASCADE`;
    await seed();
    await sql`INSERT INTO srs_card (user_id, dict_entry_id, card_type, due, source) VALUES ('u1', 1, 'recognize', now(), 'lesson')`;
    await expect(
      sql`INSERT INTO srs_card (user_id, dict_entry_id, card_type, due, source) VALUES ('u1', 1, 'recognize', now(), 'lesson')`,
    ).rejects.toThrow(/duplicate key/);
    await sql`INSERT INTO srs_card (user_id, dict_entry_id, card_type, due, source) VALUES ('u1', 1, 'listen', now(), 'lesson')`;
  });

  test('xóa user xóa dây chuyền dữ liệu của họ, trừ certificate', async () => {
    await sql`TRUNCATE "user", stage, dict_entry CASCADE`;
    await seed();
    await sql`INSERT INTO lesson_progress (user_id, lesson_id) VALUES ('u1', 'hsk1-u01-l01')`;
    await sql`INSERT INTO srs_card (user_id, dict_entry_id, card_type, due, source) VALUES ('u1', 1, 'recognize', now(), 'lesson')`;
    await sql`INSERT INTO daily_activity (user_id, date, seconds) VALUES ('u1', '2026-10-27', 60)`;
    await sql`INSERT INTO user_settings (user_id) VALUES ('u1')`;
    await sql`INSERT INTO session (id, expires_at, token, user_id) VALUES ('s1', now() + interval '1 day', 't1', 'u1')`;
    await sql`INSERT INTO certificate (code, user_id, stage_id, name_on_certificate, score) VALUES ('C1', 'u1', 'hsk1', 'A', 90)`;

    await sql`DELETE FROM "user" WHERE id = 'u1'`;

    for (const t of ['lesson_progress', 'srs_card', 'daily_activity', 'user_settings', 'session']) {
      const rows = await sql.unsafe(`SELECT count(*)::int AS n FROM ${t}`);
      expect(rows[0]?.n, t).toBe(0);
    }
    const certs = await sql`SELECT code, user_id, name_on_certificate FROM certificate`;
    expect(certs).toHaveLength(1);
    expect(certs[0]).toMatchObject({ code: 'C1', user_id: null, name_on_certificate: 'A' });
  });
});
