// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { WritingMode, WritingResult } from './WritingPad';

vi.mock('./WritingPad', () => ({
  WritingPad: ({ mode, onDone }: { mode: WritingMode; onDone: (r: WritingResult) => void }) => (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={() => onDone({ mode, misses: 2, usedHint: false, score: 80 })}>xong</button>
    </div>
  ),
}));

import { WritingQuiz } from './WritingQuiz';

afterEach(cleanup);

describe('WritingQuiz', () => {
  test('chỉ có chế độ Tự viết, không có tab chọn chế độ', () => {
    render(<WritingQuiz char="你" strokesBaseUrl="x" onDone={vi.fn()} />);
    expect(screen.getByTestId('mode').textContent).toBe('recall');
    expect(screen.queryByRole('tab')).toBeNull();
  });

  test('xong thì gửi { misses, usedHint, score } kèm chữ', () => {
    const onDone = vi.fn();
    render(<WritingQuiz char="你" strokesBaseUrl="x" onDone={onDone} />);
    fireEvent.click(screen.getByText('xong'));
    expect(onDone).toHaveBeenCalledWith({ char: '你', misses: 2, usedHint: false, score: 80 });
  });

  test('hiện đề (nghĩa tiếng Anh và pinyin) nếu có', () => {
    render(<WritingQuiz char="你" strokesBaseUrl="x" onDone={vi.fn()} prompt={{ pinyin: 'ni3', meaning: 'you' }} />);
    expect(screen.getByText('you')).toBeTruthy();
    expect(screen.getByText('nǐ')).toBeTruthy();
  });
});
