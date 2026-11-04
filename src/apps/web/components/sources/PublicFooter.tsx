import Link from 'next/link';
import { vi } from '@/lib/strings/vi';

/** Chân trang của mọi trang công khai (từ điển, xác thực chứng nhận): ghi nguồn và link tới /nguon-du-lieu. */
export function PublicFooter({ credits }: { credits?: string[] }) {
  return (
    <footer className="small muted" style={{ marginTop: 'var(--space-6)' }}>
      <p>
        {credits && credits.length > 0 ? vi.footer.credits(credits) : null}
        <Link href="/nguon-du-lieu">{vi.footer.sourcesAndLicenses}</Link>
      </p>
    </footer>
  );
}
