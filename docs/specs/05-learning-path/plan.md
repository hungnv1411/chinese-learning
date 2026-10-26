# Plan thực hiện: 05 – Lộ trình (con đường học, khóa/mở)

Spec: [learning-path.md](learning-path.md). Quy ước chung: [00-foundation/plan.md](../00-foundation/plan.md).

## 1. Màn hình design

`path.html` → route `/lo-trinh`:
- Con đường một lộ trình (màn A): banner chủ đề, các nút `.node` (`done`, `current`, `locked`), nút bài ôn chủ đề hình chữ nhật có sao, nút Bài kiểm tra cuối + hình chứng nhận chờ.
- Toast khi bấm bài khóa (màn B).
- `dialog#stages` “Chọn lộ trình” = tổng quan các lộ trình (màn C).

## 2. Phụ thuộc

- 02: `stage`, `unit` (`published`), `lesson`, `stage.exam_open`.
- 09: mức “Đã thuộc” theo từ (`masteryOfWord`).
- 12: trạng thái chờ 24 giờ, thi vượt.
- Cung cấp cho: 03 (merge), 04 (bài tiếp theo), 06 (chặn mở bài), 12 (điều kiện thi).

## 3. Các bước

### Bước 1. Logic khóa/mở — `packages/core/src/unlock.ts`
Phần quan trọng nhất (spec §1), test đầy đủ.

```ts
interface CurriculumIndex {
  stages: { id: StageId; order: number; examOpen: boolean;
    units: { id: string; published: boolean;
      lessons: { id: string; type: 'normal' | 'checkpoint' }[] }[] }[];
}
interface ProgressSnapshot {
  lessons: Record<string, { status: 'in_progress' | 'completed' }>;
  stages: Partial<Record<StageId, { completedVia: 'lessons' | 'exam_skip' }>>;
}
interface UnlockState {
  stages: Record<StageId, 'locked' | 'available' | 'completed'>;
  units: Record<string, 'locked' | 'available' | 'coming_soon'>;
  lessons: Record<string, 'locked' | 'available' | 'in_progress' | 'completed'>;
  finalExam: Record<StageId, 'locked' | 'available' | 'none'>;   // 'none' cho pron
  skipExam: StageId | null;                                        // lộ trình được thi vượt
}
```

Quy tắc:
- `pron` luôn mở. HSK *n* mở khi lộ trình trước `completed`.
- Lộ trình `completed` chỉ khi có trong `progress.stages` (đạt bài kiểm tra cuối, thi vượt, hoặc với `pron` là đạt bài kiểm tra pinyin). Học hết bài **chưa** tính.
- Chủ đề đầu mở khi lộ trình mở; chủ đề sau mở khi bài ôn của chủ đề trước `completed` (= đạt, xem 00 bước 4). Chủ đề `published = false` → `coming_soon`, và mọi chủ đề sau nó cũng không mở.
- Bài 1 mở khi chủ đề mở; bài *k+1* mở khi bài *k* `completed`; bài ôn mở khi mọi bài thường của chủ đề `completed`.
- Bài kiểm tra cuối `available` khi mọi bài ôn của lộ trình đạt **và** `examOpen`.
- `skipExam` = lộ trình HSK đang `available` (chưa `completed`) và `examOpen`, chỉ một lộ trình (không nhảy hai cấp).
- Lộ trình `completed` với `exam_skip`: **mọi** bài trong lộ trình thành `available` (nếu chưa `completed`).
- Học lại bài `completed` không đổi trạng thái.

`lockReason(lessonId, state, curriculum)`: `{ kind: 'prev_lesson', lessonId } | { kind: 'checkpoint', unitId } | { kind: 'stage', stageId } | { kind: 'coming_soon' }`, dùng cho toast màn B (“Hoàn thành bài 3 để mở”).

Test (dùng chương trình mẫu 3 lộ trình × 2 chủ đề × 3 bài + bài ôn):
- Người mới: chỉ `pron-u01-l01` available, mọi HSK locked.
- Xong bài 1 → bài 2 available; bài ôn chưa mở cho tới khi xong cả 3 bài.
- Bài ôn đạt → chủ đề 2 mở; bài ôn chưa đạt (`in_progress`) → chủ đề 2 vẫn khóa.
- Học hết mọi bài của HSK 1 nhưng chưa thi → HSK 1 chưa completed, HSK 2 locked, `finalExam.hsk1 = available`.
- `examOpen = false` → `finalExam = locked` dù đã đạt hết bài ôn; `skipExam = null`.
- `pron` completed qua `exam_skip` → HSK 1 available; `skipExam = 'hsk1'`.
- HSK 1 completed `exam_skip` → mọi bài HSK 1 available, HSK 2 available, `skipExam = 'hsk2'`.
- Chủ đề 2 `published = false` → `coming_soon`, chủ đề 3 locked dù dữ liệu tiến độ có.
- Dữ liệu tiến độ có bài 3 `completed` mà bài 2 chưa → bài 3 vẫn hiện `completed` (không xóa tiến độ), nhưng bài 4 chỉ mở theo bài 3 (ghi rõ trong test để cố định hành vi).

### Bước 2. Server: một nguồn sự thật
- `lib/path/load.ts`: `loadCurriculumIndex()` (cache theo `content_version`), `loadProgressSnapshot(userId)`.
- `GET /api/path`: trả `UnlockState` + dữ liệu hiển thị (tiêu đề, số từ mới, thời lượng, kỹ năng, chữ tiêu biểu của bài đã xong, từ tiêu biểu của chủ đề).
- `assertLessonOpen(userId, lessonId)`: dùng ở `GET /api/lessons/[id]` (06) và các API ghi tiến độ. Bài `locked` → 403 `LESSON_LOCKED`.
- Khách: `GuestGateway.getPath()` chạy cùng `computeUnlockState` trên `guest_progress_v1`, rồi áp thêm giới hạn học thử (03): bài thứ 4 hiện như mở nhưng bấm vào thì hiện `LoginSheet variant='blocked'`.
- Test: API mở bài khóa trả 403; mở bài `completed` (học lại) cho phép.

### Bước 3. Tiến độ lộ trình (màn C)
- `stageProgress(userId, stageId)`: số từ “Đã thuộc” / tổng từ của cấp, số chữ đã thuộc / tổng chữ (09 §6), số chủ đề xong / tổng.
- Lộ trình `exam_skip` → hiện “Hoàn thành (thi vượt)” thay cho %.
- Lộ trình khóa → điều kiện mở (“Hoàn thành HSK 1 để mở”).
- Ô “Đã học ở nơi khác?” → `/kiem-tra/{skipExam}?skip=1`, chỉ hiện khi `skipExam` khác null và đã đăng nhập (khách thấy `LoginSheet`).
- Test: hàm `stageProgress` với dữ liệu mẫu ra đúng tỉ lệ.

### Bước 4. Màn hình con đường
- Chép phần CSS `.node`, `.unit`, `.trail` (styles.css phần 6) vào `styles/screens/path.css`.
- `PathView` render từ `GET /api/path`:
  - Thanh trên: tên lộ trình đang xem (bấm mở `dialog#stages`) + % hoàn thành.
  - Mỗi chủ đề: banner (xám khi khóa, “Sắp ra mắt” khi `coming_soon`), “x/y bài”, vài từ tiêu biểu.
  - Nút bài uốn lượn theo vị trí lệch trái/phải như design (`app` tính offset theo chỉ số trong chủ đề).
  - Nút `done` hiện chữ Hán tiêu biểu; `current` có viền sáng (animation tắt khi `prefers-reduced-motion`); `locked` có ổ khóa.
  - Bấm bài mở: popover thẻ mô tả (số thứ tự, tên, số từ mới, thời gian, kỹ năng, nút “Bắt đầu”/“Học lại”).
  - Bấm bài khóa: toast theo `lockReason`.
  - Mở màn hình tự cuộn tới bài `current` (`scrollIntoView({ block: 'center' })`).
  - Cuối lộ trình: nút Bài kiểm tra cuối + hình chứng nhận chờ (`pron` thay bằng Bài kiểm tra pinyin, 10).
- Nút có vùng chạm ≥ 44px, `aria-label` dạng “Bài 3: Xin chào, đã xong”.
- Test Playwright ở 360×800, 820×1180, 1440×900: tự cuộn tới bài hiện tại; bấm bài khóa ra toast; không cuộn ngang.

## 4. Xong module khi
- Toàn bộ test `unlock.ts` xanh; API từ chối bài khóa.
- Màn hình khớp `path.html`, chạy cho khách và người dùng.
