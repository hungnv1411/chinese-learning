import type { StageId } from './types';

export type LessonType = 'normal' | 'checkpoint';

export interface CurriculumIndex {
  stages: {
    id: StageId;
    order: number;
    examOpen: boolean;
    units: {
      id: string;
      published: boolean;
      lessons: { id: string; type: LessonType }[];
    }[];
  }[];
}

export interface ProgressSnapshot {
  lessons: Record<string, { status: 'in_progress' | 'completed' }>;
  stages: Partial<Record<StageId, { completedVia: 'lessons' | 'exam_skip' }>>;
}

export type StageStatus = 'locked' | 'available' | 'completed';
export type UnitStatus = 'locked' | 'available' | 'coming_soon';
export type LessonStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export interface UnlockState {
  stages: Record<StageId, StageStatus>;
  units: Record<string, UnitStatus>;
  lessons: Record<string, LessonStatus>;
  /** `none` cho lộ trình Phát âm (không có bài kiểm tra cuối). */
  finalExam: Record<StageId, 'locked' | 'available' | 'none'>;
  /** Lộ trình được thi vượt (chỉ một, không nhảy hai cấp). */
  skipExam: StageId | null;
}

export type LockReason =
  | { kind: 'prev_lesson'; lessonId: string }
  | { kind: 'checkpoint'; unitId: string }
  | { kind: 'stage'; stageId: StageId }
  | { kind: 'coming_soon' };

const STAGE_IDS: StageId[] = ['pron', 'hsk1', 'hsk2', 'hsk3'];

type Stage = CurriculumIndex['stages'][number];
type Unit = Stage['units'][number];

const sortedStages = (c: CurriculumIndex) => [...c.stages].sort((a, b) => a.order - b.order);

/** Bài chốt chủ đề: bài ôn nếu có, không thì bài cuối. */
const gateLesson = (u: Unit) =>
  u.lessons.find((l) => l.type === 'checkpoint') ?? u.lessons[u.lessons.length - 1];

/**
 * Tính trạng thái khóa/mở (spec 05 §1). Hàm thuần, chạy ở client (khách) và server.
 * Trạng thái `locked`/`available` không lưu; tiến độ đã có (`completed`) không bao giờ bị xóa.
 */
export function computeUnlockState(curriculum: CurriculumIndex, progress: ProgressSnapshot): UnlockState {
  const state: UnlockState = {
    stages: Object.fromEntries(STAGE_IDS.map((id) => [id, 'locked'])) as UnlockState['stages'],
    units: {},
    lessons: {},
    finalExam: Object.fromEntries(STAGE_IDS.map((id) => [id, 'none'])) as UnlockState['finalExam'],
    skipExam: null,
  };
  const isDone = (lessonId: string) => progress.lessons[lessonId]?.status === 'completed';

  let prevCompleted = true; // lộ trình đầu (pron) luôn mở
  for (const stage of sortedStages(curriculum)) {
    const via = progress.stages[stage.id]?.completedVia;
    const stageStatus: StageStatus = via ? 'completed' : prevCompleted ? 'available' : 'locked';
    state.stages[stage.id] = stageStatus;
    prevCompleted = stageStatus === 'completed';
    const stageOpen = stageStatus !== 'locked';
    const skipped = via === 'exam_skip';

    let unitOpen = stageOpen; // chủ đề trước đã đạt (và đã phát hành)
    for (const unit of stage.units) {
      let unitStatus: UnitStatus;
      if (!unit.published) {
        unitStatus = 'coming_soon';
        unitOpen = false; // mọi chủ đề sau cũng không mở
      } else {
        unitStatus = unitOpen || (skipped && stageOpen) ? 'available' : 'locked';
      }
      state.units[unit.id] = unitStatus;

      const open = unitStatus === 'available';
      const normals = unit.lessons.filter((l) => l.type === 'normal');
      let prevNormalDone = true;
      for (const lesson of unit.lessons) {
        let unlocked: boolean;
        if (skipped && open) unlocked = true;
        else if (!open) unlocked = false;
        else if (lesson.type === 'checkpoint') unlocked = normals.every((l) => isDone(l.id));
        else unlocked = prevNormalDone;
        if (lesson.type === 'normal') prevNormalDone = isDone(lesson.id);

        const p = progress.lessons[lesson.id];
        state.lessons[lesson.id] =
          p?.status === 'completed'
            ? 'completed'
            : !unlocked
              ? 'locked'
              : p?.status === 'in_progress'
                ? 'in_progress'
                : 'available';
      }

      const gate = gateLesson(unit);
      if (unitStatus === 'available' && !skipped) {
        unitOpen = gate ? isDone(gate.id) : true;
      } else if (unitStatus === 'available') {
        unitOpen = true; // thi vượt: chủ đề nào cũng mở
      } else if (unitStatus === 'locked') {
        unitOpen = false;
      }
    }

    if (stage.id !== 'pron') {
      const allCheckpointsDone =
        stage.units.length > 0 &&
        stage.units.every((u) => u.published && (gateLesson(u) ? isDone(gateLesson(u)!.id) : true));
      state.finalExam[stage.id] = stageOpen && stage.examOpen && allCheckpointsDone ? 'available' : 'locked';
      if (stageStatus === 'available' && stage.examOpen && state.skipExam === null) {
        state.skipExam = stage.id;
      }
    }
  }
  return state;
}

/**
 * Lý do một bài đang khóa, cho thông báo “Hoàn thành bài 3 để mở”. `null` khi bài không khóa
 * (hoặc không có trong chương trình). Với `stage`, `stageId` là lộ trình cần hoàn thành.
 */
export function lockReason(
  lessonId: string,
  state: UnlockState,
  curriculum: CurriculumIndex,
): LockReason | null {
  if (state.lessons[lessonId] !== 'locked') return null;
  const stages = sortedStages(curriculum);
  for (const [si, stage] of stages.entries()) {
    for (const [ui, unit] of stage.units.entries()) {
      const idx = unit.lessons.findIndex((l) => l.id === lessonId);
      if (idx < 0) continue;

      const unitStatus = state.units[unit.id];
      if (unitStatus === 'coming_soon') return { kind: 'coming_soon' };
      if (unitStatus === 'locked') {
        if (state.stages[stage.id] === 'locked') {
          const prev = stages[si - 1];
          return prev ? { kind: 'stage', stageId: prev.id } : null;
        }
        // chủ đề đứng sau một chủ đề chưa phát hành → cũng “sắp ra mắt”
        if (stage.units.slice(0, ui).some((u) => !u.published)) return { kind: 'coming_soon' };
        const prevUnit = stage.units[ui - 1];
        return prevUnit ? { kind: 'checkpoint', unitId: prevUnit.id } : null;
      }

      const lesson = unit.lessons[idx]!;
      const isDone = (id: string) => state.lessons[id] === 'completed';
      if (lesson.type === 'checkpoint') {
        const missing = unit.lessons.find((l) => l.type === 'normal' && !isDone(l.id));
        return missing ? { kind: 'prev_lesson', lessonId: missing.id } : null;
      }
      const prev = unit.lessons.slice(0, idx).reverse().find((l) => l.type === 'normal');
      return prev ? { kind: 'prev_lesson', lessonId: prev.id } : null;
    }
  }
  return null;
}
