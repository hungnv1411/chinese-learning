import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';
import { getConfig } from './config';

let client: ReturnType<typeof postgres> | undefined;
let db: ReturnType<typeof makeDb> | undefined;

const makeDb = (sql: ReturnType<typeof postgres>) => drizzle(sql, { schema });

/** Kết nối Postgres dùng chung của tiến trình web (tạo khi cần). */
export function getSql() {
  client ??= postgres(getConfig().DATABASE_URL, { max: 10 });
  return client;
}

export function getDb() {
  db ??= makeDb(getSql());
  return db;
}

export { schema };
