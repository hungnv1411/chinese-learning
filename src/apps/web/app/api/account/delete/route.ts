import { z } from 'zod';
import { handler } from '@/lib/api/handler';
import { requireUser } from '@/lib/api/viewer';
import { DELETE_CONFIRM_TEXT, certificatePdfKey, deleteAccount } from '@/lib/account/delete';
import { getSql } from '@/lib/db';
import { getObjectStore } from '@/lib/storage';

const body = z.object({ confirm: z.literal(DELETE_CONFIRM_TEXT) });

/** Xóa tài khoản của chính người gọi. Xóa PDF trên R2 sau commit, lỗi chỉ ghi log. */
export const POST = handler(body, async ({ req }) => {
  const { userId } = await requireUser(req);
  const { certificateCodes } = await deleteAccount(getSql(), userId);
  const store = getObjectStore();
  if (store && certificateCodes.length > 0) {
    try {
      await store.deleteObjects(certificateCodes.map(certificatePdfKey));
    } catch (e) {
      // Job dọn dẹp sẽ thử lại (spec 03 plan bước 6); không chặn việc xóa tài khoản.
      console.error('certificate pdf cleanup failed', { count: certificateCodes.length, e });
    }
  }
  return { ok: true };
});
