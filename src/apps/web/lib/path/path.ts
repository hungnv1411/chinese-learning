import type postgres from 'postgres';
import { computeUnlockState, lockReason } from '@clp/core';
import { loadCurriculum, loadProgressSnapshot } from './load';

/** Dữ liệu cho `GET /api/path`: trạng thái khóa/mở (nguồn sự thật) + thông tin hiển thị. */
export async function getPath(sql: postgres.Sql, userId: string) {
  const [curriculum, progress] = await Promise.all([loadCurriculum(sql), loadProgressSnapshot(sql, userId)]);
  const state = computeUnlockState(curriculum.index, progress);
  const stages = curriculum.display.map((stage) => ({
    ...stage,
    status: state.stages[stage.id],
    finalExam: state.finalExam[stage.id],
    units: stage.units.map((unit) => {
      const lessons = unit.lessons.map((l) => ({
        ...l,
        status: state.lessons[l.id]!,
        lockReason: lockReason(l.id, state, curriculum.index),
        keyChar: state.lessons[l.id] === 'completed' ? l.keyChar : null,
      }));
      return {
        ...unit,
        status: state.units[unit.id]!,
        doneCount: lessons.filter((l) => l.status === 'completed').length,
        total: lessons.length,
        lessons,
      };
    }),
  }));
  return { contentVersion: curriculum.version, skipExam: state.skipExam, stages };
}
