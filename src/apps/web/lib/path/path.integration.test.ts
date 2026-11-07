import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { runMigrations } from '@/db/migrate';
import { ApiError } from '@/lib/api/errors';

// Cần Postgres thật (xem db/schema.test.ts). Không có TEST_DATABASE_URL thì bỏ qua.
const adminUrl = process.env.TEST_DATABASE_URL;

const content = (over: Record<string, unknown> = {}) => ({
  contentVersion: 'abc123def456',
  type: 'normal',
  newWords: [{ word: '你', hskWordId: null, extra: false }, { word: '好', hskWordId: null, extra: false }],
  newChars: ['你', '好'],
  sentences: [],
  tips: {},
  steps: [
    { kind: 'intro', word: '你' },
    { kind: 'exercise', type: 'listen_pick_hanzi', ref: '你' },
    { kind: 'writing', char: '你' },
    { kind: 'speaking', mode: 'word', ref: '你' },
  ],
  ...over,
});

describe.skipIf(!adminUrl)('lộ trình (Postgres thật)', () => {
  const dbName = `clp_path_${randomBytes(4).toString('hex')}`;
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
    await sql`INSERT INTO stage (id, "order", title, has_certificate, exam_open)
              VALUES ('pron', 0, 'Phát âm', false, false), ('hsk1', 1, 'HSK 1', true, true)`;
    await sql`INSERT INTO unit (id, stage_id, "order", title, published) VALUES
              ('pron-u01', 'pron', 1, 'Thanh điệu', true),
              ('pron-u02', 'pron', 2, 'Vần', true),
              ('hsk1-u01', 'hsk1', 1, 'Chào hỏi', false)`;
    for (const [id, unit, order, kind] of [
      ['pron-u01-l01', 'pron-u01', 1, 'normal'],
      ['pron-u01-l02', 'pron-u01', 2, 'normal'],
      ['pron-u01-cp', 'pron-u01', 3, 'checkpoint'],
      ['pron-u02-l01', 'pron-u02', 1, 'normal'],
      ['hsk1-u01-l01', 'hsk1-u01', 1, 'normal'],
    ] as const) {
      await sql`INSERT INTO lesson (id, unit_id, "order", title, kind, estimated_minutes, content)
                VALUES (${id}, ${unit}, ${order}, ${'Bài ' + id}, ${kind}, 7, ${sql.json(content({ type: kind }))})`;
    }
    await sql`INSERT INTO content_meta (key, value) VALUES ('content_version', 'v1')`;
  }, 60_000);

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.end();
  });

  beforeEach(async () => {
    await sql`TRUNCATE lesson_progress, stage_progress`;
  });

  const lessonDone = (id: string, status = 'completed') =>
    sql`INSERT INTO lesson_progress (user_id, lesson_id, status) VALUES ('u1', ${id}, ${status})`;

  describe('assertLessonOpen', () => {
    test('bài khóa → 403 LESSON_LOCKED', async () => {
      const { assertLessonOpen } = await import('./guard');
      const err = await assertLessonOpen(sql, 'u1', 'pron-u01-l02').catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err).toMatchObject({ status: 403, code: 'LESSON_LOCKED' });
    });

    test('bài đầu mở; bài đang làm dở mở; học lại bài đã xong cho phép', async () => {
      const { assertLessonOpen } = await import('./guard');
      await expect(assertLessonOpen(sql, 'u1', 'pron-u01-l01')).resolves.toBeUndefined();
      await lessonDone('pron-u01-l01');
      await expect(assertLessonOpen(sql, 'u1', 'pron-u01-l01')).resolves.toBeUndefined();
      await expect(assertLessonOpen(sql, 'u1', 'pron-u01-l02')).resolves.toBeUndefined();
    });

    test('bài không tồn tại → 404', async () => {
      const { assertLessonOpen } = await import('./guard');
      await expect(assertLessonOpen(sql, 'u1', 'nope')).rejects.toMatchObject({ status: 404 });
    });

    test('bài của lộ trình khóa hoặc chủ đề chưa phát hành bị chặn', async () => {
      const { assertLessonOpen } = await import('./guard');
      await expect(assertLessonOpen(sql, 'u1', 'hsk1-u01-l01')).rejects.toMatchObject({ code: 'LESSON_LOCKED' });
      await expect(assertLessonOpen(sql, 'u1', 'pron-u02-l01')).rejects.toMatchObject({ code: 'LESSON_LOCKED' });
    });
  });

  describe('GET /api/path', () => {
    const get = async (headers: Record<string, string> = { authorization: 'Bearer tok-123' }) => {
      const { GET } = await import('@/app/api/path/route');
      return GET(new Request('http://localhost:3000/api/path', { headers }));
    };

    test('khách → 401 theo định dạng lỗi chuẩn', async () => {
      const res = await get({});
      expect(res.status).toBe(401);
      expect((await res.json()).error.code).toBe('UNAUTHORIZED');
    });

    test('trả trạng thái khóa/mở và dữ liệu hiển thị', async () => {
      await lessonDone('pron-u01-l01', 'completed');
      await lessonDone('pron-u01-l02', 'in_progress');
      const body = await (await get()).json();
      expect(body.contentVersion).toBe('v1');
      expect(body.skipExam).toBeNull();

      const pron = body.stages.find((s: { id: string }) => s.id === 'pron');
      expect(pron).toMatchObject({ title: 'Phát âm', status: 'available' });
      const u1 = pron.units[0];
      expect(u1).toMatchObject({ id: 'pron-u01', status: 'available', doneCount: 1, total: 3 });
      expect(u1.sampleWords).toEqual(['你', '好']);
      const [l1, l2, cp] = u1.lessons;
      expect(l1).toMatchObject({
        id: 'pron-u01-l01', status: 'completed', keyChar: '你', newWordCount: 2,
        estimatedMinutes: 7, lockReason: null,
      });
      expect(l1.skills).toEqual(['listen', 'write', 'speak']);
      expect(l2.status).toBe('in_progress');
      expect(cp).toMatchObject({ status: 'locked', lockReason: { kind: 'prev_lesson', lessonId: 'pron-u01-l02' } });
      expect(pron.units[1]).toMatchObject({ status: 'locked' });

      const hsk1 = body.stages.find((s: { id: string }) => s.id === 'hsk1');
      expect(hsk1.status).toBe('locked');
      expect(hsk1.units[0].status).toBe('coming_soon');
      expect(hsk1.finalExam).toBe('locked');
    });

    test('keyChar chỉ có ở bài đã xong', async () => {
      const body = await (await get()).json();
      const l1 = body.stages[0].units[0].lessons[0];
      expect(l1.status).toBe('available');
      expect(l1.keyChar).toBeNull();
    });
  });
});
