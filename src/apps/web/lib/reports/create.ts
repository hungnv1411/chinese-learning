import type postgres from 'postgres';
import type { ReportBody } from './schema';

/**
 * Phiên bản nội dung gắn vào báo cáo do server quyết định, không tin client: bài thì lấy
 * `contentVersion` của bài, còn lại (hoặc bài chưa có) lấy bản chung của lần nhập.
 */
async function contentVersionFor(sql: postgres.Sql, target: ReportBody['target']) {
  if (target.kind === 'lesson' && target.id) {
    const [row] = await sql<{ v: string | null }[]>`
      SELECT content->>'contentVersion' AS v FROM lesson WHERE id = ${target.id}`;
    if (row?.v) return row.v;
  }
  const [meta] = await sql<{ value: string }[]>`
    SELECT value FROM content_meta WHERE key = 'content_version'`;
  return meta?.value ?? null;
}

export async function createReport(
  sql: postgres.Sql,
  input: ReportBody & { userId: string | null; userAgent: string | null },
): Promise<number> {
  const contentVersion = await contentVersionFor(sql, input.target);
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO content_report
      (user_id, target_type, target_id, kind, description, content_version, user_agent)
    VALUES (${input.userId}, ${input.target.kind}, ${input.target.id ?? ''}, ${input.kind},
            ${input.description}, ${contentVersion}, ${input.userAgent})
    RETURNING id`;
  return (row as { id: number }).id;
}
