import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { runMigrations } from '@/db/migrate';
import { resetRateLimits } from '@/lib/api/rate-limit';
import { searchDictionary } from './search';

// Cần Postgres thật (xem db/schema.test.ts). Không có TEST_DATABASE_URL thì bỏ qua.
const adminUrl = process.env.TEST_DATABASE_URL;

type Seed = [string, string, string, string, string[], number | null, boolean, number];
// [simplified, traditional, pinyin_numbered, pinyin_marked, definitions, hsk, variantOrSurname, order]
const ENTRIES: Seed[] = [
  ['好', '好', 'hao3', 'hǎo', ['good', 'well'], 1, false, 10],
  ['好', '好', 'hao4', 'hào', ['to be fond of'], 5, false, 11],
  ['号', '號', 'hao4', 'hào', ['number', 'day of the month'], 2, false, 12],
  ['好吃', '好吃', 'hao3 chi1', 'hǎochī', ['tasty'], 2, false, 13],
  ['你好', '你好', 'ni3 hao3', 'nǐhǎo', ['hello'], 1, false, 14],
  ['看', '看', 'kan4', 'kàn', ['to see', 'to look at', 'to read'], 1, false, 15],
  ['看看', '看看', 'kan4 kan5', 'kànkan', ['to have a look'], null, false, 16],
  ['瞧', '瞧', 'qiao2', 'qiáo', ['to look', 'to see'], null, false, 17],
  ['郝', '郝', 'Hao3', 'Hǎo', ['surname Hao'], null, true, 18],
  ['蒿', '蒿', 'hao1', 'hāo', ['artemisia'], null, false, 19],
];
const HANZI: [string, string[]][] = [
  ['好', ['hảo', 'hiếu']],
  ['吃', ['ngật']],
  ['你', ['nễ']],
  ['号', ['hiệu']],
  ['看', ['khán']],
  ['郝', ['hách']],
];

describe.skipIf(!adminUrl)('tìm kiếm từ điển (Postgres thật)', () => {
  const dbName = `clp_dict_${randomBytes(4).toString('hex')}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  let dbUrl: string;

  beforeAll(async () => {
    admin = postgres(adminUrl as string, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl as string);
    url.pathname = `/${dbName}`;
    dbUrl = url.toString();
    await runMigrations(dbUrl);
    sql = postgres(dbUrl, { max: 2, onnotice: () => {} });
    for (const [s, t, num, marked, defs, hsk, variant, order] of ENTRIES) {
      await sql`INSERT INTO dict_entry (simplified, traditional, pinyin_numbered, pinyin_marked,
        pinyin_plain, definitions, hsk_level, is_variant_or_surname, cedict_order)
        VALUES (${s}, ${t}, ${num}, ${marked}, ${num.replace(/[\s1-5]/g, '').toLowerCase()},
        ${defs}, ${hsk}, ${variant}, ${order})`;
    }
    for (const [ch, hv] of HANZI)
      await sql`INSERT INTO hanzi (char, han_viet) VALUES (${ch}, ${hv})`;
  }, 60_000);

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.end();
  });

  const search = async (
    q: string,
    chip: 'all' | 'hanzi' | 'pinyin' | 'english' | 'hanviet' = 'all',
  ) => {
    const res = await searchDictionary(sql, { q, chip, offset: 0, limit: 30 });
    return res.groups;
  };
  const words = (g: { items: { simplified: string }[] }) => g.items.map((i) => i.simplified);
  const keys = (g: { items: { simplified: string; pinyinNumbered: string }[] }) =>
    g.items.map((i) => `${i.simplified}:${i.pinyinNumbered}`);

  test('好 → 好 đầu tiên, rồi 好吃, rồi 你好', async () => {
    const [g] = await search('好');
    expect(g?.kind).toBe('hanzi');
    expect(words(g as never)).toEqual(['好', '好', '好吃', '你好']);
    expect(keys(g as never)[0]).toBe('好:hao3');
  });

  test('hao → 好 trước 号; mục họ xếp sau mục thường cùng loại', async () => {
    const groups = await search('hao');
    const pin = groups.find((g) => g.kind === 'pinyin');
    const k = keys(pin as never);
    expect(k.indexOf('好:hao3')).toBeLessThan(k.indexOf('号:hao4'));
    expect(k.indexOf('蒿:hao1')).toBeLessThan(k.indexOf('郝:Hao3'));
    expect(k).toContain('好吃:hao3 chi1'); // khớp đầu
  });

  test('hao3 → có hao3, không có 号 (hao4) hay 蒿 (hao1)', async () => {
    const [g] = await search('hao3');
    expect(g?.kind).toBe('pinyin');
    const k = keys(g as never);
    expect(k).toContain('好:hao3');
    expect(k).toContain('好吃:hao3 chi1');
    expect(k).not.toContain('号:hao4');
    expect(k).not.toContain('蒿:hao1');
    // Họ (variant/surname) xếp sau mục thường cùng tầng khớp; 郝 khớp đúng nên vẫn trước nhóm "khớp đầu".
    expect(k.indexOf('好:hao3')).toBeLessThan(k.indexOf('郝:Hao3'));
    expect(k.indexOf('郝:Hao3')).toBeLessThan(k.indexOf('好吃:hao3 chi1'));
  });

  test('hǎo chī và hao3 chi → 好吃', async () => {
    for (const q of ['hǎo chī', 'hao3 chi', 'haochi']) {
      const groups = await search(q);
      expect(words(groups[0] as never)).toEqual(['好吃']);
    }
  });

  test('look → 看 (HSK 1) trước các mục ít dùng; chỉ nhóm english', async () => {
    const groups = await search('look');
    expect(groups.map((g) => g.kind)).toEqual(['english']);
    const w = words(groups[0] as never);
    expect(w[0]).toBe('看');
    expect(w).toEqual(expect.arrayContaining(['看看', '瞧']));
  });

  test('he vừa pinyin vừa english: trả hai nhóm có tiêu đề riêng', async () => {
    const groups = await search('hello');
    expect(groups.map((g) => g.kind)).toEqual(['english']);
    const two = await search('hao');
    expect(two.map((g) => g.kind)).toEqual(['pinyin', 'english']);
  });

  test('Hán Việt: hảo → 好 rồi các từ chứa 好 (HSK thấp trước); hao + chip cũng vậy', async () => {
    const [g] = await search('hảo');
    expect(g?.kind).toBe('hanviet');
    expect(words(g as never)).toEqual(['好', '好', '你好', '好吃']);
    const [g2] = await search('hao', 'hanviet');
    expect(words(g2 as never)).toEqual(['好', '好', '你好', '好吃']);
    const [g3] = await search('hiếu');
    expect(words(g3 as never)).toEqual(['好', '好', '你好', '好吃']);
  });

  test('mỗi dòng có Hán Việt ghép từ từng chữ', async () => {
    const [g] = await search('好吃');
    expect(g?.items[0]).toMatchObject({ simplified: '好吃', hanViet: 'hảo ngật', hskLevel: 2 });
    const [one] = await search('号');
    expect(one?.items[0]?.hanViet).toBe('hiệu');
    const [none] = await search('瞧');
    expect(none?.items[0]?.hanViet).toBeNull(); // 瞧 chưa có Hán Việt
  });

  test('phân trang: limit/offset và hasMore', async () => {
    const p1 = await searchDictionary(sql, { q: 'hao', chip: 'pinyin', offset: 0, limit: 2 });
    expect(p1.groups[0]?.items).toHaveLength(2);
    expect(p1.groups[0]?.hasMore).toBe(true);
    const p2 = await searchDictionary(sql, { q: 'hao', chip: 'pinyin', offset: 2, limit: 30 });
    expect(p2.groups[0]?.hasMore).toBe(false);
    const all = await searchDictionary(sql, { q: 'hao', chip: 'pinyin', offset: 0, limit: 30 });
    expect([...(p1.groups[0]?.items ?? []), ...(p2.groups[0]?.items ?? [])]).toEqual(
      all.groups[0]?.items,
    );
  });

  test('ký tự đặc biệt LIKE không gây khớp tràn', async () => {
    expect(await search('%')).toEqual([{ kind: 'english', items: [], hasMore: false }]);
    expect((await search('好%', 'hanzi'))[0]?.items).toEqual([]);
  });

  test('từ khóa rỗng → không có nhóm', async () => {
    expect(await search('   ')).toEqual([]);
  });

  describe('GET /api/dictionary/search', () => {
    beforeEach(resetRateLimits);
    const call = async (qs: string, ip = '1.1.1.1') => {
      vi.stubEnv('SITE_NAME', 'Test');
      vi.stubEnv('SITE_URL', 'http://localhost:3000');
      vi.stubEnv('DATABASE_URL', dbUrl);
      vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-0123456789-abcdef');
      vi.stubEnv('GOOGLE_CLIENT_ID', 'id');
      vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret');
      const { GET } = await import('@/app/api/dictionary/search/route');
      return GET(
        new Request(`http://localhost:3000/api/dictionary/search?${qs}`, {
          headers: { 'x-forwarded-for': ip },
        }),
      );
    };

    test('trả { groups, nextCursor }', async () => {
      const res = await call('q=hao&chip=pinyin');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.groups[0].kind).toBe('pinyin');
      expect(body.groups[0].items[0]).toMatchObject({ simplified: '好', pinyinMarked: 'hǎo' });
      expect(body.nextCursor).toBeNull();
    });

    test('lần gọi thứ 61 trong phút → 429', async () => {
      for (let i = 0; i < 60; i++) expect((await call('q=好', '9.9.9.9')).status).toBe(200);
      const res = await call('q=好', '9.9.9.9');
      expect(res.status).toBe(429);
      expect((await res.json()).error.code).toBe('RATE_LIMITED');
      expect((await call('q=好', '8.8.8.8')).status).toBe(200); // IP khác không bị ảnh hưởng
    });

    test('q quá dài hoặc chip lạ → 400', async () => {
      expect((await call(`q=${'a'.repeat(101)}`)).status).toBe(400);
      expect((await call('q=a&chip=zzz')).status).toBe(400);
      expect((await call('q=a&cursor=abc')).status).toBe(400);
    });
  });
});
