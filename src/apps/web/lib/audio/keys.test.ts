import { describe, expect, test } from 'vitest';
import { wordAudioKey } from './keys';

describe('wordAudioKey (giống clp/audio/keys.py)', () => {
  test('ví dụ trong spec', () => {
    expect(wordAudioKey('好吃', 'hao3 chi1', 'xiaoxiao')).toBe('word/xiaoxiao/好吃_hao3chi1.mp3');
    expect(wordAudioKey('行', 'xing2', 'yunxi')).toBe('word/yunxi/行_xing2.mp3');
  });
});
