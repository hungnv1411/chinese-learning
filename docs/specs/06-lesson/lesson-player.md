# Trình chạy bài học

Wireframe: [03-lesson.html](../../ideas/03-lesson.html).

## 1. Bố cục

- Toàn màn hình, **không** có thanh tab dưới cùng.
- Thanh trên cùng gồm:
  - Nút ✕ (thoát).
  - Thanh tiến độ: số bước đã qua trên tổng số bước. Câu làm sai được hỏi lại thì cộng thêm vào tổng.
  - Số thứ tự bước.
- **Nội dung bước** ở giữa.
- **Nút hành động chính** cố định ở dưới (Tiếp / Kiểm tra / Tiếp tục).
- **Phản hồi đúng/sai** hiện dạng bottom sheet: màu xanh “Chính xác!” hoặc đỏ “Chưa đúng” kèm đáp án đúng, và nút Tiếp tục.

## 2. Các loại bước

| Loại | Mô tả | Có chấm điểm |
|---|---|---|
| `intro` | Thẻ giới thiệu từ mới (mục 3) | Không |
| `sound_intro`, `tone_contour_intro` | Thẻ giới thiệu âm/thanh, chỉ dùng ở giai đoạn Phát âm ([10-pronunciation §3](../10-pronunciation/pronunciation.md)) | Không |
| `writing` | Luyện viết một chữ ([07-writing](../07-writing/writing.md)) | Không tính điểm, nhưng phải làm xong |
| `grammar` | Thẻ giải thích ngữ pháp (tiếng Việt), mẫu câu, 2–3 ví dụ có audio | Không |
| `exercise` | Một câu bài tập ([exercise-types.md](exercise-types.md)) | Có |
| `speaking` | Một câu luyện nói ([08-speaking](../08-speaking/speaking-ui.md)) | Có (ngưỡng riêng) |
| `summary` | Tổng kết | – |

## 3. Thẻ giới thiệu từ

- **Chữ Hán** cỡ lớn, tô màu theo thanh nếu bật.
- **Pinyin** có dấu thanh, tô màu theo thanh. Nếu cách đọc thực tế khác cách viết do biến điệu thì thêm dòng “đọc là **ní hǎo**”. Dòng này sinh tự động bằng quy tắc biến điệu (mục 6).
- **Âm Hán Việt** của từng chữ, ví dụ “nhĩ hảo”. Có thể tắt trong cài đặt.
- **Nghĩa tiếng Anh:** dùng nghĩa rút gọn trong `overrides/definitions.yaml`, không có thì lấy 1–3 nghĩa đầu của CC-CEDICT.
- **Audio** tự phát một lần khi thẻ hiện (từ thẻ thứ hai trở đi, vì iOS). Có nút phát lại và nút đọc chậm.
- **Tách chữ:** mỗi chữ hiện bộ thủ, tên và nghĩa tiếng Việt của bộ thủ, nghĩa tiếng Anh của chữ.
- **Mẹo tiếng Việt** từ trường `tips`, nếu có.
- **Câu mẫu:** 1 câu có audio, pinyin, bản dịch tiếng Anh.

## 4. Luồng bài

1. Các bước chạy theo thứ tự đã định ([curriculum-structure §4](../02-curriculum/curriculum-structure.md)).
2. Câu `exercise` làm sai được đưa vào **hàng hỏi lại**. Hàng này chạy ngay sau câu bài tập cuối cùng, trước phần luyện nói. Mỗi câu chỉ hỏi lại 1 lần. Sai lần nữa thì vẫn đi tiếp và ghi nhận sai.
3. Câu `speaking`: xem ngưỡng và cách thoát ở [speaking-ui.md](../08-speaking/speaking-ui.md).
4. Hết bước thì đến `summary`.

**Điều kiện hoàn thành bài** (server kiểm tra):
- Đã qua mọi bước `intro`, `grammar`.
- Mọi bước `writing` đã hoàn thành ở chế độ “Tự viết”.
- Mọi bước `exercise` đã trả lời, kể cả hàng hỏi lại.
- Mọi bước `speaking` đã đạt, hoặc đã dùng hết số lần thử.

Bài thường không có điểm đạt, đi hết là hoàn thành. Độ chính xác chỉ để thống kê và để xếp lịch SRS.

## 5. Thoát giữa chừng

- Bấm ✕ thì hỏi xác nhận bằng bottom sheet (không dùng hộp thoại của trình duyệt): “Tiến độ bài này sẽ được lưu”.
- Server lưu `current_step` và `step_state` sau mỗi bước.
- Lần sau mở bài thì tiếp tục đúng bước đó.
- Nếu nội dung bài đã thay đổi (khác `content_version`) thì bắt đầu lại bài, nhưng giữ những gì đã ghi nhận vào SRS.

## 6. Biến điệu (dùng chung cho mọi module)

Hàm `applyToneSandhi(syllables)` đổi thanh viết sang thanh đọc thực tế:
- Thanh 3 + thanh 3: thanh 3 đầu đọc thành thanh 2. Chuỗi 3 âm tiết thanh 3: áp dụng theo cách ngắt từ, mặc định từ trái sang phải trong một từ.
- 不 (bù) + thanh 4 → bú.
- 一 (yī) + thanh 4 → yí. 一 + thanh 1/2/3 → yì. 一 khi là số thứ tự hoặc đứng cuối thì giữ yī.

Hàm này dùng cho: dòng “đọc là…” ở thẻ giới thiệu, chấm thanh khi luyện nói ([speech-service.md](../08-speaking/speech-service.md)), và bài tập chọn thanh. Pinyin hiển thị luôn theo cách **viết** chuẩn (dấu thanh gốc).

## 7. Màn hình tổng kết

- Số từ mới, độ chính xác, thời gian.
- Danh sách từ đã học. Từ làm sai có nhãn “Sai 1 lần”.
- Hai nút: **Bài tiếp theo** và **Về trang Hôm nay**.
- Với khách: hiện lời mời đăng nhập theo [03-auth §3](../03-auth/auth.md).

## 8. Khi hoàn thành bài, server

1. Đặt `lesson_progress.completed`.
2. Tạo thẻ SRS cho mỗi từ mới, các kiểu thẻ đang bật trong cài đặt. Từ làm sai thì lần ôn đầu đến hạn sớm hơn: dùng rating “Again” cho lần ôn đầu tiên thay vì “Good”.
3. Mở bài tiếp theo.
4. Cập nhật `daily_activity`.
