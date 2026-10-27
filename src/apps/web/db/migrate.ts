import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const here = import.meta.dirname;

/** Chạy pre-migrate.sql rồi các migration Drizzle trên `url`. */
export async function runMigrations(url: string): Promise<void> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(readFileSync(resolve(here, 'pre-migrate.sql'), 'utf8'));
    await migrate(drizzle(sql), { migrationsFolder: resolve(here, 'migrations') });
  } finally {
    await sql.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL là bắt buộc');
  await runMigrations(url);
  console.log('migrations: ok');
}
