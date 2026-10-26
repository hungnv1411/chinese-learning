# Tài khoản, đăng nhập & học thử

Wireframe: [01-home.html](../../ideas/01-home.html), màn hình A và C.

## 1. Đăng nhập

- **Chỉ có “Đăng nhập với Google”** (D4), làm bằng Better Auth (Google OAuth). Không có email/mật khẩu, không gửi email.
- Lấy từ Google: email, tên, ảnh đại diện. `certificate_name` mặc định là tên Google, người dùng sửa được ([13-profile](../13-profile/profile.md)).
- Phiên đăng nhập 30 ngày, tự gia hạn khi còn dùng.
- **Sau này:** khi có app iOS, phải thêm “Đăng nhập với Apple” theo quy định của App Store. Không làm trong bản này, nhưng thiết kế bảng `account` đã cho phép một người dùng có nhiều cách đăng nhập (Better Auth mặc định đã hỗ trợ).

## 2. Khách (chưa đăng nhập) được làm gì

| Tính năng | Khách |
|---|---|
| Màn hình đầu tiên, chọn điểm xuất phát | Có |
| Học bài | **Tối đa 3 bài thường** đã hoàn thành **[Đề xuất]** |
| Luyện viết, luyện nói trong 3 bài đó | Có (luyện nói giới hạn theo IP) |
| Ôn tập các từ đã học trong 3 bài | Có |
| Bảng pinyin, luyện nghe thanh | Có, không giới hạn |
| Từ điển | Có, không giới hạn (trừ việc tạo audio mới) |
| Bài kiểm tra pinyin | Có |
| Bài ôn chủ đề, bài kiểm tra cuối, thi vượt HSK | **Không**, phải đăng nhập |
| Chứng nhận | Không |

## 3. Lời mời đăng nhập

- **Lần 1:** ngay sau màn hình tổng kết của bài thường đầu tiên, hiện bottom sheet “Lưu lại tiến độ của bạn” (màn hình C). Có nút “Tiếp tục với Google” và “Để sau”.
- **Lần 2:** sau bài thứ 2, hiện lại như trên, kèm dòng “Còn 1 bài học thử”.
- **Hết học thử:** khách bấm vào bài thứ 4 thì hiện màn hình đăng nhập, không có nút “Để sau”. Vẫn còn link quay về bảng pinyin và từ điển.
- Ở màn hình đầu tiên có link “Đã có tài khoản? Đăng nhập”.

## 4. Lưu tiến độ của khách

- Lưu trong `localStorage` dưới một khóa có phiên bản, ví dụ `guest_progress_v1`. Gồm:
  - Điểm xuất phát đã chọn, mục tiêu mỗi ngày.
  - Kết quả bài kiểm tra pinyin (đạt hay chưa, thời điểm).
  - `lesson_progress` của các bài đã học hoặc đang học.
  - Thẻ SRS và lịch sử ôn.
  - `daily_activity`.
- Không lưu được (trình duyệt chặn, chế độ ẩn danh) thì vẫn học được, nhưng hiện cảnh báo nhỏ “Tiến độ sẽ mất khi đóng trang”.
- Server không lưu gì về khách, trừ bộ đếm giới hạn tần suất theo IP.

## 5. Chuyển tiến độ khách vào tài khoản

Khi khách đăng nhập thành công, client gửi `guest_progress_v1` lên `POST /api/guest/merge`. Server:

1. **Kiểm tra lại** dữ liệu khách. Chỉ chấp nhận các bài mà khách có quyền học, tức là thuộc 3 bài thử và đúng thứ tự mở khóa. Bỏ qua phần không hợp lệ.
   - Kết quả “đạt bài kiểm tra pinyin” của khách **được chấp nhận mà không kiểm tra lại**. Server không có cách xác minh, và cái giá nếu bị giả mạo rất thấp: chỉ mở được HSK 1. Khi đó giai đoạn Phát âm được ghi `completed_via = exam_skip`.
2. Nếu tài khoản **chưa có tiến độ**: nhận toàn bộ dữ liệu khách.
3. Nếu tài khoản **đã có tiến độ**, tức người dùng đã học trên máy khác:
   - Bài học: lấy trạng thái tiến xa hơn cho từng bài.
   - Thẻ SRS: thẻ đã có trong tài khoản thì giữ nguyên, thẻ chỉ có ở khách thì thêm vào.
   - Hoạt động hằng ngày: cộng dồn theo ngày.
   - Cài đặt: giữ của tài khoản.
4. Xóa `guest_progress_v1` sau khi server xác nhận.

Có unit test cho cả 3 trường hợp: tài khoản mới, tài khoản đã có tiến độ, dữ liệu khách bị sửa tay.

## 6. Đăng xuất & xóa tài khoản

- **Đăng xuất:** xóa phiên. Không giữ lại tiến độ trong localStorage.
- **Xóa tài khoản:** ở trang Tôi, cần gõ xác nhận. Xóa mọi dữ liệu người dùng. Chứng nhận: **giữ lại** dòng `certificate` với `code`, `stage_id`, `issued_at`, `revoked = true`; **xóa** `name_on_certificate`, điểm, `user_id` và file PDF trên R2. Trang xác thực của mã đó chỉ hiện “Chứng nhận không còn hiệu lực”, không hiện tên hay điểm. **[Đề xuất]**
