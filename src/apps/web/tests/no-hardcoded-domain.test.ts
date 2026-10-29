import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

// D16: tên website và tên miền chỉ đọc từ SITE_NAME / SITE_URL. Danh sách mẫu cấm viết cứng:
const FORBIDDEN = [
  /litchi/i,
  /hoctiengtrung/i,
  /tiengtrung\.(vn|com|org)/i,
  /https?:\/\/(?!localhost|127\.0\.0\.1|speech|www\.w3\.org)[a-z0-9-]+\.(vn|com|org|net|io)/i,
];
const ROOTS = ['app', 'components', 'lib'].map((d) => resolve(__dirname, '..', d));
const SKIP = /\.(test|spec)\.tsx?$/;

function walk(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  } catch {
    return [];
  }
}

test('không có tên miền hoặc tên website viết cứng trong app/, components/, lib/', () => {
  const offenders: string[] = [];
  for (const file of ROOTS.flatMap(walk)) {
    if (!/\.(tsx?|css|json)$/.test(file) || SKIP.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const re of FORBIDDEN) if (re.test(text)) offenders.push(`${file} khớp ${re}`);
  }
  expect(offenders).toEqual([]);
});
