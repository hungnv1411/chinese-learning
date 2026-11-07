# Ledger tiến độ thực hiện

File này là **nguồn duy nhất** về việc gì đã xong, việc gì làm tiếp. Mỗi dòng là một bước trong plan của module (`docs/specs/<module>/plan.md`). Thứ tự trong bảng là **thứ tự thực hiện**, đã xếp theo phụ thuộc giữa các module. Không nhất thiết theo thứ tự bước trong từng plan.

## Cách dùng

- Lấy dòng `⬜` đầu tiên mà mọi dòng nó phụ thuộc đã `✅`. Đọc spec và plan của module, rồi làm.
- Bắt đầu làm: đổi sang `🟨`. Xong (test trong plan đã xanh): đổi sang `✅`, ghi commit ngắn ở cột Ghi chú, thêm một dòng vào **Nhật ký**.
- Bị chặn: đổi sang `⛔`, ghi lý do ở Ghi chú, và thêm vào **Việc đang chặn**.
- Có quyết định mới (kể cả việc đổi so với plan): ghi vào `docs/specs/<module>/decisions.md`, rồi cập nhật plan nếu cần.
- Mã bước: `<module>-<số bước trong plan>`. Riêng 00: `00-1…00-7` là §10 bước 1–7, `00-UI1…UI4` là §5, `00-API` là §7, `00-GW` là §8, `00-AUD` là §9. 08 có `08a` (dịch vụ chấm) và `08b` (giao diện). Đợt nội dung của 02 là `02-D1…D4`.

Ký hiệu: ⬜ chưa làm · 🟨 đang làm · ✅ xong · ⛔ bị chặn

## Tổng quan mốc

| Mốc | Nội dung | Trạng thái |
|---|---|---|
| M0 | Spec, design, plan | ✅ |
| M1 | Nền tảng: repo, DB, đăng nhập, design system | 🟨 |
| M2 | Pipeline dữ liệu | 🟨 |
| M3 | Từ điển | 🟨 |
| M4 | Định dạng nội dung, soạn bằng AI, đợt nội dung D-1 | 🟨 |
| M5 | Dịch vụ chấm phát âm | ⬜ |
| M6 | Học: bài học, viết, nói, ôn tập | ⬜ |
| M7 | Lộ trình, Hôm nay, học thử & đăng nhập (E2E luồng chính) | ⬜ |
| M8 | Bảng pinyin, luyện nghe thanh, bài kiểm tra pinyin | ⬜ |
| M9 | Bài kiểm tra cuối, chứng nhận, trang Tôi | ⬜ |
| M10 | Sản xuất toàn bộ nội dung HSK 1–3, chuẩn bị ra mắt | ⬜ |

---

## M1 — Nền tảng · [plan](00-foundation/plan.md)

| # | Mã | Việc | Phụ thuộc | TT | Ghi chú |
|---|---|---|---|---|---|
| 1 | 00-1 | Khung monorepo (pnpm + uv), lint, LICENSE theo thư mục, CI | – | 🟨 | Đã tạo file, chưa cài gói/chạy test (mạng chậm) |
| 2 | 00-2 | `lib/config.ts` (zod env), cấm viết cứng tên miền | 00-1 | ✅ | 8 test xanh (Docker) |
| 3 | 00-3 | Docker Compose (caddy, web, speech, db), `/healthz` | 00-2 | ✅ | `compose up` đủ 5 dịch vụ khỏe; `curl -k https://localhost/healthz` → 200 `{ok:true}`; web gọi được `speech:8000`; speech/db không có `ports` ra host |
| 4 | 00-4 | Schema Drizzle + migration + test ràng buộc | 00-3 | ✅ | Migration `0000_*` sinh bằng drizzle-kit; 5 test ràng buộc xanh với Postgres thật |
| 5 | 00-5 | Better Auth Google, phiên 30 ngày, bearer, `getViewer` | 00-4 | ✅ | 3 test `getViewer` (bearer, cookie, khách) xanh với phiên tạo trong DB; đăng nhập Google thật chưa thử tay |
| 6 | 00-6 | `packages/core`: `pinyin.ts`, `sandhi.ts` + fixture dùng chung | 00-1 | ✅ | 47 test core xanh (Docker); bản Python ở 01-1/08a-3 đọc cùng fixture |
| 7 | 00-API | `handler`, `requireUser`, `rateLimit`, định dạng lỗi | 00-5 | ✅ | 10 test xanh |
| 8 | 00-UI1 | Port CSS từ `docs/design/styles.css`, font, trang `/dev/ui` | 00-1 | 🟨 | CSS tách + test token + font Mona Sans tự host; `/dev/ui` chưa xem trên trình duyệt |
| 9 | 00-UI2 | `AppShell` (nav 3 dạng), `FocusLayout`, test 9 viewport | 00-UI1 | 🟨 | Test Vitest xanh; Playwright 9 viewport chưa chạy (cần trình duyệt) |
| 10 | 00-UI3 | Test phóng chữ 130% | 00-UI2 | 🟨 | Viết trong `src/e2e/tests/layout.spec.ts`, chưa chạy |
| 11 | 00-UI4 | Component UI (`Hanzi`, `Pinyin`, `ToneContour`, `Sheet`, `Toast`…) + test | 00-UI1, 00-6 | ✅ | 10 test Vitest xanh |
| 12 | 00-GW | `ProgressGateway`, `ServerGateway`, `GuestGateway`, `GuestStore` | 00-API | ✅ | Test GuestStore (setItem lỗi), useGateway, apiFetch xanh |
| 13 | 00-AUD | `useAudio`, `audioUrl`, `AudioButton` (không dùng Web Speech API) | 00-UI4 | ✅ | 6 test xanh |
| 14 | 00-7 | `deploy/backup.sh`, giữ 14 bản | 00-3 | ✅ | 3 test xanh; chưa thử đẩy lên R2 thật |

## M2 — Pipeline dữ liệu · [plan](01-content-data/plan.md)

| # | Mã | Việc | Phụ thuộc | TT | Ghi chú |
|---|---|---|---|---|---|
| 15 | 01-1 | Khung pipeline, `pinyin.py` (khớp fixture TS), `upsert` | 00-4, 00-6 | ✅ | 41 test xanh trong Docker (`pinyin.py` khớp fixture, `upsert` test bằng fake conn), `clp --help` liệt kê lệnh, ruff sạch; `upsert` chưa thử với Postgres thật (sẽ có ở 01-3) |
| 16 | 01-2 | `fetch` + `manifest.json` | 01-1 | ✅ | 5 test fetch xanh (respx); tải thật cedict, hsk30, unihan, makemeahanzi, hanzi-writer-data OK, URL Tatoeba trả 200 (chưa tải thân file); `data/raw/manifest.json` được commit |
| 17 | 01-3 | `import_cedict` | 01-2 | ✅ | 54 test xanh (gồm 4 test với Postgres thật); nhập thật 125.356 mục, chạy lại không thêm dòng; thêm unique `dict_entry_natural_uq` (xem decisions.md) |
| 18 | 01-4 | `import_hsk` + ghép từ điển + CSV chưa khớp | 01-3 | ✅ | 68 test xanh (5 quy tắc ghép + 3 test DB); nhập thật 11.109 từ/3.000 chữ/573 ngữ pháp, 32 từ chưa ghép; cảnh báo lệch chuẩn: cấp 1 từ 512, cấp 2 từ 776 và ngữ pháp 82 (xem decisions.md) |
| 19 | 02-8 | `content/radicals_vi.yaml` (214 bộ thủ, AI soạn) | 01-1 | ✅ | 4 test kiểm tra máy xanh (214, không trùng); AI soạn, chưa duyệt; thêm `number`, `variants` (xem 02-curriculum/decisions.md) |
| 20 | 01-5 | `import_hanzi` (Hán Việt, phân tích chữ, nét → R2) | 01-4, 02-8 | ✅ | 79 test xanh (11 test hanzi, gồm DB thật); nhập thật 3.000 chữ + 214 bộ thủ, 3.000 chữ có nét (ghi cục bộ, R2 chỉ test bằng mock); 123/900 chữ HSK 1–3 thiếu Hán Việt (xem decisions.md) |
| 21 | 01-6 | `import_tatoeba` | 01-4 | ✅ | 92 test xanh; nhập thật 61.896 câu + 331.089 liên kết từ, chạy lại không nhân đôi; 692 từ HSK 1–3 chưa có câu phù hợp (xem decisions.md) |
| 22 | 01-8 | `report.md` | 01-6 | ✅ | 95 test xanh; `clp report` chạy thật: thiếu câu ví dụ cấp 1/2/3 = 100/215/377 từ (tổng 692), các số khác khớp 01-3…01-6 |
| 23 | 01-9 | `content/sources.yaml` | 01-2 | ✅ | 100 test xanh; 10 nguồn; CC-CEDICT ghi 4.0 theo tiêu đề file (spec ghi 3.0); URL giấy phép CC/Unicode/OSI/Microsoft chưa kiểm tra được bằng mạng |
| 24 | 10-1 | `content/pron/syllables.yaml` (danh sách âm tiết + chữ ví dụ) | 01-5 | ✅ | 127 test xanh; 408 âm tiết, 918/1.632 thanh có chữ ví dụ; `audio` đều false, chạy lại `clp syllables` sau 01-7b (xem 10-pronunciation/decisions.md) |
| 25 | 01-7a | Thử TTS: âm tiết đứng riêng, `.slow` hay `playbackRate` → `decisions.md` | 10-1 | ⬜ | Quyết định chờ Q1, Q2 |
| 26 | 01-7b | `generate_audio` (phase 1: âm tiết; từ/câu chạy lại sau 02-D1) | 01-7a | ⬜ | |

## M3 — Từ điển · [plan](11-dictionary/plan.md)

| # | Mã | Việc | Phụ thuộc | TT | Ghi chú |
|---|---|---|---|---|---|
| 27 | 11-1 | `classifyQuery`, `parsePinyinQuery` | 10-1, 00-6 | ✅ | 88 test core xanh (41 test mới); danh sách âm tiết ở `packages/core/src/syllables.json` do `clp syllables` sinh, có test Python giữ khớp |
| 28 | 11-2 | Tìm kiếm SQL + API + rate limit 60/phút/IP | 11-1, 01-6 | ✅ | core 91 + web 78 test xanh (14 test tìm kiếm với Postgres thật, gồm 429 ở lần 61); thử 22 từ khóa trên 125.356 mục, 1–35 ms (Hán Việt ≤ 220 ms); `hảo` ra rỗng vì Unihan thiếu (xem decisions.md) |
| 29 | 11-3 | Màn hình `/tra-tu` | 11-2, 00-UI2 | 🟨 | web 149 + core 104 test xanh (22 mới: debounce 250 ms, hủy yêu cầu cũ, nhóm, chip, tải thêm, trạng thái, Tra gần đây, localStorage bị chặn); chạy thật `/tra-tu?q=好` và API phân trang. Còn thiếu: Playwright, kiểm tra 360/1440px bằng trình duyệt, chi tiết từ ở cột phải ≥ 900px |
| 30 | 13-4 | `/nguon-du-lieu` + `PublicFooter` | 01-9, 00-UI2 | 🟨 | 11 test mới + toàn bộ web 89 / core 91 xanh; trang chạy thật trên dev (200, 10 thẻ nguồn, số âm AI từ DB); còn thiếu: kiểm tra 360/1440px bằng trình duyệt, test `PublicFooter` trên `/tu`, `/chung-nhan` (trang chưa có), dựng thử ảnh production |
| 31 | 13-5 | `ReportSheet` + `POST /api/reports` | 00-API, 00-UI4 | ✅ | web 149 test xanh (6 `ReportSheet`, 7 với Postgres thật: khách 10/ngày/IP, `content_version` do server quyết); commit 72a5313. Chưa gắn `ReportButton` vào màn hình nào (xem 13-profile/decisions.md) |
| 32 | 11-4 | Trang từ `/tu/[word]` (SSR, cache 1 ngày) | 11-2, 13-4, 13-5 | 🟨 | Nút “Thêm vào ôn tập” nối 09-2 sau. web 127 + core 91 test xanh (20 mới: dữ liệu với Postgres thật, SEO, WordView); chạy thật trên 125 nghìn mục: `/tu/好吃` 2 khối, `/tu/行` 3 khối, 404. Còn thiếu: nút “Thêm vào ôn tập” (cần 09, 03), kiểm tra 360/1440px bằng trình duyệt |
| 33 | 11-5 | Audio theo yêu cầu, giới hạn 500/ngày | 11-4, 01-7b | ⬜ | |
| 34 | 07-1 | `writingScore` | 00-6 | ✅ | core 104 test xanh (13 mới: các giá trị của plan, trần gợi ý, đầu vào không hợp lệ). `misses` không hợp lệ thì ném RangeError |
| 35 | 07-2 | `WritingPad` (hanzi-writer, 3 chế độ, `touch-action: none`) | 07-1, 01-5 | 🟨 | web 162 test xanh (13 mới, hanzi-writer giả: 3 lần sai → `usedHint`, recall 2 lần sai → 80, `touch-action: none`, “Xem lại thứ tự nét”, không có nút bỏ qua, thiếu dữ liệu nét). Chưa thử với hanzi-writer thật, chưa có Playwright cảm ứng 390×844 hay thử tay iOS/Android (plan bước 7) |
| 36 | 11-6 | Trang chữ `/chu/[char]` | 07-2, 11-4 | ⬜ | |
| 37 | 11-7 | Sitemap, robots | 11-6 | ⬜ | |

## M4 — Nội dung · [plan](02-curriculum/plan.md)

| # | Mã | Việc | Phụ thuộc | TT | Ghi chú |
|---|---|---|---|---|---|
| 38 | 02-1 | `content.ts` (hợp đồng JSON) + đọc YAML, lỗi theo file:dòng | 01-4 | ✅ | core 128 + pipeline 149 test xanh (hợp đồng zod ↔ Pydantic qua 3 fixture, 15 mã bài tập dùng chung, lỗi `file:dòng` cho 12 ca); chưa có `stages.yaml`, `_plan.yaml`, `exam/*.yaml`, `sounds.yaml` (xem decisions.md) |
| 39 | 02-2 | Quy tắc kiểm tra (chặn / cảnh báo) | 02-1 | ✅ | pipeline 194 test xanh (41 test quy tắc, mỗi quy tắc một YAML mẫu sai); `clp check-content` chạy thật với DB dev. Phát hiện: HSK 2021 không có 你好 (xem 02-curriculum/decisions.md) |
| 40 | 02-3 | Chuẩn hóa, bố cục mặc định, `writing: auto`, ghi DB | 02-2 | ✅ | pipeline 216 test xanh (11 chuẩn hóa, 11 nhập DB thật: đủ bảng, chạy lại không đổi, đổi thứ tự bài, lỗi thì không ghi); `clp import-content` chạy thật nạp 4 lộ trình từ `content/stages.yaml`; định dạng `stages.yaml`, `_plan.yaml` là đề xuất (xem decisions.md) |
| 41 | 02-4 | Báo cáo độ phủ, `exam_open` | 02-3 | ✅ | pipeline 232 test xanh (16 test độ phủ với Postgres thật: thiếu 1 từ thì liệt kê đúng và đóng; đủ thì mở; chủ đề chưa phát hành, ngân hàng đề thiếu, nội dung lùi đều đóng); chạy thật: HSK 1/2/3 còn 512/776/973 từ chưa dạy; giả định ghép `hsk_code` và khóa `skill` cần xác nhận (decisions.md) |
| 42 | 02-5 | `plan_units` | 02-4 | 🟨 | pipeline 255 test xanh (23 test, model giả: kiểm tra phủ/trùng, vòng sửa tối đa 2 lần, ghi `_plan.yaml` + `_meta`, hình dạng lời gọi Anthropic SDK); `plan-units --dry-run` chạy thật (HSK 1: 508 từ, 48 ngữ pháp). Chưa gọi API thật (không có ANTHROPIC_API_KEY): chạy `clp plan-units hsk1` để chốt |
| 43 | 02-7 | `crosscheck` | 02-3 | ✅ | Làm trước 02-6 để lượt soạn dùng được. pipeline 280 + core 128 test xanh (25 test crosscheck: pinyin từ, pinyin câu có tha biến điệu/thanh nhẹ/đa âm, Tatoeba nguyên văn, Hán Việt, độ dài); thêm trường tùy chọn `pinyin` cho `new_words` (xem decisions.md). Lưu ý: bước nối vào `check_loaded` chỉ thật sự có hiệu lực từ commit 02-6 (đã ghi lỗi ở decisions.md) |
| 44 | 02-6 | `author_unit` + `review_unit` | 02-5, 02-7 | 🟨 | pipeline 304 test xanh (23 test: đầu vào, prompt, kiểm tra đầu ra, vòng soạn/rà soát tối đa 2 lần, ghi file/ngữ pháp/overrides/meta, từ chối model trùng, không ghi khi còn lỗi máy); chưa gọi API thật (không có ANTHROPIC_API_KEY). Kèm sửa lỗi nối crosscheck của 02-7 (decisions.md) |
| 45 | 10-2 | `content/pron/sounds.yaml` | 02-6 | ⬜ | |
| 46 | 02-D1 | Đợt D-1: Phát âm 8 chủ đề + HSK 1 chủ đề 1–2, seed `dev` | 02-6, 10-2 | ⬜ | |
| 47 | 01-7b′ | Chạy `generate_audio` cho từ và câu của D-1 | 02-D1, 01-7b | ⬜ | |

## M5 — Dịch vụ chấm phát âm · [plan](08-speaking/plan-speech-service.md)

| # | Mã | Việc | Phụ thuộc | TT | Ghi chú |
|---|---|---|---|---|---|
| 48 | 08a-1 | Khung FastAPI, `/score`, `/healthz`, hàng đợi, 503 | 00-3 | ⬜ | Làm song song được với M2–M4 |
| 49 | 08a-2 | Giải mã ffmpeg, VAD, các trạng thái lỗi | 08a-1 | ⬜ | |
| 50 | 08a-3 | `apply_tone_sandhi` (khớp fixture TS) | 00-6 | ⬜ | |
| 51 | 08a-4 | faster-whisper + gióng hàng + nới lỏng | 08a-2 | ⬜ | |
| 52 | 08a-5 | Chia thời gian theo âm tiết | 08a-4 | ⬜ | |
| 53 | 08a-6 | Dò cao độ 2 lượt + đoán thanh (test bằng tín hiệu tổng hợp) | 08a-5 | ⬜ | |
| 54 | 08a-7 | Kết luận thanh + tính điểm | 08a-3, 08a-6 | ⬜ | |
| 55 | 08a-8 | Bộ hồi quy TTS + job CI | 08a-7, 01-7b | ⬜ | |
| 56 | 08a-9 | Docker image, đo trên 2 vCPU / 4 GB → `BENCHMARK.md` | 08a-8 | ⬜ | |

## M6 — Học · [06](06-lesson/plan.md) · [07](07-writing/plan.md) · [08b](08-speaking/plan-speaking-ui.md) · [09](09-review/plan.md)

| # | Mã | Việc | Phụ thuộc | TT | Ghi chú |
|---|---|---|---|---|---|
| 57 | 09-1 | `srs.ts` (ts-fsrs, mức độ thuộc, giới hạn ngày) | 00-6 | ✅ | core 152 test xanh (24 mới: thẻ mới qua good, `previewIntervals` 2/4 nút, nhãn khoảng, mức độ thuộc theo bảng spec §6). Phát hiện: `srs_card` thiếu cột `learning_steps` → làm ở 09-2 (xem 09-review/decisions.md) |
| 58 | 09-2 | `cards.ts` (tạo thẻ, ghi ôn từ bài tập, `speakingFail`, `bumpDue`, `addFromDictionary`) | 09-1, 00-4 | ⬜ | Nối nút ở 11-4 |
| 59 | 05-1 | `unlock.ts` (test đầy đủ) | 02-1 | ⬜ | Kéo lên vì 06 cần chặn bài khóa |
| 60 | 05-2 | `/api/path`, `assertLessonOpen` | 05-1, 02-3 | ⬜ | |
| 61 | 04-2 | `useActiveTimer` + ghi `daily_activity` | 00-API | ⬜ | |
| 62 | 06-1 | `buildLessonPayload`, `GET /api/lessons/[id]` | 05-2, 02-D1 | ⬜ | |
| 63 | 06-2 | Đáp án nhiễu | 06-1 | ⬜ | |
| 64 | 06-3 | Bài tập tự sinh | 06-2, 09-1 | ⬜ | |
| 65 | 07-3 | `WritingStep` + ghi `char_written` | 07-2 | 🟨 | web 167 test xanh (5 mới: khóa chế độ sau, Tự viết xong gọi `onComplete`, `onCharWritten` chỉ lần đạt đầu). Còn thiếu: API/gateway ghi `char_written` và nối `completeStep` (làm ở 06) |
| 66 | 07-4 | `WritingQuiz` | 07-2 | ✅ | web 170 test xanh (3 mới: chỉ Tự viết, không có tab, gửi `{ char, misses, usedHint, score }`, hiện đề). Nối vào bài ôn, bài kiểm tra, thẻ ôn ở 06/09/12 |
| 67 | 07-5 | Phân tích chữ dưới ô | 07-2 | ✅ | web 173 test xanh (3 mới: số nét, bộ thủ + tên + nghĩa, thiếu dữ liệu). `CharAnalysis` nhận dữ liệu qua props; nơi dùng lấy từ `CharInfo` (11-4). Tên nét đang vẽ chờ 07-6 |
| 68 | 07-6 | Tìm hiểu tên nét tiếng Việt → `decisions.md` | 07-2 | ✅ | Nghiên cứu xong: chưa có nguồn mở đủ điều kiện, bản đầu bỏ tên nét, chỉ hiện “Nét i/n” (xem 07-writing/decisions.md). Q3 = không |
| 69 | 08b-1 | API proxy `/api/speech/score` | 08a-7, 00-API | ⬜ | |
| 70 | 08b-2 | `useRecorder` | 00-UI4 | ⬜ | |
| 71 | 08b-3 | Quyền micro, màn `#blocked` | 08b-2 | ⬜ | |
| 72 | 08b-4 | `nextSpeakingState` | 00-6 | ⬜ | |
| 73 | 08b-5 | Màn kết quả (ô âm tiết, so sánh đường thanh) | 08b-1, 08b-4 | ⬜ | |
| 74 | 06-4 | 14 dạng bài tập (client) | 06-3, 07-4, 08b-5 | ⬜ | |
| 75 | 06-5 | `player-reducer` (hàng hỏi lại) | 06-4 | ⬜ | |
| 76 | 08b-6 | Ghi ôn tập khi chưa đạt sau 3 lần | 09-2, 08b-5 | ⬜ | |
| 77 | 08b-7 | `SpeakingStep` + E2E micro giả | 08b-6, 06-5 | ⬜ | |
| 78 | 06-6 | Lưu bước, thoát, tiếp tục, `content_version` | 06-5, 04-2 | ⬜ | |
| 79 | 06-7 | Bài tập ghi vào SRS | 06-6, 09-2 | ⬜ | |
| 80 | 06-8 | `checkLessonCompletion` + `lesson-complete` | 06-7 | ⬜ | |
| 81 | 06-9 | Thẻ giới thiệu, ngữ pháp, tổng kết | 06-8, 00-AUD, 13-5 | ⬜ | |
| 82 | 10-5 | `SoundIntroCard`, `ToneContourIntroCard` | 06-9, 10-2 | ⬜ | |
| 83 | 06-10 | Bài ôn chủ đề | 06-8 | ⬜ | |
| 84 | 09-3 | Phiên ôn (`buildSession`) | 09-2 | ⬜ | |
| 85 | 09-4 | API ôn tập, bật/tắt kiểu thẻ | 09-3 | ⬜ | |
| 86 | 09-5 | Màn hình ôn tập | 09-4, 07-4, 11-4 | ⬜ | |
| 87 | 06-11 | Playwright bài học + đo mở bài < 1,5 giây | 06-10, 10-5 | ⬜ | |
| 88 | 07-7 | Thử viết trên iOS / Android thật | 07-3 | ⬜ | Bỏ qua theo chủ dự án (2026-11-07); không chặn bước nào. Rủi ro còn lại: chưa kiểm chứng `touch-action: none` trên máy thật |

## M7 — Lộ trình, Hôm nay, đăng nhập · [05](05-learning-path/plan.md) · [04](04-home/plan.md) · [03](03-auth/plan.md)

| # | Mã | Việc | Phụ thuộc | TT | Ghi chú |
|---|---|---|---|---|---|
| 89 | 05-3 | Tiến độ lộ trình (màn C) | 05-2, 09-1 | ⬜ | |
| 90 | 05-4 | Màn hình con đường | 05-3 | ⬜ | |
| 91 | 04-1 | `streak.ts` | 00-6 | ⬜ | |
| 92 | 04-3 | `pickMainCard` | 05-1 | ⬜ | |
| 93 | 04-4 | Chữ của ngày | 01-5 | ⬜ | |
| 94 | 04-5 | `GET /api/today` | 04-1, 04-3, 04-4, 09-4 | ⬜ | |
| 95 | 03-1 | `GuestProgressV1Schema` | 00-GW | ⬜ | |
| 96 | 03-2 | Tập học thử, `GET /api/public/lessons/[id]` | 03-1, 06-1 | ⬜ | |
| 97 | 04-6 | Màn hình đầu tiên `/` | 03-1, 05-4 | ⬜ | Lựa chọn “đọc được pinyin” nối 10-6 ở M8 |
| 98 | 04-7 | Màn hình Hôm nay | 04-5 | ⬜ | |
| 99 | 03-3 | Lời mời, màn hình chặn, cảnh báo không lưu được | 03-2, 06-9 | ⬜ | |
| 100 | 03-4 | `mergeGuestProgress` + `POST /api/guest/merge` | 03-1, 05-1 | ⬜ | |
| 101 | 03-5 | Đăng xuất | 03-4 | ⬜ | |
| 102 | 03-6 | Xóa tài khoản | 00-4 | ⬜ | Kiểm tra trang xác thực ở 12-11 |
| 103 | 03-7 | E2E luồng chính: khách học thử → đăng nhập → học tiếp → ôn tập | 03-3, 03-4, 04-7, 09-5 | ⬜ | |

## M8 — Phát âm · [plan](10-pronunciation/plan.md)

| # | Mã | Việc | Phụ thuộc | TT | Ghi chú |
|---|---|---|---|---|---|
| 104 | 10-3 | Bảng pinyin `/pinyin` | 10-1, 00-AUD | ⬜ | |
| 105 | 10-4 | Luyện nghe thanh + thống kê theo thanh | 10-3, 04-2 | ⬜ | |
| 106 | 10-6 | Bài kiểm tra pinyin (`pinyin_pick_audio`, mở HSK 1) | 06-5, 08b-7 | ⬜ | Nối lại 04-6 |
| 107 | 10-7 | Quy tắc nội dung + SRS của giai đoạn Phát âm | 02-2, 09-2 | ⬜ | |

## M9 — Kiểm tra cuối, chứng nhận, trang Tôi · [12](12-exam-certificate/plan.md) · [13](13-profile/plan.md)

| # | Mã | Việc | Phụ thuộc | TT | Ghi chú |
|---|---|---|---|---|---|
| 108 | 12-1 | Sinh ngân hàng đề + kiểm tra ≥ 3× | 02-4 | ⬜ | |
| 109 | 12-2 | `drawExam` | 12-1 | ⬜ | |
| 110 | 12-3 | `examEligibility` | 05-1 | ⬜ | |
| 111 | 12-9 | Mã chứng nhận, kiểm tra tên | 00-6 | ⬜ | |
| 112 | 12-4 | Trước khi bắt đầu: kiểm tra micro, tên trên chứng nhận | 08b-2, 12-9 | ⬜ | |
| 113 | 12-5 | API lượt làm bài (giờ do server giữ, tự nộp) | 12-2, 12-3 | ⬜ | |
| 114 | 12-6 | `scoreExam` | 07-1 | ⬜ | |
| 115 | 12-7 | Khi nộp bài: hoàn thành lộ trình, `bumpDue` | 12-5, 12-6, 09-2 | ⬜ | |
| 116 | 12-8 | Màn hình kết quả | 12-7 | ⬜ | |
| 117 | 12-10 | Cấp chứng nhận + PDF (phông nhúng, dòng cảnh báo bắt buộc) | 12-7 | ⬜ | |
| 118 | 12-11 | Trang xác thực `/chung-nhan/[code]`, OG image | 12-10, 13-4 | ⬜ | |
| 119 | 12-12 | Chia sẻ, LinkedIn | 12-11 | ⬜ | |
| 120 | 13-1 | Thống kê trang Tôi | 09-1, 04-1, 07-3 | ⬜ | |
| 121 | 13-2 | Cài đặt (có hiệu lực ngay) | 00-GW, 09-4 | ⬜ | |
| 122 | 13-3 | Khối tài khoản, Chứng nhận của tôi | 12-10, 03-5, 03-6 | ⬜ | |
| 123 | 12-13 | Đổi tên sau khi cấp (tối đa 3 lần) | 12-10, 13-3 | ⬜ | |
| 124 | 13-6 | `/admin/reports` | 13-5 | ⬜ | |
| 125 | 13-7 | Trang tĩnh (giới thiệu, quyền riêng tư, điều khoản) | 00-UI2 | ⬜ | |
| 126 | 13-8 | Playwright trang Tôi | 13-3 | ⬜ | |

## M10 — Nội dung đầy đủ và ra mắt · [plan 02](02-curriculum/plan.md)

| # | Mã | Việc | Phụ thuộc | TT | Ghi chú |
|---|---|---|---|---|---|
| 127 | 02-D2 | Toàn bộ HSK 1 + ngân hàng đề, `exam_open = true` | 02-D1, 12-1 | ⬜ | |
| 128 | 02-D3 | HSK 2 | 02-D2 | ⬜ | |
| 129 | 02-D4 | HSK 3 | 02-D3 | ⬜ | |
| 130 | REL-1 | Đọc lại file LICENSE gốc của mọi nguồn, đối chiếu `sources.yaml` | 01-9 | ⬜ | sources-and-licenses |
| 131 | REL-2 | Thử tay trên Safari iOS 16+ và Chrome Android: thu âm, phát audio, viết chữ | 03-7 | ⬜ | non-functional §1 |
| 132 | REL-3 | Đo LCP < 2,5 giây trên 4G, chụp ảnh so sánh với design ở 8 viewport | 03-7 | ⬜ | DESIGN-HANDOFF |
| 133 | REL-4 | Triển khai VPS prod, kiểm tra sao lưu khôi phục được | 00-7 | ⬜ | |

---

## Quyết định chờ

| Mã | Câu hỏi | Ở bước | Kết quả |
|---|---|---|---|
| Q1 | TTS đọc âm tiết đứng riêng (SSML phoneme) có tự nhiên không, hay phải đọc chữ ví dụ | 01-7a | – |
| Q2 | Đọc chậm bằng file `.slow.mp3` hay `playbackRate` ở client (`AUDIO_SLOW_MODE`) | 01-7a | – |
| Q3 | Có nguồn mở cho loại nét để hiện tên nét tiếng Việt không | 07-6 | Không (2026-11-07): bỏ tên nét ở bản đầu |

## Việc đang chặn

| Mã | Lý do | Cần ai / cần gì |
|---|---|---|
| – | | |

## Nhật ký

| Ngày | Việc |
|---|---|
| 2026-11-07 | 13-5 đánh dấu ✅ (code đã có từ 72a5313). 07-2 (🟨): `components/writing/WritingPad.tsx`, `strokes.ts`; thêm gói `hanzi-writer` |
| 2026-11-07 | 09-1 xong: `packages/core/src/srs.ts` (ts-fsrs 6.0.0) |
| 2026-11-07 | 07-6 xong (nghiên cứu): không có nguồn loại nét phù hợp, bỏ tên nét; 07-7 bỏ qua theo chủ dự án |
| 2026-11-07 | 07-5 xong: `CharAnalysis` |
| 2026-11-07 | 07-4 xong: `WritingQuiz` |
| 2026-11-07 | 07-3 (🟨): `WritingStep` (Xem → Viết theo → Tự viết, khóa chế độ sau) |
| 2026-11-06 | Thêm `docs/PROGRESS.md` (bản chụp tiến độ); cập nhật bảng mốc M1–M4 sang 🟨 |
| 2026-11-05 | 02-6 (chưa gọi API thật): `clp/authoring/{author_unit,review_unit}.py`, lệnh `clp author-unit`; nối crosscheck vào `check_loaded` (sửa lỗi 02-7) |
| 2026-11-05 | 02-7 xong: `clp/content/crosscheck.py`, nối vào `check-content`/`import-content`, `new_words.pinyin` |
| 2026-11-05 | 02-5 (chưa gọi API thật): `clp/authoring/{config,llm,plan_units}.py`, lệnh `clp plan-units` |
| 2026-11-05 | 02-4 xong: `clp/content/coverage.py`, `coverage-<stage>.md`, `stage.exam_open` |
| 2026-11-05 | 02-3 xong: `normalize.py`, `importer.py`, `clp import-content`, `content/stages.yaml` |
| 2026-11-05 | 02-2 xong: `clp/content/rules.py`, `check.py`, lệnh `check-content` |
| 2026-11-05 | 02-1 xong: `packages/core/src/content.ts`, `clp/content/{models,authoring,loader}.py`, fixture hợp đồng |
| 2026-11-05 | 11-3 (phần lớn): `/tra-tu`, `SearchScreen`, `lib/dictionary/recent.ts`, `AppShell wide` |
| 2026-11-05 | 07-1 xong: `writingScore`, `WRITING_PASS`, `writingRating` ở `packages/core/src/scoring.ts` |
| 2026-11-05 | 11-4 (phần lớn): `/tu/[word]` SSR, `getWordPage`, SEO, `WordView`, `ShareButton` |
| 2026-11-05 | 13-5 xong: `ReportSheet`, `ReportButton`, `POST /api/reports`, migration 0003 |
| 2026-11-05 | 13-4 (phần lớn): `/nguon-du-lieu`, `PublicFooter`, `lib/sources.ts`, `license_short` |
| 2026-11-05 | 11-2 xong: `lib/dictionary/search.ts`, `GET /api/dictionary/search`, `parsePinyinSyllables` |
| 2026-11-04 | 11-1 xong: `classifyQuery`, `parsePinyinQuery`, `segmentPinyin` ở `packages/core/src/dictionary.ts` |
| 2026-11-04 | 10-1 xong: `clp syllables` sinh `content/pron/syllables.yaml` |
| 2026-11-04 | 01-9 xong: `content/sources.yaml` + test đối chiếu nguồn tải về |
| 2026-11-04 | 01-8 xong: `clp report` |
| 2026-11-04 | 01-6 xong: `clp import-tatoeba` (OpenCC, jieba, pypinyin) |
| 2026-11-04 | 01-5 xong: `clp import-hanzi` (Hán Việt qua biến thể phồn thể, phân tích chữ, nét, radical_vi) |
| 2026-11-04 | 02-8 xong: `content/radicals_vi.yaml` (214 bộ thủ) + validator `clp/radicals.py` |
| 2026-11-02 | 01-4 xong: `clp import-hsk`, migration 0002 (unique hsk_word) |
| 2026-11-02 | 01-3 xong: `clp import-cedict`, migration 0001 (unique dict_entry), py-pipeline nối db |
| 2026-11-02 | 01-2 xong: `clp fetch`, `sources.yaml`, manifest |
| 2026-11-02 | 01-1 xong: chạy pytest/ruff/`clp --help` trong Docker (`py-pipeline`) |
| 2026-10-29 | Merge `feat/foundation` vào `master`. Bắt đầu 01-1 trên `feat/pipeline`: `pinyin.py`, `db.py`, `cli.py` |
| 2026-10-28 | Verify M1 trong Docker: lint, typecheck, 108 test xanh (có Postgres thật), compose up + `/healthz` 200. Còn Playwright 9 viewport, font Mona Sans, thử Google OAuth thật |
| 2026-10-27 | Bắt đầu M1: khung repo dưới `src/`, Docker/compose, config, pinyin + sandhi (chạy qua Docker) |
| 2026-10-26 | M0 xong: spec (`docs/specs/`), design cuối (`docs/design/`), plan cho từng module, ledger này |
