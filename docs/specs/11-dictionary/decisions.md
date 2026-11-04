# Quyết định phát sinh – 11 Từ điển

## 11-1: nhận biết loại từ khóa
- `packages/core` không đọc file, nên danh sách âm tiết của 10 nằm ở `packages/core/src/syllables.json`, **sinh bởi** `clp syllables` cùng lúc với `content/pron/syllables.yaml`; test Python (`test_core_syllables_json_matches_standard_list`) bắt buộc hai bản khớp. File được `.prettierignore` để Prettier không đổi định dạng.
- Phân biệt Hán Việt và pinyin theo dấu kết hợp Unicode (NFD): dấu hỏi, ngã, nặng, móc (ơ ư), mũ (â ê ô), trăng (ă) và `đ` chỉ có ở tiếng Việt → `hanviet`. Dấu sắc/huyền dùng chung với pinyin nên **`hào`, `mà` được coi là pinyin** (người dùng muốn Hán Việt thì chọn chip, hoặc gõ dạng có dấu hỏi/ngã/nặng như `hảo`). Macron, caron, ü → pinyin.
- Chuỗi Latin không dấu gồm âm tiết hợp lệ (`he`, `haochi`, `xi'an`, cả `women`) → `['pinyin', 'english']`; tách âm tiết chọn cách ít âm tiết nhất, trùng thì âm đầu dài nhất; dấu `'` tách tường minh.
- `parsePinyinQuery`: trả `plain` (ü → u) và thanh từng âm tiết (`null` nếu không ghi thanh, `5` nếu ghi `ma5`); nhận cả số thanh và dấu thanh, kể cả viết liền (`hǎochī`).

## 11-2: tìm kiếm SQL và API
- **Phân trang:** `cursor` là vị trí bắt đầu của trang sau (số nguyên, tối đa 5 chữ số), không phải con trỏ keyset: thứ tự nhiều tiêu chí khó keyset, và 30 kết quả/trang cuộn vài trang là đủ. Mỗi nhóm lấy `limit + 1` dòng để biết còn trang sau; `nextCursor` có khi bất kỳ nhóm nào còn.
- **English không có tầng "khớp đúng":** đã khớp `websearch_to_tsquery` thì xếp theo cấp HSK → độ dài → không phải họ/biến thể → thứ tự CC-CEDICT. Nếu có tầng khớp đúng nghĩa (`to look`) thì mục ít dùng như 瞧 sẽ vượt 看, trái test của plan.
- **Tầng khớp (tier) trước mọi tiêu chí khác:** khớp đúng (0) → khớp đầu (1) → chứa (2). Vì vậy mục họ/biến thể khớp đúng vẫn đứng trước từ HSK chỉ khớp đầu (`郝` trước `好吃` khi tìm `hao`); "họ xếp cuối" chỉ áp dụng trong cùng tầng.
- **Lọc theo thanh:** tìm `hao3` lọc thêm `lower(pinyin_numbered) ~ '^hao3'` (mỗi `u` thành `u:?` để khớp `lu:4` của CC-CEDICT). Dùng `parsePinyinSyllables` mới ở core để biết ranh giới âm tiết.
- **Hán Việt của dòng kết quả:** ghép âm đầu tiên (`han_viet[1]`) của từng chữ; thiếu chữ nào thì `null` (không hiện).
- **Chip Hán Việt không dấu** (`hao`) so bằng `unaccent`; có dấu thì so đúng chuỗi.
- **Dữ liệu thật cho thấy:** tìm `hảo` ra rỗng vì Unihan chỉ có `háo` cho 好 (xem 01-5); `吗` bị gán `mửa` (Unihan). Cần bổ sung/sửa qua `content/overrides/han_viet.yaml`. Từ khóa tiếng Việt có dấu sắc/huyền (`xin chào`) bị coi là pinyin (xem 11-1) nên không ra kết quả.
- `getSql()` tắt NOTICE của Postgres (tsquery chỉ gồm stop word sinh NOTICE ở mỗi lần tìm).
- Thời gian trên 125.356 mục: pinyin/hanzi/english 1–35 ms, Hán Việt 100–220 ms (quét `position()`); chấp nhận được ở 60 yêu cầu/phút/IP, chưa cần chỉ mục.

## 11-4: trang từ `/tu/[word]`
- **Dữ liệu:** `lib/dictionary/word.ts` (`getWordPage`) trả mọi mục có `simplified = word` (xếp: có cấp HSK, cấp thấp trước, không phải họ/biến thể), câu ví dụ (tối đa 5, `max_hsk_level` thấp rồi ngắn) và từ cùng chữ (tối đa 12, không lặp, bỏ họ/biến thể, HSK trước). Câu và từ cùng chữ dùng chung cho cả trang, chỉ phần đầu/nghĩa/từng chữ lặp theo mục.
- **Từng chữ:** pinyin của chữ lấy theo âm tiết cùng vị trí trong `pinyin_numbered` (chỉ khi số âm tiết khớp số chữ Hán; không thì ẩn). Hán Việt tất cả các âm của chữ; bộ thủ lấy tên tiếng Việt từ `radical_vi`. Chữ chưa có trong `hanzi` vẫn có thẻ (thiếu Hán Việt/bộ thủ).
- **Audio:** nút nghe chỉ hiện khi `audio_asset` đã có khóa `word/xiaoxiao/{từ}_{pinyin liền}.mp3` (giọng mặc định; theo cài đặt giọng sẽ làm khi có `SettingsProvider` đọc cài đặt) và `R2_PUBLIC_URL` đã đặt. Audio theo yêu cầu (bước 5) sẽ thêm nút ▶ cho từ chưa có. `lib/audio/keys.ts` là bản TS của `clp/audio/keys.py` (chưa viết bên Python; 01-7b phải khớp, kể cả cách ghi `u:`/`ü` trong khóa; hiện giữ nguyên chuỗi `pinyin_numbered`).
- **SEO:** title theo mẫu spec (nhiều cách đọc thì liệt kê), description ≤ 160 ký tự, JSON-LD `DefinedTerm` (thoát `<`). Tên website và URL từ `SITE_NAME`, `SITE_URL`.
- **Không dùng `revalidate = 86400`:** layout gốc `force-dynamic` (cấu hình đọc lúc chạy), nên trang render mỗi request; dữ liệu không phụ thuộc người dùng nên cache sau Caddy/CDN khi cần. Thời gian trên dữ liệu thật: 0,06–0,15 s (lần đầu 2,8 s do biên dịch dev).
- **Chưa làm:** nút “Thêm vào ôn tập” (cần 09 `addFromDictionary` và `LoginSheet` của 03), và “Đã có trong ôn tập” tải ở client.
- **Hán Việt trong tiêu đề** là âm Hán Việt đầu tiên của từng chữ (không phân biệt cách đọc), nên 行 (xíng) ra `hàng`; phụ thuộc chất lượng Unihan (xem 01-5).
- **Test cấm tên miền viết cứng** (`tests/no-hardcoded-domain.test.ts`) miễn `schema.org` và `tatoeba.org` (domain bên thứ ba).
- 404: `not-found.tsx` có ô tìm kiếm gửi tới `/tra-tu?q=` (màn hình `/tra-tu` làm ở 11-3).
