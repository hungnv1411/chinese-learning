// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DeleteAccountSheet } from './DeleteAccountSheet';

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

const setup = (fetchImpl: typeof fetch) => {
  vi.stubGlobal('fetch', fetchImpl);
  const onClose = vi.fn();
  const onDeleted = vi.fn();
  render(<DeleteAccountSheet open onClose={onClose} onDeleted={onDeleted} />);
  return { onClose, onDeleted };
};
const deleteBtn = () => screen.getByRole('button', { name: 'Xóa tài khoản' }) as HTMLButtonElement;
const type = (v: string) =>
  fireEvent.change(screen.getByLabelText('Gõ XÓA TÀI KHOẢN để xác nhận'), { target: { value: v } });

describe('DeleteAccountSheet', () => {
  test('nút xóa tắt cho đến khi gõ đúng chuỗi xác nhận', () => {
    setup(vi.fn() as never);
    expect(deleteBtn().disabled).toBe(true);
    type('xóa tài khoản');
    expect(deleteBtn().disabled).toBe(true);
    type('XÓA TÀI KHOẢN ');
    expect(deleteBtn().disabled).toBe(true);
    type('XÓA TÀI KHOẢN');
    expect(deleteBtn().disabled).toBe(false);
  });

  test('gõ đúng rồi bấm → gọi API với confirm, xong gọi onDeleted', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    const { onDeleted } = setup(fetchMock as never);
    type('XÓA TÀI KHOẢN');
    fireEvent.click(deleteBtn());
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/account/delete');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ confirm: 'XÓA TÀI KHOẢN' });
  });

  test('server lỗi → hiện lỗi có ✗, không gọi onDeleted, thử lại được', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ error: { code: 'X', message: 'x' } }, { status: 500 }),
    );
    const { onDeleted } = setup(fetchMock as never);
    type('XÓA TÀI KHOẢN');
    fireEvent.click(deleteBtn());
    expect((await screen.findByRole('alert')).textContent).toContain('✗');
    expect(onDeleted).not.toHaveBeenCalled();
    await waitFor(() => expect(deleteBtn().disabled).toBe(false));
  });

  test('“Giữ lại” đóng hộp thoại mà không gọi API', () => {
    const fetchMock = vi.fn();
    const { onClose } = setup(fetchMock as never);
    fireEvent.click(screen.getByRole('button', { name: 'Giữ lại' }));
    expect(onClose).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
