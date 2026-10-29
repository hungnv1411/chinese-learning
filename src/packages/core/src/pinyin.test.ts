import { describe, expect, test } from 'vitest';
import fixtures from '../fixtures/pinyin.json';
import { numberedToMarked, parseNumbered, splitSyllables, toPlain } from './pinyin';

describe('pinyin (fixtures/pinyin.json)', () => {
  test.each(fixtures.numberedToMarked)('numberedToMarked $input', (c) => {
    expect(numberedToMarked(c.input, { join: (c as { join?: boolean }).join })).toBe(c.expected);
  });
  test.each(fixtures.toPlain)('toPlain $input', (c) => {
    expect(toPlain(c.input)).toBe(c.expected);
  });
  test.each(fixtures.parseNumbered)('parseNumbered $input', (c) => {
    expect(parseNumbered(c.input)).toEqual(c.expected);
  });
  test.each(fixtures.splitSyllables)('splitSyllables "$input"', (c) => {
    expect(splitSyllables(c.input)).toEqual(c.expected);
  });
});
