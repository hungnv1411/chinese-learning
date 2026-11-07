import type postgres from 'postgres';
import type { CurriculumIndex, ProgressSnapshot, StageId } from '@clp/core';

type Sql = postgres.Sql;

export type LessonDisplay = {
  id: string;
  order: number;
  title: string;
  type: 'normal' | 'checkpoint';
  estimatedMinutes: number | null;
  newWordCount: number;
  skills: ('listen' | 'speak' | 'read' | 'write')[];
  /** Chữ Hán tiêu biểu của bài (hiện ở nút khi bài đã xong). */
  keyChar: string | null;
};
export type UnitDisplay = {
  id: string;
  order: number;
  title: string;
  description: string;
  image: string | null;
  sampleWords: string[];
  lessons: LessonDisplay[];
};
export type StageDisplay = { id: StageId; title: string; description: string; units: UnitDisplay[] };

export type Curriculum = { version: string | null; index: CurriculumIndex; display: StageDisplay[] };

type Step = { kind?: string; type?: string };

/** Kỹ năng của bài suy từ các bước: nghe, nói, đọc, viết (theo thứ tự cố định). */
export function skillsOf(steps: Step[]): LessonDisplay['skills'] {
  const has = new Set<LessonDisplay['skills'][number]>();
  for (const s of steps) {
    if (s.kind === 'writing' || s.type === 'write_char') has.add('write');
    else if (s.kind === 'speaking' || s.type === 'speak') has.add('speak');
    else if (s.type?.startsWith('listen')) has.add('listen');
    else if (s.kind === 'exercise' || s.kind === 'exercise_auto') has.add('read');
  }
  return (['listen', 'read', 'write', 'speak'] as const).filter((k) => has.has(k));
}

let cached: Curriculum | undefined;

/**
 * Chương trình học (cấu trúc + dữ liệu hiển thị), cache trong bộ nhớ theo `content_version`;
 * nhập nội dung mới thì phiên bản đổi và lần gọi sau đọc lại. Không có phiên bản thì không cache.
 */
export async function loadCurriculum(sql: Sql): Promise<Curriculum> {
  const [meta] = await sql<{ value: string }[]>`
    SELECT value FROM content_meta WHERE key = 'content_version'`;
  const version = meta?.value ?? null;
  if (cached && version !== null && cached.version === version) return cached;

  const [stages, units, lessons] = await Promise.all([
    sql<{ id: StageId; order: number; title: string; description: string; exam_open: boolean }[]>`
      SELECT id, "order", title, description, exam_open FROM stage ORDER BY "order"`,
    sql<{ id: string; stage_id: string; order: number; title: string; description: string; image: string | null; published: boolean }[]>`
      SELECT id, stage_id, "order", title, description, image, published FROM unit ORDER BY "order"`,
    sql<{
      id: string; unit_id: string; order: number; title: string; kind: string;
      estimated_minutes: number | null; words: { word: string }[] | null;
      chars: string[] | null; steps: Step[] | null;
    }[]>`
      SELECT id, unit_id, "order", title, kind, estimated_minutes,
             content->'newWords' AS words, content->'newChars' AS chars, content->'steps' AS steps
      FROM lesson ORDER BY "order"`,
  ]);

  const lessonsByUnit = new Map<string, (typeof lessons)[number][]>();
  for (const l of lessons) lessonsByUnit.set(l.unit_id, [...(lessonsByUnit.get(l.unit_id) ?? []), l]);
  const unitsByStage = new Map<string, (typeof units)[number][]>();
  for (const u of units) unitsByStage.set(u.stage_id, [...(unitsByStage.get(u.stage_id) ?? []), u]);

  const index: CurriculumIndex = { stages: [] };
  const display: StageDisplay[] = [];
  for (const s of stages) {
    const stageUnits = unitsByStage.get(s.id) ?? [];
    index.stages.push({
      id: s.id,
      order: s.order,
      examOpen: s.exam_open,
      units: stageUnits.map((u) => ({
        id: u.id,
        published: u.published,
        lessons: (lessonsByUnit.get(u.id) ?? []).map((l) => ({
          id: l.id,
          type: l.kind === 'checkpoint' ? 'checkpoint' : 'normal',
        })),
      })),
    });
    display.push({
      id: s.id,
      title: s.title,
      description: s.description,
      units: stageUnits.map((u) => {
        const ls = lessonsByUnit.get(u.id) ?? [];
        const words = ls.flatMap((l) => (l.words ?? []).map((w) => w.word));
        return {
          id: u.id,
          order: u.order,
          title: u.title,
          description: u.description,
          image: u.image,
          sampleWords: [...new Set(words)].slice(0, 3),
          lessons: ls.map((l) => ({
            id: l.id,
            order: l.order,
            title: l.title,
            type: l.kind === 'checkpoint' ? 'checkpoint' : 'normal',
            estimatedMinutes: l.estimated_minutes,
            newWordCount: l.words?.length ?? 0,
            skills: skillsOf(l.steps ?? []),
            keyChar: l.chars?.[0] ?? null,
          })),
        };
      }),
    });
  }
  const result = { version, index, display };
  if (version !== null) cached = result;
  return result;
}

export const clearCurriculumCache = (): void => {
  cached = undefined;
};

export async function loadProgressSnapshot(sql: Sql, userId: string): Promise<ProgressSnapshot> {
  const [lessons, stages] = await Promise.all([
    sql<{ lesson_id: string; status: 'in_progress' | 'completed' }[]>`
      SELECT lesson_id, status FROM lesson_progress WHERE user_id = ${userId}`,
    sql<{ stage_id: StageId; completed_via: 'lessons' | 'exam_skip' }[]>`
      SELECT stage_id, completed_via FROM stage_progress
      WHERE user_id = ${userId} AND status = 'completed' AND completed_via IS NOT NULL`,
  ]);
  return {
    lessons: Object.fromEntries(lessons.map((r) => [r.lesson_id, { status: r.status }])),
    stages: Object.fromEntries(stages.map((r) => [r.stage_id, { completedVia: r.completed_via }])),
  };
}
