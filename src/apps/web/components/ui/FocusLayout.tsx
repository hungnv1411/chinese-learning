import type { ReactNode } from 'react';

/** Màn hình toàn trang cho bài học, ôn tập, kiểm tra. Không có thanh tab. */
export function FocusLayout({
  top,
  foot,
  children,
}: {
  top: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="focus">
      <div className="focus-top">{top}</div>
      <div className="focus-body">{children}</div>
      {foot}
    </div>
  );
}
