import type postgres from 'postgres';
import { computeUnlockState } from '@clp/core';
import { errors } from '@/lib/api/errors';
import { loadCurriculum, loadProgressSnapshot } from './load';

/**
 * Server quyết định bài có mở không (spec 05 §1). Bài khóa → 403 `LESSON_LOCKED`,
 * không có bài → 404. Bài đã `completed` luôn học lại được.
 */
export async function assertLessonOpen(
  sql: postgres.Sql,
  userId: string,
  lessonId: string,
): Promise<void> {
  const [curriculum, progress] = await Promise.all([loadCurriculum(sql), loadProgressSnapshot(sql, userId)]);
  const status = computeUnlockState(curriculum.index, progress).lessons[lessonId];
  if (status === undefined) throw errors.notFound('Không tìm thấy bài học.');
  if (status === 'locked') throw errors.lessonLocked();
}
