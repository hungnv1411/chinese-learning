// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ApiClientError, apiFetch } from './api-client';
import { GatewayProvider, GuestGateway, useGateway } from './gateway';

afterEach(cleanup);

function Kind() {
  return <span>{useGateway().kind}</span>;
}

describe('useGateway', () => {
  test('đăng nhập thì ServerGateway, khách thì GuestGateway', () => {
    render(
      <GatewayProvider signedIn>
        <Kind />
      </GatewayProvider>,
    );
    expect(screen.getByText('server')).toBeTruthy();
    cleanup();
    render(
      <GatewayProvider signedIn={false}>
        <Kind />
      </GatewayProvider>,
    );
    expect(screen.getByText('guest')).toBeTruthy();
  });

  test('GuestGateway có GuestStore', () => {
    expect(new GuestGateway().store.persistent).toBe(true);
  });
});

describe('apiFetch', () => {
  test('lỗi theo định dạng chuẩn thành ApiClientError', async () => {
    const f = vi.fn(async () =>
      Response.json({ error: { code: 'LESSON_LOCKED', message: 'Bài chưa mở.' } }, { status: 403 }),
    ) as unknown as typeof fetch;
    await expect(apiFetch('/api/x', {}, f)).rejects.toMatchObject({
      status: 403,
      code: 'LESSON_LOCKED',
      message: 'Bài chưa mở.',
    });
    await expect(apiFetch('/api/x', {}, f)).rejects.toBeInstanceOf(ApiClientError);
  });

  test('gửi json và trả JSON khi thành công', async () => {
    const f = vi.fn(async (_u: string, init?: RequestInit) => {
      expect(init?.body).toBe('{"a":1}');
      return Response.json({ ok: true });
    }) as unknown as typeof fetch;
    expect(await apiFetch('/api/x', { method: 'POST', json: { a: 1 } }, f)).toEqual({ ok: true });
  });
});
