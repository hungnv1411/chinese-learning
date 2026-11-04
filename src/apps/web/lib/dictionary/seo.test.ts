import { describe, expect, test } from 'vitest';
import { jsonLdFor, titleFor, descriptionFor } from './seo';
import type { WordEntry } from './word';

const entry = (over: Partial<WordEntry> = {}): WordEntry => ({
  id: 1,
  simplified: '好吃',
  traditional: '好吃',
  pinyinNumbered: 'hao3 chi1',
  pinyinMarked: 'hǎochī',
  definitions: ['tasty', 'delicious'],
  hskLevel: 1,
  pos: null,
  hanViet: 'hảo khật',
  hasAudio: false,
  chars: [],
  ...over,
});

describe('seo', () => {
  test('title theo mẫu của spec, tên website từ cấu hình', () => {
    expect(titleFor([entry()], 'Tên Thử')).toBe(
      '好吃 hǎochī – nghĩa, cách đọc, Hán Việt hảo khật | Tên Thử',
    );
  });

  test('title không có Hán Việt thì bỏ phần đó; nhiều cách đọc thì ghép', () => {
    expect(titleFor([entry({ hanViet: null })], 'X')).toBe('好吃 hǎochī – nghĩa, cách đọc | X');
    expect(titleFor([entry(), entry({ pinyinMarked: 'hàochī' })], 'X')).toContain('hǎochī, hàochī');
  });

  test('description gồm pinyin và các nghĩa đầu, không quá 160 ký tự', () => {
    const d = descriptionFor([entry({ definitions: Array(30).fill('some long meaning here') })]);
    expect(d.startsWith('好吃 (hǎochī): some long meaning here')).toBe(true);
    expect(d.length).toBeLessThanOrEqual(160);
  });

  test('JSON-LD DefinedTerm, URL từ SITE_URL, thoát "<" để không phá thẻ script', () => {
    const ld = jsonLdFor([entry({ definitions: ['a </script> b'] })], 'https://site.test');
    const parsed = JSON.parse(ld);
    expect(parsed).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'DefinedTerm',
      name: '好吃',
      termCode: 'hǎochī',
      url: `https://site.test/tu/${encodeURIComponent('好吃')}`,
      inDefinedTermSet: 'CC-CEDICT',
    });
    expect(ld).not.toContain('</script>');
  });
});
