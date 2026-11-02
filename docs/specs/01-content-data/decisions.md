# Quyết định phát sinh – 01 Dữ liệu nguồn, pipeline

## 01-3: khóa tự nhiên của `dict_entry`
- Schema 00-4 chưa có ràng buộc unique nên upsert theo `(simplified, traditional, pinyin_numbered)` không chạy được. Thêm `dict_entry_natural_uq` (migration `0001_*`).
- CC-CEDICT có các dòng trùng khóa này. Importer gộp: giữ thứ tự (`cedict_order`) của dòng đầu, nối các nghĩa chưa có; `is_variant_or_surname` chỉ `true` khi mọi dòng gộp đều `true`.
- `pinyin_numbered` giữ nguyên như trong CC-CEDICT (ví dụ `lu:4`), không chuẩn hóa `u:`.
- `cedict_order` đếm theo dòng dữ liệu, bỏ dòng chú thích `#`.
- Upsert không ghi đè `hsk_level` (cột không có trong dữ liệu nhập), nên chạy lại `import-cedict` giữ nguyên cấp HSK đã ghép ở 01-4.

## Chạy pipeline trong Docker
- Service `py-pipeline` (dev) nối tới `db` và có `DATABASE_URL`, `TEST_DATABASE_URL`. Test tích hợp (`tests/conftest.py`) tự tạo database riêng, áp `pre-migrate.sql` và các migration của web rồi xóa khi xong. Chạy bằng `src/deploy/dev.sh run --rm py-pipeline run pytest` (không dùng `--no-deps`, vì cần `db`).
