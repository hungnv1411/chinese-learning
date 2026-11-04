import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type postgres from 'postgres';
import { parse } from 'yaml';
import { z } from 'zod';

const https = z.string().url().startsWith('https://');
const nonEmpty = z.string().trim().min(1);

const raw = z.object({
  id: nonEmpty,
  name: nonEmpty,
  url: https,
  used_for: nonEmpty,
  license: nonEmpty,
  license_short: nonEmpty,
  license_url: https,
  attribution: nonEmpty,
});

export type Source = {
  id: string;
  name: string;
  url: string;
  usedFor: string;
  license: string;
  licenseShort: string;
  licenseUrl: string;
  attribution: string;
};

export function parseSources(text: string): Source[] {
  return z
    .array(raw)
    .min(1)
    .parse(parse(text))
    .map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
      usedFor: s.used_for,
      license: s.license,
      licenseShort: s.license_short,
      licenseUrl: s.license_url,
      attribution: s.attribution,
    }));
}

// `next dev`, `next start` và bản standalone đều chạy với cwd = thư mục apps/web;
// file nằm ở gốc repo (Dockerfile sao chép vào ảnh, next.config đưa vào vết build).
const SOURCES_FILE = resolve(process.cwd(), '../../../content/sources.yaml');

/** Đọc `content/sources.yaml` (nguồn dữ liệu và giấy phép, 01 bước 9). */
export function loadSources(file = SOURCES_FILE): Source[] {
  return parseSources(readFileSync(file, 'utf8'));
}

/** Số chữ có âm Hán Việt do AI bổ sung; null nếu không đọc được DB (trang vẫn hiển thị). */
export async function countAiHanViet(sql: postgres.Sql): Promise<number | null> {
  try {
    const [row] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM hanzi WHERE han_viet_source = 'ai'`;
    return row?.n ?? 0;
  } catch {
    return null;
  }
}
