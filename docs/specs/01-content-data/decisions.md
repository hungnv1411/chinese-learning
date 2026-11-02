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
