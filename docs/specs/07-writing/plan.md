# Plan thực hiện: 07 – Luyện viết chữ

Spec: [writing.md](writing.md). Quy ước chung: [00-foundation/plan.md](../00-foundation/plan.md).

## 1. Màn hình design

`writing.html`: tiêu đề “Viết chữ …”, `.seg` chọn chế độ (Xem / Viết theo / Tự viết), ô 田字格 (`.tzg`, `section[aria-label="Ô tập viết"]`), dòng số nét + tên nét (`.strokes`), phần phân tích chữ (bộ thủ, Hán Việt, nghĩa).

Trong sản phẩm, màn hình này là component dùng ở: bước `writing` (06), bài tập `write_char` (06, 12), thẻ ôn `write` (09), luyện viết tự do ở `/chu/{char}` (11, không chấm vào SRS).

## 2. Phụ thuộc

- 01: `strokes/{char}.json` trên R2, `hanzi.has_stroke_data`, `strokes_missing.csv`.
- 00: `writingScore`, `WRITING_PASS = 60` trong `packages/core/src/scoring.ts` (file này viết test cho phần viết).

## 3. Cấu trúc

```
apps/web/components/writing/
  WritingPad.tsx       bọc hanzi-writer, nhận mode
  WritingStep.tsx      Xem → Viết theo → Tự viết (bước trong bài)
  WritingQuiz.tsx      chỉ Tự viết (bài ôn, bài kiểm tra, thẻ ôn)
  strokeNames.ts       đọc strokes_vi.yaml (nếu có nguồn loại nét)
  styles/screens/writing.css
```

## 4. Các bước

### Bước 1. Điểm một chữ — `writingScore`
- `writingScore({ misses, usedHint })` = `max(0, 100 − 10 × misses)`; `usedHint` → tối đa 50.
- Đạt khi ≥ 60. SRS: đạt = `good`, không đạt = `again`.
- Test: (0, false) → 100; (3, false) → 70; (5, false) → 50 không đạt; (0, true) → 50; (12, false) → 0.

### Bước 2. `WritingPad`
- hanzi-writer, `charDataLoader` tải `${R2_PUBLIC_URL}/strokes/{char}.json` (cache theo chữ, tải trước khi bài mở).
- Kích thước: vuông, `min(100% chiều ngang, 320px)`; vẽ đường kẻ 田字格 bằng SVG nền như `.tzg`.
- `touch-action: none` trên vùng viết, chặn `touchmove` mặc định → không cuộn trang khi viết (iOS).
- Chế độ:
  - `watch`: `animateCharacter`, nút phát lại, nút đi từng nét (`animateStroke(i)`), hiện “Nét i/n”. Xong khi hoạt ảnh chạy hết ít nhất một lần.
  - `trace`: `showOutline: true`, `quiz()`. Xong khi viết đủ nét.
  - `recall`: `showOutline: false, showCharacter: false`, `quiz()`; đề là nghĩa tiếng Anh + pinyin. Xong khi viết đủ nét.
- `quiz({ showHintAfterMisses: 3, onMistake, onCorrectStroke, onComplete })`; đếm `misses` tổng và `usedHint` (khi một nét đạt 3 lần sai).
- Nét sai: hanzi-writer tô đỏ rồi mờ đi; thêm toast ngắn “Nét {n} chưa đúng”.
- Nút “Xem lại thứ tự nét”: chạy lại hoạt ảnh, rồi cho viết lại từ đầu (`usedHint = true` cho lượt đó).
- **Không** có nút bỏ qua.
- `onDone({ mode, misses, usedHint, score })`.
- Test (mock hanzi-writer): `onMistake` 3 lần ở một nét → `usedHint = true`; xong `recall` với 2 lần sai → `score = 80`; component đặt `touch-action: none` trên vùng viết.

### Bước 3. `WritingStep` (bước trong bài)
- Chữ mới: đi đủ 3 chế độ theo thứ tự `watch → trace → recall`; `.seg` hiện chế độ đang làm, chế độ sau khóa tới khi xong chế độ trước.
- Hoàn thành bước khi `recall` xong (06 kiểm tra trong `step_state`).
- Khi `recall` đạt ≥ 60 lần đầu: ghi `char_written(user_id, char)` (thống kê “chữ viết được” ở 13).
- Chữ không có dữ liệu nét: 06 đã bỏ bước khi dựng payload; nếu vẫn gặp (dữ liệu R2 lỗi) thì hiện thông báo và cho đi tiếp, ghi log `writing.missing_strokes`.
- Test: không chuyển được sang `recall` khi `trace` chưa xong; `onDone` của `recall` gọi `completeStep`.

### Bước 4. `WritingQuiz`
- Chỉ chế độ `recall`. Dùng ở bài ôn chủ đề, bài kiểm tra cuối (gửi `{ misses, usedHint }` lên server, 12), thẻ ôn `write` (09: đạt = good).
- Có nút “Xem lại thứ tự nét” (tính `usedHint`).

### Bước 5. Phân tích chữ dưới ô
- Số nét, tên nét đang vẽ (chế độ Xem, nếu có dữ liệu, xem bước 6), bộ thủ + tên và nghĩa tiếng Việt, Hán Việt, nghĩa tiếng Anh.

### Bước 6. Tên nét tiếng Việt (việc cần tìm hiểu)
- hanzi-writer-data không ghi loại nét. Thời hạn tìm hiểu: 1 ngày. Ứng viên: dữ liệu loại nét của dự án mở có giấy phép tương thích (kiểm tra giấy phép theo sources-and-licenses).
- Có nguồn: thêm bước pipeline sinh `stroke_types` cho chữ HSK 1–3, `content/strokes_vi.yaml` ánh xạ loại nét → tên (横 ngang, 竖 sổ, 撇 phẩy, 点 chấm, 捺 mác, 提 hất, 横折 ngang gập, 竖钩 sổ móc…), ghi nguồn ở trang Nguồn dữ liệu.
- Không có nguồn: **bỏ tên nét** ở bản đầu, chỉ hiện “Nét i/n”. Ghi quyết định vào `docs/specs/07-writing/decisions.md`.

### Bước 7. Kiểm thử thiết bị
- Playwright (cảm ứng giả lập, 390×844): vẽ nét trong ô, `window.scrollY` không đổi.
- Thử tay trên Safari iOS và Chrome Android: viết bằng ngón tay không cuộn trang; desktop: viết bằng chuột được chấm bình thường.

## 5. Xong module khi
- Test `writingScore` và `WritingPad` xanh.
- Viết được một chữ qua đủ 3 chế độ trên điện thoại thật, không cuộn trang.
- Có `decisions.md` về tên nét.
