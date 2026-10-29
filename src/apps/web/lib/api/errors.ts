import { ZodError } from 'zod';

export type ApiErrorStatus = 400 | 401 | 403 | 404 | 409 | 429 | 503;

/** Lỗi có chủ đích của API: trả về `{ error: { code, message } }` với đúng HTTP status. */
export class ApiError extends Error {
  constructor(
    public readonly status: ApiErrorStatus,
    public readonly code: string,
    message: string,
    public readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const errors = {
  unauthorized: () =>
    new ApiError(401, 'UNAUTHORIZED', 'Bạn cần đăng nhập để thực hiện thao tác này.'),
  forbidden: (message = 'Bạn không có quyền thực hiện thao tác này.') =>
    new ApiError(403, 'FORBIDDEN', message),
  notFound: (message = 'Không tìm thấy.') => new ApiError(404, 'NOT_FOUND', message),
  rateLimited: (retryAfterSec: number) =>
    new ApiError(429, 'RATE_LIMITED', 'Bạn thao tác quá nhanh, hãy thử lại sau ít phút.', {
      'Retry-After': String(retryAfterSec),
    }),
};

export function errorResponse(e: unknown): Response {
  if (e instanceof ApiError) {
    return Response.json(
      { error: { code: e.code, message: e.message } },
      { status: e.status, headers: e.headers },
    );
  }
  if (e instanceof ZodError) {
    return Response.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Dữ liệu gửi lên không hợp lệ.' } },
      { status: 400 },
    );
  }
  console.error(e);
  return Response.json(
    { error: { code: 'INTERNAL', message: 'Có lỗi xảy ra, hãy thử lại sau.' } },
    { status: 500 },
  );
}
