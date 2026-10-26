# Phát âm, bảng pinyin & luyện nghe thanh

Wireframe: [06-pinyin.html](../../ideas/06-pinyin.html).

Module này có hai phần:
- **Nội dung của giai đoạn Phát âm**, tức các bài trong lộ trình ([curriculum-structure §2](../02-curriculum/curriculum-structure.md)).
- **Công cụ tự do** dùng bất cứ lúc nào, không cần đăng nhập: bảng pinyin và luyện nghe thanh.

## 1. Bảng pinyin

- **Ba tab:** Bảng | Thanh mẫu | Vận mẫu.
- **Tab Bảng:**
  - Lưới thanh mẫu (hàng) × vận mẫu (cột) của mọi âm tiết tiếng phổ thông.
  - Ô tổ hợp không tồn tại thì gạch chéo, không bấm được.
  - Bảng rộng nên cuộn ngang được. Cột tiêu đề hàng và hàng tiêu đề cột cố định khi cuộn.
  - Dữ liệu âm tiết lấy từ danh sách âm tiết chuẩn (khoảng 400 âm tiết). Có thể sinh từ CC-CEDICT rồi đối chiếu với danh sách có sẵn.
- **Bấm một âm tiết:** hiện thẻ có 4 thanh. Mỗi thanh có: pinyin có dấu (màu thanh), một chữ ví dụ HSK cấp thấp có đúng âm và thanh đó kèm nghĩa (ví dụ mā 妈 mẹ), và nút phát audio (`syl/{voice}/{pinyin}.mp3`, xem [tts-audio](../01-content-data/tts-audio.md)).
  - Âm tiết không có chữ ở một thanh nào đó thì ghi “không có chữ thông dụng”. Không có audio thì làm mờ thanh đó.
- **Tab Thanh mẫu / Vận mẫu:** danh sách từng âm, mỗi âm có:
  - Audio.
  - Cách đặt lưỡi và môi, bằng lời tiếng Việt, kèm hình minh họa nếu có.
  - **So sánh với âm tiếng Việt gần nhất**, ví dụ “b giống p không bật hơi”, “x gần như x tiếng Việt nhưng lưỡi đặt sau răng dưới”. Nội dung tự viết, lưu trong `/content/pron/sounds.yaml`.
  - Cặp hay nhầm.

## 2. Luyện nghe thanh

- **Một phiên 20 câu.** Mỗi câu phát audio và hiện pinyin che thanh (ví dụ `h_o`). Người học chọn 1 trong 4 thanh, mỗi thanh có hình đường đi của thanh cùng màu với pinyin.
- **Ba mức:**
  - **1 âm tiết:** ngẫu nhiên trong các âm tiết phổ biến.
  - **2 âm tiết:** từ HSK 1–2. Chọn thanh **nghe được** (đã biến điệu) cho từng âm tiết, giống `pick_tone`. Phản hồi hiện pinyin viết chuẩn và giải thích biến điệu.
  - **Cặp dễ nhầm:** ưu tiên các cặp thanh người Việt hay nhầm, gồm 2/3, 1/4 với giọng cao, 3/4.
- Kết quả không ghi vào SRS và không ảnh hưởng lộ trình. Chỉ thống kê độ chính xác theo từng thanh, lưu trên máy (khách) hoặc server.

## 3. Bài trong giai đoạn Phát âm

Ngoài các dạng chung ở [exercise-types](../06-lesson/exercise-types.md), giai đoạn này dùng:

| Dạng | Mô tả |
|---|---|
| `sound_intro` | Thẻ giới thiệu một âm hoặc thanh: audio, mô tả khẩu hình, so sánh với tiếng Việt, 3–4 ví dụ |
| `tone_contour_intro` | Thẻ giới thiệu thanh: hình đường đi của thanh, so với dấu tiếng Việt, audio ví dụ |
| `pick_tone` | Như ở exercise-types |
| `listen_pick_pinyin` | Phân biệt âm gần nhau (zhi/chi/shi/ri, ü/u, an/ang…) |
| `speak_syllable` | Đọc to âm tiết, chấm thanh ([speech-service](../08-speaking/speech-service.md), `mode = syllable`) |
| `write_char` | Chỉ có ở chủ đề 8 (nét và chữ đầu tiên) |

**Ở giai đoạn Phát âm, bước nói** dùng `speak_syllable`, mỗi bài ít nhất 3 âm tiết. Chủ đề 7 (biến điệu) dùng `speak_word` với từ hai âm tiết.

### Cấu trúc một bài Phát âm

| Thứ tự | Bước | Bắt buộc |
|---|---|---|
| 1 | `sound_intro` / `tone_contour_intro` (1–4 thẻ) | Có |
| 2 | Bài tập nghe: `pick_tone`, `listen_pick_pinyin` (6–10 câu) | Có |
| 3 | Luyện nói: `speak_syllable` hoặc `speak_word` (≥ 3 câu) | Có |
| 4 | Luyện viết (chỉ chủ đề 8) | Có ở chủ đề 8 |
| 5 | Tổng kết | Có |

- `sound_intro` và `tone_contour_intro` là loại bước mới trong trình chạy bài, cùng nhóm với `intro` (không chấm điểm).
- **Hoàn thành bài:** như bài thường ([lesson-player §4](../06-lesson/lesson-player.md)).
- **Kiểm tra nội dung** (`import_content`) cho `stage: pron`: không bắt buộc `new_words` và `writing` (trừ chủ đề 8), bài tập ≥ 6, nói ≥ 3.
- **SRS:** chủ đề 1–7 không tạo thẻ, vì không có từ HSK. Chủ đề 8 tạo thẻ `recognize` cho các chữ đã học.

## 4. Hình đường đi của thanh

Một component SVG dùng chung ở mọi nơi (luyện nghe, luyện nói, thẻ giới thiệu), dựa trên thang 5 bậc của Chao Yuen Ren:

| Thanh | Đường đi (thang 5 bậc) |
|---|---|
| 1 | 55 |
| 2 | 35 |
| 3 | 214 (trong câu thường là 21) |
| 4 | 51 |

Màu theo [non-functional §3](../00-foundation/non-functional.md). Khi so sánh trong luyện nói thì vẽ thêm một đường nét đứt cho `contour` người học đọc.
