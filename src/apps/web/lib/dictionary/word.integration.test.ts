import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { runMigrations } from '@/db/migrate';
import { getWordPage } from './word';

// Cần Postgres thật (xem db/schema.test.ts). Không có TEST_DATABASE_URL thì bỏ qua.
const adminUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!adminUrl)('getWordPage (Postgres thật)', () => {
  const dbName = `clp_word_${randomBytes(4).toString('hex')}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;

  const entry = async (
    s: string,
    t: string,
    num: string,
    marked: string,
    defs: string[],
    hsk: number | null,
    variant = false,
    order = 1,
  ) => {
    const [r] = await sql<{ id: number }[]>`
      INSERT INTO dict_entry (simplified, traditional, pinyin_numbered, pinyin_marked, pinyin_plain,
        definitions, hsk_level, is_variant_or_surname, cedict_order)
      VALUES (${s}, ${t}, ${num}, ${marked}, ${num.replace(/[\s1-5]/g, '').toLowerCase()},
        ${defs}, ${hsk}, ${variant}, ${order}) RETURNING id`;
    return (r as { id: number }).id;
  };

  let xing: number;
  let haochi: number;
  const sentenceIds: number[] = [];

  beforeAll(async () => {
    admin = postgres(adminUrl as string, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl as string);
    url.pathname = `/${dbName}`;
    await runMigrations(url.toString());
    sql = postgres(url.toString(), { max: 2, onnotice: () => {} });

    xing = await entry('行', '行', 'xing2', 'xíng', ['to walk', 'to go', 'OK'], 1, false, 1);
    await entry('行', '行', 'hang2', 'háng', ['row', 'profession'], null, false, 2);
    await entry('好', '好', 'hao3', 'hǎo', ['good'], 1, false, 3);
    haochi = await entry(
      '好吃',
      '好吃',
      'hao3 chi1',
      'hǎochī',
      ['tasty', 'delicious'],
      1,
      false,
      4,
    );
    await entry('吃', '吃', 'chi1', 'chī', ['to eat'], 1, false, 5);
    await entry('好吃', '好喫', 'hao4 chi1', 'hàochī', ['gluttonous'], null, false, 6);
    await entry('壮', '壯', 'zhuang4', 'zhuàng', ['strong'], 3, false, 7);
    // Từ chứa 好/吃: 14 từ thường, 1 họ, 1 biến thể
    for (let i = 0; i < 14; i++)
      await entry(
        `好${'甲乙丙丁戊己庚辛壬癸子丑寅卯'[i]}`,
        'x',
        `hao3 a${i}`,
        'x',
        ['w'],
        i < 3 ? 2 : null,
        false,
        20 + i,
      );
    await entry('吃郝', 'x', 'chi1 hao3', 'x', ['surname thing'], null, true, 40);

    await sql`INSERT INTO hsk_word (level, simplified, pinyin, pos, dict_entry_id)
              VALUES (1, '行', 'xíng', 'V', ${xing}), (1, '好吃', 'hǎochī', 'Adj', ${haochi})`;
    await sql`INSERT INTO radical_vi (radical, number, name_vi, meaning_vi)
              VALUES ('女', 38, 'nữ', 'phụ nữ'), ('口', 30, 'khẩu', 'cái miệng')`;
    await sql`INSERT INTO hanzi (char, han_viet, radical) VALUES
              ('好', ${['hảo', 'hiếu']}, '女'), ('吃', ${['khật']}, '口')`;
    await sql`INSERT INTO audio_asset (key, url, text, voice, hash)
              VALUES ('word/xiaoxiao/好吃_hao3chi1.mp3', 'https://r2.test/a', '好吃', 'xiaoxiao', 'h1')`;

    // 7 câu cho 好吃: ưu tiên cấp thấp rồi ngắn; chỉ 5 câu được lấy
    const levels = [3, 1, 2, 1, 7, 2, 1];
    for (const [i, lv] of levels.entries()) {
      const [s] = await sql<{ id: number }[]>`
        INSERT INTO sentence (zh, pinyin, en, source, source_ref, max_hsk_level, audio_url)
        VALUES (${'好吃的东西'.repeat(1 + (i % 3))}, 'p', ${'e' + i}, 'tatoeba', ${String(900 + i)},
                ${lv}, ${i === 1 ? 'https://r2.test/s1.mp3' : null}) RETURNING id`;
      sentenceIds.push((s as { id: number }).id);
      await sql`INSERT INTO sentence_word (sentence_id, dict_entry_id) VALUES (${(s as { id: number }).id}, ${haochi})`;
    }
  }, 60_000);

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.end();
  });

  test('từ không có → null', async () => {
    expect(await getWordPage(sql, '不存在')).toBeNull();
  });

  test('行 có 2 mục (xíng trước, rồi háng), mỗi mục có Hán Việt/nhãn riêng', async () => {
    const page = await getWordPage(sql, '行');
    expect(page?.entries.map((e) => e.pinyinMarked)).toEqual(['xíng', 'háng']);
    expect(page?.entries[0]).toMatchObject({ hskLevel: 1, pos: 'V' });
    expect(page?.entries[1]).toMatchObject({ hskLevel: null, pos: null });
    expect(page?.entries[0]?.definitions).toEqual(['to walk', 'to go', 'OK']);
  });

  test('好吃: Hán Việt ghép, từng chữ có pinyin, Hán Việt và bộ thủ tiếng Việt', async () => {
    const page = await getWordPage(sql, '好吃');
    const e = page?.entries[0];
    expect(page?.entries).toHaveLength(2);
    expect(e).toMatchObject({
      simplified: '好吃',
      hanViet: 'hảo khật',
      pos: 'Adj',
      hasAudio: true,
    });
    expect(page?.entries[1]?.hasAudio).toBe(false);
    expect(e?.chars).toEqual([
      {
        char: '好',
        pinyinNumbered: 'hao3',
        hanViet: ['hảo', 'hiếu'],
        radical: { radical: '女', nameVi: 'nữ', meaningVi: 'phụ nữ' },
      },
      {
        char: '吃',
        pinyinNumbered: 'chi1',
        hanViet: ['khật'],
        radical: { radical: '口', nameVi: 'khẩu', meaningVi: 'cái miệng' },
      },
    ]);
  });

  test('chữ chưa có trong bảng hanzi vẫn có thẻ, thiếu Hán Việt và bộ thủ', async () => {
    const page = await getWordPage(sql, '壮');
    expect(page?.entries[0]?.chars).toEqual([
      { char: '壮', pinyinNumbered: 'zhuang4', hanViet: [], radical: null },
    ]);
    expect(page?.entries[0]?.hanViet).toBeNull();
  });

  test('câu ví dụ: tối đa 5, cấp thấp trước rồi ngắn trước, có link Tatoeba và audio', async () => {
    const page = await getWordPage(sql, '好吃');
    const s = page?.sentences ?? [];
    expect(s).toHaveLength(5);
    expect(s.map((x) => x.maxHskLevel)).toEqual([1, 1, 1, 2, 2]);
    const lengths = s.slice(0, 3).map((x) => x.zh.length);
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
    expect(s.every((x) => x.source === 'tatoeba' && x.sourceRef)).toBe(true);
    expect(s.some((x) => x.audioUrl === 'https://r2.test/s1.mp3')).toBe(true);
  });

  test('từ cùng chữ: tối đa 12, có cấp HSK trước, bỏ chính nó và họ/biến thể', async () => {
    const page = await getWordPage(sql, '好吃');
    const r = page?.related ?? [];
    expect(r).toHaveLength(12);
    expect(r.map((x) => x.simplified)).not.toContain('好吃');
    expect(r.map((x) => x.simplified)).not.toContain('吃郝');
    expect(r.slice(0, 4).map((x) => x.hskLevel)).toEqual([1, 1, 2, 2]); // 好 (1), 吃 (1), rồi HSK 2
    expect(new Set(r.map((x) => x.simplified)).size).toBe(r.length);
  });

  test('từ không có câu và không có từ liên quan → mảng rỗng', async () => {
    const page = await getWordPage(sql, '壮');
    expect(page?.sentences).toEqual([]);
    expect(page?.related).toEqual([]);
  });
});
