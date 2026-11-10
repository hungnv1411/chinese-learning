'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { apiFetch } from '@/lib/gateway/api-client';
import { vi } from '@/lib/strings/vi';

const L = vi.account;

/** Hộp thoại xóa tài khoản: chỉ bật nút khi gõ đúng chuỗi xác nhận (design `profile.html#delete`). */
export function DeleteAccountSheet({
  open,
  onClose,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  /** Sau khi server xóa xong (client dọn dữ liệu cục bộ, chuyển về trang đầu). */
  onDeleted: () => void;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = text === L.deleteConfirmText;

  async function remove() {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/account/delete', { method: 'POST', json: { confirm: text } });
      onDeleted();
    } catch {
      setError(L.deleteFailed);
      setBusy(false);
    }
  }

  function close() {
    setText('');
    setError(null);
    onClose();
  }

  return (
    <Sheet open={open} onClose={close} label={L.deleteTitle}>
      <h2>{L.deleteTitle}</h2>
      <p className="muted">{L.deleteBody}</p>
      <div className="field">
        <label htmlFor={`${id}-confirm`}>{L.deleteConfirmLabel}</label>
        <input
          id={`${id}-confirm`}
          value={text}
          autoComplete="off"
          autoCapitalize="characters"
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="field-help">
          ✗ {error}
        </p>
      )}
      <Button variant="danger" block disabled={!matches} loading={busy} onClick={remove}>
        {L.deleteAction}
      </Button>
      <Button variant="quiet" block onClick={close}>
        {L.deleteKeep}
      </Button>
    </Sheet>
  );
}
