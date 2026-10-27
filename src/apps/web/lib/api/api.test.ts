import { beforeEach, describe, expect, test } from 'vitest';
import { z } from 'zod';
import { errors } from './errors';
import { handler } from './handler';
import { rateLimit, resetRateLimits } from './rate-limit';
import { getViewer, requireUser } from './viewer';

const req = (init?: RequestInit) => new Request('http://x.test/api', init);

describe('rateLimit', () => {
  beforeEach(resetRateLimits);

  test('cho qua đúng limit lần trong cửa sổ, lần sau ok=false', () => {
    for (let i = 0; i < 3; i++) expect(rateLimit('k', 3, 60, 1000 + i).ok).toBe(true);
    const r = rateLimit('k', 3, 60, 1500);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThan(0);
  });

  test('qua cửa sổ thì cho lại', () => {
    for (let i = 0; i < 3; i++) rateLimit('k', 3, 60, 1000);
    expect(rateLimit('k', 3, 60, 1000 + 59_000).ok).toBe(false);
    expect(rateLimit('k', 3, 60, 1000 + 60_000).ok).toBe(true);
  });

  test('key khác nhau đếm riêng', () => {
    rateLimit('a', 1, 60, 0);
    expect(rateLimit('a', 1, 60, 1).ok).toBe(false);
    expect(rateLimit('b', 1, 60, 1).ok).toBe(true);
  });
});

describe('requireUser / getViewer', () => {
  test('khách bị 401 đúng định dạng', async () => {
    const h = handler(null, async ({ req }) => {
      await requireUser(req, async () => null);
      return { ok: true };
    });
    const res = await h(req());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: 'UNAUTHORIZED', message: expect.any(String) },
    });
  });

  test('có phiên thì trả user; khách lấy IP đầu tiên của X-Forwarded-For', async () => {
    expect(await getViewer(req(), async () => 'u1')).toEqual({ kind: 'user', userId: 'u1' });
    const guest = await getViewer(
      req({ headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } }),
      async () => null,
    );
    expect(guest).toEqual({ kind: 'guest', ip: '1.2.3.4' });
  });
});

describe('handler', () => {
  const schema = z.object({ n: z.number().int() });
  const h = handler(schema, ({ body }) => ({ double: body.n * 2 }));
  const post = (body: string) => req({ method: 'POST', body });

  test('body hợp lệ thì trả JSON 200', async () => {
    const res = await h(post('{"n":2}'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ double: 4 });
  });

  test('body sai schema thì 400 VALIDATION_ERROR', async () => {
    const res = await h(post('{"n":"x"}'));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
  });

  test('không phải JSON thì 400 INVALID_JSON', async () => {
    const res = await h(post('{oops'));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_JSON');
  });

  test('ApiError giữ status, code và header (429 có Retry-After)', async () => {
    const limited = handler(null, () => {
      throw errors.rateLimited(30);
    });
    const res = await limited(req());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect((await res.json()).error.code).toBe('RATE_LIMITED');
  });

  test('lỗi lạ thì 500 mà không lộ chi tiết', async () => {
    const boom = handler(null, () => {
      throw new Error('secret db password');
    });
    const res = await boom(req());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
  });
});
