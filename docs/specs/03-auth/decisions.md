# Quyết định phát sinh: 03-auth

## 03-1: thêm `guestId`, cài đặt kiểm tra từng trường

- Plan 04 bước 4 cần một id ngẫu nhiên của khách làm seed “Chữ của ngày” và nói lưu trong `guest_progress_v1`, nhưng interface ở plan 03 không có chỗ. Thêm `guestId?: string` (tùy chọn, ≤ 64 ký tự). Khách chưa có thì `GuestGateway` tự tạo lần ghi đầu.
- `settings` kiểm tra từng trường theo giá trị hợp lệ của `user_settings` (mục tiêu chỉ 5/10/20, `reviewButtons` 2/4…); trường sai hoặc lạ bị bỏ, không bỏ cả `settings`.
- `contentVersion` của bài khách là chuỗi (đúng plan 03), trong khi cột `lesson_progress.content_version` là số nguyên; `mergeGuestProgress` (03-4) phải đổi qua lại.
