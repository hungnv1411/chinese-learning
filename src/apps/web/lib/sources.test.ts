import { describe, expect, test } from 'vitest';
import { loadSources, parseSources } from './sources';

describe('loadSources', () => {
  test('đọc content/sources.yaml thật: đủ trường, id duy nhất', () => {
    const list = loadSources();
    expect(list.length).toBeGreaterThanOrEqual(10);
    expect(new Set(list.map((s) => s.id)).size).toBe(list.length);
    for (const s of list) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.licenseUrl).toMatch(/^https:\/\//);
      expect(s.licenseShort.length).toBeLessThanOrEqual(20);
    }
    expect(list.map((s) => s.id)).toEqual(
      expect.arrayContaining(['cedict', 'tatoeba', 'azure-tts', 'parselmouth']),
    );
  });

  test('chuyển tên trường snake_case sang camelCase', () => {
    const [s] = parseSources(`
- id: x
  name: X
  url: https://x.test
  used_for: Dùng để thử
  license: MIT
  license_short: MIT
  license_url: https://x.test/license
  attribution: Nguồn X
`);
    expect(s).toEqual({
      id: 'x',
      name: 'X',
      url: 'https://x.test',
      usedFor: 'Dùng để thử',
      license: 'MIT',
      licenseShort: 'MIT',
      licenseUrl: 'https://x.test/license',
      attribution: 'Nguồn X',
    });
  });

  test('thiếu trường hoặc URL không phải https thì lỗi', () => {
    expect(() => parseSources('- {id: x, name: X}')).toThrow();
    expect(() =>
      parseSources(
        '- {id: x, name: X, url: http://x.test, used_for: a, license: b, license_short: c, license_url: https://l.test, attribution: d}',
      ),
    ).toThrow();
  });
});
