import { z } from 'zod';
import { errors } from '@/lib/api/errors';
import { handler } from '@/lib/api/handler';
import { rateLimit } from '@/lib/api/rate-limit';
import { clientIp } from '@/lib/api/viewer';
import { getSql } from '@/lib/db';
import { PAGE_SIZE, searchDictionary } from '@/lib/dictionary/search';

const query = z.object({
  q: z.string().max(100).default(''),
  chip: z.enum(['all', 'hanzi', 'pinyin', 'english', 'hanviet']).default('all'),
  // Con trỏ: vị trí bắt đầu của trang tiếp theo (số nguyên không âm, giới hạn để không quét vô hạn).
  cursor: z
    .string()
    .regex(/^\d{1,5}$/)
    .optional(),
});

const LIMIT_PER_MINUTE = 60;

export const GET = handler(null, async ({ req }) => {
  const url = new URL(req.url);
  const { q, chip, cursor } = query.parse(Object.fromEntries(url.searchParams));
  const limited = rateLimit(`dict-search:${clientIp(req)}`, LIMIT_PER_MINUTE, 60);
  if (!limited.ok) throw errors.rateLimited(limited.retryAfterSec);

  const offset = cursor ? Number(cursor) : 0;
  const { groups } = await searchDictionary(getSql(), { q, chip, offset, limit: PAGE_SIZE });
  const more = groups.some((g) => g.hasMore);
  return {
    groups: groups.map(({ kind, items }) => ({ kind, items })),
    nextCursor: more ? String(offset + PAGE_SIZE) : null,
  };
});
