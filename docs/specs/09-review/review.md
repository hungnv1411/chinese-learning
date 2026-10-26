# Ôn tập ngắt quãng (SRS)

Wireframe: [05-review.html](../../ideas/05-review.html).

## 1. Thuật toán

- Dùng **FSRS** qua thư viện `ts-fsrs`, tham số mặc định, `request_retention = 0.9`.
- Lưu trạng thái thẻ trong `srs_card` và lịch sử trong `srs_review_log` ([data-model](../00-foundation/data-model.md)). Lịch sử dùng để tối ưu tham số sau này.
- Mọi lần xếp lịch đều tính **phía server**. Với khách thì tính ở client bằng cùng thư viện.

## 2. Thẻ

Mỗi từ đã học có tối đa 3 thẻ, mỗi thẻ một kiểu:

| Kiểu | Mặt trước | Mặt sau | Mặc định |
|---|---|---|---|
| `recognize` | Chữ Hán | Pinyin, Hán Việt, nghĩa, câu ví dụ, audio | Bật |
| `listen` | Audio (tự phát) + nút phát lại | Chữ Hán và như trên | Bật |
| `write` | Nghĩa + pinyin | Người học **tự viết** trên ô 田字格, máy chấm ([07-writing §4](../07-writing/writing.md)) | **Tắt [Đề xuất]**, bật được trong cài đặt |

- Thẻ `write` mặc định tắt vì viết đã bắt buộc trong bài học và bài kiểm tra. Ôn viết mỗi ngày sẽ tăng nhiều thời gian ôn.
- Thẻ `write` chỉ áp dụng cho từ có 1–2 chữ. Từ dài hơn thì tạo thẻ cho từng chữ chưa có thẻ.
- **Tắt** một kiểu thẻ: các thẻ đó bị `suspended`, không bị xóa. **Bật lại:** thẻ đã có thì tiếp tục, thiếu thì tạo mới.

**Nguồn tạo thẻ:**
- Hoàn thành bài: thẻ cho mỗi từ mới.
- Bấm “Thêm vào ôn tập” trong từ điển ([11-dictionary](../11-dictionary/dictionary.md)).
- Câu nói chưa đạt sau 3 lần ([speaking-ui §3](../08-speaking/speaking-ui.md)).

## 3. Tự đánh giá (D9)

| Chế độ | Nút | Ánh xạ FSRS |
|---|---|---|
| **2 nút** (mặc định) | Quên / Nhớ | Again / Good |
| 4 nút | Quên / Khó / Được / Dễ | Again / Hard / Good / Easy |

- Mỗi nút ghi khoảng thời gian đến lần ôn sau (ví dụ “3 ngày”), tính bằng `ts-fsrs`.
- Thẻ `write` **không** có nút tự đánh giá. Máy chấm: đạt = Good, không đạt = Again.

## 4. Phiên ôn tập

- **Thứ tự lấy thẻ:** các thẻ đến hạn, sắp theo `due` tăng dần, trộn nhẹ để hai thẻ của cùng một từ không đi liền nhau.
- **Giới hạn mỗi ngày** theo mục tiêu ([04-home](../04-home/home.md)):

  | Mục tiêu | Thẻ ôn tối đa/ngày |
  |---|---|
  | 5 phút | 50 |
  | 10 phút | 100 |
  | 20 phút | 200 |

  Thẻ đến hạn vượt giới hạn thì để sang ngày sau.
- **Mỗi phiên tối đa 20 thẻ**, rồi hiện “Ôn tiếp 20 thẻ nữa?”. Lý do: hợp với lúc rảnh ngắn.
- Thẻ trả lời Again trong phiên thì quay lại ở cuối phiên (theo bước learning của FSRS).
- **Cuối phiên:** số thẻ đã ôn, tỷ lệ nhớ, số thẻ còn đến hạn hôm nay.

## 5. Màn hình

- **Màn hình chính (tab Ôn tập):**
  - Số thẻ đến hạn hôm nay và thời gian ước tính (khoảng 6 giây/thẻ), nút “Bắt đầu ôn”.
  - Bật/tắt kiểu thẻ.
  - Mức độ thuộc (mục 6).
  - Nút **Luyện thêm các từ hay quên**: phiên luyện các thẻ có `lapses` cao nhất. Phiên này **không** thay đổi lịch FSRS.
- **Mặt trước / mặt sau thẻ** như wireframe. Bấm “Lật thẻ” hoặc chạm vào thẻ để lật.
- **Mặt sau có link “xem chi tiết từ”**, mở trang từ điển trong một lớp phủ. Đóng lại thì quay về đúng thẻ.
- Không có thẻ đến hạn: hiện “Hôm nay bạn đã ôn xong” và thời điểm thẻ tiếp theo đến hạn.

## 6. Mức độ thuộc

Tính theo **từ** (gộp các thẻ của một từ, lấy trạng thái yếu nhất):

| Mức | Điều kiện |
|---|---|
| Mới | Có thẻ nhưng chưa ôn lần nào |
| Đang học | Đã ôn, stability < 21 ngày |
| Hay quên | lapses ≥ 3 và stability < 21 ngày |
| Đã thuộc | stability ≥ 21 ngày |

“Đã thuộc” là số liệu dùng cho tiến độ lộ trình ([05-learning-path](../05-learning-path/learning-path.md)) và trang Tôi. Số chữ đã thuộc = số chữ khác nhau xuất hiện trong các từ đã thuộc.
