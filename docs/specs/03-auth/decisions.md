# Quyết định phát sinh: 03-auth

## 03-1: thêm `guestId`, cài đặt kiểm tra từng trường

- Plan 04 bước 4 cần một id ngẫu nhiên của khách làm seed “Chữ của ngày” và nói lưu trong `guest_progress_v1`, nhưng interface ở plan 03 không có chỗ. Thêm `guestId?: string` (tùy chọn, ≤ 64 ký tự). Khách chưa có thì `GuestGateway` tự tạo lần ghi đầu.
- `settings` kiểm tra từng trường theo giá trị hợp lệ của `user_settings` (mục tiêu chỉ 5/10/20, `reviewButtons` 2/4…); trường sai hoặc lạ bị bỏ, không bỏ cả `settings`.
- `contentVersion` của bài khách là chuỗi (đúng plan 03), trong khi cột `lesson_progress.content_version` là số nguyên; `mergeGuestProgress` (03-4) phải đổi qua lại.

## 03-4: phạm vi gộp

- `mergeGuestProgress` nhận thêm `lessonEntries` (mục từ điển của từng bài trong tập thử) trong `ctx` để loại thẻ của từ không thuộc bài hợp lệ. Server dựng từ `lesson_word` + `lesson_char` + mục đơn chữ của từng chữ trong từ (thẻ `write` của từ dài dùng từng chữ).
- `reviewLog` của khách **không** được gộp: plan chỉ liệt kê 5 loại thao tác và log không ảnh hưởng lịch ôn (FSRS lưu trạng thái ngay trên thẻ). Thẻ nhận vào có `source = 'lesson'`.
- `daily` của khách bị chặn trên: ≤ 1440 phút, ≤ 3 bài, ≤ 1000 thẻ ôn mỗi ngày, bỏ ngày sau hôm nay quá 1 ngày. Không tin tuyệt đối vì chuỗi ngày học tính từ đây.
- Gọi `POST /api/guest/merge` hai lần với cùng dữ liệu không nhân đôi bài và thẻ, nhưng `daily` cộng dồn lần nữa (cộng dồn là thiết kế); client chỉ xóa dữ liệu khách sau 200 nên thực tế chỉ gọi một lần.
- `trialLessonIds` thuộc 03-2 nhưng cần ở đây nên làm trước, nằm ở `guest-merge.ts`.

## 03-6: xóa tài khoản

- `certificate.name_on_certificate` và `score` đang `NOT NULL`, nhưng spec yêu cầu xóa hai cột này khi chủ tài khoản xóa tài khoản. Migration 0005 cho phép null; mã đọc chứng nhận (12) phải xử lý `revoked = true` với các cột null (trang xác thực chỉ hiện “Chứng nhận không còn hiệu lực”).
- Thu hồi chứng nhận gồm cả `exam_attempt_id = NULL` (bài làm bị xóa theo user).
- Ngoài dây chuyền ON DELETE, xóa thêm `verification` có `identifier` là email (Better Auth). `content_report` đã `SET NULL` nên báo lỗi nội dung vẫn còn nhưng không gắn với ai; mô tả lỗi là văn bản người dùng tự viết.
- Web chưa có client R2: `lib/storage.ts` là chỗ cắm (`getObjectStore()` trả null thì bỏ qua). Client R2 thật làm cùng 12-10 (tạo và đẩy PDF). Đến lúc đó phải thêm job dọn các `certificates/{code}.pdf` mồ côi của chứng nhận `revoked` mà `pdf_url` đã bị xóa (route chỉ thử một lần và ghi log).
- Test kiểm tra “không còn dòng nào” bằng cách quét mọi bảng có cột `user_id` trong `information_schema`, nên bảng mới thêm sau này tự được kiểm tra (test sẽ đỏ nếu bảng đó không được nạp dữ liệu mẫu trong `populate`, nhắc người thêm bảng cập nhật).
