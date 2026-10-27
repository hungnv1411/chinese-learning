export type HealthResult =
  { status: 200; body: { ok: true } } | { status: 503; body: { ok: false } };

/** `ping` chạy truy vấn nhẹ (SELECT 1). Lỗi kết nối thì trả 503. */
export async function checkHealth(ping: () => Promise<unknown>): Promise<HealthResult> {
  try {
    await ping();
    return { status: 200, body: { ok: true } };
  } catch {
    return { status: 503, body: { ok: false } };
  }
}
