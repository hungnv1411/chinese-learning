import type { GuestCard, GuestProgressV1, GuestSettings } from './guest';
import { GUEST_LESSON_LIMIT } from './guest';
import { computeUnlockState, type CurriculumIndex, type ProgressSnapshot } from './unlock';

/** Bài thuộc tập học thử: 3 bài thường đầu của `pron` và của `hsk1` (spec 03 §2). */
export function trialLessonIds(curriculum: CurriculumIndex): Set<string> {
  const out = new Set<string>();
  for (const id of ['pron', 'hsk1'] as const) {
    const stage = curriculum.stages.find((s) => s.id === id);
    const normals = (stage?.units ?? [])
      .flatMap((u) => u.lessons)
      .filter((l) => l.type === 'normal');
    for (const l of normals.slice(0, GUEST_LESSON_LIMIT)) out.add(l.id);
  }
  return out;
}

export interface AccountLesson {
  status: 'in_progress' | 'completed';
  currentStep: number;
  stepState: unknown;
  bestScore: number | null;
  contentVersion: string | null;
  completedAt: string | null;
}

export interface AccountSnapshot {
  lessons: Record<string, AccountLesson>;
  stages: ProgressSnapshot['stages'];
  /** `${dictEntryId}:${cardType}` của các thẻ tài khoản đã có. */
  cardKeys: string[];
}

export interface MergeCtx {
  curriculum: CurriculumIndex;
  trialIds: Set<string>;
  /** Mục từ điển (từ và chữ) của từng bài, để loại thẻ của từ không thuộc bài hợp lệ. */
  lessonEntries: Record<string, number[]>;
  now: Date;
}

export interface LessonUpsert {
  lessonId: string;
  status: 'in_progress' | 'completed';
  currentStep: number;
  stepState: unknown;
  bestScore: number | null;
  contentVersion: string | null;
  completedAt?: string;
}

export interface MergePlan {
  upsertLessonProgress: LessonUpsert[];
  insertCards: GuestCard[];
  /** Cộng dồn vào `daily_activity`. */
  addDaily: { date: string; seconds: number; lessonsCompleted: number; reviewsDone: number }[];
  setStageCompleted: { stageId: 'pron'; via: 'exam_skip' }[];
  /** null = giữ cài đặt của tài khoản. */
  setSettings: GuestSettings | null;
}

const MAX_DAILY_MINUTES = 24 * 60;
const MAX_DAILY_REVIEWS = 1000;
const DAY_MS = 86_400_000;

const lessonOrder = (c: CurriculumIndex): string[] =>
  [...c.stages]
    .sort((a, b) => a.order - b.order)
    .flatMap((s) => s.units.flatMap((u) => u.lessons.map((l) => l.id)));

/**
 * Gộp tiến độ khách vào tài khoản (spec 03 §5). Hàm thuần: trả danh sách thao tác để server áp
 * dụng trong một transaction. Không tin dữ liệu khách: chỉ nhận bài thuộc tập học thử và đúng
 * thứ tự mở khóa, tối đa `GUEST_LESSON_LIMIT` bài hoàn thành.
 */
export function mergeGuestProgress(
  account: AccountSnapshot,
  guest: GuestProgressV1,
  ctx: MergeCtx,
): MergePlan {
  const accountHasProgress =
    Object.keys(account.lessons).length > 0 ||
    account.cardKeys.length > 0 ||
    Object.keys(account.stages).length > 0;

  // Bài kiểm tra pinyin: chấp nhận không kiểm tra lại (server không xác minh được).
  const setStageCompleted: MergePlan['setStageCompleted'] =
    guest.pinyinTest?.passed && !account.stages.pron ? [{ stageId: 'pron', via: 'exam_skip' }] : [];
  const stages: ProgressSnapshot['stages'] = { ...account.stages };
  if (setStageCompleted.length > 0) stages.pron = { completedVia: 'exam_skip' };

  // 1. Lọc bài: thuộc tập thử và mở được tại thời điểm xét (theo thứ tự chương trình).
  const known: ProgressSnapshot['lessons'] = Object.fromEntries(
    Object.entries(account.lessons).map(([id, l]) => [id, { status: l.status }]),
  );
  const accepted: string[] = [];
  let completedCount = 0;
  for (const id of lessonOrder(ctx.curriculum)) {
    const g = guest.lessons[id];
    if (!g || !ctx.trialIds.has(id)) continue;
    if (g.status === 'completed' && completedCount >= GUEST_LESSON_LIMIT) continue;
    const state = computeUnlockState(ctx.curriculum, { lessons: known, stages });
    const st = state.lessons[id];
    if (st !== 'available' && st !== 'in_progress' && st !== 'completed') continue;
    accepted.push(id);
    if (g.status === 'completed') completedCount += 1;
    if (known[id]?.status !== 'completed') known[id] = { status: g.status };
  }

  // 4a. Bài: lấy trạng thái tiến xa hơn; bestScore lấy max.
  const upsertLessonProgress: LessonUpsert[] = [];
  for (const id of accepted) {
    const g = guest.lessons[id]!;
    const a = account.lessons[id];
    const maxScore = (x: number | null, y: number | null) =>
      x === null ? y : y === null ? x : Math.max(x, y);
    const guestWins =
      !a ||
      (g.status === 'completed' && a.status !== 'completed') ||
      (g.status === a.status && g.status === 'in_progress' && g.currentStep > a.currentStep);
    const bestScore = maxScore(a?.bestScore ?? null, g.bestScore);
    const winner = guestWins
      ? {
          status: g.status,
          currentStep: g.currentStep,
          stepState: g.stepState,
          contentVersion: g.contentVersion as string | null,
          completedAt: g.completedAt ?? null,
        }
      : a!;
    const completedAt =
      winner.status === 'completed' ? (winner.completedAt ?? ctx.now.toISOString()) : undefined;
    if (!guestWins && bestScore === a!.bestScore) continue; // không có gì mới
    upsertLessonProgress.push({
      lessonId: id,
      status: winner.status,
      currentStep: winner.currentStep,
      stepState: winner.stepState,
      bestScore,
      contentVersion: winner.contentVersion,
      ...(completedAt ? { completedAt } : {}),
    });
  }

  // 4b. Thẻ: khóa đã có thì giữ của tài khoản; thẻ của từ ngoài bài hợp lệ thì bỏ.
  const validEntries = new Set(accepted.flatMap((id) => ctx.lessonEntries[id] ?? []));
  const seen = new Set(account.cardKeys);
  const insertCards: GuestCard[] = [];
  for (const c of guest.cards) {
    const key = `${c.dictEntryId}:${c.cardType}`;
    if (seen.has(key) || !validEntries.has(c.dictEntryId)) continue;
    seen.add(key);
    insertCards.push({ ...c, cardKey: key });
  }

  // 4c. Hoạt động hằng ngày: cộng dồn, chặn số liệu phi lý và ngày tương lai.
  const latest = ctx.now.getTime() + DAY_MS; // dung sai múi giờ
  const addDaily: MergePlan['addDaily'] = [];
  for (const [date, d] of Object.entries(guest.daily).sort(([x], [y]) => x.localeCompare(y))) {
    if (Date.parse(`${date}T00:00:00Z`) > latest) continue;
    addDaily.push({
      date,
      seconds: Math.round(Math.min(d.minutes, MAX_DAILY_MINUTES) * 60),
      lessonsCompleted: Math.min(d.lessonsCompleted, GUEST_LESSON_LIMIT),
      reviewsDone: Math.min(d.reviewsDone, MAX_DAILY_REVIEWS),
    });
  }

  return {
    upsertLessonProgress,
    insertCards,
    addDaily,
    setStageCompleted,
    setSettings:
      accountHasProgress || Object.keys(guest.settings).length === 0 ? null : guest.settings,
  };
}
