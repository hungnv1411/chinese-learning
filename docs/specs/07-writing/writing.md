# Luyện viết chữ

Wireframe: [04-writing.html](../../ideas/04-writing.html). Luyện viết là **bắt buộc** (D7).

## 1. Công cụ

- Dùng thư viện **hanzi-writer** để vẽ hoạt ảnh nét và chấm từng nét (chế độ `quiz`).
- Dữ liệu nét lấy từ R2 tại `strokes/{char}.json`, sinh từ hanzi-writer-data ([import-pipeline B4](../01-content-data/import-pipeline.md)). Truyền vào hanzi-writer qua `charDataLoader`.
- Chữ không có dữ liệu nét (`has_stroke_data = false`) thì bỏ qua bước viết cho chữ đó và ghi log. Pipeline phải báo trước danh sách chữ HSK 1–3 thiếu dữ liệu nét.

## 2. Ba chế độ

| Chế độ | Mô tả | Hoàn thành khi |
|---|---|---|
| **Xem** | Hoạt ảnh vẽ từng nét. Hiện tên nét bằng tiếng Việt (mục 5), số nét hiện tại trên tổng số nét. Có nút phát lại và nút đi từng nét | Hoạt ảnh chạy hết ít nhất một lần |
| **Viết theo** | Chữ hiện mờ phía sau. Người học tô theo từng nét. Nét đúng được giữ lại | Viết đủ các nét |
| **Tự viết** | Không hiện chữ. Đề là nghĩa tiếng Anh và pinyin. Người học tự viết | Viết đủ các nét (xem mục 4) |

- Chữ **mới** trong bài phải đi đủ 3 chế độ theo thứ tự.
- Bài ôn chủ đề, ôn tập SRS (thẻ `write`) và bài kiểm tra cuối chỉ dùng **Tự viết**.

## 3. Giao diện

- Ô 田字格 vuông, chiếm gần hết chiều ngang màn hình (tối đa 320px), có đường kẻ chia ô.
- Khi viết trong ô thì **không được cuộn trang**: dùng `touch-action: none` trên vùng viết.
- **Dưới ô:**
  - Số nét.
  - Tên nét đang vẽ (chế độ Xem).
  - Phân tích chữ: bộ thủ, tên và nghĩa tiếng Việt của bộ thủ, âm Hán Việt, nghĩa tiếng Anh.
- **Nét sai:** tô đỏ trong chốc lát rồi biến mất. Hiện thông báo ngắn kiểu “Nét 4 chưa đúng”.

## 4. Chấm điểm & chống kẹt

- hanzi-writer chấm từng nét (đúng hướng, đúng vị trí, đúng thứ tự).
- Sai 3 lần ở cùng một nét: tự hiện gợi ý nét đó (`showHintAfterMisses: 3`).
- Không có nút bỏ qua. Để không bị kẹt:
  - Gợi ý luôn hiện sau 3 lần sai.
  - Nút “Xem lại thứ tự nét” chạy lại hoạt ảnh rồi cho viết lại từ đầu.
- **Điểm một chữ** (dùng cho bài kiểm tra và SRS):
  - `100 − 10 × tổng số lần sai`, tối thiểu 0.
  - Có dùng gợi ý thì điểm tối đa là 50.
  - **Đạt** khi điểm ≥ 60. Trong SRS: đạt = Good, không đạt = Again.

## 5. Tên nét tiếng Việt

Bảng ánh xạ loại nét → tên tiếng Việt, lưu trong `/content/strokes_vi.yaml`. Ví dụ: 横 ngang, 竖 sổ, 撇 phẩy, 点 chấm, 捺 mác, 提 hất, 横折 ngang gập, 竖钩 sổ móc…

hanzi-writer-data không ghi loại nét. Vì vậy loại nét của từng nét cần một nguồn khác. Nếu không tìm được nguồn mở phù hợp thì **bỏ tên nét** ở bản đầu, chỉ hiện số thứ tự nét. Người xây quyết sau khi tìm hiểu.

## 6. Trên desktop

Viết bằng chuột vẫn được chấm như bình thường. Không cần hỗ trợ bút cảm ứng riêng.
