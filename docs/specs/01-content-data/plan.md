# Plan thực hiện: 01 – Dữ liệu nguồn, pipeline, audio TTS

Spec: [import-pipeline.md](import-pipeline.md), [sources-and-licenses.md](sources-and-licenses.md), [tts-audio.md](tts-audio.md). Quy ước chung: [00-foundation/plan.md](../00-foundation/plan.md).

Không có màn hình riêng. Kết quả được kiểm tra qua từ điển (11) và `report.md`.

## 1. Phụ thuộc

- 00: schema DB (bảng tham chiếu), cấu hình R2, `fixtures/pinyin.json`.
- Cung cấp cho: 02 (nội dung bài cần từ, chữ, câu), 06/07/09/10/11 (dữ liệu và audio), 13 (`content/sources.yaml` cho trang Nguồn dữ liệu).

## 2. Cấu trúc

```
/pipeline
  pyproject.toml              uv; typer, psycopg[binary], pydantic, pyyaml, jieba, pypinyin, opencc, boto3, httpx
  clp/cli.py                  `uv run clp <lệnh>`
  clp/db.py                   kết nối, upsert theo lô, ghi run log
  clp/pinyin.py               bản Python của packages/core/pinyin.ts
  clp/fetch.py                B1
  clp/cedict.py               B2
  clp/hsk.py                  B3
  clp/hanzi.py                B4
  clp/tatoeba.py              B5
  clp/audio/                  B7: provider.py, azure.py, keys.py, generate.py
  clp/report.py               /pipeline/out/report.md
  sources.yaml                URL tải của từng nguồn
  tests/                      pytest, dữ liệu mẫu nhỏ trong tests/data/
/content/sources.yaml          danh sách nguồn cho trang /nguon-du-lieu (13)
/content/radicals_vi.yaml      214 bộ thủ (soạn ở 02, nhập ở đây)
/content/overrides/{hsk_dict_map,han_viet,definitions}.yaml
```

Quy ước: mọi lệnh **idempotent** (upsert theo khóa tự nhiên: `dict_entry(simplified, traditional, pinyin_numbered)`, `hsk_word(level, simplified, pinyin)`, `hanzi(char)`, `sentence(source, source_ref)`). Mỗi lệnh ghi một dòng tóm tắt vào `/pipeline/out/runs.log` (thời điểm, lệnh, số dòng thêm/sửa/bỏ qua).

## 3. Các bước

### Bước 1. Khung pipeline + `pinyin.py`
- `clp/pinyin.py`: `parse_numbered`, `numbered_to_marked(s, join=False)`, `to_plain`.
- Test đọc `packages/core/fixtures/pinyin.json`, kết quả phải giống bản TS.
- `clp/db.py`: `upsert(table, rows, key_cols)` trả số dòng thêm/sửa.
- Xong khi: `uv run pytest` xanh; `uv run clp --help` liệt kê các lệnh.

### Bước 2. `fetch` (B1)
- Tải CC-CEDICT, ivankra/hsk30, Unihan (`Unihan_Readings.txt`), Make Me a Hanzi (`dictionary.txt`, `graphics.txt`), hanzi-writer-data, Tatoeba (`sentences` lọc `cmn`/`eng`, `links`).
- Lưu vào `/data/raw/<nguồn>/<YYYY-MM-DD>/`; ghi `/data/raw/manifest.json`: `{ nguồn: { date, url, sha256, files[] } }`.
- Lệnh khác đọc bản mới nhất theo manifest.
- Test (mock HTTP bằng `respx`): manifest có đúng checksum; chạy lại với cùng checksum thì không tải lại.

### Bước 3. `import_cedict` (B2)
- Phân tích dòng `繁 简 [pin1 yin1] /def1/def2/`. Bỏ dòng chú thích `#`.
- Sinh `pinyin_marked` (nối liền, `hǎochī`) và `pinyin_plain` (`haochi`).
- `is_variant_or_surname = true` khi **mọi** nghĩa bắt đầu bằng `surname `, `variant of`, `old variant of`, `see `.
- Giữ thứ tự dòng gốc vào cột `cedict_order` (dùng xếp hạng tìm kiếm ở 11).
- Test:
  - `好吃 好吃 [hao3 chi1] /tasty/delicious/` → `pinyin_marked = hǎochī`, `definitions = ['tasty','delicious']`.
  - `綠 绿 [lu:4] /green/` → `lǜ`, plain `lu`.
  - Mục chỉ có `surname Wang` → `is_variant_or_surname = true`; mục có `surname X` + nghĩa khác → `false`.
  - Chạy 2 lần trên tệp mẫu: số dòng bảng không đổi.

### Bước 4. `import_hsk` (B3)
- Đọc từ/chữ/ngữ pháp và cấp 1–9 từ hsk30.
- Ghép `hsk_word → dict_entry` đúng 4 bước của spec, ưu tiên `overrides/hsk_dict_map.yaml` trước tất cả.
- Không khớp → `/pipeline/out/hsk_unmatched.csv` (simplified, pinyin, level, ứng viên).
- Cập nhật `dict_entry.hsk_level` (cấp thấp nhất nếu một mục được nhiều từ HSK trỏ tới).
- Đối chiếu số lượng cấp 1–3 với bảng chuẩn (từ 500/772/973, chữ 300/300/300, ngữ pháp 48/81/81). Lệch thì **cảnh báo** trong log và report, không dừng.
- Test, mỗi quy tắc ghép một ca:
  1. Khớp `simplified + pinyin` bỏ khoảng trắng, không phân biệt hoa thường.
  2. Khớp `simplified` duy nhất.
  3. Nhiều mục → chọn mục không phải họ/biến thể và nhiều nghĩa nhất (ví dụ 行 với các mục `xing2`, `hang2`: theo pinyin HSK).
  4. Override thắng mọi quy tắc.
  5. Không khớp → có dòng trong CSV.

### Bước 5. `import_hanzi` (B4)
- Unihan `kVietnamese` → `hanzi.han_viet` (mảng, chữ thường).
- Gộp `overrides/han_viet.yaml` (định dạng `{ char: { han_viet: [...], source: manual|ai } }`). Ghi `source` vào `hanzi.han_viet_source` để trang Nguồn dữ liệu nói rõ âm do AI bổ sung.
- Make Me a Hanzi `dictionary.txt` → `decomposition`, `radical`, `etymology_hint`.
- hanzi-writer-data → `has_stroke_data`, `stroke_count`; đẩy `strokes/{char}.json` lên R2 (bỏ qua nếu ETag trùng MD5).
- `radicals_vi.yaml` → `radical_vi`.
- Xuất `/pipeline/out/hanviet_missing.csv` và `/pipeline/out/strokes_missing.csv` cho chữ HSK 1–3 (07 cần danh sách thiếu nét).
- Test: chữ 好 có `han_viet = ['hảo','hiếu']` từ Unihan mẫu; override `source: ai` ghi đúng nguồn; chữ không có trong hanzi-writer-data → `has_stroke_data = false` và có trong CSV; upload R2 bị gọi đúng 1 lần khi chạy 2 lần (mock boto3).

### Bước 6. `import_tatoeba` (B5)
- Ghép `cmn ↔ eng` qua `links`. Chuyển giản thể bằng OpenCC (`t2s`).
- Lọc theo spec: 4–25 chữ Hán; bỏ câu có chữ Latin (trừ dấu câu và số); nhiều bản dịch → bản ngắn nhất; bỏ câu trùng (`zh` sau chuẩn hóa).
- Tách từ bằng jieba (nạp thêm từ điển người dùng là toàn bộ `hsk_word` để tách đúng từ HSK), nối `sentence_word`, tính `max_hsk_level` (từ không có trong HSK = 7).
- Pinyin câu bằng `pypinyin` (style số thanh), lưu cả bản dấu.
- Test cho từng luật lọc; câu `我很好。` có `max_hsk_level = 1`; câu có từ ngoài HSK có `max_hsk_level = 7`.

### Bước 7. `generate_audio` (B7)
**Bước 7a. Thử nghiệm trước (quyết định cần ghi lại):**
- Sinh 20 âm tiết đứng riêng (`ma1..ma4`, `shi1..shi4`, …) bằng SSML `<phoneme alphabet="sapi">` và bằng chữ ví dụ. Nghe, chọn cách nào tự nhiên hơn.
- So sánh file `.slow.mp3` (SSML `rate="-30%"`) với `playbackRate = 0.7` ở client trên điện thoại.
- Ghi kết quả vào `docs/specs/01-content-data/decisions.md`; đặt `AUDIO_SLOW_MODE` (00 §9) theo kết quả.

**Bước 7b. Script:**
- `TtsProvider` (giao diện): `synthesize(text: str, voice: str, rate: str | None, phoneme: str | None) -> bytes`. Bản `AzureTts` gọi REST, MP3 mono 24 kHz 48 kbps (`audio-24khz-48kbitrate-mono-mp3`).
- Giọng: `xiaoxiao` = `zh-CN-XiaoxiaoNeural`, `yunxi` = `zh-CN-YunxiNeural`, đổi qua cấu hình.
- Khóa R2 (`clp/audio/keys.py`):
  - `word/{voice}/{simplified}_{pinyin_numbered bỏ khoảng trắng}.mp3` → `word/xiaoxiao/好吃_hao3chi1.mp3`
  - `sent/{voice}/{sentence_id}.mp3`
  - `syl/{voice}/{pinyin_numbered}.mp3` → `syl/xiaoxiao/ma3.mp3`
  - biến thể chậm: thêm `.slow` trước `.mp3`
- Từ đa âm: luôn gửi SSML `<phoneme>` theo pinyin của bài.
- Danh sách cần tạo: từ trong `lesson_word` + `exam_item`, câu trong bài và ngân hàng đề, ~400 âm tiết × 4 thanh (danh sách từ 10-pronunciation).
- Bỏ qua khi `audio_asset.hash = sha256(text|voice|rate|phoneme)` đã có. Thử lại tối đa 3 lần, giãn cách theo quota.
- `--dry-run`: in tổng số ký tự sẽ gửi đi, theo loại.
- Test (provider giả): tên khóa đúng các ví dụ trên; chạy lần 2 không gọi provider; lỗi 2 lần rồi thành công thì vẫn ghi `audio_asset`; lỗi 3 lần thì ghi vào danh sách lỗi, không dừng cả lô; `--dry-run` không gọi provider.

Phần **tạo audio theo yêu cầu cho từ điển** (tts-audio §4) nằm ở [11-dictionary/plan.md](../11-dictionary/plan.md), dùng lại cách đặt tên khóa này (viết lại bằng TS, có test đối chiếu tên khóa với cùng ví dụ).

### Bước 8. `report`
- Sinh `/pipeline/out/report.md`: số dòng mỗi bảng; số từ HSK chưa ghép; số chữ HSK 1–3 thiếu Hán Việt, thiếu nét; số từ HSK 1–3 không có câu ví dụ nào có `max_hsk_level ≤ cấp của từ`; cảnh báo lệch số lượng chuẩn.
- Test: với DB mẫu, report có đủ các mục và con số đúng.

### Bước 9. `content/sources.yaml`
- Mỗi nguồn trong bảng sources-and-licenses: `id`, `name`, `url`, `used_for` (tiếng Việt), `license`, `license_url`, `attribution` (dòng ghi nguồn ngắn). Thêm `azure-tts`, `faster-whisper`, `parselmouth`.
- Test (ở pipeline): mọi nguồn trong file có đủ trường; mọi nguồn mà pipeline thực sự dùng (theo `sources.yaml` tải về) đều có mặt.

## 4. Xong module khi
- Chạy lần lượt `fetch → import_cedict → import_hsk → import_hanzi → import_tatoeba → report` trên máy dev ra DB đầy đủ, chạy lại lần 2 không đổi số dòng.
- `report.md` không có lỗi ngoài các cảnh báo đã biết; các file CSV thiếu dữ liệu được sinh.
- Có `decisions.md` cho audio âm tiết và đọc chậm.

## 5. Rủi ro / việc cần theo dõi
- Định dạng file của hsk30 có thể đổi: parser đọc theo tên cột, có test với file mẫu chụp lại.
- Âm Hán Việt của Unihan chưa xác minh (spec B4): chỉ sửa qua `overrides/han_viet.yaml`.
- Đọc lại LICENSE gốc của từng nguồn trước khi ra mắt (sources-and-licenses): thêm mục này vào checklist phát hành.
