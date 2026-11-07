import { handler } from '@/lib/api/handler';
import { requireUser } from '@/lib/api/viewer';
import { getSql } from '@/lib/db';
import { getPath } from '@/lib/path/path';

/** Khách dùng `GuestGateway.getPath()` ở client (cùng `computeUnlockState`), không gọi API này. */
export const GET = handler(null, async ({ req }) => {
  const { userId } = await requireUser(req);
  return getPath(getSql(), userId);
});
