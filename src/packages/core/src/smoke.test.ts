import { expect, test } from 'vitest';
import type { Tone } from './types';

test('smoke: core package runs tests', () => {
  const t: Tone = 3;
  expect(t).toBe(3);
});
