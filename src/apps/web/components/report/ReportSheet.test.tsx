// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { ReportSheet } from './ReportSheet';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const setup = (fetchImpl: typeof fetch, onClose = vi.fn()) => {
  vi.stubGlobal('fetch', fetchImpl);
  render(
    <ToastProvider>
      <ReportSheet open onClose={onClose} target={{ kind: 'word', id: '好吃' }} />
    </ToastProvider>,
  );
  return onClose;
};
const ok = () => vi.fn(async () => Response.json({ ok: true }, { status: 201 }));

describe('ReportSheet', () => {
  test('có 7 loại lỗi, mô tả không bắt buộc, bộ đếm ký tự', () => {
    setup(ok() as never);
    const select = screen.getByLabelText('Loại lỗi') as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual([
      'Sai pinyin',
      'Sai nghĩa',
      'Sai Hán Việt',
      'Sai audio',
      'Câu ví dụ không tự nhiên',
      'Chấm sai',
      'Khác',
    ]);
    const desc = screen.getByLabelText(/Mô tả/) as HTMLTextAreaElement;
    expect(desc.required).toBe(false);
    expect(screen.getByText('0/500')).toBeTruthy();
    fireEvent.change(desc, { target: { value: 'sai rồi' } });
    expect(screen.getByText('7/500')).toBeTruthy();
  });

  test('gửi đúng nội dung tới /api/reports, báo cảm ơn và đóng', async () => {
    const fetchMock = ok();
    const onClose = setup(fetchMock as never);
    fireEvent.change(screen.getByLabelText('Loại lỗi'), { target: { value: 'hanviet' } });
    fireEvent.change(screen.getByLabelText(/Mô tả/), { target: { value: 'phải là hảo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo lỗi' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/reports');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      target: { kind: 'word', id: '好吃' },
      kind: 'hanviet',
      description: 'phải là hảo',
    });
    expect(screen.getByText('Cảm ơn bạn, mình đã ghi nhận báo lỗi.')).toBeTruthy();
  });

  test('quá 500 ký tự thì khóa nút gửi và báo số ký tự', () => {
    setup(ok() as never);
    fireEvent.change(screen.getByLabelText(/Mô tả/), { target: { value: 'a'.repeat(501) } });
    expect(
      (screen.getByRole('button', { name: 'Gửi báo lỗi' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText('501/500')).toBeTruthy();
  });

  test('429 → thông báo gửi quá nhiều, sheet vẫn mở', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ error: { code: 'RATE_LIMITED', message: 'x' } }, { status: 429 }),
    );
    const onClose = setup(fetchMock as never);
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo lỗi' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/quá nhiều/);
    expect(onClose).not.toHaveBeenCalled();
  });

  test('lỗi mạng → thông báo thử lại, không mất nội dung đã gõ', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('network');
    });
    setup(fetchMock as never);
    const desc = screen.getByLabelText(/Mô tả/) as HTMLTextAreaElement;
    fireEvent.change(desc, { target: { value: 'giữ lại' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo lỗi' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/thử lại/);
    expect(desc.value).toBe('giữ lại');
  });

  test('nút đóng có aria-label', () => {
    setup(ok() as never);
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeTruthy();
  });
});
