'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { ReportTarget } from '@/lib/reports/schema';
import { vi } from '@/lib/strings/vi';
import { ReportSheet } from './ReportSheet';

/** Nút "Báo lỗi" kèm sheet; đặt ở thẻ từ, phản hồi bài tập, mặt sau thẻ ôn, trang từ, trang Tôi. */
export function ReportButton({ target }: { target: ReportTarget }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="quiet" size="sm" onClick={() => setOpen(true)}>
        <Icon name="flag" />
        {vi.report.open}
      </Button>
      <ReportSheet open={open} onClose={() => setOpen(false)} target={target} />
    </>
  );
}
