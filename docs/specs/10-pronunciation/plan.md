# Plan thực hiện: 10 – Phát âm, bảng pinyin, luyện nghe thanh

Spec: [pronunciation.md](pronunciation.md). Quy ước chung: [00-foundation/plan.md](../00-foundation/plan.md).

## 1. Màn hình design

`pinyin.html` → route `/pinyin` (mục “Bảng pinyin” trên thanh điều hướng):
- Tab Bảng: `section[aria-label="Bảng pinyin"]` (`.ptable`), `#tones` (`tone-panel`, thẻ 4 thanh của âm tiết đang chọn), `viet-tips`.
- Tab Thanh mẫu (`#init-info`) và Vận mẫu (`#fin-info`): danh sách âm (`.letters`) + thông tin âm đang chọn.
- Luyện nghe thanh: `tone-drill` (`.tonegrid`, `.tone-btn` có `ToneContour`), kết quả “Bạn đúng x/20 câu”.

Bài trong giai đoạn Phát âm chạy trong trình chạy bài (06), thêm hai loại thẻ giới thiệu ở module này.

## 2. Phụ thuộc

- 01: audio `syl/{voice}/{pinyin}.mp3`, từ điển để tìm chữ ví dụ. 02: nhập `pron/*.yaml`, `pron/sounds.yaml`.
- 06: trình chạy bài, `pick_tone`, `listen_pick_pinyin`. 08: `SpeakingStep mode=syllable`. 00: `ToneContour`.
- Cung cấp cho: 04 (bài kiểm tra pinyin cho lựa chọn “Tôi đọc được pinyin”), 05 (điều kiện mở HSK 1), 08 (mẹo tiếng Việt khi sai thanh).

## 3. Các bước

### Bước 1. Dữ liệu âm tiết — `content/pron/syllables.yaml`
- Danh sách âm tiết chuẩn của tiếng phổ thông (~400), mỗi mục: `initial` (rỗng cho âm không thanh mẫu), `final`, `syllable` (dạng viết, ví dụ `yu`, `ju`, `zhi`), và 4 thanh: `{ tone, char?, gloss?, hsk_level?, audio: bool }`.
- Script `pipeline/clp/syllables.py`:
  - Sinh tập âm tiết từ CC-CEDICT (âm tiết đơn), đối chiếu với danh sách chuẩn ghi tay trong script; khác nhau thì báo.
  - Chữ ví dụ cho mỗi thanh: chữ có đúng âm + thanh, ưu tiên cấp HSK thấp nhất, rồi số nghĩa nhiều nhất; không có → “không có chữ thông dụng”.
  - `audio` = file `syl/xiaoxiao/{syllable}{tone}.mp3` đã có trên R2 (theo `audio_asset`).
- Test: `ma` có 4 thanh với 妈/麻/马/骂; tổ hợp `bi + ong` không tồn tại; `lü`, `nü` được giữ (`lv`/`nv` không lọt vào).

### Bước 2. Nội dung âm — `content/pron/sounds.yaml`
- Mỗi thanh mẫu, vận mẫu và 4 thanh: `id`, `label`, `audio`, `mouth_vi` (cách đặt lưỡi/môi), `compare_vi` (so với âm tiếng Việt gần nhất, ví dụ “b giống p không bật hơi”), `confusions` (cặp hay nhầm), `examples` (3–4 âm tiết/chữ), `image?`.
- Soạn bằng quy trình AI của 02 (prompt riêng cho người Việt: zh/ch/sh, ü, r, thanh 3 so với dấu hỏi…). `import_content` kiểm tra mọi `audio`/`examples` tồn tại.

### Bước 3. Bảng pinyin
- `PinyinTable`: hàng = thanh mẫu, cột = vận mẫu, dựng từ `syllables.yaml`. Ô không tồn tại gạch chéo, `aria-disabled`, không bấm được.
- Cuộn ngang trong khung riêng (không làm cả trang cuộn ngang); cột tiêu đề hàng và hàng tiêu đề cột `position: sticky`.
- Bấm âm tiết → `#tones`: 4 thanh, mỗi thanh có pinyin dấu (màu thanh), chữ ví dụ + nghĩa (ví dụ “mā 妈 mẹ”), nút phát. Không có audio → làm mờ thanh đó.
- Tab Thanh mẫu / Vận mẫu: danh sách âm, bấm hiện `mouth_vi`, `compare_vi`, cặp hay nhầm, audio.
- Dùng tự do, không cần đăng nhập. Dữ liệu tĩnh (JSON build-time từ YAML), không gọi API.
- Test Playwright 360×800: bảng cuộn ngang trong khung, `document.scrollingElement.scrollWidth` không vượt `innerWidth`; tiêu đề cố định khi cuộn; ô gạch chéo không phản hồi.

### Bước 4. Luyện nghe thanh
- `buildToneDrill(level: 'one' | 'two' | 'confusable', rand): DrillItem[]`, 20 câu:
  - `one`: âm tiết phổ biến ngẫu nhiên (có audio).
  - `two`: từ HSK 1–2 hai âm tiết; đáp án là thanh **đọc** (`applyToneSandhi`) cho từng âm tiết; phản hồi hiện pinyin viết chuẩn + giải thích biến điệu.
  - `confusable`: ưu tiên cặp 2/3, 1/4, 3/4 (chọn âm tiết có cả hai thanh trong cặp).
- Đề: phát audio, pinyin che thanh (`h_o`), 4 nút thanh có `ToneContour` cùng màu.
- Không ghi SRS, không ảnh hưởng lộ trình. Thống kê độ chính xác **theo từng thanh**: khách lưu trong `guest_progress_v1`, người dùng ở `tone_drill_stat` (`POST /api/tone-drill/result`). `useActiveTimer` bật, phút học gửi qua `POST /api/activity` (04).
- Test: mức `two` với 你好 có đáp án [2, 3]; mức `confusable` 20 câu đều thuộc 3 cặp trên; thống kê cộng đúng `correct/total` theo thanh.

### Bước 5. Thẻ giới thiệu của giai đoạn Phát âm (bước trong bài)
- `SoundIntroCard` (`sound_intro`): audio, khẩu hình, so sánh với tiếng Việt, 3–4 ví dụ có audio. Dữ liệu từ `sounds.yaml`.
- `ToneContourIntroCard` (`tone_contour_intro`): `ToneContour` lớn (thang Chao: 55, 35, 214 — trong câu thường 21, 51), so với dấu tiếng Việt, audio ví dụ.
- Không chấm điểm, cùng nhóm với `intro` ở `checkLessonCompletion` (06).
- `ToneContour` dùng path của design (`CONTOUR`, viewBox 60×40) và thêm đường nét đứt cho contour người học (08).

### Bước 6. Bài kiểm tra pinyin (`pron-test`)
- 20 câu, chạy trong trình chạy bài (06) chế độ `pinyin_test`, không có hàng hỏi lại:
  - nghe chọn âm tiết (`listen_pick_pinyin`),
  - nghe chọn thanh (`pick_tone`),
  - đọc pinyin chọn audio (`pinyin_pick_audio`: hiện pinyin có dấu, 4 nút phát audio, chọn đúng audio),
  - đọc to 5 âm tiết (`SpeakingStep mode=syllable`, tối đa 2 lượt, lấy cao nhất; đúng khi ≥ 60).
- Phân bố: 5 + 5 + 5 + 5. **Đạt ≥ 70%** → mở HSK 1.
- Ai cũng làm được ngay, kể cả khách, không cần học hết giai đoạn.
- Người dùng: `POST /api/pinyin-test/finish` server chấm lại từ kết quả từng câu đã lưu, đạt → `stage_progress('pron') = completed, completed_via = exam_skip`. Khách: lưu `pinyinTest` trong `guest_progress_v1` (server chấp nhận khi merge, 03).
- Chưa đạt (đi từ màn hình đầu tiên) → về lộ trình Phát âm với thông báo “Bạn nên học lại phần phát âm trước” (04).
- Ở lộ trình (05), nút cuối giai đoạn Phát âm là “Bài kiểm tra pinyin”, không có chứng nhận.
- Test: 14/20 → đạt, stage `pron` completed; 13/20 → chưa đạt, không đổi stage; `pinyin_pick_audio` chấm đúng/sai.

### Bước 7. Quy tắc nội dung và SRS của giai đoạn Phát âm
- Đã nằm trong `import_content` (02): `stage: pron` không bắt buộc `new_words`/`writing` (trừ chủ đề 8), bài tập ≥ 6, nói ≥ 3. Chủ đề 7 dùng `speak_word` với từ hai âm tiết.
- SRS (09): chủ đề 1–7 không tạo thẻ; chủ đề 8 tạo thẻ `recognize` cho 20 chữ đầu tiên.
- Test (ở 02/09): bài `pron` chủ đề 3 thiếu `writing` vẫn hợp lệ; hoàn thành bài chủ đề 8 tạo thẻ `recognize`.

## 4. Xong module khi
- `/pinyin` khớp design, dùng được khi chưa đăng nhập, không cuộn ngang ở 360px.
- Luyện nghe thanh 3 mức chạy và lưu thống kê.
- Bài kiểm tra pinyin mở được HSK 1 cho cả khách và người dùng.
