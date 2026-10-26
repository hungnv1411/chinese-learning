# Luyện nói: giao diện

Wireframe: [10-speaking.html](../../ideas/10-speaking.html). Luyện nói là **bắt buộc**, không bỏ qua được (D8).

## 1. Các dạng câu nói

| Dạng | Dùng ở | Đề |
|---|---|---|
| `speak_syllable` | Giai đoạn Phát âm | 1 âm tiết có thanh, ví dụ `mǎ` |
| `speak_word` | Bài thường | 1 từ |
| `speak_sentence` | Bài thường, bài ôn chủ đề, bài kiểm tra cuối | 1 câu ngắn (tối đa khoảng 12 chữ) |
| `speak_answer` | HSK 2–3, bài kiểm tra cuối | Nghe một câu hỏi, đọc to câu trả lời có sẵn trên màn hình |

Mọi dạng đều là **đọc to một nội dung đã biết trước**. Không có hội thoại tự do, vì cách chấm chỉ so được với nội dung mong đợi.

## 2. Luồng một câu (màn hình A → B)

1. **Hiện đề:** chữ Hán, pinyin tô màu theo thanh (ẩn hay hiện theo cài đặt), nghĩa tiếng Anh. Có nút ▶ phát audio mẫu và nút đọc chậm.
2. **Thu âm:** người học **bấm giữ** nút micro để thu, thả ra là gửi. Đang thu thì hiện sóng âm.
   - Bấm nhanh dưới 0,4 giây: coi như bấm nhầm, hiện gợi ý “Giữ nút trong khi nói”.
   - Tối đa 8 giây thì tự dừng.
   - **[Đề xuất]** Có thể thêm chế độ “bấm một lần để bắt đầu, bấm lần nữa để dừng” trong cài đặt, cho người khó giữ nút.
3. **Đang chấm:** hiện vòng xoay “Đang chấm…”. Quá 10 giây chưa có kết quả thì báo lỗi và cho thu lại, lần này không tính.
4. **Kết quả:**
   - Điểm 0–100 và nhãn Đạt/Chưa đạt.
   - Các ô theo từng âm tiết: xanh nếu đúng, đỏ nếu sai âm hoặc sai thanh.
   - Một âm tiết sai thanh: hiện **đường thanh cần đọc** so với **đường thanh bạn đọc** (hình vẽ cùng hệ màu thanh), kèm câu giải thích, ví dụ “cần thanh 2 (đi lên), bạn đọc gần thanh 1 (ngang)”, và một mẹo tiếng Việt nếu có.
   - Nút **▶ Giọng mẫu** và **▶ Giọng của bạn** (phát bản ghi đang có trên máy).
   - Nút **Nói lại** và **Tiếp** (nút Tiếp chỉ bật được khi đạt hoặc đã hết lượt).

## 3. Ngưỡng đạt & chống kẹt **[Đề xuất]**

- **Đạt** khi điểm ≥ 60.
- Chưa đạt thì nói lại. **Sau 3 lần chưa đạt**:
  - Nút Tiếp vẫn bật, câu được ghi là “chưa đạt”.
  - Ghi vào ôn tập theo từ, không có thẻ cho cả câu:
    - **Câu `speak_word`:** từ đó có thẻ `listen` thì đặt đến hạn ngay (`due = now`). Chưa có thì tạo thẻ `listen` với `source = speaking_fail`.
    - **Câu `speak_sentence` / `speak_answer`:** làm như trên cho các từ HSK chứa âm tiết bị chấm sai.
    - **`speak_syllable`:** không ghi gì.
  - Bài vẫn được tính hoàn thành.
- Kết quả không ổn định (máy không nhận ra tiếng nói, quá ồn, quá nhỏ): **không tính** là một lần thử, hiện hướng dẫn “Không nghe rõ, hãy nói to hơn hoặc tìm chỗ yên tĩnh”.
- **Bài kiểm tra cuối:** mỗi câu nói chỉ được thử **2 lần**, lấy điểm cao nhất ([12-exam-certificate](../12-exam-certificate/final-exam.md)).

## 4. Quyền micro (màn hình C)

- Xin quyền micro lần đầu khi đến câu nói đầu tiên, **không** xin ngay khi vào web.
- Trước khi trình duyệt hỏi quyền, hiện một màn giải thích ngắn: “Bạn sẽ đọc to để luyện phát âm. Bản ghi không được lưu lại.”
- **Bị từ chối hoặc không có micro:**
  - Hiện hướng dẫn bật quyền theo từng trình duyệt (Chrome Android, Safari iOS, desktop).
  - Có nút **Thử lại** và **Lưu & thoát**.
  - **Không** có nút bỏ qua.
- **Lưu & thoát:** lưu bài tại đúng câu nói đó. Lần sau mở bài thì tiếp tục từ đây.

## 5. Kỹ thuật thu âm (client)

- Dùng `getUserMedia` + `MediaRecorder`. Chrome ra webm/opus, Safari ra mp4/aac. Gửi nguyên định dạng, server tự chuyển đổi.
- Gửi kèm: `item_ref` (mã câu), `expected` (chữ Hán + pinyin có số thanh), `mode` (`syllable`/`word`/`sentence`).
- Bản ghi chỉ giữ trong bộ nhớ trình duyệt, đến khi chuyển sang câu khác.
- **Không** dùng nhận dạng giọng nói có sẵn của trình duyệt (Web Speech API), vì kết quả mỗi trình duyệt một khác và gửi audio đi nơi khác.
