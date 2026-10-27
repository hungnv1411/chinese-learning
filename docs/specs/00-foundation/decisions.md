# Quyết định phát sinh – 00 Nền tảng

## 00-1: vị trí mã nguồn
- **Quyết định:** toàn bộ mã nguồn đặt dưới `src/` (yêu cầu của chủ dự án): `src/apps/web`, `src/packages/core`, `src/services/speech`, `src/pipeline`, `src/deploy`, `src/e2e`. Các thư mục không phải mã (`docs/`, `content/`, `data/raw/`) giữ ở gốc. `package.json`, `pnpm-workspace.yaml`, cấu hình lint nằm ở gốc.
- **Hệ quả:** mọi đường dẫn trong plan có dạng `apps/web/...`, `packages/core/...`, `pipeline/...`, `services/speech/...`, `deploy/...`, `e2e/...` đọc thành `src/<đường dẫn đó>`. Fixture dùng chung: `src/packages/core/fixtures/`.
- **Node:** máy dev cần Node ≥ 22.13 (pnpm 11); CI dùng 22.

## 00-3: Docker làm trước (theo yêu cầu chủ dự án)
- Làm Dockerfile/compose trước khi xong 00-2 và 00-4. Ledger: 00-3 chuyển `🟨`, phần còn lại (`/healthz` của web, kiểm tra `docker compose up`) làm khi có app.
- Chạy từ gốc repo: `docker compose --env-file .env -f src/deploy/docker-compose.yml [-f src/deploy/docker-compose.dev.yml] up`.
- Mạng: `internal` (internal: true) chứa `speech`, `db`; `web` và `caddy` nối thêm `edge` (web cần ra Internet cho Google OAuth và R2). `speech` và `db` không có `ports` ở prod; dev mở DB ở 127.0.0.1:5432.
- `src/services/speech/app/main.py` có sẵn `/healthz` tối thiểu để compose khỏe; `/score` thuộc 08a-1.
- Dockerfile web yêu cầu `output: 'standalone'` trong next.config (làm ở 00-3 khi dựng Next).

## 00-4: schema
- `certificate.user_id` nullable, `ON DELETE SET NULL`: xóa tài khoản không xóa chứng nhận (plan: “trừ certificate, do 03 xử lý riêng”); `name_on_certificate` giữ nguyên. 03-6 quyết định ẩn danh hay giữ.
- Cột sinh `dict_entry.definitions_tsv` dùng hàm `clp_array_to_text` (IMMUTABLE) tạo ở `db/pre-migrate.sql`, vì `array_to_string` chỉ STABLE. `db/migrate.ts` chạy file này trước migration Drizzle (cũng chạy trong test).
- ID của bảng Better Auth là `text`. `exam_attempt.id` và `certificate.id` là `uuid`.
- Test schema chạy với `TEST_DATABASE_URL` (tự tạo/xóa database riêng); không có biến thì bỏ qua. Service `node` trong compose dev đặt sẵn biến này và nối mạng `internal` để tới `db`.
- Migration SQL sinh bằng `pnpm -F @clp/web db:generate` (drizzle-kit) và commit vào `db/migrations/`.

## 00-UI1: CSS và font
- Phần 6 của `styles.css` (screen modules) đã được cắt sẵn thành `styles/screens/<màn hình>.css` (nguyên văn), thay vì để từng module tự chép. Riêng phần “Launcher” (gallery, tile, page-hero) của `index.html` không port vì không làm route.
- `.card.row` (cuối file design) chuyển vào `components.css`; các quy tắc scrollbar mobile vào `shell.css`.
- Font Mona Sans (SIL OFL 1.1) tự host ở `public/fonts/` (3 tập con latin, latin-ext, vietnamese, bản biến thiên 200–900, tải từ npm `@fontsource-variable/mona-sans` 5.3.0). Dùng `@font-face` trong `styles/fonts.css` thay vì `next/font/local`, vì token `--font-body` yêu cầu đúng tên họ “Mona Sans” và cần `unicode-range` cho tiếng Việt. Cần ghi nguồn phông ở trang Nguồn dữ liệu (01-9 / 13-4).
- `/dev/ui` hiện chỉ dùng class của design (button, badge, progress, field, switch, màu thanh); các component React (`Hanzi`, `Sheet`…) thêm ở 00-UI4.
