# Báo cáo tiến độ

**Bản chụp ngày 2026-11-07**, nhánh `feat/pipeline` (commit `a79e34e`). File này chỉ **tổng hợp** để đọc nhanh và **được cập nhật sau mỗi task** (quy tắc ở [CLAUDE.md](../CLAUDE.md)). Nguồn duy nhất về tiến độ từng bước vẫn là [specs/LEDGER.md](specs/LEDGER.md); khi hai nơi khác nhau thì LEDGER đúng.

## 1. Tóm tắt

| | |
|---|---|
| Thời gian | 2026-10-23 → 2026-11-05 (14 ngày lịch), 43 commit |
| **Hoàn thành toàn dự án** | **≈ 23% số bước xong, ≈ 30% tính cả bước làm dở** (36 ✅ · 11 🟨 · 86 ⬜, tổng 133 bước). Phần còn lại nặng hơn phần đã làm (giao diện học, chấm phát âm), nên khối lượng kỹ thuật thực tế xong khoảng 25–30% |
| Mã nguồn | ≈ 16.700 dòng (web 7.000, pipeline 8.500, core 700, deploy 300), gồm cả test |
| Dữ liệu và nội dung | `content/`: 3.600 dòng (214 bộ thủ, 408 âm tiết, nguồn dữ liệu…); `docs/specs`: 3.900 dòng |
| Test | **673 test xanh**: web 194, core 171, pipeline 308 (nhiều test chạy với Postgres thật) |
| Chạy được | Web dev tại `http://127.0.0.1:3100`: tra từ, trang từ, nguồn dữ liệu, bảng mẫu component |

## 2. Tiến độ theo mốc

| Mốc | Nội dung | Xong | Dở | Chưa | Trạng thái |
|---|---|---|---|---|---|
| M0 | Spec, design, plan | – | – | – | ✅ |
| M1 | Nền tảng: repo, DB, đăng nhập, design system | 10 | 4 | 0 | 🟨 còn kiểm tra giao diện trên trình duyệt |
| M2 | Pipeline dữ liệu | 10 | 0 | 2 | 🟨 còn audio TTS (01-7a, 01-7b) |
| M3 | Từ điển | 4 | 4 | 3 | 🟨 `/tra-tu` và `/tu/…` chạy; còn audio theo yêu cầu, trang chữ, sitemap |
| M4 | Định dạng nội dung, soạn bằng AI, đợt D-1 | 5 | 2 | 3 | 🟨 xong khung; chưa chạy AI thật |
| M5 | Dịch vụ chấm phát âm | 0 | 0 | 9 | ⬜ |
| M6 | Học: bài học, viết, nói, ôn tập | 7 | 1 | 24 | ⬜ (riêng 07-1 `writingScore` xong, nằm ở M3) |
| M7 | Lộ trình, Hôm nay, học thử, đăng nhập | 0 | 0 | 15 | ⬜ |
| M8 | Phát âm: bảng pinyin, luyện nghe thanh | 0 | 0 | 4 | ⬜ |
| M9 | Kiểm tra cuối, chứng nhận, trang Tôi | 0 | 0 | 19 | ⬜ |
| M10 | Nội dung đầy đủ HSK 1–3, ra mắt | 0 | 0 | 7 | ⬜ |

Phần còn lại lớn nhất là **M6 (học)** và **M7 (lộ trình/Hôm nay)**: đó là trải nghiệm người học thật sự. Hiện chưa có màn hình nào để học một bài.

## 3. Đã làm được gì

### Người dùng thấy được
- **Tra từ** `/tra-tu`: một ô tìm tự nhận biết chữ Hán / pinyin (số thanh, dấu thanh) / English / Hán Việt, chip lọc, kết quả theo nhóm, tải thêm, "Tra gần đây". 125.356 mục từ điển, tìm trong 1–35 ms.
- **Trang từ** `/tu/好吃`: SSR, mỗi cách đọc một khối, nghĩa đánh số, từng chữ (Hán Việt, bộ thủ tiếng Việt), 5 câu Tatoeba, 12 từ cùng chữ, SEO + JSON-LD, nút báo lỗi và chia sẻ.
- **Nguồn dữ liệu và giấy phép** `/nguon-du-lieu` (10 nguồn), **báo lỗi nội dung** (`ReportSheet` + `POST /api/reports`, khách giới hạn 10/ngày/IP).
- **Design system** đã port (AppShell, FocusLayout, `Hanzi`, `Pinyin`, `ToneContour`, `Sheet`, `Toast`, `AudioButton`), font Mona Sans tự host.

### Hạ tầng và dữ liệu (không thấy trên màn hình)
- Monorepo, Docker Compose (Caddy, web, speech, db, backup), Postgres + Drizzle (4 migration), Better Auth (Google), API utilities, GuestStore.
- **Pipeline dữ liệu trong DB dev:** CC-CEDICT 125.356 mục · HSK 2021 (11.109 từ, 3.000 chữ, 573 ngữ pháp) · 3.000 chữ có nét và Hán Việt (Unihan) · 214 bộ thủ · 61.896 câu Tatoeba có cấp HSK và liên kết từ · báo cáo `report.md`.
- **Hệ thống nội dung (02):** hợp đồng JSON zod ↔ Pydantic, đọc YAML báo lỗi `file:dòng`, 30+ quy tắc chặn/cảnh báo, chuẩn hóa + bố cục mặc định + ghi DB một transaction, báo cáo độ phủ + điều kiện mở bài kiểm tra cuối, kiểm tra đối chiếu (pinyin, Tatoeba, Hán Việt).
- **Soạn nội dung bằng AI (02-5, 02-6):** `plan-units`, `author-unit`, rà soát bằng model khác, vòng sửa tối đa 2 lần. Đã viết và test bằng model giả; gọi Claude qua Claude Code CLI (`claude -p`, dịch vụ `py-claude`, không cần API key); đã soạn thật **36 chủ đề HSK 3** (`content/hsk3/`, `check-content`: 0 lỗi, 432 cảnh báo; đã sửa hết mục rà soát tồn đọng của HSK 1–3). LEDGER 02-D4 vẫn ⬜ vì chưa duyệt tay và chưa nạp DB.
- **Core thuần:** `pinyin`, `sandhi`, `classifyQuery`, `parsePinyinQuery`, `writingScore`, hợp đồng nội dung.

## 4. Chưa làm và đang chờ

### Cần bạn làm hoặc cung cấp
| Việc | Chặn cái gì |
|---|---|
| Chạy `src/deploy/dev.sh run --rm py-claude run clp plan-units hsk1` rồi `... clp author-unit hsk1 hsk1-u01` (cần Claude Code CLI đã đăng nhập trên máy), xem kết quả | 02-5, 02-6, 10-2, 02-D1 (toàn bộ nội dung bài học) |
| Khóa Azure TTS (và nghe thử âm tiết) | 01-7a, 01-7b, 11-5, mọi nút nghe |
| Kết nối extension Chrome (hoặc xem tay) để kiểm tra 360px / 1440px và chạy Playwright | Đóng M1, 11-3, 11-4, 13-4 |
| Điền `SITE_NAME`, `BETTER_AUTH_SECRET`, `GOOGLE_*` vào `.env` (đang trống; tôi chạy web bằng biến tạm) | `docker compose up web` bình thường, đăng nhập Google |
| Khóa R2 (Cloudflare) | Đẩy dữ liệu nét và audio lên R2 (hiện ghi ra `data/strokes/`) |

### Quyết định đang chờ chủ dự án (đều ghi trong `decisions.md`)
1. **`你好` không có trong danh sách HSK 2021** (chỉ có `你`, `好`), nhưng ví dụ trong spec dạy `你好` là từ mới. Cần sửa ví dụ hoặc dùng `extra: true`.
2. **Định dạng `content/stages.yaml` và `_plan.yaml`** là đề xuất của tôi.
3. **Ghép `hsk_code` ngữ pháp** (`一级-语法-012` = điểm thứ 12 của cấp 1) và **khóa kỹ năng bài kiểm tra** (`listening/reading/writing/speaking`): giả định cần xác nhận.
4. **Âm Hán Việt từ Unihan kém hơn kỳ vọng:** 123/900 chữ HSK 1–3 thiếu, một số sai (好 chỉ ra `háo`, 吗 ra `mửa`). Cần bổ sung qua `overrides/han_viet.yaml`.
5. Số liệu lệch chuẩn (chỉ cảnh báo): HSK 1 có 512 từ (chuẩn 500), HSK 2 có 776 (772) và 82 ngữ pháp (81).
6. URL giấy phép của Creative Commons, Unicode, Microsoft chưa kiểm tra được bằng mạng.
7. **Tên nét tiếng Việt (Q3):** đã nghiên cứu, không có nguồn đủ điều kiện nên bản đầu bỏ tên nét (chi tiết ở `07-writing/decisions.md`). Muốn có sau này: tự suy 5 nét cơ bản từ median.
8. `complete-hsk-vocabulary` có trong `sources.yaml` nhưng chưa dùng; nên xóa nếu không dùng.

## 5. Đề xuất bước tiếp theo
1. **Mở khóa nội dung** (quan trọng nhất): bạn chạy `plan-units hsk1` bằng `py-claude` → `author-unit hsk1 hsk1-u01` → xem `_meta` → nhập vào DB dev. Từ đó mới làm được các màn hình học trên dữ liệu thật.
2. Sau đó làm **M6** theo thứ tự trong LEDGER: trình chạy bài (06), `WritingPad` (07-2 đã có, 07-7 thử máy thật đã bỏ qua), nói (08b, cần dịch vụ chấm), SRS ôn tập (09).
3. Song song, những việc không cần khóa hay trình duyệt: `srs.ts`, `computeUnlockState`, `streak.ts`, `today.ts`, `guest.ts` trong `packages/core` (hàm thuần, test được ngay), dịch vụ `speech` (08a, Python).

## 6. Cách xem và chạy
```bash
src/deploy/dev.sh run --rm node pnpm test                       # test TS
src/deploy/dev.sh run --rm py-pipeline run pytest -q            # test pipeline (Postgres thật)
src/deploy/dev.sh run -d --name clp-web-dev --service-ports \
  -e SITE_NAME="Tiếng Trung (dev)" -e SITE_URL=http://localhost:3100 \
  -e BETTER_AUTH_SECRET=dev-only-secret-0123456789abcdef \
  -e GOOGLE_CLIENT_ID=dev-id -e GOOGLE_CLIENT_SECRET=dev-secret web   # web tại :3100
src/deploy/dev.sh run --rm py-pipeline run clp --help           # các lệnh pipeline
```
Mọi lệnh chạy trong Docker (xem [CLAUDE.md](../CLAUDE.md)).
