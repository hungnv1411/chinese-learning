import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { runMigrations } from '@/db/migrate';
import { MAX_SECONDS_PER_REPORT, addActiveSeconds, localDate } from './record';

const adminUrl = process.env.TEST_DATABASE_URL;

describe('localDate', () => {
  const t = new Date('2026-11-09T18:30:00Z'); // 01:30 ngày 10 ở Việt Nam
  test('theo múi giờ của người dùng', () => {
    expect(localDate(t, 'Asia/Ho_Chi_Minh')).toBe('2026-11-10');
    expect(localDate(t, 'UTC')).toBe('2026-11-09');
    expect(localDate(t, 'America/Los_Angeles')).toBe('2026-11-09');
  });
  test('múi giờ sai → mặc định Asia/Ho_Chi_Minh', () => {
    expect(localDate(t, 'Not/AZone')).toBe('2026-11-10');
    expect(localDate(t, undefined)).toBe('2026-11-10');
  });
});

describe.skipIf(!adminUrl)('addActiveSeconds (Postgres thật)', () => {
  const dbName = `clp_act_${randomBytes(4).toString('hex')}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  const now = new Date('2026-11-10T08:00:00Z');

  beforeAll(async () => {
    admin = postgres(adminUrl as string, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl as string);
    url.pathname = `/${dbName}`;
    await runMigrations(url.toString());
    sql = postgres(url.toString(), { max: 2, onnotice: () => {} });
    await sql`INSERT INTO "user" (id, name, email) VALUES ('u1', 'A', 'a@x.test')`;
  }, 60_000);
  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.end();
  });
  beforeEach(async () => {
    await sql`TRUNCATE daily_activity`;
  });

  const rows = () =>
    sql<{ date: string; seconds: number }[]>`SELECT date::text, seconds FROM daily_activity`;

  test('lần đầu tạo dòng của ngày', async () => {
    const r = await addActiveSeconds(sql, 'u1', { seconds: 45, now });
    expect(r).toEqual({ date: '2026-11-10', seconds: 45 });
    expect(await rows()).toEqual([{ date: '2026-11-10', seconds: 45 }]);
  });

  test('cộng dồn trong cùng ngày, không tạo dòng mới', async () => {
    await addActiveSeconds(sql, 'u1', { seconds: 45, now });
    const r = await addActiveSeconds(sql, 'u1', { seconds: 30, now });
    expect(r.seconds).toBe(75);
    expect((await rows()).length).toBe(1);
  });

  test('sang ngày mới (theo múi giờ) thì dòng mới', async () => {
    await addActiveSeconds(sql, 'u1', { seconds: 10, now, tz: 'UTC' });
    await addActiveSeconds(sql, 'u1', { seconds: 10, now, tz: 'Pacific/Pago_Pago' });
    expect((await rows()).map((x) => x.date).sort()).toEqual(['2026-11-09', '2026-11-10']);
  });

  test('server chặn số giây quá lớn trong một lần gửi', async () => {
    const r = await addActiveSeconds(sql, 'u1', { seconds: 99_999, now });
    expect(r.seconds).toBe(MAX_SECONDS_PER_REPORT);
  });

  test('số âm, 0, NaN, số lẻ', async () => {
    expect((await addActiveSeconds(sql, 'u1', { seconds: -5, now })).seconds).toBe(0);
    expect((await addActiveSeconds(sql, 'u1', { seconds: Number.NaN, now })).seconds).toBe(0);
    expect((await addActiveSeconds(sql, 'u1', { seconds: 7.9, now })).seconds).toBe(7);
    expect((await rows())[0]?.seconds).toBe(7);
  });
});
