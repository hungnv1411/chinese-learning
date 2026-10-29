import type { ReactNode } from 'react';
import { getConfig } from '@/lib/config';
import '@/styles/index.css';

// Cấu hình đọc lúc chạy (SITE_NAME), không đọc lúc build.
export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return { title: getConfig().SITE_NAME };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
