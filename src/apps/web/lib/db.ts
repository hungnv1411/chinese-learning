import postgres from 'postgres';
import { getConfig } from './config';

let client: ReturnType<typeof postgres> | undefined;

/** Kết nối Postgres dùng chung của tiến trình web (tạo khi cần). */
export function getSql() {
  client ??= postgres(getConfig().DATABASE_URL, { max: 10 });
  return client;
}
