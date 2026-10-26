# Các dạng bài tập

Dùng chung cho bài thường, bài ôn chủ đề, bài kiểm tra pinyin và bài kiểm tra cuối. Mỗi dạng thuộc một kỹ năng, dùng để cân đối bài và chấm điểm theo kỹ năng.

| Mã | Kỹ năng | Đề | Trả lời | Chấm |
|---|---|---|---|---|
| `listen_pick_hanzi` | Nghe | Audio của từ hoặc câu (không hiện chữ) | Chọn 1 trong 4 chữ Hán | Đúng/sai |
| `listen_pick_meaning` | Nghe | Audio | Chọn 1 trong 4 nghĩa tiếng Anh | Đúng/sai |
| `listen_pick_pinyin` | Nghe | Audio | Chọn 1 trong 4 pinyin | Đúng/sai |
| `pick_tone` | Nghe | Audio + pinyin bị che dấu thanh, ví dụ `h_o` | Chọn thanh 1–4 cho từng âm tiết | Đáp án là thanh **đọc thực tế** (đã áp dụng biến điệu, ví dụ 你好 → 2, 3), vì đó là thứ người học nghe được. Phản hồi luôn hiện pinyin viết chuẩn và giải thích biến điệu nếu có. Âm tiết thanh nhẹ không hỏi. Câu chỉ đúng khi mọi âm tiết đúng |
| `listen_dictation_pinyin` | Nghe | Audio 1 từ | Gõ pinyin, dấu thanh bằng số (`hao3`) | Khớp với pinyin **viết** sau khi chuẩn hóa (chấp nhận cả thanh đọc nếu khác do biến điệu). Chỉ dùng từ HSK 2 trở lên |
| `hanzi_to_meaning` | Đọc | Chữ Hán (pinyin ẩn hay hiện theo cài đặt) | Chọn 1 trong 4 nghĩa | Đúng/sai |
| `meaning_to_hanzi` | Đọc | Nghĩa tiếng Anh | Chọn 1 trong 4 chữ Hán | Đúng/sai |
| `hanzi_to_pinyin` | Đọc | Chữ Hán | Chọn 1 trong 4 pinyin | Đúng/sai |
| `arrange` | Đọc | Bản dịch tiếng Anh + các khối từ bị xáo trộn | Bấm các khối theo thứ tự đúng | Khớp một trong các thứ tự đúng được khai báo |
| `fill_blank` | Đọc | Câu có một chỗ trống + bản dịch | Chọn 1 trong 4 từ | Đúng/sai |
| `match_pairs` | Đọc | 4–5 cặp chữ Hán ↔ nghĩa | Nối cặp | Đúng khi nối hết, sai mỗi lần nối nhầm |
| `read_sentence` | Đọc | Câu tiếng Trung (không có pinyin) | Chọn 1 trong 3 bản dịch | Đúng/sai |
| `write_char` | Viết | Nghĩa hoặc pinyin của 1 chữ (không hiện chữ) | Tự viết trên ô 田字格 | Theo [07-writing §4](../07-writing/writing.md) |
| `speak` | Nói | Chữ/câu + audio mẫu | Thu âm | Theo [speech-service.md](../08-speaking/speech-service.md) |

## Chọn đáp án nhiễu

- Ưu tiên lấy từ **đã học**, cùng chủ đề hoặc cùng từ loại.
- Ưu tiên từ **dễ nhầm**: cùng một chữ (好吃 / 好看), pinyin gần (shí / shì), chữ giống hình (人 / 入 / 八).
- Không lấy đáp án nhiễu trùng nghĩa với đáp án đúng. Ví dụ hai từ đều có nghĩa “to look”: kiểm tra trùng nghĩa sau khi chuẩn hóa.
- Không đủ từ đã học thì lấy từ cùng cấp HSK chưa học.

## Bài tập tự sinh (`type: auto`)

- Máy chọn dạng bài và từ cần hỏi:
  - Ưu tiên từ mới của bài.
  - Sau đó là từ học trong 3 bài trước có độ nhớ thấp (lấy từ SRS).
- Không lặp cùng một dạng quá 2 lần liên tiếp.
- Đảm bảo mỗi bài có **ít nhất 2 câu nghe** và **2 câu đọc**.

## Ghi nhận vào SRS

- Mọi câu bài tập về một từ (trong bài thường hoặc bài ôn chủ đề) cũng được tính như một lần ôn cho thẻ tương ứng, nếu thẻ đã tồn tại và đến hạn trong vòng 24 giờ tới.
- Ánh xạ: `listen_*` → thẻ `listen`. `hanzi_to_*` → thẻ `recognize`. `write_char` → thẻ `write`. Đúng = Good, sai = Again.
- Bài kiểm tra cuối **không** ghi vào SRS.
