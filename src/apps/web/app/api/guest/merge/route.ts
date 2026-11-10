import { GuestProgressV1Schema } from '@clp/core';
import { handler } from '@/lib/api/handler';
import { requireUser } from '@/lib/api/viewer';
import { getSql } from '@/lib/db';
import { mergeGuestIntoAccount } from '@/lib/guest/merge';

/**
 * Gộp `guest_progress_v1` vào tài khoản vừa đăng nhập. Client chỉ xóa dữ liệu khách sau khi
 * nhận 200. Server kiểm tra lại toàn bộ, không tin dữ liệu khách (spec 03 §5).
 */
export const POST = handler(GuestProgressV1Schema, async ({ req, body }) => {
  const { userId } = await requireUser(req);
  const merged = await mergeGuestIntoAccount(getSql(), userId, body);
  return { merged };
});
