# Quyết định phát sinh – 13 Trang Tôi

## 13-4: `/nguon-du-lieu` và `PublicFooter`
- `content/sources.yaml` thêm trường `license_short` (≤ 20 ký tự) cho nhãn `.badge` trong thẻ nguồn; `license` đầy đủ vẫn nằm trong file. Test ở pipeline và ở web đều bắt buộc trường này.
- Web đọc file lúc chạy (`lib/sources.ts`, gói `yaml` + zod) từ `process.cwd()/../../../content/sources.yaml`. Dockerfile sao chép file vào ảnh build và runtime, `next.config.mjs` đưa vào `outputFileTracingIncludes` của route. Chưa dựng thử ảnh production.
- Trang hiển thị số chữ có `han_viet_source = 'ai'` đọc từ DB mỗi request (layout gốc đã `force-dynamic`). Lỗi DB thì trang vẫn hiện, ghi chú chung không kèm số.
- Link tải: `${REPO_URL}/tree/HEAD/content`; chưa cấu hình `REPO_URL` thì chỉ hiện ghi chú, không có nút.
- `PublicFooter { credits? }`: chưa gắn vào `/tu/…`, `/chung-nhan/…` vì các trang đó chưa có; test "có trên trang" bổ sung ở 11-4 và 12.
- Trang tạm bọc `AppShell` trực tiếp; khi có route group `(app)` thì chuyển sang layout chung.
- Chưa kiểm tra 360px/1440px bằng trình duyệt (extension Chrome không kết nối được lúc làm).

## 13-5: báo lỗi nội dung
- `content_report` thêm `content_version` và `user_agent` (migration `0003_*`); plan 00 chưa có hai cột này.
- **Server quyết định `content_version`**: báo từ bài (`target.kind = lesson`) lấy `lesson.content->>'contentVersion'`; thiếu (bài chưa có hoặc không tồn tại) thì dùng `content_meta.content_version` của lần nhập. Client gửi `contentVersion` cũng bị bỏ qua. Cách lưu `contentVersion` của bài (trong JSON `content`) là giả định cho đến khi 02 bước nhập nội dung chốt; sửa `lib/reports/create.ts` nếu 02 lưu chỗ khác.
- Đối tượng `general` lưu `target_id = ''`; `word`/`sentence`/`lesson` bắt buộc `id`. `word` dùng chữ giản thể (`好吃`) làm id tạm; nếu trang từ đa âm cần phân biệt từng khối thì dùng `dict_entry.id` (quyết ở 11-4).
- Khách giới hạn 10 báo cáo/ngày/IP (`rateLimit` trong bộ nhớ); người đăng nhập chưa giới hạn (spec không yêu cầu). Nếu có lạm dụng thì thêm giới hạn theo user.
- Độ dài mô tả đếm theo ký tự hiển thị (`Intl.Segmenter`), cùng hàm ở client và server.
- Lỗi hiện trong sheet có tiền tố "✗" kèm chữ (không chỉ dùng màu).
- `handler()` nhận `ZodType<B, ZodTypeDef, unknown>` để schema có `.default()` suy ra kiểu đầu ra đúng.
- Chưa gắn `ReportButton` vào màn hình nào (các màn hình chưa có); gắn dần ở 06, 09, 11-4, 13-1.
