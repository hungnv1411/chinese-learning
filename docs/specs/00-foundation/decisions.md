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
