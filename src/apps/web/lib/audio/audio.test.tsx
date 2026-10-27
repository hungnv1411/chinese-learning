// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { audioUrl, voiceOf } from './audio-url';
import { useAudio } from './use-audio';

describe('audioUrl', () => {
  test('ghép R2_PUBLIC_URL/kind/voice/key.mp3', () => {
    expect(audioUrl('https://cdn.test/', 'syl', 'hao3', 'xiaoxiao')).toEqual({
      src: 'https://cdn.test/syl/xiaoxiao/hao3.mp3',
      rate: 1,
    });
    expect(audioUrl('https://cdn.test', 'word', '好吃_hao3chi1', 'yunxi').src).toBe(
      'https://cdn.test/word/yunxi/%E5%A5%BD%E5%90%83_hao3chi1.mp3',
    );
  });

  test('đọc chậm: mode file dùng .slow.mp3, mode rate dùng cùng file với rate thấp', () => {
    expect(audioUrl('https://c', 'sent', '123', 'xiaoxiao', { slow: true, slowMode: 'file' })).toEqual({
      src: 'https://c/sent/xiaoxiao/123.slow.mp3',
      rate: 1,
    });
    const r = audioUrl('https://c', 'sent', '123', 'xiaoxiao', { slow: true, slowMode: 'rate' });
    expect(r.src).toBe('https://c/sent/xiaoxiao/123.mp3');
    expect(r.rate).toBeLessThan(1);
  });

  test('voiceOf: nữ → xiaoxiao, nam → yunxi', () => {
    expect(voiceOf('female')).toBe('xiaoxiao');
    expect(voiceOf('male')).toBe('yunxi');
  });
});

describe('useAudio', () => {
  const make = () => {
    const el = { src: '', playbackRate: 1, currentTime: 0, preload: '', play: vi.fn(async () => {}), pause: vi.fn(), load: vi.fn() };
    return el;
  };

  test('không phát trước thao tác chạm đầu tiên, phát được sau pointerdown', async () => {
    const el = make();
    const { result } = renderHook(() => useAudio(() => el));
    expect(await result.current.play('a.mp3')).toBe(false);
    expect(el.play).not.toHaveBeenCalled();
    act(() => void window.dispatchEvent(new Event('pointerdown')));
    expect(await result.current.play('a.mp3', 0.7)).toBe(true);
    expect(el.src).toBe('a.mp3');
    expect(el.playbackRate).toBe(0.7);
  });

  test('preload tạo cache một lần cho mỗi URL', () => {
    const created: ReturnType<typeof make>[] = [];
    const { result } = renderHook(() =>
      useAudio(() => {
        const e = make();
        created.push(e);
        return e;
      }),
    );
    result.current.preload(['a.mp3', 'b.mp3', 'a.mp3']);
    expect(created).toHaveLength(2);
    expect(created[0]!.load).toHaveBeenCalled();
  });

  test('play bị trình duyệt từ chối thì trả false, không ném', async () => {
    const el = make();
    el.play = vi.fn(async () => {
      throw new Error('NotAllowedError');
    });
    const { result } = renderHook(() => useAudio(() => el));
    act(() => void window.dispatchEvent(new Event('pointerdown')));
    expect(await result.current.play('a.mp3')).toBe(false);
  });
});
