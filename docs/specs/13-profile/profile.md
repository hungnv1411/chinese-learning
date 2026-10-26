# Tôi: tiến độ, cài đặt, nguồn dữ liệu, báo lỗi

Wireframe: [08-profile.html](../../ideas/08-profile.html).

## 1. Thống kê (đầu trang)

- **Bốn ô:** số từ đã học (có thẻ SRS), số chữ viết được (chữ đã đạt ở chế độ Tự viết ít nhất một lần), chuỗi ngày hiện tại, tổng thời gian học.
- **Bên dưới:** mức độ thuộc theo 4 mức ([09-review §6](../09-review/review.md)), lộ trình đang học và %.
- Không có bảng xếp hạng, không so sánh với người khác.

## 2. Cài đặt

| Nhóm | Mục | Giá trị | Mặc định |
|---|---|---|---|
| Hiển thị | Hiện pinyin | Luôn / Chỉ với từ mới / Ẩn | Luôn |
| | Hiện âm Hán Việt | Bật/tắt | Bật |
| | Màu theo thanh điệu | Bật/tắt | Bật |
| | Chữ phồn thể | Bật/tắt | Tắt |
| Học tập | Mục tiêu mỗi ngày | 5 / 10 / 20 phút | Lấy từ màn hình đầu tiên |
| | Giọng đọc | Nữ / Nam | Nữ |
| | Nút tự đánh giá khi ôn | 2 nút / 4 nút | 2 nút |
| | Kiểu thẻ ôn | recognize / listen / write | recognize + listen |
| | Cách thu âm | Bấm giữ / Bấm để bắt đầu–dừng | Bấm giữ |

- **“Chỉ với từ mới”:** pinyin hiện ở thẻ giới thiệu từ và với từ học trong 7 ngày qua. Ở chỗ khác thì ẩn, chạm vào chữ để hiện.
- Cài đặt có hiệu lực ngay ở mọi màn hình.
- **Lưu ở đâu:** khách lưu trên máy, khi đăng nhập thì chuyển vào tài khoản ([03-auth §5](../03-auth/auth.md)).

## 3. Tài khoản

- **Tài khoản:** ảnh, tên, email Google.
- **Tên trên chứng nhận:** sửa được ([certificate.md §2](../12-exam-certificate/certificate.md)).
- **Chứng nhận của tôi** ([certificate.md §7](../12-exam-certificate/certificate.md)).
- **Đăng xuất.**
- **Xóa tài khoản** ([03-auth §6](../03-auth/auth.md)).
- **Khách:** thay phần này bằng nút “Đăng nhập với Google để lưu tiến độ”.

## 4. Nguồn dữ liệu & giấy phép: `/nguon-du-lieu`

- Trang công khai, liệt kê mọi nguồn theo [sources-and-licenses](../01-content-data/sources-and-licenses.md). Mỗi nguồn có tên, mô tả ngắn, link, giấy phép, link văn bản giấy phép.
- Có mục “Dữ liệu của chúng tôi”: nội dung lộ trình và dữ liệu chỉnh sửa phát hành theo CC BY-SA 4.0, kèm link tải về (repo hoặc file nén).
- Link tới trang này nằm ở trang Tôi và ở chân trang mọi trang công khai (từ điển, xác thực chứng nhận).

## 5. Báo lỗi nội dung

- **Nút “Báo lỗi” có ở:** thẻ giới thiệu từ, màn hình phản hồi bài tập, mặt sau thẻ ôn, trang từ điển, và trang Tôi (báo lỗi chung).
- **Biểu mẫu** (bottom sheet):
  - Loại lỗi: Sai pinyin / Sai nghĩa / Sai Hán Việt / Sai audio / Câu ví dụ không tự nhiên / Chấm sai / Khác.
  - Mô tả (không bắt buộc, tối đa 500 ký tự).
- **Tự động đính kèm:** đối tượng (bài/từ/câu + id), `content_version`, trình duyệt.
- Khách cũng gửi được, giới hạn 10 báo cáo/ngày/IP.
- **Trang quản trị đơn giản** `/admin/reports`:
  - Chỉ email trong biến môi trường `ADMIN_EMAILS` mới vào được.
  - Danh sách báo cáo, lọc theo trạng thái.
  - Đánh dấu Đã xử lý / Bỏ qua.
  - Sửa lỗi thật sự thì vẫn sửa YAML trong repo ([authoring-workflow](../02-curriculum/authoring-workflow.md)).

## 6. Trang tĩnh khác

- **Giới thiệu:** dự án phi lợi nhuận, mục tiêu, cách liên hệ.
- **Chính sách quyền riêng tư** ([non-functional §5](../00-foundation/non-functional.md)).
- **Điều khoản sử dụng** ngắn, kèm lưu ý về chứng nhận.
