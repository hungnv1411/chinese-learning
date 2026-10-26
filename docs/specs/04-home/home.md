# Màn hình đầu tiên & Hôm nay

Wireframe: [01-home.html](../../ideas/01-home.html).

## 1. Lần đầu vào web (màn hình A)

Hiện khi khách chưa có `guest_progress_v1` và chưa đăng nhập. Gồm hai câu hỏi và một nút.

**“Bạn đang ở đâu?”**

| Lựa chọn | Hành động |
|---|---|
| Tôi chưa biết gì | Mở thẳng bài đầu tiên của giai đoạn Phát âm |
| Tôi đọc được pinyin | Mở **bài kiểm tra pinyin** ([02-curriculum §6](../02-curriculum/curriculum-structure.md)). Đạt thì giai đoạn Phát âm được tính hoàn thành (`completed_via = exam_skip`) và mở HSK 1. Chưa đạt thì về giai đoạn Phát âm, kèm thông báo “Bạn nên học lại phần phát âm trước” |
| Tôi đã học HSK 1 | Yêu cầu đăng nhập, rồi mở **thi vượt HSK 1** ([12-exam-certificate](../12-exam-certificate/final-exam.md)). Giai đoạn Phát âm được tính hoàn thành khi người dùng bắt đầu thi vượt |

**“Mỗi ngày bạn rảnh khoảng”:** 5 / 10 / 20 phút, mặc định 10. Giá trị này dùng cho thanh mục tiêu và giới hạn số thẻ ôn mỗi ngày ([09-review](../09-review/review.md)).

## 2. Hôm nay (màn hình B)

Tab đầu tiên của thanh điều hướng dưới cùng. Thứ tự từ trên xuống:

1. **Lời chào + chuỗi ngày học** (chip “5 ngày liên tiếp”).
2. **Thanh mục tiêu hôm nay**: số phút đã học trên mục tiêu.
3. **Thẻ chính** (thẻ to nhất), chọn theo thứ tự ưu tiên:
   1. Có bài đang dở thì hiện “Học tiếp: {bài}”, mở đúng bước đang dở.
   2. Số thẻ ôn đến hạn lớn hơn giới hạn ôn của ngày × 1,5 thì thẻ chính là **Ôn tập**. Lý do: tránh dồn thẻ ôn.
   3. Còn lại thì hiện bài tiếp theo đang mở trong lộ trình.
   4. Đã học hết những gì đang mở, ví dụ chờ 24 giờ để thi lại, thì hiện trạng thái đó và gợi ý ôn tập.
4. **Thẻ ôn tập** (nếu không phải thẻ chính và có thẻ đến hạn): số thẻ và thời gian ước tính.
5. **Chữ của ngày:** một chữ đã học (nếu chưa học chữ nào thì lấy chữ của bài tiếp theo). Hiện chữ, pinyin, Hán Việt, nghĩa, cách tách bộ thủ. Mỗi ngày đổi một chữ, giống nhau cho cùng một người trong ngày.
6. **Biểu đồ 7 ngày qua:** số phút mỗi ngày.

## 3. Chuỗi ngày học

- **Một ngày tính là có học** nếu hoàn thành ít nhất 1 bài **hoặc** ôn ít nhất 10 thẻ. “Ngày” tính theo múi giờ của trình duyệt người dùng (mặc định Asia/Ho_Chi_Minh).
- **Ngày nghỉ tự động:** mỗi tuần (thứ Hai–Chủ Nhật) được 1 ngày không học mà không mất chuỗi. Không phải bấm gì.
- Mất chuỗi thì không có thông báo gây áp lực. Chỉ hiện “Bắt đầu chuỗi mới hôm nay”.

## 4. Thời gian học

- Chỉ đếm thời gian đang ở trong bài học, bài ôn, luyện nghe thanh hoặc bài kiểm tra **và** có thao tác.
- Không có thao tác quá 60 giây thì ngừng đếm.
- Client gửi số phút lên server cùng với tiến độ bước.

## 5. Không có thông báo

Bản web không gửi thông báo đẩy hay email nhắc học (D5). Chuỗi ngày và thanh mục tiêu là động lực duy nhất.
