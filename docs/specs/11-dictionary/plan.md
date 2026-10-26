# Plan thực hiện: 11 – Từ điển

Spec: [dictionary.md](dictionary.md). Quy ước chung: [00-foundation/plan.md](../00-foundation/plan.md).

Theo README §7, làm **ngay sau pipeline dữ liệu** để kiểm tra dữ liệu đã nhập đúng chưa.

## 1. Màn hình design

`dictionary.html`, bố cục `.split`:
- Ô tìm `.searchbox`, chip lọc (Tất cả | Chữ Hán | Pinyin | English | Hán Việt), danh sách kết quả, “Tra gần đây” (`#recent`).
- Phần chi tiết: chữ lớn, pinyin, audio, Hán Việt, nhãn; nghĩa; “Từng chữ”; “Câu ví dụ”; “Từ cùng chữ”; ghi nguồn; `dialog#reportdlg`.
- ≥ 900px: kết quả bên trái, chi tiết bên phải (sticky). < 900px: một trong hai (`.showing-detail`).

Ánh xạ route (để giữ URL riêng cho Google theo spec):
- `/tra-tu`: ô tìm + kết quả; ≥ 900px cột phải hiện “Tra gần đây”.
- `/tu/[word]`: **SSR**, cùng bố cục `.split`; cột trái là kết quả của lần tìm gần nhất (client), cột phải là chi tiết. < 900px chỉ hiện chi tiết + nút quay lại kết quả.
- `/chu/[char]`: **SSR**, trang chữ.

## 2. Phụ thuộc

- 01: `dict_entry`, `hanzi`, `radical_vi`, `sentence`, `sentence_word`, `audio_asset`, `strokes/*.json`.
- 07: `WritingPad` (xem + luyện viết tự do). 09: `addFromDictionary`. 13: `ReportSheet`.

## 3. Các bước

### Bước 1. Nhận biết loại từ khóa — `packages/core/src/dictionary.ts`
`classifyQuery(q, chip): QueryKind[]` với `QueryKind = 'hanzi' | 'pinyin' | 'english' | 'hanviet'`:
- Chip khác “Tất cả” → đúng loại đó.
- Có ký tự CJK → `['hanzi']`.
- Có dấu tiếng Việt không phải dấu thanh pinyin (ví dụ `ả`, `ơ`, `đ`, `ư`) → `['hanviet']`.
- Có dấu thanh pinyin (`ǎ`, `ǚ`…) hoặc số thanh (`hao3`) → `['pinyin']`.
- Chữ Latin không dấu: là chuỗi âm tiết pinyin hợp lệ (tách bằng danh sách âm tiết của 10) → `['pinyin', 'english']`; không → `['english']`.
- `parsePinyinQuery(q): { plain: string; tones: (Tone | null)[] }` (`hao3 chi` → plain `haochi`, tones `[3, null]`).
- Test: `好` → hanzi; `hǎo` → pinyin; `hao3` → pinyin; `hảo` → hanviet; `he` → pinyin + english; `delicious` → english; `hao` + chip Hán Việt → hanviet; `ma` có cả `ā` lẫn `à` không phải Hán Việt.

### Bước 2. Tìm kiếm SQL — `lib/dictionary/search.ts`
- `searchHanzi`: khớp đúng `simplified`/`traditional` → bắt đầu bằng → chứa (`pg_trgm`/`LIKE`).
- `searchPinyin`: `pinyin_plain` bằng hoặc bắt đầu bằng `plain`; có thanh → lọc theo `pinyin_numbered`.
- `searchEnglish`: `to_tsvector('english', array_to_string(definitions,' ')) @@ websearch_to_tsquery('english', q)` (cột tsvector sinh sẵn + GIN).
- `searchHanViet`: chữ có `han_viet` khớp (không phân biệt hoa thường, dùng `unaccent` chỉ khi chip Hán Việt và từ khóa không dấu), rồi các từ chứa chữ đó.
- Thứ tự chung: khớp đúng → có cấp HSK (cấp thấp trước) → từ ngắn trước → `is_variant_or_surname = false` trước → `cedict_order`.
- Phân trang theo con trỏ, 30 kết quả/lần.
- `GET /api/dictionary/search?q&chip&cursor`: trả `{ groups: [{ kind, items[] }], nextCursor }`. Tab Tất cả với từ khóa mơ hồ trả hai nhóm có tiêu đề. Giới hạn 60 lần/phút/IP.
- Mỗi dòng: chữ (màu thanh), pinyin, Hán Việt, 1–2 nghĩa đầu, nhãn HSK.
- Test (DB mẫu): `hao` trả 好 trước 号; `hao3` không có 号 (hao4); `好` trả 好 đầu tiên rồi 好吃, rồi 你好; `look` trả 看 có HSK 1 trước mục ít dùng; mục “surname …” xếp cuối; lần gọi thứ 61/phút → 429.

### Bước 3. Màn hình tìm kiếm `/tra-tu`
- Tìm sau 250 ms kể từ phím cuối (hủy yêu cầu cũ bằng `AbortController`); cuộn tới cuối thì tải thêm.
- Tra gần đây: 20 từ gần nhất trong `localStorage` (bọc `try/catch`).
- Trạng thái: rỗng (gợi ý cách tìm), đang tải, không có kết quả, lỗi.
- Test Playwright: gõ “hao” → sau ~250 ms có kết quả; hai nhóm khi gõ “he”; < 900px bấm kết quả mở `/tu/…`.

### Bước 4. Trang từ `/tu/[word]` (SSR)
- `generateMetadata`: title “好吃 hǎochī – nghĩa, cách đọc, Hán Việt hảo ngật | {SITE_NAME}”, description riêng; JSON-LD `DefinedTerm`.
- Nhiều mục (đa âm) → mỗi mục một khối.
- Phần đầu: chữ lớn, pinyin, nút audio, Hán Việt, nhãn HSK, từ loại, dạng phồn thể (nếu khác).
- Nghĩa: toàn bộ nghĩa CC-CEDICT, đánh số.
- “+ Thêm vào ôn tập”: khách → `LoginSheet` (03); đã có thẻ → “Đã có trong ôn tập”; gọi `addFromDictionary` (09).
- Từng chữ: chữ, pinyin, Hán Việt, bộ thủ (tên tiếng Việt), bấm mở `/chu/{char}`.
- Câu ví dụ: tối đa 5, ưu tiên `max_hsk_level` thấp rồi ngắn; chữ, pinyin, bản dịch, audio nếu có; Tatoeba ghi “Tatoeba #id” kèm link.
- Từ cùng chữ: tối đa 12, ưu tiên có cấp HSK.
- Cuối trang: ghi nguồn (CC-CEDICT · Tatoeba · Unihan · Make Me a Hanzi), nút “Báo lỗi”, link `/nguon-du-lieu`.
- Nút chia sẻ: `navigator.share`, không có thì sao chép link + toast “Đã sao chép link”.
- Cache: `revalidate = 86400`. Phần phụ thuộc người dùng (đã có thẻ chưa) tải ở client sau khi trang hiện.
- Từ không có → 404 có ô tìm kiếm.
- Test: HTML SSR có `<title>` đúng mẫu và JSON-LD; 行 hiện 2 khối (xíng, háng); trang không chứa dữ liệu người dùng trong HTML cache.

### Bước 5. Audio theo yêu cầu (tts-audio §4)
- `GET /api/audio/word?simplified&pinyin`: có `audio_asset` → trả URL.
- Chưa có: chỉ người đã đăng nhập kích hoạt tạo; `tts_daily_counter` < `TTS_DAILY_LIMIT` (500) → gọi Azure (`lib/tts/azure.ts`, cùng định dạng và cách đặt tên khóa với 01), lưu R2, ghi `audio_asset`, tăng bộ đếm trong cùng transaction (`UPDATE … WHERE count < limit RETURNING`).
- Vượt giới hạn, hoặc khách → `{ url: null }`, nút ▶ hiện “Chưa có âm thanh cho từ này”.
- Test: tên khóa sinh ra giống bản Python với cùng ví dụ (`word/xiaoxiao/好吃_hao3chi1.mp3`); lần thứ 501 trong ngày trả `null`; 2 yêu cầu đồng thời ở 499 chỉ một yêu cầu được tạo.

### Bước 6. Trang chữ `/chu/[char]` (SSR)
- Chữ lớn với hoạt ảnh thứ tự nét (`WritingPad mode=watch`, tải ở client), nút “Luyện viết” mở `trace`/`recall` **không chấm vào SRS**.
- Mọi cách đọc pinyin, mọi âm Hán Việt, số nét, bộ thủ (tên tiếng Việt), phân tích cấu tạo (IDS), gợi ý nguồn gốc (tiếng Anh).
- Các từ thông dụng chứa chữ này (ưu tiên HSK).
- Metadata + JSON-LD như trang từ.

### Bước 7. SEO
- `app/sitemap.ts`: mọi từ HSK 1–6 (`/tu/…`) và mọi chữ HSK (`/chu/…`); chia nhiều sitemap nếu > 50.000 URL. Không đưa cả 120.000 mục.
- `robots.ts`: cho phép `/tu/`, `/chu/`; chặn `/api/`, `/chung-nhan/`.
- Test: sitemap có `/tu/好吃`, không có mục ngoài HSK.

## 4. Xong module khi
- Test `classifyQuery` và tìm kiếm xanh trên dữ liệu thật (đối chiếu tay 20 từ khóa mẫu).
- Trang `/tu/…`, `/chu/…` render SSR, đúng metadata, khớp design ở 360px và 1440px.
- Audio theo yêu cầu tôn trọng giới hạn 500/ngày.
