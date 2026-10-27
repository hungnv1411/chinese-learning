import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const root = resolve(__dirname, '..');
const css = readFileSync(resolve(root, 'styles/fonts.css'), 'utf8');

test('Mona Sans tự host: họ phông khớp token và đủ 3 tập con (latin, latin-ext, vietnamese)', () => {
  expect(readFileSync(resolve(root, 'styles/tokens.css'), 'utf8')).toContain('"Mona Sans"');
  expect(css.match(/font-family: 'Mona Sans'/g)).toHaveLength(3);
  for (const subset of ['latin', 'latin-ext', 'vietnamese']) {
    expect(css).toContain(`/fonts/mona-sans-${subset}-wght-normal.woff2`);
    expect(existsSync(resolve(root, `public/fonts/mona-sans-${subset}-wght-normal.woff2`))).toBe(
      true,
    );
  }
});

test('có file giấy phép OFL cạnh phông', () => {
  expect(readFileSync(resolve(root, 'public/fonts/OFL.txt'), 'utf8')).toContain(
    'SIL OPEN FONT LICENSE',
  );
});

test('không tải web font CJK', () => {
  expect(css).not.toMatch(/Noto Sans SC|PingFang|Hiragino|YaHei|Source Han/);
});
