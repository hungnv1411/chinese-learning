# Mô hình dữ liệu

Phần này mô tả các thực thể và quan hệ. Tên bảng và tên cột chỉ là gợi ý, người xây có thể đổi.

Dữ liệu chia làm 3 nhóm:
- **Dữ liệu tham chiếu:** nhập từ nguồn mở bằng pipeline, chỉ đọc lúc chạy.
- **Nội dung lộ trình:** nhập từ file YAML trong `/content`.
- **Dữ liệu người dùng.**

## 1. Dữ liệu tham chiếu (từ [01-content-data](../01-content-data/))

### `dict_entry`: một mục từ điển (từ CC-CEDICT)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | serial | |
| simplified | text | 好吃 |
| traditional | text | 好吃 |
| pinyin_numbered | text | `hao3 chi1` (giữ nguyên gốc CC-CEDICT) |
| pinyin_marked | text | `hǎochī` (sinh ra lúc nhập) |
| pinyin_plain | text | `haochi` (không dấu, dùng để tìm) |
| definitions | text[] | Nghĩa tiếng Anh, tách theo `/` |
| hsk_level | smallint null | 1–9 theo HSK 2021 nếu có trong danh sách |
| is_variant_or_surname | bool | Đánh dấu mục ít dùng (ví dụ “surname X”, “variant of”) để xếp xuống cuối khi tìm |

Một chữ hay từ có thể có nhiều mục (đa âm, ví dụ 行 xíng / háng).

### `hsk_word`: danh sách từ HSK 2021
| Cột | Ghi chú |
|---|---|
| id | |
| level | 1–9 (chỉ dùng 1–3 cho lộ trình) |
| simplified, pinyin | Theo danh sách HSK |
| pos | Từ loại, nếu nguồn có |
| dict_entry_id | Liên kết tới mục CC-CEDICT phù hợp nhất. Có thể null nếu không khớp, khi đó cần xử lý tay |

### `hsk_char`: danh sách chữ HSK 2021 (3.000 chữ, 1–9)
### `hsk_grammar`: danh sách điểm ngữ pháp HSK 2021 (mã, cấp, tên gốc tiếng Trung)

### `hanzi`: thông tin từng chữ
| Cột | Ghi chú |
|---|---|
| char | Khóa chính, 1 ký tự |
| han_viet | text[]: âm Hán Việt (Unihan `kVietnamese`, có thể nhiều âm) |
| decomposition | Chuỗi IDS từ Make Me a Hanzi, ví dụ `⿰亻尔` |
| radical | Bộ thủ |
| etymology_hint | Gợi ý nguồn gốc từ Make Me a Hanzi (tiếng Anh), nếu có |
| stroke_count | |
| has_stroke_data | Có dữ liệu nét của hanzi-writer không |

### `radical_vi`: tên và nghĩa tiếng Việt của khoảng 214 bộ thủ
Nhóm dự án tự biên soạn (ví dụ 亻 = “nhân đứng – người”). Lưu trong `/content`.

### `sentence`: câu ví dụ
| Cột | Ghi chú |
|---|---|
| id | |
| zh | Câu tiếng Trung giản thể |
| pinyin | Sinh tự động, có thể sửa tay |
| en | Bản dịch tiếng Anh |
| source | `tatoeba` hoặc `authored` |
| source_ref | ID câu Tatoeba, dùng để ghi nguồn |
| max_hsk_level | Cấp HSK cao nhất của các từ trong câu (tính lúc nhập) |
| audio_url | |

Bảng nối `sentence_word(sentence_id, dict_entry_id)` để tìm câu ví dụ theo từ.

### `audio_asset`
`key` (ví dụ `word/xiaoxiao/好吃_hao3chi1.mp3`, `syl/xiaoxiao/hao3.mp3`, `sent/xiaoxiao/123.mp3`, có thêm biến thể `slow`. Xem [tts-audio](../01-content-data/tts-audio.md)), `url`, `text`, `voice`, `created_at`.

## 2. Nội dung lộ trình (từ [02-curriculum](../02-curriculum/))

- `stage`: id (`pron`, `hsk1`, `hsk2`, `hsk3`), thứ tự, tiêu đề, mô tả, `has_certificate`.
- `unit`: id, stage_id, thứ tự, tiêu đề tiếng Việt, mô tả, ảnh minh họa.
- `lesson`: id, unit_id, thứ tự, tiêu đề, loại (`normal` | `checkpoint`), thời lượng ước tính, `content` (JSONB chứa danh sách bước, sinh từ YAML).
- `lesson_word`: các từ **mới** được giới thiệu trong bài (liên kết `hsk_word`).
- `lesson_char`: các chữ **mới** cần luyện viết trong bài.
- `grammar_point`: id, mã HSK, tiêu đề, giải thích tiếng Việt (markdown), ví dụ.
- `exam_item`: ngân hàng câu hỏi cho bài kiểm tra cuối (stage_id, kỹ năng, dạng, nội dung JSONB).

**Phiên bản nội dung:**
- Mỗi lần nhập nội dung có một `content_version`.
- Tiến độ người dùng gắn theo `lesson.id` cố định (ví dụ `hsk1-u03-l02`). Vì vậy sửa nội dung bài không làm mất tiến độ.
- Không được đổi id hay xóa một bài đã phát hành. Chỉ được thêm bài mới hoặc sửa nội dung bên trong.

## 3. Dữ liệu người dùng

- `user`, `session`, `account`: do Better Auth quản lý. Thêm cột `display_name` và `certificate_name` (tên in trên chứng nhận).
- `user_settings`: user_id, `daily_goal_minutes` (5/10/20), `show_pinyin` (`always` | `new` | `never`), `show_han_viet`, `tone_colors`, `traditional`, `review_buttons` (2 | 4), `review_card_types` (mảng), `voice` (`female` | `male`), `record_mode` (`hold` | `toggle`).
- `lesson_progress`: user_id, lesson_id, `status` (`locked` | `available` | `in_progress` | `completed`), `current_step`, `step_state` (JSONB), `best_score`, `completed_at`, `attempts`.
  - Trạng thái `locked`/`available` có thể tính ra từ dữ liệu khác thay vì lưu. Người xây chọn.
- `stage_progress`: user_id, stage_id, `status` (`locked` | `available` | `completed`), `completed_via` (`lessons` | `exam_skip`), `completed_at`.
- `srs_card`: id, user_id, `word_id` (hsk_word hoặc dict_entry), `card_type` (`recognize` | `listen` | `write`), các trường trạng thái FSRS (due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review), `source` (`lesson` | `dictionary` | `speaking_fail`), `suspended`.
- `srs_review_log`: card_id, rating, review_time, thời gian trả lời. Dùng để thống kê và tinh chỉnh FSRS sau này.
- `daily_activity`: user_id, date (theo múi giờ của người dùng), `minutes`, `lessons_completed`, `reviews_done`, `streak_freeze_used`.
- `speaking_attempt`: user_id, item_ref, score, chi tiết từng âm tiết (JSONB), created_at. **Không lưu file ghi âm.**
- `exam_attempt`: id, user_id, stage_id, `item_ids`, `answers` (JSONB), điểm từng kỹ năng, tổng điểm, `passed`, started_at, finished_at.
- `certificate`: id, `code` (duy nhất, ví dụ `HSK1-7F3K-92QD`), user_id, stage_id, exam_attempt_id, name_on_certificate, điểm, issued_at, pdf_url, `revoked`.
- `content_report`: user_id null, đối tượng bị báo (lesson/word/sentence + id), loại lỗi, mô tả, trạng thái xử lý, created_at.

## 4. Quy tắc toàn vẹn

- Chỉ server được tạo `certificate`, sau khi tự chấm `exam_attempt`.
- Chỉ server được đặt `lesson_progress.completed`, sau khi kiểm tra đã đủ các bước bắt buộc (xem [06-lesson](../06-lesson/lesson-player.md)).
- Khi đã có tiến độ thì không được xóa `hsk_word`. Nếu cần bỏ thì đánh dấu ngưng dùng.
