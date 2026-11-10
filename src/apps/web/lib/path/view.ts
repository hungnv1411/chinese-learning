import type { LockReason } from '@clp/core';
import type { PathData } from './path';
import { vi } from '@/lib/strings/vi';

const L = vi.path;

export type PathStage = PathData['stages'][number];
export type PathUnit = PathStage['units'][number];
export type PathLesson = PathUnit['lessons'][number];

/** Độ lệch ngang (px) của nút bài, lặp theo chỉ số trong chủ đề để con đường uốn lượn. */
const OFFSETS = [28, 0, -28, -8, 12];
export const nodeOffset = (index: number): number => OFFSETS[index % OFFSETS.length]!;

/** Lộ trình hiển thị đầu tiên: đang học (`available`), nếu không thì lộ trình xong cuối cùng, nếu không thì đầu tiên. */
export function defaultStage(stages: PathStage[]): PathStage | undefined {
  return (
    stages.find((s) => s.status === 'available') ??
    [...stages].reverse().find((s) => s.status === 'completed') ??
    stages[0]
  );
}

/** Bài hiện tại: bài đang làm dở đầu tiên, nếu không thì bài mở đầu tiên chưa xong. */
export function currentLesson(stage: PathStage): PathLesson | undefined {
  const all = stage.units.flatMap((u) => (u.status === 'available' ? u.lessons : []));
  return all.find((l) => l.status === 'in_progress') ?? all.find((l) => l.status === 'available');
}

export function lockMessage(
  reason: LockReason | null,
  stages: PathStage[],
): string {
  if (!reason) return L.lock.generic;
  const lessons = stages.flatMap((s) => s.units.flatMap((u) => u.lessons));
  switch (reason.kind) {
    case 'prev_lesson': {
      const l = lessons.find((x) => x.id === reason.lessonId);
      return l ? L.lock.prevLesson(l.title) : L.lock.generic;
    }
    case 'checkpoint': {
      const u = stages.flatMap((s) => s.units).find((x) => x.id === reason.unitId);
      return u ? L.lock.checkpoint(u.title) : L.lock.generic;
    }
    case 'stage': {
      const s = stages.find((x) => x.id === reason.stageId);
      return s ? L.lock.stage(s.title) : L.lock.generic;
    }
    case 'coming_soon':
      return L.lock.comingSoon;
  }
}
