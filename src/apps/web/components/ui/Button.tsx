import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './icons';

export type ButtonVariant = 'primary' | 'secondary' | 'blue' | 'streak' | 'danger' | 'white' | 'quiet';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  block?: boolean;
  /** Đang xử lý: khóa nút và đặt aria-busy. */
  loading?: boolean;
  children: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  loading,
  className,
  disabled,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const cls = ['btn', `btn-${variant}`, size === 'sm' && 'btn-sm', block && 'btn-block', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button {...rest} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined}>
      {children}
    </button>
  );
}

/** Nút chỉ có biểu tượng: `label` (aria-label) là bắt buộc (non-functional §4). */
export function IconButton({
  icon,
  label,
  className,
  type = 'button',
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> & {
  icon: IconName;
  label: string;
}) {
  return (
    <button {...rest} type={type} className={['icon-btn', className].filter(Boolean).join(' ')} aria-label={label}>
      <Icon name={icon} />
    </button>
  );
}
