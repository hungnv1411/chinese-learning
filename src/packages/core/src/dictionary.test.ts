import { describe, expect, test } from 'vitest';
import { classifyQuery, parsePinyinQuery, segmentPinyin } from './dictionary';

describe('classifyQuery', () => {
  test.each([
    ['好', 'all', ['hanzi']],
    ['好吃', 'all', ['hanzi']],
    ['hǎo', 'all', ['pinyin']],
    ['hao3', 'all', ['pinyin']],
    ['hao3 chi1', 'all', ['pinyin']],
    ['hảo', 'all', ['hanviet']],
    ['hiếu', 'all', ['hanviet']],
    ['đại', 'all', ['hanviet']],
    ['nhất', 'all', ['hanviet']],
    ['he', 'all', ['pinyin', 'english']],
    ['haochi', 'all', ['pinyin', 'english']],
    ["xi'an", 'all', ['pinyin', 'english']],
    ['delicious', 'all', ['english']],
    ['look', 'all', ['english']],
    ['to eat', 'all', ['english']],
    ['hao', 'hanviet', ['hanviet']],
    ['好', 'english', ['english']],
    ['hao', 'pinyin', ['pinyin']],
    ['', 'all', ['english']],
  ])('%s (%s)', (q, chip, expected) => {
    expect(classifyQuery(q, chip as never)).toEqual(expected);
  });

  test('ma có cả ā lẫn à không phải Hán Việt', () => {
    expect(classifyQuery('mā', 'all')).toEqual(['pinyin']);
    expect(classifyQuery('mà', 'all')).toEqual(['pinyin']);
    expect(classifyQuery('lǜ', 'all')).toEqual(['pinyin']);
    expect(classifyQuery('lü', 'all')).toEqual(['pinyin']);
  });

  test('cụm trộn có chữ Hán thì là hanzi', () => {
    expect(classifyQuery('hao好', 'all')).toEqual(['hanzi']);
  });
});

describe('segmentPinyin', () => {
  test.each([
    ['haochi', ['hao', 'chi']],
    ['xian', ['xian']],
    ["xi'an", ['xi', 'an']],
    ['nihao', ['ni', 'hao']],
    ['zhongguo', ['zhong', 'guo']],
    ['lv', ['lu']],
    ['xyz', null],
    ['delicious', null],
  ])('%s', (input, expected) => {
    expect(segmentPinyin(input)).toEqual(expected);
  });
});

describe('parsePinyinQuery', () => {
  test.each([
    ['hao3 chi', 'haochi', [3, null]],
    ['hao3 chi1', 'haochi', [3, 1]],
    ['hao3chi1', 'haochi', [3, 1]],
    ['hǎo chī', 'haochi', [3, 1]],
    ['hǎochī', 'haochi', [3, 1]],
    ['hao', 'hao', [null]],
    ['haochi', 'haochi', [null, null]],
    ['ma5', 'ma', [5]],
    ['lu:4', 'lu', [4]],
    ['lǜ', 'lu', [4]],
    ['nǚ', 'nu', [3]],
    ['  Hao3   Chi ', 'haochi', [3, null]],
  ])('%s', (input, plain, tones) => {
    expect(parsePinyinQuery(input)).toEqual({ plain, tones });
  });
});
