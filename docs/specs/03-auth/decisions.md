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
