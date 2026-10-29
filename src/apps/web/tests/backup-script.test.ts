import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

const script = resolve(__dirname, '../../../deploy/backup/backup.sh');

function dryRun(names: string[]): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'backup-'));
  const list = join(dir, 'list.txt');
  writeFileSync(list, names.join('\n') + '\n');
  const out = execFileSync('bash', [script, '--dry-run', '--list-file', list], {
    encoding: 'utf8',
    env: { ...process.env, KEEP: '14' },
  });
  return out.split('\n').filter(Boolean);
}

const day = (n: number) => `2026-09-${String(n).padStart(2, '0')}.sql.gz`;

test('16 bản thì xóa đúng 2 bản cũ nhất', () => {
  const names = Array.from({ length: 16 }, (_, i) => day(i + 1)).reverse(); // thứ tự lộn xộn
  expect(dryRun(names)).toEqual([`DELETE backups/${day(1)}`, `DELETE backups/${day(2)}`]);
});

test('đủ 14 bản hoặc ít hơn thì không xóa gì', () => {
  expect(dryRun(Array.from({ length: 14 }, (_, i) => day(i + 1)))).toEqual([]);
  expect(dryRun([day(1)])).toEqual([]);
});

test('bỏ qua file lạ không đúng định dạng tên', () => {
  const names = [...Array.from({ length: 15 }, (_, i) => day(i + 1)), 'README.txt'];
  expect(dryRun(names)).toEqual([`DELETE backups/${day(1)}`]);
});
