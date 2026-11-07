// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';

type QuizOpts = {
  onMistake: (d: { strokeNum: number; mistakesOnStroke: number; totalMistakes: number }) => void;
  onCorrectStroke: (d: { strokeNum: number }) => void;
  onComplete: (d: { totalMistakes: number }) => void;
  showHintAfterMisses: number;
};

const h = vi.hoisted(() => ({
  create: vi.fn(),
  writer: null as unknown as Record<
    'animateCharacter' | 'animateStroke' | 'quiz' | 'cancelQuiz' | 'showCharacter' | 'hideCharacter' | 'showOutline' | 'hideOutline',
    ReturnType<typeof vi.fn>
  >,
  quiz: null as null | QuizOpts,
  opts: null as null | Record<string, unknown>,
}));

vi.mock('hanzi-writer', () => ({ default: { create: h.create } }));

import { WritingPad } from './WritingPad';
import { clearStrokeCache } from './strokes';

const STROKES = { strokes: ['a', 'b', 'c'], medians: [[], [], []] };

beforeEach(() => {
  clearStrokeCache();
  h.quiz = null;
  h.writer = {
    animateCharacter: vi.fn((o?: { onComplete?: () => void }) => o?.onComplete?.()),
    animateStroke: vi.fn((_i: number, o?: { onComplete?: () => void }) => o?.onComplete?.()),
    quiz: vi.fn((o: QuizOpts) => {
      h.quiz = o;
    }),
    cancelQuiz: vi.fn(),
    showCharacter: vi.fn(),
    hideCharacter: vi.fn(),
    showOutline: vi.fn(),
    hideOutline: vi.fn(),
  };
  h.create.mockImplementation((_el: HTMLElement, _c: string, opts: Record<string, unknown>) => {
    h.opts = opts;
    return h.writer;
  });
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(STROKES)));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const setup = (props: Partial<React.ComponentProps<typeof WritingPad>> = {}) => {
  const onDone = vi.fn();
  render(
    <ToastProvider>
      <WritingPad char="你" mode="recall" strokesBaseUrl="https://r2.test/" onDone={onDone} {...props} />
    </ToastProvider>,
  );
  return onDone;
};
const ready = () => waitFor(() => expect(h.writer.quiz.mock.calls.length + h.writer.animateCharacter.mock.calls.length).toBeGreaterThan(0));
const mistake = (strokeNum: number, mistakesOnStroke: number, totalMistakes: number) =>
  act(() => h.quiz!.onMistake({ strokeNum, mistakesOnStroke, totalMistakes }));

describe('WritingPad', () => {
  test('vùng viết đặt touch-action: none', () => {
    setup();
    expect((screen.getByRole('img') as HTMLElement).style.touchAction).toBe('none');
  });

  test('tải nét từ R2_PUBLIC_URL/strokes/{char}.json', async () => {
    setup();
    await ready();
    const loader = h.opts!.charDataLoader as (c: string, ok: (d: unknown) => void, err: () => void) => void;
    const ok = vi.fn();
    loader('你', ok, vi.fn());
    await waitFor(() => expect(ok).toHaveBeenCalledWith(STROKES));
    expect(fetch).toHaveBeenCalledWith(`https://r2.test/strokes/${encodeURIComponent('你')}.json`);
  });

  test('recall: ẩn nét mờ và chữ, quiz gợi ý sau 3 lần sai', async () => {
    setup({ mode: 'recall' });
    await ready();
    expect(h.opts).toMatchObject({ showOutline: false, showCharacter: false });
    expect(h.quiz!.showHintAfterMisses).toBe(3);
  });

  test('trace: hiện nét mờ', async () => {
    setup({ mode: 'trace' });
    await ready();
    expect(h.opts).toMatchObject({ showOutline: true, showCharacter: false });
  });

  test('sai 3 lần ở một nét → usedHint, điểm tối đa 50', async () => {
    const onDone = setup();
    await ready();
    await mistake(1, 1, 1);
    await mistake(1, 2, 2);
    await mistake(1, 3, 3);
    await act(() => h.quiz!.onComplete({ totalMistakes: 3 }));
    expect(onDone).toHaveBeenCalledWith({ mode: 'recall', misses: 3, usedHint: true, score: 50 });
  });

  test('recall xong với 2 lần sai → 80', async () => {
    const onDone = setup();
    await ready();
    await mistake(0, 1, 1);
    await mistake(2, 1, 2);
    await act(() => h.quiz!.onComplete({ totalMistakes: 2 }));
    expect(onDone).toHaveBeenCalledWith({ mode: 'recall', misses: 2, usedHint: false, score: 80 });
  });

  test('nét sai hiện thông báo “Nét n chưa đúng” (n bắt đầu từ 1)', async () => {
    setup();
    await ready();
    await mistake(3, 1, 1);
    expect(screen.getByText('Nét 4 chưa đúng')).toBeTruthy();
  });

  test('hiện “Nét i/n” theo nét đúng đã viết', async () => {
    setup();
    await ready();
    expect(await screen.findByText('Nét 1/3')).toBeTruthy();
    await act(() => h.quiz!.onCorrectStroke({ strokeNum: 0 }));
    expect(screen.getByText('Nét 2/3')).toBeTruthy();
  });

  test('“Xem lại thứ tự nét”: chạy hoạt ảnh rồi viết lại, lượt đó tính là đã dùng gợi ý', async () => {
    const onDone = setup();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại thứ tự nét' }));
    await waitFor(() => expect(h.writer.quiz).toHaveBeenCalledTimes(2));
    expect(h.writer.cancelQuiz).toHaveBeenCalled();
    expect(h.writer.animateCharacter).toHaveBeenCalled();
    await act(() => h.quiz!.onComplete({ totalMistakes: 0 }));
    expect(onDone).toHaveBeenCalledWith({ mode: 'recall', misses: 0, usedHint: true, score: 50 });
  });

  test('không có nút bỏ qua', async () => {
    setup();
    await ready();
    expect(screen.queryByRole('button', { name: /bỏ qua/i })).toBeNull();
  });

  test('watch: xong khi hoạt ảnh chạy hết một lần', async () => {
    const onDone = setup({ mode: 'watch' });
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ mode: 'watch', misses: 0, usedHint: false, score: 100 }));
    expect(h.writer.quiz).not.toHaveBeenCalled();
  });

  test('watch: nút phát lại và đi từng nét', async () => {
    setup({ mode: 'watch' });
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Phát lại' }));
    expect(h.writer.animateCharacter.mock.calls.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByRole('button', { name: 'Nét tiếp theo' }));
    expect(h.writer.animateStroke).toHaveBeenCalledWith(0, expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Nét tiếp theo' }));
    expect(h.writer.animateStroke).toHaveBeenLastCalledWith(1, expect.anything());
  });

  test('không tải được dữ liệu nét → báo và gọi onUnavailable, không tạo writer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    const onUnavailable = vi.fn();
    setup({ onUnavailable });
    await waitFor(() => expect(onUnavailable).toHaveBeenCalledWith('你'));
    expect(await screen.findByText(/chưa có dữ liệu nét/i)).toBeTruthy();
    expect(h.create).not.toHaveBeenCalled();
  });
});
