import type postgres from 'postgres';

type Sql = postgres.Sql;

export const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';
/** Server không tin client: một lần gửi tối đa 10 phút (client gửi sau mỗi bước/câu). */
export const MAX_SECONDS_PER_REPORT = 600;

/** Ngày `YYYY-MM-DD` của `now` theo múi giờ `tz` (sai múi giờ thì dùng mặc định). */
export function localDate(now: Date, tz: string | undefined): string {
  const fmt = (zone: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  try {
    return fmt(tz ?? DEFAULT_TZ);
  } catch {
    return fmt(DEFAULT_TZ);
  }
}

/** Cộng giây học vào `daily_activity` của ngày hiện tại. Trả tổng giây của ngày đó. */
export async function addActiveSeconds(
  sql: Sql,
  userId: string,
  opts: { seconds: number; now: Date; tz?: string },
): Promise<{ date: string; seconds: number }> {
  const date = localDate(opts.now, opts.tz);
  const add = Number.isFinite(opts.seconds)
    ? Math.min(MAX_SECONDS_PER_REPORT, Math.max(0, Math.floor(opts.seconds)))
    : 0;
  const [row] = await sql<{ seconds: number }[]>`
    INSERT INTO daily_activity (user_id, date, seconds)
    VALUES (${userId}, ${date}, ${add})
    ON CONFLICT (user_id, date)
    DO UPDATE SET seconds = daily_activity.seconds + EXCLUDED.seconds
    RETURNING seconds`;
  return { date, seconds: (row as { seconds: number }).seconds };
}
