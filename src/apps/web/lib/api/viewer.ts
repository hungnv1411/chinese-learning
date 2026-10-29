import { errors } from './errors';

export type Viewer = { kind: 'user'; userId: string } | { kind: 'guest'; ip: string };

/** Trả userId nếu request có phiên hợp lệ (cookie hoặc `Authorization: Bearer`), ngược lại null. */
export type SessionResolver = (req: Request) => Promise<string | null>;

export function clientIp(req: Request): string {
  // Caddy đặt X-Forwarded-For; lấy phần tử đầu tiên.
  const xff = req.headers.get('x-forwarded-for');
  return xff?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

async function defaultResolver(req: Request): Promise<string | null> {
  const { resolveSession } = await import('../auth');
  return resolveSession(req);
}

export async function getViewer(
  req: Request,
  resolve: SessionResolver = defaultResolver,
): Promise<Viewer> {
  const userId = await resolve(req);
  return userId ? { kind: 'user', userId } : { kind: 'guest', ip: clientIp(req) };
}

/** Ném 401 (định dạng chuẩn) nếu là khách. */
export async function requireUser(
  req: Request,
  resolve: SessionResolver = defaultResolver,
): Promise<{ kind: 'user'; userId: string }> {
  const viewer = await getViewer(req, resolve);
  if (viewer.kind !== 'user') throw errors.unauthorized();
  return viewer;
}
