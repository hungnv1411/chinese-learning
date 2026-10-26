# Kiến trúc & cách xây dựng

## 1. Tổng quan

```
                ┌──────────────────────────── VPS (Docker Compose) ───────────────────────────┐
 Trình duyệt ──▶│ Caddy (HTTPS) ──▶ web: Next.js (UI + API) ──▶ PostgreSQL                     │
 (điện thoại)   │                         │                                                    │
                │                         └──▶ speech: Python FastAPI (chỉ nội bộ)             │
                └──────────────────────────────────────────────────────────────────────────────┘
        │
        └──▶ Cloudflare R2 (file audio TTS, dữ liệu nét chữ, PDF chứng nhận, bản sao lưu DB)
```

- **web** là ứng dụng duy nhất người dùng truy cập. Gồm giao diện và API.
- **speech** chỉ nhận yêu cầu từ **web** qua mạng nội bộ Docker, không mở ra Internet. Lý do: để web kiểm soát đăng nhập, giới hạn tần suất và hàng đợi.
- File tĩnh lớn (audio, PDF) để trên R2 phía sau CDN của Cloudflare. R2 không tính phí băng thông tải xuống.

## 2. Công nghệ

| Phần | Lựa chọn | Ghi chú |
|---|---|---|
| Ngôn ngữ web | TypeScript | |
| Framework web | **Next.js** (App Router, bản ổn định mới nhất) | Trang từ điển và trang xác thực chứng nhận phải render trên server để Google tìm thấy được. Phần học chạy phía client |
| Giao diện | Tailwind CSS. Thư viện component do người xây chọn (gợi ý shadcn/ui) | Thiết kế mobile-first |
| Truy cập database | Drizzle ORM (hoặc Prisma, người xây chọn) | Có migration |
| Database | **PostgreSQL** 16+ | Bật extension `unaccent` và `pg_trgm` cho tìm kiếm |
| Đăng nhập | **Better Auth**, chỉ Google OAuth | Xem [03-auth](../03-auth/auth.md) |
| SRS | **ts-fsrs** | Xem [09-review](../09-review/review.md) |
| Viết chữ | **hanzi-writer** + hanzi-writer-data | Xem [07-writing](../07-writing/writing.md) |
| Chấm phát âm | Python 3.11+, **FastAPI**, **faster-whisper**, **Parselmouth**, **pypinyin**, ffmpeg | Xem [08-speaking/speech-service.md](../08-speaking/speech-service.md) |
| Pipeline dữ liệu | Script Python (chạy tay hoặc trong CI) | Xem [01-content-data](../01-content-data/) |
| TTS | Azure Neural TTS (zh-CN) **[Đề xuất]** | Chỉ dùng lúc tạo audio, không gọi khi người dùng đang học |
| Lưu file | Cloudflare R2 (tương thích S3) | |
| PDF chứng nhận | Tạo phía server (`@react-pdf/renderer` hoặc tương đương) | |
| Reverse proxy | Caddy (HTTPS tự động) | |
| Triển khai | Docker Compose trên **một VPS cấu hình tối thiểu: 2 vCPU / 4 GB RAM** (D15) | Whisper `base` chạy bằng CPU. Chưa tính đến tải lớn |

## 3. Cấu trúc repo (gợi ý)

```
/apps/web            Next.js
/services/speech     FastAPI, chấm phát âm
/pipeline            Script Python nhập dữ liệu, tạo audio TTS
/content             File YAML nội dung lộ trình (xem 02-curriculum)
/data/raw            Dữ liệu nguồn đã tải về (không commit file lớn, chỉ commit script tải)
/docs                Spec, wireframe
/deploy              docker-compose.yml, Caddyfile, script sao lưu
```

## 4. Luồng chính

**Tải bài học:** client gọi `GET /api/lessons/{id}`. Server trả về toàn bộ nội dung bài: các bước, từ, câu, URL audio, dữ liệu nét chữ. Sau đó bài học chạy hoàn toàn ở client cho mượt. Riêng bước nói gọi server để chấm.

**Ghi tiến độ:**
- Client gửi kết quả từng bước (`POST /api/progress/step`) để thoát giữa chừng không mất tiến độ.
- Khi hoàn thành bài, client gửi `POST /api/progress/lesson-complete`. Server kiểm tra lại điều kiện hoàn thành, rồi tạo thẻ SRS và mở khóa bài sau.
- Nếu là khách thì lưu trong localStorage (xem [03-auth](../03-auth/auth.md)).

**Chấm nói:** client thu âm → `POST /api/speech/score` (web) → web kiểm tra đăng nhập/khách và giới hạn tần suất → chuyển tiếp sang `speech:8000/score` → trả kết quả.

## 5. API

Người xây tự thiết kế chi tiết API, nhưng phải đáp ứng:
- Mọi API ghi dữ liệu đều kiểm tra quyền phía server. Không tin dữ liệu client gửi lên về việc đã mở khóa hay đã đạt.
- API dùng JSON và có thể gọi bằng token (không chỉ cookie), để app native sau này dùng lại được. Better Auth có hỗ trợ bearer token.

## 6. Môi trường

- `dev`: chạy cục bộ bằng Docker Compose, có dữ liệu mẫu (giai đoạn Phát âm + 2 chủ đề HSK 1).
- `prod`: một VPS. Không cần môi trường staging riêng ở bản đầu.

## 7. Sao lưu & vận hành

- `pg_dump` hằng đêm, nén, đẩy lên R2. Giữ 14 bản gần nhất.
- Log của web và speech ghi ra stdout, Docker giữ log. Không dùng dịch vụ giám sát trả phí.
- Có endpoint `/healthz` cho web và speech.

## 8. Tên website và tên miền

Chưa có (D16). Mọi chỗ dùng tên hoặc tên miền (tiêu đề trang, chứng nhận, LinkedIn, trang pháp lý, email Google OAuth) phải đọc từ cấu hình `SITE_NAME`, `SITE_URL`. **Không viết cứng.**

## 9. Người xây tự quyết

- Chọn ORM, thư viện component, cách quản lý state phía client.
- Chi tiết route API và tên bảng (miễn là đủ dữ liệu ở [data-model.md](data-model.md)).
- Nhà cung cấp VPS.
