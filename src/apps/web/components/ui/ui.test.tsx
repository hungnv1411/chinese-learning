// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Switch } from './Basics';
import { IconButton } from './Button';
import { Hanzi } from './Hanzi';
import { Pinyin } from './Pinyin';
import { DEFAULT_DISPLAY_SETTINGS, SettingsProvider } from './settings';
import { Sheet } from './Sheet';
import { ToastProvider, TOAST_MS, useToast } from './Toast';
import { ToneContour } from './ToneContour';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Hanzi', () => {
  test('gán class t3 cho 好 khi tones=[3]', () => {
    render(<Hanzi text="好" tones={[3]} />);
    expect(screen.getByText('好').className).toBe('t3');
  });

  test('tô từng chữ theo thanh, bỏ qua dấu câu khi đếm', () => {
    render(<Hanzi text="你，好" tones={[3, 3]} />);
    expect(screen.getByText('你').className).toBe('t3');
    expect(screen.getByText('，').className).toBe('');
  });

  test('bật phồn thể thì hiện bản phồn thể', () => {
    render(
      <SettingsProvider value={{ ...DEFAULT_DISPLAY_SETTINGS, traditional: true }}>
        <Hanzi text="说" traditional="說" />
      </SettingsProvider>,
    );
    expect(screen.getByText('說')).toBeTruthy();
  });
});

describe('Pinyin', () => {
  test('luôn hiện dấu thanh và tô màu từng âm tiết', () => {
    render(<Pinyin numbered="ni3 hao3" />);
    expect(screen.getByText('nǐ').className).toBe('t3');
    expect(screen.getByText('hǎo').className).toBe('t3');
  });
});

describe('IconButton', () => {
  test('có aria-label; thiếu label thì lỗi kiểu TS', () => {
    render(<IconButton icon="close" label="Đóng" />);
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeTruthy();
    // @ts-expect-error thiếu `label` phải báo lỗi biên dịch
    const bad = <IconButton icon="close" />;
    expect(bad).toBeTruthy();
  });
});

describe('Switch', () => {
  test('đổi aria-checked khi bấm', () => {
    function Demo() {
      const [on, setOn] = useState(false);
      return <Switch checked={on} onChange={setOn} label="Bật" />;
    }
    render(<Demo />);
    const sw = screen.getByRole('switch', { name: 'Bật' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });
});

describe('SettingsProvider', () => {
  test('áp class no-hv / no-tone / no-py lên body', () => {
    render(
      <SettingsProvider
        value={{ showPinyin: 'never', showHanViet: false, toneColors: false, traditional: false }}
      >
        x
      </SettingsProvider>,
    );
    for (const c of ['no-hv', 'no-tone', 'no-py']) expect(document.body.classList.contains(c)).toBe(true);
  });
});

describe('ToneContour', () => {
  test('vẽ đường thanh chuẩn và đường nét đứt của người học', () => {
    const { container } = render(<ToneContour tone={2} userContour={[0.1, 0.5, 0.9]} label="thanh 2" />);
    expect(container.querySelectorAll('path')).toHaveLength(2);
    expect(container.querySelector('path[stroke-dasharray]')).not.toBeNull();
  });
});

describe('Toast', () => {
  test('hiện role=status rồi tự ẩn sau 2,8 giây', () => {
    vi.useFakeTimers();
    function Demo() {
      const toast = useToast();
      return <button onClick={() => toast('Đã lưu')}>go</button>;
    }
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('go'));
    expect(screen.getByRole('status').textContent).toBe('Đã lưu');
    act(() => void vi.advanceTimersByTime(TOAST_MS));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('Sheet', () => {
  test('mở bằng showModal và đóng khi bấm nền', () => {
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.showModal = showModal;
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
    const onClose = vi.fn();
    const { container } = render(
      <Sheet open onClose={onClose} label="Báo lỗi">
        nội dung
      </Sheet>,
    );
    expect(showModal).toHaveBeenCalled();
    fireEvent.click(container.querySelector('dialog')!); // target là chính dialog = bấm nền
    expect(onClose).toHaveBeenCalled();
  });
});
