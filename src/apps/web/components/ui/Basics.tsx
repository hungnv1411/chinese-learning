'use client';

import type { HTMLAttributes, ReactNode } from 'react';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

export function Card({
  soft,
  tap,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { soft?: boolean; tap?: boolean }) {
  return <div {...rest} className={cx('card', soft && 'soft', tap && 'tap', className)} />;
}

export type BadgeVariant = 'default' | 'success' | 'streak' | 'blue' | 'warn' | 'danger';

export function Badge({ variant = 'default', children }: { variant?: BadgeVariant; children: ReactNode }) {
  return <span className={cx('badge', variant !== 'default' && `badge-${variant}`)}>{children}</span>;
}

export function Chip({
  disabled,
  children,
  ...rest
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'>) {
  return (
    <button type="button" {...rest} className="chip" disabled={disabled}>
      {children}
    </button>
  );
}

export function Progress({
  value,
  small,
  streak,
  label,
}: {
  value: number;
  small?: boolean;
  streak?: boolean;
  label: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cx('progress', small && 'sm', streak && 'streak')}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
    >
      <i style={{ ['--v' as string]: `${v}%` }} />
    </div>
  );
}

export function Seg<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    />
  );
}

export function Field({
  id,
  label,
  help,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {help && <p className="field-help">{help}</p>}
    </div>
  );
}
