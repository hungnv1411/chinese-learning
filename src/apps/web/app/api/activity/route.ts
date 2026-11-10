import { z } from 'zod';
import { handler } from '@/lib/api/handler';
import { requireUser } from '@/lib/api/viewer';
import { MAX_SECONDS_PER_REPORT, addActiveSeconds } from '@/lib/activity/record';
import { getSql } from '@/lib/db';

const body = z.object({
  seconds: z.number().int().min(0).max(MAX_SECONDS_PER_REPORT),
  tz: z.string().max(64).optional(),
});

/** Ghi thời gian học (luyện nghe thanh, và các màn không có API tiến độ riêng). */
export const POST = handler(body, async ({ req, body }) => {
  const { userId } = await requireUser(req);
  const out = await addActiveSeconds(getSql(), userId, {
    seconds: body.seconds,
    tz: body.tz,
    now: new Date(),
  });
  return { ok: true, ...out };
});
