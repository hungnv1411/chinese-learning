import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { WordView } from '@/components/dictionary/WordView';
import { AppShell } from '@/components/ui/AppShell';
import { ToastProvider } from '@/components/ui/Toast';
import { getConfig } from '@/lib/config';
import { getSql } from '@/lib/db';
import { descriptionFor, jsonLdFor, titleFor } from '@/lib/dictionary/seo';
import { getWordPage } from '@/lib/dictionary/word';

type Props = { params: Promise<{ word: string }> };

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

// Một request chỉ truy vấn một lần dù cả generateMetadata và trang đều gọi.
const load = cache((word: string) => getWordPage(getSql(), word));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await load(decode((await params).word));
  if (!page) return { title: getConfig().SITE_NAME };
  return {
    title: titleFor(page.entries, getConfig().SITE_NAME),
    description: descriptionFor(page.entries),
  };
}

// Trang chỉ có dữ liệu dùng chung (không đọc phiên người dùng) nên không có thông tin cá nhân
// trong HTML. Phần "đã có trong ôn tập" sẽ tải ở client sau khi trang hiện (09).
export default async function WordRoute({ params }: Props) {
  const word = decode((await params).word);
  const page = await load(word);
  if (!page) notFound();
  const { SITE_NAME, SITE_URL, R2_PUBLIC_URL } = getConfig();
  return (
    <AppShell siteName={SITE_NAME}>
      <ToastProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdFor(page.entries, SITE_URL) }}
        />
        <WordView
          page={page}
          audioBase={R2_PUBLIC_URL}
          url={`${SITE_URL.replace(/\/+$/, '')}/tu/${encodeURIComponent(word)}`}
        />
      </ToastProvider>
    </AppShell>
  );
}
