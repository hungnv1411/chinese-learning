'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { vi } from '@/lib/strings/vi';
import { Icon } from './Icon';
import type { IconName } from './icons';

const TABS: { href: string; icon: IconName; label: string }[] = [
  { href: '/hom-nay', icon: 'home', label: vi.nav.today },
  { href: '/lo-trinh', icon: 'path', label: vi.nav.path },
  { href: '/on-tap', icon: 'review', label: vi.nav.review },
  { href: '/tra-tu', icon: 'search', label: vi.nav.dictionary },
  { href: '/toi', icon: 'user', label: vi.nav.profile },
];

function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Thanh điều hướng 3 dạng (dưới < 768px, cột 88px từ 768px, 256px từ 1200px) do CSS quyết định.
 * Tên thương hiệu lấy từ `siteName` (SITE_NAME, D16), không viết cứng.
 */
export function AppShell({ siteName, children }: { siteName: string; children: ReactNode }) {
  const pathname = usePathname() ?? '';

  useEffect(() => {
    document.body.classList.add('has-nav');
    return () => document.body.classList.remove('has-nav');
  }, []);

  const cur = (href: string) =>
    isCurrent(pathname, href) ? ({ 'aria-current': 'page' } as const) : {};

  return (
    <>
      <nav className="nav" aria-label={vi.nav.label}>
        <Link className="brand" href="/" aria-label={vi.nav.home}>
          <span className="logo" lang="zh">
            学
          </span>
          <span className="word">{siteName}</span>
        </Link>
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} {...cur(t.href)}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </Link>
        ))}
        <Link className="nav-extra" href="/pinyin" {...cur('/pinyin')}>
          <Icon name="volume" />
          <span>{vi.nav.pinyin}</span>
        </Link>
        <div className="nav-foot">
          <Link href="/nguon-du-lieu" {...cur('/nguon-du-lieu')}>
            <Icon name="info" />
            <span>{vi.nav.sources}</span>
          </Link>
        </div>
      </nav>
      <main className="main">{children}</main>
    </>
  );
}
