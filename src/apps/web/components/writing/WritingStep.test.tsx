// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { WritingMode, WritingResult } from './WritingPad';

vi.mock('./WritingPad', () => ({
  WritingPad: ({ mode, onDone }: { mode: WritingMode; onDone: (r: WritingResult) => void }) => (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={() => onDone({ mode, misses: 0, usedHint: false, score: 100 })}>xong-tot</button>
      <button onClick={() => onDone({ mode, misses: 6, usedHint: false, score: 40 })}>xong-kem</button>
    </div>
  ),
}));

import { WritingStep } from './WritingStep';

afterEach(cleanup);

const setup = () => {
  const onComplete = vi.fn();
  const onCharWritten = vi.fn();
  render(<WritingStep char="你" strokesBaseUrl="x" onComplete={onComplete} onCharWritten={onCharWritten} />);
  return { onComplete, onCharWritten };
};
const tab = (name: string) => screen.getByRole('tab', { name }) as HTMLButtonElement;
const finish = (label = 'xong-tot') => fireEvent.click(screen.getByText(label));

describe('WritingStep', () => {
  test('bắt đầu ở Xem; Viết theo và Tự viết bị khóa', () => {
    setup();
    expect(screen.getByTestId('mode').textContent).toBe('watch');
    expect(tab('Xem').getAttribute('aria-selected')).toBe('true');
    expect(tab('Viết theo').disabled).toBe(true);
    expect(tab('Tự viết').disabled).toBe(true);
  });

  test('không sang Tự viết khi Viết theo chưa xong', () => {
    setup();
    finish();
    expect(tab('Viết theo').disabled).toBe(false);
    expect(tab('Tự viết').disabled).toBe(true);
    fireEvent.click(tab('Viết theo'));
    expect(screen.getByTestId('mode').textContent).toBe('trace');
    fireEvent.click(tab('Tự viết'));
    expect(screen.getByTestId('mode').textContent).toBe('trace');
  });

  test('xong Tự viết: onComplete và ghi chữ đã viết khi đạt', () => {
    const { onComplete, onCharWritten } = setup();
    finish();
    fireEvent.click(tab('Viết theo'));
    finish();
    fireEvent.click(tab('Tự viết'));
    finish();
    expect(onComplete).toHaveBeenCalledWith({ mode: 'recall', misses: 0, usedHint: false, score: 100 });
    expect(onCharWritten).toHaveBeenCalledWith('你');
  });

  test('Tự viết chưa đạt vẫn hoàn thành bước nhưng không ghi chữ đã viết', () => {
    const { onComplete, onCharWritten } = setup();
    finish();
    fireEvent.click(tab('Viết theo'));
    finish();
    fireEvent.click(tab('Tự viết'));
    finish('xong-kem');
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onCharWritten).not.toHaveBeenCalled();
  });

  test('chỉ ghi chữ đã viết ở lần đạt đầu tiên', () => {
    const { onCharWritten } = setup();
    finish();
    fireEvent.click(tab('Viết theo'));
    finish();
    fireEvent.click(tab('Tự viết'));
    finish();
    finish();
    expect(onCharWritten).toHaveBeenCalledTimes(1);
  });
});
