// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

const pathname = vi.hoisted(() => ({ value: '/hom-nay' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AppShell } from './AppShell';
import { FocusLayout } from './FocusLayout';

afterEach(cleanup);

describe('AppShell', () => {
  test('có 5 tab, “Bảng pinyin”, “Nguồn dữ liệu”; tên thương hiệu từ siteName', () => {
    render(<AppShell siteName="Tên Thử">nội dung</AppShell>);
    for (const label of ['Hôm nay', 'Lộ trình', 'Ôn tập', 'Tra từ', 'Tôi', 'Bảng pinyin', 'Nguồn dữ liệu']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText('Tên Thử')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Điều hướng chính' })).toBeTruthy();
  });

  test('tab hiện tại có aria-current, đường dẫn con cũng tính', () => {
    pathname.value = '/on-tap/phien';
    render(<AppShell siteName="X">.</AppShell>);
    const current = document.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain('Ôn tập');
  });

  test('đặt class has-nav trên body khi gắn và bỏ khi gỡ', () => {
    const { unmount } = render(<AppShell siteName="X">.</AppShell>);
    expect(document.body.classList.contains('has-nav')).toBe(true);
    unmount();
    expect(document.body.classList.contains('has-nav')).toBe(false);
  });
});

describe('FocusLayout', () => {
  test('render top, body, foot theo class của design và không có thanh tab', () => {
    const { container } = render(
      <FocusLayout top={<span>TOP</span>} foot={<div className="focus-foot">FOOT</div>}>
        BODY
      </FocusLayout>,
    );
    expect(container.querySelector('.focus-top')?.textContent).toBe('TOP');
    expect(container.querySelector('.focus-body')?.textContent).toBe('BODY');
    expect(container.querySelector('.focus-foot')?.textContent).toBe('FOOT');
    expect(container.querySelector('nav')).toBeNull();
  });
});
