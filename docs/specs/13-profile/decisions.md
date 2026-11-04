# Quyết định phát sinh – 13 Trang Tôi

## 13-4: `/nguon-du-lieu` và `PublicFooter`
- `content/sources.yaml` thêm trường `license_short` (≤ 20 ký tự) cho nhãn `.badge` trong thẻ nguồn; `license` đầy đủ vẫn nằm trong file. Test ở pipeline và ở web đều bắt buộc trường này.
- Web đọc file lúc chạy (`lib/sources.ts`, gói `yaml` + zod) từ `process.cwd()/../../../content/sources.yaml`. Dockerfile sao chép file vào ảnh build và runtime, `next.config.mjs` đưa vào `outputFileTracingIncludes` của route. Chưa dựng thử ảnh production.
- Trang hiển thị số chữ có `han_viet_source = 'ai'` đọc từ DB mỗi request (layout gốc đã `force-dynamic`). Lỗi DB thì trang vẫn hiện, ghi chú chung không kèm số.
- Link tải: `${REPO_URL}/tree/HEAD/content`; chưa cấu hình `REPO_URL` thì chỉ hiện ghi chú, không có nút.
- `PublicFooter { credits? }`: chưa gắn vào `/tu/…`, `/chung-nhan/…` vì các trang đó chưa có; test "có trên trang" bổ sung ở 11-4 và 12.
- Trang tạm bọc `AppShell` trực tiếp; khi có route group `(app)` thì chuyển sang layout chung.
- Chưa kiểm tra 360px/1440px bằng trình duyệt (extension Chrome không kết nối được lúc làm).
