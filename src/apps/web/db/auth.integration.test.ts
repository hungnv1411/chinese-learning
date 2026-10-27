import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { runMigrations } from './migrate';

// Cần Postgres thật (xem schema.test.ts). Kiểm tra getViewer nhận cả bearer lẫn cookie
// với phiên tạo thẳng trong DB.
const adminUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!adminUrl)('getViewer với phiên thật', () => {
  const dbName = `clp_auth_${randomBytes(4).toString('hex')}`;
  const secret = 'test-secret-0123456789-abcdef';
  let admin: postgres.Sql;
  let sql: postgres.Sql;

  beforeAll(async () => {
    admin = postgres(adminUrl as string, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl as string);
    url.pathname = `/${dbName}`;
    await runMigrations(url.toString());
    sql = postgres(url.toString(), { max: 1, onnotice: () => {} });

    vi.stubEnv('SITE_NAME', 'Test');
    vi.stubEnv('SITE_URL', 'http://localhost:3000');
    vi.stubEnv('DATABASE_URL', url.toString());
    vi.stubEnv('BETTER_AUTH_SECRET', secret);
    vi.stubEnv('GOOGLE_CLIENT_ID', 'id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret');

    await sql`INSERT INTO "user" (id, name, email) VALUES ('u1', 'A', 'a@x.test')`;
    await sql`INSERT INTO session (id, expires_at, token, user_id)
              VALUES ('s1', now() + interval '1 day', 'tok-123', 'u1')`;
  }, 60_000);

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.end();
  });

  test('nhận bearer token', async () => {
    const { getViewer } = await import('@/lib/api/viewer');
    const v = await getViewer(
      new Request('http://localhost:3000/api/x', { headers: { authorization: 'Bearer tok-123' } }),
    );
    expect(v).toEqual({ kind: 'user', userId: 'u1' });
  });

  test('nhận cookie phiên (đã ký)', async () => {
    const { createHmac } = await import('node:crypto');
    const sig = createHmac('sha256', secret).update('tok-123').digest('base64');
    const cookie = `better-auth.session_token=${encodeURIComponent(`tok-123.${sig}`)}`;
    const { getViewer } = await import('@/lib/api/viewer');
    const v = await getViewer(new Request('http://localhost:3000/api/x', { headers: { cookie } }));
    expect(v).toEqual({ kind: 'user', userId: 'u1' });
  });

  test('không có phiên thì là khách', async () => {
    const { getViewer } = await import('@/lib/api/viewer');
    const v = await getViewer(new Request('http://localhost:3000/api/x'));
    expect(v.kind).toBe('guest');
  });
});
