'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { apiFetch } from './api-client';
import { GuestStore } from './guest-store';

/**
 * Giao diện dữ liệu phía client. Khách và người dùng đăng nhập dùng cùng giao diện màn hình,
 * khác nhau ở nơi lưu. Mỗi module tự thêm phương thức của mình vào interface này
 * (06: loadLesson, saveStep, completeLesson; 09: startReview, answerReview…).
 */
export interface ProgressGateway {
  readonly kind: 'server' | 'guest';
}

/** Gọi API. Nội dung bài và tiến độ người dùng đăng nhập nằm ở server. */
export class ServerGateway implements ProgressGateway {
  readonly kind = 'server' as const;
  readonly api = apiFetch;
}

/** Đọc/ghi GuestStore và chạy logic packages/core tại chỗ; nội dung bài lấy từ API công khai. */
export class GuestGateway implements ProgressGateway {
  readonly kind = 'guest' as const;
  readonly api = apiFetch;
  constructor(readonly store: GuestStore = new GuestStore()) {}
}

const Ctx = createContext<ProgressGateway | null>(null);

/** Chọn gateway theo phiên đăng nhập (`signedIn` do layout server truyền xuống). */
export function GatewayProvider({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: ReactNode;
}) {
  const gateway = useMemo<ProgressGateway>(
    () => (signedIn ? new ServerGateway() : new GuestGateway()),
    [signedIn],
  );
  return <Ctx.Provider value={gateway}>{children}</Ctx.Provider>;
}

export function useGateway(): ProgressGateway {
  const g = useContext(Ctx);
  if (!g) throw new Error('useGateway cần được bọc trong <GatewayProvider>');
  return g;
}
