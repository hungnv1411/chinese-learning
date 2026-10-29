type Result = { ok: boolean; retryAfterSec: number };

// Cửa sổ trượt trong bộ nhớ tiến trình (một VPS, một container: D15).
const hits = new Map<string, number[]>();

/**
 * Cho qua tối đa `limit` lần trong `windowSec` giây theo `key`.
 * `now` (ms) truyền vào để test được; mặc định là giờ hiện tại.
 */
export function rateLimit(key: string, limit: number, windowSec: number, now = Date.now()): Result {
  const windowMs = windowSec * 1000;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    const oldest = recent[0] as number;
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfterSec: 0 };
}

/** Chỉ dùng trong test. */
export function resetRateLimits(): void {
  hits.clear();
}
