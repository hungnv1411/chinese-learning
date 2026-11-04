import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { runMigrations } from '@/db/migrate';
import { resetRateLimits } from '@/lib/api/rate-limit';

// Cần Postgres thật (xem db/schema.test.ts). Không có TEST_DATABASE_URL thì bỏ qua.
const adminUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!adminUrl)('POST /api/reports (Postgres thật)', () => {
  const dbName = `clp_rep_${randomBytes(4).toString('hex')}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;

  beforeAll(async () => {
    admin = postgres(adminUrl as string, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl as string);
    url.pathname = `/${dbName}`;
    await runMigrations(url.toString());
    sql = postgres(url.toString(), { max: 2, onnotice: () => {} });
    vi.stubEnv('SITE_NAME', 'Test');
    vi.stubEnv('SITE_URL', 'http://localhost:3000');
    vi.stubEnv('DATABASE_URL', url.toString());
    vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-0123456789-abcdef');
    vi.stubEnv('GOOGLE_CLIENT_ID', 'id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret');
    await sql`INSERT INTO "user" (id, name, email) VALUES ('u1', 'A', 'a@x.test')`;
    await sql`INSERT INTO session (id, expires_at, token, user_id)
              VALUES ('s1', now() + interval '1 day', 'tok-123', 'u1')`;
    await sql`INSERT INTO stage (id, "order", title, has_certificate) VALUES ('hsk1', 1, 'HSK 1', true)`;
    await sql`INSERT INTO unit (id, stage_id, "order", title) VALUES ('hsk1-u01', 'hsk1', 1, 'U1')`;
    await sql`INSERT INTO lesson (id, unit_id, "order", title, content)
              VALUES ('hsk1-u01-l01', 'hsk1-u01', 1, 'L1', ${sql.json({ contentVersion: 'abc123def456' })})`;
    await sql`INSERT INTO lesson (id, unit_id, "order", title, content)
              VALUES ('hsk1-u01-l02', 'hsk1-u01', 2, 'L2', ${sql.json({})})`;
    await sql`INSERT INTO content_meta (key, value) VALUES ('content_version', 'gitsha1')`;
  }, 60_000);

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.end();
  });

  beforeEach(async () => {
    resetRateLimits();
    await sql`TRUNCATE content_report`;
  });

  const post = async (body: unknown, headers: Record<string, string> = {}) => {
    const { POST } = await import('@/app/api/reports/route');
    return POST(
      new Request('http://localhost:3000/api/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.1.1.1', ...headers },
        body: JSON.stringify(body),
      }),
    );
  };
  const rows = () => sql`SELECT * FROM content_report ORDER BY id`;

  test('khách gửi được: lưu đối tượng, trình duyệt và content_version chung', async () => {
    const res = await post(
      { target: { kind: 'word', id: '好吃' }, kind: 'pinyin', description: 'sai thanh' },
      { 'user-agent': 'TestAgent/1.0' },
    );
    expect(res.status).toBe(201);
    const [r] = await rows();
    expect(r).toMatchObject({
      user_id: null,
      target_type: 'word',
      target_id: '好吃',
      kind: 'pinyin',
      description: 'sai thanh',
      status: 'open',
      user_agent: 'TestAgent/1.0',
      content_version: 'gitsha1',
    });
  });

  test('báo từ bài tập có content_version của bài (không tin client)', async () => {
    await post({
      target: { kind: 'lesson', id: 'hsk1-u01-l01' },
      kind: 'meaning',
      contentVersion: 'client-gui-gia',
    });
    const [r] = await rows();
    expect(r?.content_version).toBe('abc123def456');
  });

  test('bài chưa có contentVersion hoặc không tồn tại → dùng bản chung', async () => {
    await post({ target: { kind: 'lesson', id: 'hsk1-u01-l02' }, kind: 'other' });
    await post({ target: { kind: 'lesson', id: 'khong-co' }, kind: 'other' });
    expect((await rows()).map((r) => r.content_version)).toEqual(['gitsha1', 'gitsha1']);
  });

  test('báo lỗi chung: target_id rỗng', async () => {
    await post({ target: { kind: 'general' }, kind: 'other' });
    const [r] = await rows();
    expect(r).toMatchObject({ target_type: 'general', target_id: '' });
  });

  test('người đã đăng nhập (bearer) được gắn user_id', async () => {
    const res = await post(
      { target: { kind: 'sentence', id: '12345' }, kind: 'sentence' },
      { authorization: 'Bearer tok-123' },
    );
    expect(res.status).toBe(201);
    expect((await rows())[0]?.user_id).toBe('u1');
  });

  test('mô tả 501 ký tự → 400, không lưu', async () => {
    const res = await post({
      target: { kind: 'word', id: 'x' },
      kind: 'other',
      description: 'a'.repeat(501),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
    expect(await rows()).toHaveLength(0);
  });

  test('khách báo cáo thứ 11 trong ngày → 429; IP khác và người đăng nhập không bị ảnh hưởng', async () => {
    const body = { target: { kind: 'general' }, kind: 'other' };
    for (let i = 0; i < 10; i++) expect((await post(body)).status).toBe(201);
    const res = await post(body);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    expect((await post(body, { 'x-forwarded-for': '2.2.2.2' })).status).toBe(201);
    expect((await post(body, { authorization: 'Bearer tok-123' })).status).toBe(201);
    expect(await rows()).toHaveLength(12);
  });
});
