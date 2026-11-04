'use client';

import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { vi } from '@/lib/strings/vi';

/** Web Share API; trình duyệt không hỗ trợ thì sao chép link và báo bằng toast. */
export function ShareButton({ url, title }: { url: string; title: string }) {
  const toast = useToast();
  async function share() {
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast(vi.word.copied);
    } catch {
      /* người dùng đóng hộp thoại chia sẻ hoặc không có quyền clipboard: bỏ qua */
    }
  }
  return (
    <button type="button" className="icon-btn" aria-label={vi.word.share} onClick={share}>
      <Icon name="share" />
    </button>
  );
}
