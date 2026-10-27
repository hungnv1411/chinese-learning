import { describe, expect, test } from 'vitest';
import fixtures from '../fixtures/tone-sandhi.json';
import { applyToneSandhi } from './sandhi';
import type { SandhiSyllable } from './types';

describe('applyToneSandhi (fixtures/tone-sandhi.json)', () => {
  test.each(fixtures.cases)('$name', (c) => {
    const o = c as {
      syllables: SandhiSyllable[];
      wordLengths?: number[];
      ordinalIndexes?: number[];
      expected: number[];
    };
    expect(
      applyToneSandhi(o.syllables, {
        wordLengths: o.wordLengths,
        ordinalIndexes: o.ordinalIndexes,
      }),
    ).toEqual(o.expected);
  });
});
