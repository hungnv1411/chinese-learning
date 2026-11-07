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

## 07-6: tên nét tiếng Việt (Q3) — kết luận: bỏ tên nét ở bản đầu
Nghiên cứu ngày 2026-11-07. hanzi-writer-data (từ Make Me a Hanzi, dữ liệu Arphic Public License) chỉ có đường nét và median, **không có loại nét**; trường `type` trong etymology của Make Me a Hanzi là loại chữ (tượng hình…), không phải loại nét.

| Ứng viên | Có loại nét? | Vấn đề | Kết luận |
|---|---|---|---|
| KanjiVG (CC BY-SA 3.0, thuộc tính `kvg:type` theo khối Unicode CJK Strokes) | Có | Soạn cho chữ Nhật: thứ tự và hình nét có chỗ khác chuẩn PRC, nhiều chữ giản thể thiếu; chỉ số nét không khớp hanzi-writer-data nên phải ghép tay. CC BY-SA 3.0 → 4.0 của `content/` là chiều tương thích, nhưng cần ghi nguồn | Không dùng cho bản đầu; xem lại nếu có người rà ghép |
| cnchar-order (MIT cho mã) | Có (`'一个'.stroke('order','name')`) | README không nói nguồn dữ liệu nét, không có giấy phép riêng cho dữ liệu → không chứng minh được tương thích, vi phạm quy tắc “không vi phạm giấy phép dữ liệu” | Loại |
| CCSE-Kai, bộ dữ liệu bài báo arXiv | Có nhãn | Chưa thấy giấy phép; là dữ liệu nghiên cứu | Loại |
| Tự suy loại nét từ median của hanzi-writer-data | Tự tính | Phân loại 5 nét cơ bản (ngang, sổ, phẩy, mác, chấm) bằng hướng median khá chắc; nét ghép (ngang gập, sổ móc…) dễ sai. Không vướng giấy phép | **Hướng khả thi nếu sau này cần**: chỉ gán khi chắc, còn lại không hiện tên |

Quyết định: không có nguồn đã kiểm giấy phép → theo plan, **không hiện tên nét**, chỉ “Nét i/n”. Không tạo `content/strokes_vi.yaml`, không thêm bước pipeline `stroke_types`, không thêm dòng vào `/nguon-du-lieu`. Phần “tên nét đang vẽ” của 07-5 vì thế cũng chưa có.

## 07-7: thử trên iOS / Android thật — bỏ qua
Chủ dự án quyết bỏ qua (2026-11-07). Rủi ro còn lại: `touch-action: none` và chặn `touchmove` mới được test bằng jsdom, chưa kiểm chứng trên Safari iOS và Chrome Android.
