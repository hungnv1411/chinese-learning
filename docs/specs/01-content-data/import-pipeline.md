# Pipeline nhập dữ liệu

Các script Python trong `/pipeline` đọc dữ liệu nguồn, làm sạch rồi ghi vào PostgreSQL. Yêu cầu:
- Chạy lại nhiều lần vẫn ra cùng kết quả (idempotent).
- Mỗi bước chạy riêng được.
- Có bản ghi log tóm tắt sau mỗi lần chạy.

## 1. Các bước

### B1. Tải nguồn (`fetch`)
- Tải CC-CEDICT, hsk30, Unihan, Make Me a Hanzi, hanzi-writer-data, Tatoeba (`sentences`, `links`, chỉ lấy `cmn` và `eng`) vào `/data/raw/<nguồn>/<ngày>/`.
- Ghi checksum và ngày tải vào `/data/raw/manifest.json`.

### B2. Từ điển (`import_cedict`)
- Phân tích từng dòng CC-CEDICT: `繁 简 [pin1 yin1] /def1/def2/`.
- Sinh `pinyin_marked` (dấu thanh, ví dụ `hǎochī`) và `pinyin_plain` (không dấu, không cách: `haochi`).
  - Xử lý đúng `u:` → `ü`, thanh 5 → không dấu.
  - Đặt dấu thanh theo quy tắc a/e > o > nguyên âm cuối.
- Đánh dấu `is_variant_or_surname` cho mục mà mọi nghĩa đều bắt đầu bằng `surname `, `variant of`, `old variant of`, `see `.

### B3. Danh sách HSK 2021 (`import_hsk`)
- Từ ivankra/hsk30 lấy: từ + cấp (1–9), chữ + cấp, ngữ pháp + cấp.
- Nối mỗi `hsk_word` với `dict_entry`:
  1. Khớp `simplified` + pinyin (bỏ khoảng trắng, không phân biệt hoa thường).
  2. Nếu không có: khớp `simplified` duy nhất.
  3. Nếu nhiều mục: chọn mục không phải họ hay biến thể và có nhiều nghĩa nhất.
  4. Không khớp được thì ghi vào `/pipeline/out/hsk_unmatched.csv` để xử lý tay. Có file `content/overrides/hsk_dict_map.yaml` để ghép tay.
- Cập nhật `dict_entry.hsk_level`.

**Kiểm tra bắt buộc:** số từ và số chữ cấp 1–3 phải khớp với chuẩn. Theo các nguồn thứ cấp, số liệu tham khảo của chuẩn 2021 là:

| Cấp | Từ (riêng cấp) | Chữ (riêng cấp) | Âm tiết (riêng cấp) | Ngữ pháp (riêng cấp) |
|---|---|---|---|---|
| 1 | 500 | 300 | 269 | 48 |
| 2 | 772 | 300 | 199 | 81 |
| 3 | 973 | 300 | 140 | 81 |

Nếu dữ liệu nhập lệch khỏi bảng này thì báo cảnh báo trong log, không dừng pipeline. Số liệu trong dữ liệu là nguồn đúng.

### B4. Chữ Hán (`import_hanzi`)
- Từ Unihan `kVietnamese` → `han_viet` (có thể nhiều âm).
  - Báo danh sách chữ HSK 1–3 **không có** âm Hán Việt vào `/pipeline/out/hanviet_missing.csv`.
  - Bổ sung tay bằng `content/overrides/han_viet.yaml`.
- Từ Make Me a Hanzi `dictionary.txt` → `decomposition`, `radical`, `etymology_hint`.
- Từ hanzi-writer-data → `has_stroke_data`, `stroke_count`. Dữ liệu nét (JSON từng chữ) được đẩy lên R2 tại `strokes/{char}.json`, để client tải về.
- **Lưu ý:** độ chính xác của âm Hán Việt trong Unihan chưa được xác minh. Không có người duyệt (D13). Nguồn sửa sai là báo lỗi của người học, sửa vào `overrides/han_viet.yaml`.

### B5. Câu ví dụ (`import_tatoeba`)
- Lấy cặp câu `cmn` ↔ `eng`. Chuyển câu sang giản thể (dùng bảng phồn → giản trong CC-CEDICT hoặc OpenCC).
- Tách từ (dùng `jieba`), nối với `dict_entry`, tính `max_hsk_level` (từ không có trong HSK thì tính là 7).
- **Lọc:**
  - Câu dài 4–25 chữ Hán.
  - Bỏ câu có ký tự Latin, trừ dấu câu và số.
  - Một câu nhiều bản dịch tiếng Anh thì chọn bản ngắn nhất.
  - Bỏ câu trùng nhau.
- Sinh pinyin cho câu bằng `pypinyin`. Pinyin máy sinh có thể sai với chữ đa âm. Câu dùng trong bài học được đối chiếu ở bước kiểm tra tự động (xem [02-curriculum](../02-curriculum/authoring-workflow.md)).

### B6. Nội dung lộ trình (`import_content`)
- Đọc `/content/**/*.yaml`, kiểm tra theo schema (xem [content-format.md](../02-curriculum/content-format.md)), ghi vào các bảng `stage`, `unit`, `lesson`…
- Nếu lỗi schema hoặc tham chiếu tới từ/câu không tồn tại thì **dừng** và báo rõ file, dòng.

### B7. Audio (`generate_audio`)
Xem [tts-audio.md](tts-audio.md).

## 2. Đầu ra kiểm tra

Mỗi lần chạy sinh `/pipeline/out/report.md`, gồm:
- Số mục mỗi bảng.
- Số từ HSK chưa ghép được với từ điển.
- Số chữ HSK 1–3 thiếu Hán Việt và thiếu dữ liệu nét.
- Số từ HSK 1–3 không có câu ví dụ nào có `max_hsk_level` ≤ cấp của từ.

## 3. Người xây tự quyết

- Dùng bảng tạm rồi đổi tên một lượt, hay upsert trực tiếp.
- Pipeline chạy trong container riêng hay trên máy dev.
