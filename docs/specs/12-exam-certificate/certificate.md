# Chứng nhận hoàn thành

Wireframe: [09-certificate.html](../../ideas/09-certificate.html), màn hình C.

## 1. Khi nào cấp

- Server tự cấp ngay khi một `exam_attempt` **đạt**. Mỗi người dùng chỉ có **một chứng nhận cho mỗi lộ trình**.
- Thi lại sau khi đã đạt thì không được (lộ trình đã hoàn thành).
- Giai đoạn Phát âm **không** có chứng nhận.

## 2. Tên trên chứng nhận

- Mặc định là tên tài khoản Google.
- **Trước khi bắt đầu bài kiểm tra cuối**, hiện “Tên trên chứng nhận: **Nguyễn Văn An** · Sửa” để người dùng xác nhận.
- **Sau khi đã cấp:** sửa tên ở trang Tôi thì tạo lại PDF với cùng mã. Ghi lịch sử đổi tên. Tối đa 3 lần cho mỗi chứng nhận.
- Giới hạn 60 ký tự, chỉ chữ cái (kể cả tiếng Việt có dấu), dấu cách, dấu gạch nối, dấu chấm.

## 3. Nội dung chứng nhận

Song ngữ Việt–Anh **[Đề xuất]**, để dùng được trên LinkedIn hoặc CV.

- Tiêu đề: **结业证书**, “Chứng nhận hoàn thành / Certificate of Completion”.
- Tên người nhận.
- Tên lộ trình: “HSK 1 · Sinh tồn” (kèm tiếng Anh).
- Mô tả ngắn: “đã hoàn thành lộ trình tự học theo chuẩn HSK 2021 cấp 1, gồm 500 từ, 300 chữ, đủ 4 kỹ năng nghe, nói, đọc, viết”. Số từ và số chữ lấy từ dữ liệu.
- Điểm bài kiểm tra cuối (tổng và từng phần).
- Ngày cấp.
- **Mã chứng nhận:** dạng `HSK{n}-XXXX-XXXX`, ký tự in hoa và số, bỏ các ký tự dễ nhầm (`0 O 1 I`).
- **Mã QR** trỏ tới trang xác thực.
- Dòng **bắt buộc**: “Đây là chứng nhận hoàn thành khóa học trên {tên website}, không phải chứng chỉ HSK chính thức do Chinese Testing International cấp.” (kèm bản tiếng Anh).

## 4. PDF

- Khổ A4 nằm ngang. Tạo phía server lúc cấp, lưu lên R2 tại `certificates/{code}.pdf`.
- **Phông chữ phải nhúng vào PDF**, gồm phông có dấu tiếng Việt và phông chữ Hán cho tiêu đề. Chỉ nhúng các ký tự dùng tới để file nhỏ.
- Nút “Tải PDF” trên trang chứng nhận.

## 5. Trang xác thực công khai: `/chung-nhan/{code}`

- Ai có link cũng xem được, không cần đăng nhập.
- **Nội dung:** bản xem trước chứng nhận (HTML, không phải PDF), trạng thái **Hợp lệ**, tên, lộ trình, ngày cấp, điểm.
- **Chứng nhận đã thu hồi** (do xóa tài khoản): chỉ hiện “Chứng nhận không còn hiệu lực”, không hiện tên hay điểm ([03-auth §6](../03-auth/auth.md)).
- Thẻ `noindex`, để Google không lập chỉ mục tên người dùng.
- **Có Open Graph** (ảnh xem trước tạo động): chia sẻ lên Facebook/LinkedIn thì hiện ảnh chứng nhận.
- Mã không tồn tại thì hiện “Không tìm thấy chứng nhận”.

## 6. Chia sẻ

- **Sao chép link xác thực.**
- **Chia sẻ:** Web Share API trên điện thoại. Trên desktop thì mở link chia sẻ của Facebook.
- **“Thêm vào hồ sơ LinkedIn”:** dùng URL “Add to profile” của LinkedIn, điền sẵn tên chứng nhận, tổ chức cấp (tên website), ngày cấp, mã và link xác thực.

## 7. Trang Tôi → Chứng nhận của tôi

Danh sách chứng nhận đã nhận. Mỗi dòng có lộ trình, ngày, nút xem. Chưa có chứng nhận nào thì hiện lộ trình đang học và còn bao xa.
