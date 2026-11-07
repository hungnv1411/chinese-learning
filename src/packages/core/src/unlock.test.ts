import { describe, expect, test } from 'vitest';
import {
  computeUnlockState,
  lockReason,
  type CurriculumIndex,
  type ProgressSnapshot,
} from './unlock';

/** Chương trình mẫu: pron, hsk1, hsk2 × 2 chủ đề × 3 bài thường + 1 bài ôn. */
function sample(over: { unpublished?: string[]; examOpen?: Partial<Record<string, boolean>> } = {}): CurriculumIndex {
  const stage = (id: 'pron' | 'hsk1' | 'hsk2', order: number) => ({
    id,
    order,
    examOpen: over.examOpen?.[id] ?? id !== 'pron',
    units: [1, 2].map((u) => {
      const uid = `${id}-u0${u}`;
      return {
        id: uid,
        published: !over.unpublished?.includes(uid),
        lessons: [
          ...[1, 2, 3].map((l) => ({ id: `${uid}-l0${l}`, type: 'normal' as const })),
          { id: `${uid}-cp`, type: 'checkpoint' as const },
        ],
      };
    }),
  });
  return { stages: [stage('pron', 0), stage('hsk1', 1), stage('hsk2', 2)] };
}

const done = (...ids: string[]) => Object.fromEntries(ids.map((i) => [i, { status: 'completed' as const }]));
const unit = (u: string) => [`${u}-l01`, `${u}-l02`, `${u}-l03`];
const progress = (
  lessons: Record<string, { status: 'in_progress' | 'completed' }> = {},
  stages: ProgressSnapshot['stages'] = {},
): ProgressSnapshot => ({ lessons, stages });

describe('computeUnlockState', () => {
  test('người mới: chỉ pron-u01-l01 available, mọi HSK locked', () => {
    const s = computeUnlockState(sample(), progress());
    const available = Object.entries(s.lessons).filter(([, v]) => v === 'available').map(([k]) => k);
    expect(available).toEqual(['pron-u01-l01']);
    expect(s.stages).toMatchObject({ pron: 'available', hsk1: 'locked', hsk2: 'locked' });
    expect(s.skipExam).toBeNull();
  });

  test('xong bài 1 → bài 2 available; bài ôn chưa mở tới khi xong cả 3 bài', () => {
    const c = sample();
    let s = computeUnlockState(c, progress(done('pron-u01-l01')));
    expect(s.lessons['pron-u01-l02']).toBe('available');
    expect(s.lessons['pron-u01-l03']).toBe('locked');
    s = computeUnlockState(c, progress(done('pron-u01-l01', 'pron-u01-l02')));
    expect(s.lessons['pron-u01-cp']).toBe('locked');
    s = computeUnlockState(c, progress(done(...unit('pron-u01'))));
    expect(s.lessons['pron-u01-cp']).toBe('available');
  });

  test('bài đang làm dở hiện in_progress', () => {
    const s = computeUnlockState(sample(), progress({ 'pron-u01-l01': { status: 'in_progress' } }));
    expect(s.lessons['pron-u01-l01']).toBe('in_progress');
  });

  test('bài ôn đạt → chủ đề 2 mở; bài ôn chưa đạt → chủ đề 2 vẫn khóa', () => {
    const c = sample();
    const base = done(...unit('pron-u01'));
    let s = computeUnlockState(c, progress({ ...base, 'pron-u01-cp': { status: 'in_progress' } }));
    expect(s.units['pron-u02']).toBe('locked');
    expect(s.lessons['pron-u02-l01']).toBe('locked');
    s = computeUnlockState(c, progress({ ...base, ...done('pron-u01-cp') }));
    expect(s.units['pron-u02']).toBe('available');
    expect(s.lessons['pron-u02-l01']).toBe('available');
  });

  test('học hết mọi bài HSK 1 nhưng chưa thi → chưa completed, HSK 2 locked, kiểm tra cuối available', () => {
    const all = (st: string) => ['u01', 'u02'].flatMap((u) => [...unit(`${st}-${u}`), `${st}-${u}-cp`]);
    const s = computeUnlockState(
      sample(),
      progress(done(...all('pron'), ...all('hsk1')), { pron: { completedVia: 'lessons' } }),
    );
    expect(s.stages.hsk1).toBe('available');
    expect(s.stages.hsk2).toBe('locked');
    expect(s.finalExam.hsk1).toBe('available');
    expect(s.finalExam.pron).toBe('none');
    expect(s.skipExam).toBe('hsk1');
  });

  test('examOpen = false → kiểm tra cuối locked dù đã đạt hết bài ôn; skipExam = null', () => {
    const all = ['u01', 'u02'].flatMap((u) => [...unit(`hsk1-${u}`), `hsk1-${u}-cp`]);
    const s = computeUnlockState(
      sample({ examOpen: { hsk1: false } }),
      progress(done(...all), { pron: { completedVia: 'lessons' } }),
    );
    expect(s.finalExam.hsk1).toBe('locked');
    expect(s.skipExam).toBeNull();
  });

  test('pron completed qua exam_skip → HSK 1 available; skipExam = hsk1', () => {
    const s = computeUnlockState(sample(), progress({}, { pron: { completedVia: 'exam_skip' } }));
    expect(s.stages).toMatchObject({ pron: 'completed', hsk1: 'available' });
    expect(s.skipExam).toBe('hsk1');
  });

  test('HSK 1 completed exam_skip → mọi bài HSK 1 available, HSK 2 available, skipExam = hsk2', () => {
    const s = computeUnlockState(
      sample(),
      progress(done('hsk1-u01-l02'), {
        pron: { completedVia: 'lessons' },
        hsk1: { completedVia: 'exam_skip' },
      }),
    );
    expect(s.lessons['hsk1-u02-cp']).toBe('available');
    expect(s.lessons['hsk1-u01-l01']).toBe('available');
    expect(s.lessons['hsk1-u01-l02']).toBe('completed');
    expect(s.stages.hsk2).toBe('available');
    expect(s.lessons['hsk2-u01-l01']).toBe('available');
    expect(s.skipExam).toBe('hsk2');
  });

  test('chủ đề 2 chưa phát hành → coming_soon; chủ đề 3 locked dù có dữ liệu tiến độ', () => {
    const c = sample({ unpublished: ['pron-u02'] });
    c.stages[0]!.units.push({
      id: 'pron-u03',
      published: true,
      lessons: [{ id: 'pron-u03-l01', type: 'normal' }],
    });
    const s = computeUnlockState(
      c,
      progress(done(...unit('pron-u01'), 'pron-u01-cp', 'pron-u03-l01')),
    );
    expect(s.units['pron-u02']).toBe('coming_soon');
    expect(s.units['pron-u03']).toBe('locked');
    expect(s.lessons['pron-u02-l01']).toBe('locked');
    // không xóa tiến độ có sẵn
    expect(s.lessons['pron-u03-l01']).toBe('completed');
  });

  test('bài 3 completed mà bài 2 chưa → bài 3 vẫn completed, bài 4 (ôn) theo mọi bài thường', () => {
    const s = computeUnlockState(sample(), progress(done('pron-u01-l01', 'pron-u01-l03')));
    expect(s.lessons['pron-u01-l02']).toBe('available');
    expect(s.lessons['pron-u01-l03']).toBe('completed');
    expect(s.lessons['pron-u01-cp']).toBe('locked');
  });

  test('học lại bài completed không đổi trạng thái', () => {
    const s = computeUnlockState(sample(), progress(done('pron-u01-l01')));
    expect(s.lessons['pron-u01-l01']).toBe('completed');
  });

  test('lộ trình không có trong chương trình → locked / none', () => {
    const s = computeUnlockState(sample(), progress());
    expect(s.stages.hsk3).toBe('locked');
    expect(s.finalExam.hsk3).toBe('none');
  });
});

describe('lockReason', () => {
  const c = sample();
  const reason = (id: string, p: ProgressSnapshot = progress()) =>
    lockReason(id, computeUnlockState(c, p), c);

  test('bài mở hoặc đã xong → null', () => {
    expect(reason('pron-u01-l01')).toBeNull();
    expect(reason('pron-u01-l01', progress(done('pron-u01-l01')))).toBeNull();
  });
  test('bài k+1 khóa → prev_lesson là bài k', () => {
    expect(reason('pron-u01-l03')).toEqual({ kind: 'prev_lesson', lessonId: 'pron-u01-l02' });
  });
  test('bài ôn khóa → bài thường đầu tiên chưa xong', () => {
    expect(reason('pron-u01-cp', progress(done('pron-u01-l01')))).toEqual({
      kind: 'prev_lesson',
      lessonId: 'pron-u01-l02',
    });
  });
  test('chủ đề khóa → checkpoint của chủ đề trước', () => {
    expect(reason('pron-u02-l01')).toEqual({ kind: 'checkpoint', unitId: 'pron-u01' });
  });
  test('lộ trình khóa → lộ trình trước cần hoàn thành', () => {
    expect(reason('hsk1-u01-l01')).toEqual({ kind: 'stage', stageId: 'pron' });
    expect(reason('hsk2-u01-l01')).toEqual({ kind: 'stage', stageId: 'hsk1' });
  });
  test('chủ đề chưa phát hành → coming_soon', () => {
    const cs = sample({ unpublished: ['pron-u02'] });
    const p = progress(done(...unit('pron-u01'), 'pron-u01-cp'));
    expect(lockReason('pron-u02-l01', computeUnlockState(cs, p), cs)).toEqual({ kind: 'coming_soon' });
  });
  test('bài không tồn tại → null', () => {
    expect(reason('nope')).toBeNull();
  });
});
