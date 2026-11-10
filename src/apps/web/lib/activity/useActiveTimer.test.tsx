// @vitest-environment jsdom
import { act, cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useActiveTimer } from './useActiveTimer';

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-10T08:00:00Z'));
  setVisibility('visible');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const tick = (s: number) => act(() => void vi.advanceTimersByTime(s * 1000));

describe('useActiveTimer', () => {
  test('30 giây có thao tác → 30', () => {
    const { result } = renderHook(() => useActiveTimer({ active: true }));
    fireEvent.pointerDown(document);
    tick(30);
    expect(result.current.drain()).toBe(30);
  });

  test('90 giây không thao tác thêm → chỉ đếm 60 giây đầu', () => {
    const { result } = renderHook(() => useActiveTimer({ active: true }));
    fireEvent.keyDown(document);
    tick(90);
    expect(result.current.drain()).toBe(60);
  });

  test('thao tác mới sau khi nghỉ thì đếm tiếp', () => {
    const { result } = renderHook(() => useActiveTimer({ active: true }));
    fireEvent.pointerDown(document);
    tick(90);
    fireEvent.pointerDown(document);
    tick(10);
    expect(result.current.drain()).toBe(70);
  });

  test('chưa có thao tác nào thì không đếm', () => {
    const { result } = renderHook(() => useActiveTimer({ active: true }));
    tick(20);
    expect(result.current.drain()).toBe(0);
  });

  test('ẩn tab thì dừng, hiện lại thì đếm tiếp', () => {
    const { result } = renderHook(() => useActiveTimer({ active: true }));
    fireEvent.pointerDown(document);
    tick(10);
    act(() => setVisibility('hidden'));
    tick(20);
    act(() => setVisibility('visible'));
    tick(10);
    expect(result.current.drain()).toBe(20);
  });

  test('active=false thì không đếm', () => {
    const { result, rerender } = renderHook((p: { active: boolean }) => useActiveTimer(p), {
      initialProps: { active: false },
    });
    fireEvent.pointerDown(document);
    tick(10);
    rerender({ active: true });
    fireEvent.pointerDown(document);
    tick(5);
    expect(result.current.drain()).toBe(5);
  });

  test('drain trả số giây từ lần drain trước rồi về 0', () => {
    const { result } = renderHook(() => useActiveTimer({ active: true }));
    fireEvent.pointerDown(document);
    tick(12);
    expect(result.current.drain()).toBe(12);
    expect(result.current.drain()).toBe(0);
    tick(3);
    expect(result.current.drain()).toBe(3);
  });

  test('touch() (phát audio) tính là thao tác', () => {
    const { result } = renderHook(() => useActiveTimer({ active: true }));
    act(() => result.current.touch());
    tick(15);
    expect(result.current.drain()).toBe(15);
  });

  test('gỡ component thì gỡ listener và timer', () => {
    const { unmount } = renderHook(() => useActiveTimer({ active: true }));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
