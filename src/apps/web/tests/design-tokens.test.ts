import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const design = readFileSync(resolve(__dirname, '../../../../docs/design/styles.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/tokens.css'), 'utf8');

const decls = (css: string) => new Map([...css.matchAll(/^\s*(--[\w-]+):\s*(.+?);\s*$/gm)].map((m) => [m[1], m[2]]));

test('tokens.css giữ nguyên mọi token của design (tên và giá trị)', () => {
  const want = decls(design.split('/* ─── 3. Base')[0] as string);
  const got = decls(tokens);
  expect(want.size).toBeGreaterThan(60);
  for (const [name, value] of want) expect(got.get(name), name).toBe(value);
  expect([...got.keys()].filter((k) => !want.has(k as string))).toEqual([]); // không thêm token
});
