import type { ZodType } from 'zod';
import { ApiError, errorResponse } from './errors';

type Ctx<P> = { params: Promise<P> };

/**
 * Bọc route handler: parse body JSON bằng zod (nếu có schema), bắt mọi lỗi thành
 * `{ error: { code, message } }`. `fn` trả `Response` hoặc object (thành JSON 200).
 */
export function handler<B = undefined, P = Record<string, string>>(
  schema: ZodType<B> | null,
  fn: (args: { req: Request; body: B; params: P }) => Promise<Response | object> | Response | object,
) {
  return async (req: Request, ctx?: Ctx<P>): Promise<Response> => {
    try {
      let body = undefined as B;
      if (schema) {
        let raw: unknown;
        try {
          raw = await req.json();
        } catch {
          throw new ApiError(400, 'INVALID_JSON', 'Nội dung gửi lên không phải JSON hợp lệ.');
        }
        body = schema.parse(raw);
      }
      const params = (ctx ? await ctx.params : {}) as P;
      const out = await fn({ req, body, params });
      return out instanceof Response ? out : Response.json(out);
    } catch (e) {
      return errorResponse(e);
    }
  };
}
