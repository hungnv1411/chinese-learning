import type postgres from 'postgres';
import { computeUnlockState, lockReason } from '@clp/core';
import { loadCurriculum, loadProgressSnapshot } from './load';
import { stageProgress } from './progress';

export type PathData = Awaited<ReturnType<typeof getPath>>;

/** Dữ liệu cho `GET /api/path`: trạng thái khóa/mở (nguồn sự thật) + thông tin hiển thị. */
export async function getPath(sql: postgres.Sql, userId: string) {
  const [curriculum, progress] = await Promise.all([loadCurriculum(sql), loadProgressSnapshot(sql, userId)]);
  const state = computeUnlockState(curriculum.index, progress);
  const stageOrder = curriculum.index.stages.map((s) => s.id);
  const mastery = new Map(
    await Promise.all(curriculum.display.map(async (s) => [s.id, await stageProgress(sql, userId, s.id)] as const)),
  );
  const stages = curriculum.display.map((stage) => {
    const units = stage.units.map((unit) => {
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
    });
    const status = state.stages[stage.id];
    const prev = stageOrder[stageOrder.indexOf(stage.id) - 1] ?? null;
    return {
      ...stage,
      status,
      finalExam: state.finalExam[stage.id],
      // Màn C: từ/chữ đã thuộc (null với Phát âm), chủ đề xong/tổng, “Hoàn thành (thi vượt)”,
      // và lộ trình cần hoàn thành trước khi mở (chỉ khi đang khóa).
      progress: {
        words: mastery.get(stage.id)?.words ?? null,
        chars: mastery.get(stage.id)?.chars ?? null,
        units: { done: units.filter((u) => u.total > 0 && u.doneCount === u.total).length, total: units.length },
        completedVia: progress.stages[stage.id]?.completedVia ?? null,
        requires: status === 'locked' ? prev : null,
      },
      units,
    };
  });
  return { contentVersion: curriculum.version, skipExam: state.skipExam, stages };
}
