# Quyết định phát sinh – 07 Luyện viết

## 07-1: `writingScore`
- `packages/core/src/scoring.ts` hiện chỉ có phần viết: `WRITING_PASS = 60`, `WRITING_HINT_CAP = 50`, `writingScore`, `isWritingPass`, `writingRating` (đạt = `good`, không đạt = `again`). Các hằng số khác của file (`SPEAKING_PASS`, `CHECKPOINT_PASS`, `EXAM_*`) thêm ở bước của module 08 và 12.
- `misses` không phải số nguyên ≥ 0 thì ném `RangeError` thay vì tự sửa thành 0 (tránh cho điểm tối đa vì dữ liệu hỏng). Nơi gọi trên server phải bắt lỗi này khi nhận `{ misses, usedHint }` từ client.
- Vì trần khi dùng gợi ý (50) thấp hơn ngưỡng đạt (60), chữ viết có dùng gợi ý không bao giờ đạt; có test riêng.

## 07-2: `WritingPad`
- Tải dữ liệu nét bằng `fetch` riêng (`components/writing/strokes.ts`, cache theo chữ, lỗi thì không giữ cache) rồi đưa cho hanzi-writer qua `charDataLoader`; nhờ vậy biết tổng số nét cho “Nét i/n” và báo sớm khi thiếu dữ liệu (`onUnavailable(char)`, bước cha cho đi tiếp và ghi log `writing.missing_strokes`).
- hanzi-writer không đặt `viewBox`, nên kích thước ô tính một lần lúc tạo: `min(chiều ngang ô, 320)`. Chưa xử lý đổi cỡ khi xoay màn hình.
- “Xem lại thứ tự nét”: `misses` về 0 cho lượt viết lại, `usedHint = true` (điểm tối đa 50, không đạt).
- Chế độ `watch` gọi `onDone` đúng một lần, ở lần hoạt ảnh đầu chạy hết; điểm cố định 100.
- Tên nét (bước 6) chưa làm; chỉ hiện “Nét i/n”. `strokes_vi.yaml` chưa có.
- `WritingStep`, `WritingQuiz`, phân tích chữ dưới ô chưa làm (bước 3–5).

## 07-3: `WritingStep`
- Ghi `char_written` và `completeStep` do nơi dùng truyền vào (`onCharWritten`, `onComplete`); API ghi `char_written` chưa có, làm cùng module 06.
- Tự viết xong là hoàn thành bước dù điểm < 60 (spec 06: chỉ cần viết đủ nét, không để người học kẹt); `onCharWritten` chỉ gọi ở lần đạt đầu tiên trong lần mở bước.
- Đổi chế độ mount lại `WritingPad` (`key={mode}`); chế độ đã xong vẫn mở lại được để luyện thêm.
