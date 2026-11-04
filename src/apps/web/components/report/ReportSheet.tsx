'use client';

import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { ApiClientError, apiFetch } from '@/lib/gateway/api-client';
import {
  MAX_DESCRIPTION,
  REPORT_KINDS,
  displayLength,
  type ReportKind,
  type ReportTarget,
} from '@/lib/reports/schema';
import { vi } from '@/lib/strings/vi';

const L = vi.report;

/** Biểu mẫu báo lỗi nội dung (bottom sheet). Khách cũng gửi được. */
export function ReportSheet({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: ReportTarget;
}) {
  const id = useId();
  const toast = useToast();
  const [kind, setKind] = useState<ReportKind>('pinyin');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const length = displayLength(description);
  const tooLong = length > MAX_DESCRIPTION;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (tooLong || sending) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch('/api/reports', {
        method: 'POST',
        json: { target, kind, description },
      });
      toast(L.thanks);
      setDescription('');
      setKind('pinyin');
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError && err.status === 429 ? L.tooMany : L.failed);
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} label={L.title}>
      <form onSubmit={submit} className="dlg-body" style={{ padding: 0 }}>
        <div className="row between">
          <h2>{L.title}</h2>
          <button type="button" className="icon-btn" aria-label={L.close} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="field">
          <label htmlFor={`${id}-kind`}>{L.kind}</label>
          <select
            id={`${id}-kind`}
            value={kind}
            onChange={(e) => setKind(e.target.value as ReportKind)}
          >
            {REPORT_KINDS.map((k) => (
              <option key={k} value={k}>
                {L.kinds[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-desc`}>{L.description}</label>
          <textarea
            id={`${id}-desc`}
            rows={3}
            value={description}
            placeholder={L.placeholder}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={tooLong || undefined}
          />
          <p className="field-help">
            {length}/{MAX_DESCRIPTION}
          </p>
        </div>
        {error && (
          <p role="alert" className="field-help">
            ✗ {error}
          </p>
        )}
        <Button type="submit" block loading={sending} disabled={tooLong}>
          {L.submit}
        </Button>
      </form>
    </Sheet>
  );
}
