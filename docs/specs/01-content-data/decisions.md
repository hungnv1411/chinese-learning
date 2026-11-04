# Quyết định phát sinh – 01 Dữ liệu nguồn, pipeline

## 01-3: khóa tự nhiên của `dict_entry`
- Schema 00-4 chưa có ràng buộc unique nên upsert theo `(simplified, traditional, pinyin_numbered)` không chạy được. Thêm `dict_entry_natural_uq` (migration `0001_*`).
- CC-CEDICT có các dòng trùng khóa này. Importer gộp: giữ thứ tự (`cedict_order`) của dòng đầu, nối các nghĩa chưa có; `is_variant_or_surname` chỉ `true` khi mọi dòng gộp đều `true`.
- `pinyin_numbered` giữ nguyên như trong CC-CEDICT (ví dụ `lu:4`), không chuẩn hóa `u:`.
- `cedict_order` đếm theo dòng dữ liệu, bỏ dòng chú thích `#`.
- Upsert không ghi đè `hsk_level` (cột không có trong dữ liệu nhập), nên chạy lại `import-cedict` giữ nguyên cấp HSK đã ghép ở 01-4.

## Chạy pipeline trong Docker
- Service `py-pipeline` (dev) nối tới `db` và có `DATABASE_URL`, `TEST_DATABASE_URL`. Test tích hợp (`tests/conftest.py`) tự tạo database riêng, áp `pre-migrate.sql` và các migration của web rồi xóa khi xong. Chạy bằng `src/deploy/dev.sh run --rm py-pipeline run pytest` (không dùng `--no-deps`, vì cần `db`).

## 01-4: nhập HSK
- Thêm `hsk_word_natural_uq (level, simplified, pinyin)` (migration `0002_*`) cho upsert. Dòng trùng khóa trong `hsk30-expanded.csv` được gộp. Upsert không đụng cột `deprecated`.
- hsk30 chỉ có nhóm `7-9`, lưu là `level = 7` (cho từ, chữ, ngữ pháp). Chỉ HSK 1–3 được dùng trong lộ trình.
- Tải thêm `hsk30-chars.csv` và `hsk30-grammar.csv` (thêm vào `sources.yaml`).
- `hsk_grammar.code = hsk30-gNNN` (NNN = cột `No`); `name_zh = "<Category>·<Details>：<Content>"` (bỏ `·` khi `Details` rỗng).
- Định dạng `content/overrides/hsk_dict_map.yaml`: danh sách `{simplified, pinyin (pinyin của HSK), pinyin_numbered (của dict_entry đích)}`. Override không tìm thấy mục đích thì rơi về quy tắc thường. Hiện để `[]`.
- `hsk_level` được tính lại mỗi lần chạy (đặt NULL rồi gán cấp thấp nhất), nên chạy lại luôn đúng.
- Từ biến mất khỏi nguồn không bị xóa/`deprecated` tự động (chưa cần; làm khi có tiến độ người học).
- Số liệu thật: cấp 1 có 512 từ (chuẩn 500), cấp 2 có 776 (chuẩn 772) và 82 ngữ pháp (chuẩn 81); cấp 3 đúng 973, chữ 300/300/300. Theo spec, số liệu trong dữ liệu là nguồn đúng, chỉ cảnh báo. 32 từ HSK chưa ghép được (cụm như 车上, 老王, 不太) nằm ở `out/hsk_unmatched.csv`; `hsk_word.dict_entry_id` để NULL.

## 01-5: nhập chữ Hán
- **Phạm vi:** chữ trong `hsk_char` và mọi chữ xuất hiện trong `hsk_word` (hiện đúng 3.000 chữ). Chữ ngoài danh sách (ví dụ thành phần phân tích) chưa có hàng `hanzi`; mở rộng khi màn hình chữ cần.
- **Âm Hán Việt cho giản thể:** Unihan `kVietnamese` chỉ có chữ phồn thể (说 không có, 說 có). Chữ không có âm riêng thì lấy qua `kTraditionalVariant` (`Unihan_Variants.txt`); vẫn ghi `han_viet_source = unihan`. Override trong `content/overrides/han_viet.yaml` thay hoàn toàn giá trị Unihan.
- **Chất lượng Unihan thấp hơn kỳ vọng:** 好 chỉ có `háo` (không có `hảo` như ví dụ trong plan). Dữ liệu thật: 2.119/3.000 chữ có âm; **123/900 chữ HSK 1–3 chưa có** (gồm chữ thường như 以, 但, 亮), liệt kê ở `out/hanviet_missing.csv`. Cần bổ sung bằng override (AI/tay) trước khi dùng cho mẹo nhớ chữ ở 06/07. Làm ở đợt nội dung 02, không chặn các bước kỹ thuật.
- **Bộ thủ:** trường `radical` của Make Me a Hanzi thường là dạng rút gọn (讠); đưa về bộ gốc Khang Hy qua `variants` của `radicals_vi.yaml` (讠 → 言). Ký tự mô tả `？` trong `decomposition` thành NULL.
- **Nét:** nếu có đủ `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` thì đẩy `strokes/{char}.json` lên R2 (HEAD so ETag với MD5, trùng thì bỏ qua); không có thì ghi vào `data/strokes/` (bị `.gitignore`). Bản R2 mới test bằng mock boto3, chưa thử với R2 thật.
