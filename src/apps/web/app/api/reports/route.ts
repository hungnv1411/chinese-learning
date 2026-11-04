import { errors } from '@/lib/api/errors';
import { handler } from '@/lib/api/handler';
import { rateLimit } from '@/lib/api/rate-limit';
import { getViewer } from '@/lib/api/viewer';
import { getSql } from '@/lib/db';
import { createReport } from '@/lib/reports/create';
import { reportBody } from '@/lib/reports/schema';

const GUEST_LIMIT_PER_DAY = 10;
const DAY_SEC = 86_400;

export const POST = handler(reportBody, async ({ req, body }) => {
  const viewer = await getViewer(req);
  if (viewer.kind === 'guest') {
    const limited = rateLimit(`report:${viewer.ip}`, GUEST_LIMIT_PER_DAY, DAY_SEC);
    if (!limited.ok) throw errors.rateLimited(limited.retryAfterSec);
  }
  const id = await createReport(getSql(), {
    ...body,
    userId: viewer.kind === 'user' ? viewer.userId : null,
    userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
  });
  return Response.json({ ok: true, id }, { status: 201 });
});
