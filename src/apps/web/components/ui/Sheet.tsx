'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * `<dialog class="sheet">`: showModal(), đóng khi bấm nền (backdrop), trả focus về phần tử
 * đã mở nó. Không dùng alert/confirm của trình duyệt.
 */
export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      opener.current = document.activeElement;
      dlg.showModal();
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={label}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // bấm vào nền
      }}
      onClose={() => {
        (opener.current as HTMLElement | null)?.focus?.();
        onClose();
      }}
    >
      <div className="dlg-body">{children}</div>
    </dialog>
  );
}
