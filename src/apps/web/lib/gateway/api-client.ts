export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/** Gọi API nội bộ (cookie đi kèm). Lỗi theo `{ error: { code, message } }` thành ApiClientError. */
export async function apiFetch<T>(
  path: string,
  init: Omit<RequestInit, 'body'> & { json?: unknown } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetchImpl(path, {
    ...rest,
    headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : undefined,
    credentials: 'same-origin',
  });
  if (!res.ok) {
    let code = 'UNKNOWN';
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      /* không phải JSON */
    }
    throw new ApiClientError(res.status, code, message);
  }
  return (await res.json()) as T;
}
