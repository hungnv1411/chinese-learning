import { expect, test } from 'vitest';
import { checkHealth } from './health';

test('DB trả lời thì 200 { ok: true }', async () => {
  expect(await checkHealth(async () => 1)).toEqual({ status: 200, body: { ok: true } });
});

test('DB lỗi thì 503 { ok: false }', async () => {
  const r = await checkHealth(async () => {
    throw new Error('down');
  });
  expect(r).toEqual({ status: 503, body: { ok: false } });
});
