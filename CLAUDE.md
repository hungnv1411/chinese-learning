# CLAUDE.md

Website tự học tiếng Trung cho người Việt, từ con số 0 đến HSK 3 (chuẩn HSK 2021). Phi lợi nhuận, mã nguồn mở, dùng dữ liệu mở. Học chủ yếu trên điện thoại, đủ 4 kỹ năng nghe, nói, đọc, viết. Có SRS, bài kiểm tra cuối và chứng nhận.

**Trạng thái:** mới xong spec, design và plan. **Chưa có code.** Tiến độ xem ở [docs/specs/LEDGER.md](docs/specs/LEDGER.md).

## Tài liệu

| Đường dẫn | Nội dung | Vai trò |
|---|---|---|
| [docs/specs/README.md](docs/specs/README.md) | Tổng quan, quyết định đã chốt D1–D16, thuật ngữ | Đọc đầu tiên |
| `docs/specs/<module>/*.md` | Spec từng module | **Nguồn đúng về hành vi** |
| `docs/specs/<module>/plan.md` | Plan thực hiện của module (08 có `plan-speech-service.md` và `plan-speaking-ui.md`) | Cách làm, test cần viết |
| [docs/specs/00-foundation/plan.md](docs/specs/00-foundation/plan.md) | Quy ước chung: cấu trúc repo, `packages/core`, design system, route, API, schema DB | Đọc trước khi làm module nào |
| [docs/specs/LEDGER.md](docs/specs/LEDGER.md) | Thứ tự thực hiện và trạng thái từng bước | Nguồn duy nhất về tiến độ |
| `docs/specs/<module>/decisions.md` | Quyết định phát sinh khi làm (tạo khi cần) | |
| [docs/design/](docs/design/index.html) | UI cuối (HTML/CSS/JS tĩnh), `DESIGN-HANDOFF.md`, `DESIGN-MANIFEST.json` | **Nguồn đúng về hình ảnh** |
| `docs/ideas/` | Wireframe cũ | Chỉ tham khảo, design đã thay thế |

Khi spec và design khác nhau, làm theo bảng đối chiếu ở [00-foundation/plan.md §3](docs/specs/00-foundation/plan.md). Chỗ khác mới chưa có trong bảng thì dừng lại hỏi, rồi ghi vào bảng.

## Cách làm việc

1. Lấy bước `⬜` tiếp theo trong `LEDGER.md` mà các bước nó phụ thuộc đã `✅`.
2. Đọc spec của module, plan của module, và các phần liên quan ở plan 00.
3. Viết test trước, theo đúng ca kiểm thử và giá trị trong plan. Rồi viết code cho test xanh.
4. Cập nhật `LEDGER.md`: trạng thái, ghi chú commit, một dòng nhật ký. Mỗi commit gắn với một mã bước.
5. Làm khác plan, hoặc gặp chỗ plan chưa quyết: ghi vào `decisions.md` của module, sửa plan cho khớp.

- Plan mới hoặc plan sửa lại đặt ở `docs/specs/<module>/plan.md`. **Không** dùng định dạng hay thư mục plan của superpowers.
- Quyết định **D1–D16** trong spec README là của chủ dự án: không được đổi. Mục đánh dấu **[Đề xuất]** thì làm theo, chủ dự án có thể đổi sau.
- Commit: tiếng Anh, câu mệnh lệnh, có mã bước, ví dụ `00-4: add Drizzle schema and migrations`. Không commit thẳng lên `master`.

## Cấu trúc repo (dự kiến, theo plan 00)

```
apps/web          Next.js App Router (UI + API), Drizzle, Better Auth   MIT
packages/core     Logic TS thuần dùng chung client + server             MIT
services/speech   FastAPI chấm phát âm (faster-whisper + Parselmouth)   GPL-3.0
pipeline          Python: nhập dữ liệu, tạo audio TTS, soạn nội dung AI MIT
content           YAML nội dung lộ trình                                CC BY-SA 4.0
data/raw          Dữ liệu nguồn tải về (không commit file lớn)
deploy            docker-compose, Caddyfile, backup.sh
e2e               Playwright
```

## Lệnh (dự kiến, cập nhật khi đã có thật)

```bash
pnpm install
pnpm test                         # Vitest mọi gói TS
pnpm -F web dev
pnpm e2e                          # Playwright
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.dev.yml up
cd pipeline && uv run pytest      # và: uv run clp <lệnh>
cd services/speech && uv run pytest
```

## Quy tắc không được vi phạm

Những điều dưới đây dễ làm sai và spec coi là thất bại:

- **Tên website, tên miền** chỉ đọc từ `SITE_NAME`, `SITE_URL`. Không viết cứng ở đâu cả, kể cả PDF chứng nhận và metadata.
- **Không dùng Web Speech API** (`speechSynthesis`, nhận dạng giọng nói của trình duyệt). Audio mẫu là file MP3 TTS trên R2. `app.js` của design có dùng `speechSynthesis`, phải thay.
- **Không lưu file ghi âm** ở đâu cả. Dịch vụ speech chỉ xử lý trong bộ nhớ hoặc `/dev/shm` rồi xóa ngay. Log không ghi transcript kèm định danh người dùng.
- **Server quyết định** mở khóa, hoàn thành bài, đạt bài kiểm tra, cấp chứng nhận. Không tin dữ liệu client. Bài kiểm tra cuối không gửi đáp án xuống client.
- **Không được để người học bị kẹt** vì máy chấm sai. Mọi chỗ chấm tự động có lối thoát như spec: gợi ý nét sau 3 lần sai, đi tiếp sau 3 lần nói chưa đạt, lượt “không nghe rõ” không tính, không chắc thanh thì cho đúng.
- **Chứng nhận** luôn có dòng ghi rõ đây không phải chứng chỉ HSK chính thức.
- **Không vi phạm giấy phép dữ liệu:** mọi nguồn có trong `content/sources.yaml` và trang `/nguon-du-lieu`. Không chép nội dung Chinese Grammar Wiki, MIT OCW, FSI.
- **Không đổi hoặc xóa `id` của bài đã phát hành.**
- **Ngưỡng chấm** (phát âm, viết, điểm đạt) nằm trong file cấu hình hoặc hằng số ở `packages/core`, không rải trong code.
- **Không có chi phí tăng theo lượt dùng:** không gọi dịch vụ chấm trả phí; TTS chỉ tạo sẵn, riêng từ điển tạo theo yêu cầu tối đa 500 lần/ngày.

## Quy ước code

- `packages/core` chỉ chứa hàm thuần: không IO, không đọc giờ hệ thống ngầm (truyền `now` vào), không đọc biến môi trường. Chạy được ở cả trình duyệt và server.
- Biến điệu (`applyToneSandhi`) và chuyển pinyin có bản TS và bản Python. Hai bản phải đọc **cùng file fixture** ở `packages/core/fixtures/`.
- Giao diện giữ tên class và token của `docs/design/styles.css` (port sang `apps/web/styles/`). Không đổi giá trị token, không thêm màu ngoài token. Tailwind chỉ dùng cho tiện ích bố cục.
- Mobile-first: không cuộn ngang ở 360px, vùng chạm ≥ 44px, nút chỉ có biểu tượng phải có `aria-label`, đúng/sai luôn có biểu tượng ✓/✗ kèm chữ, không chỉ dùng màu. Kiểm tra ở các viewport trong `DESIGN-MANIFEST.json`.
- Chữ Hán dùng phông hệ thống (`--font-cjk`), không tải web font CJK.
- Màu thanh điệu thống nhất: thanh 1 đỏ, 2 xanh lá, 3 xanh dương, 4 tím, thanh nhẹ xám. Pinyin luôn có dấu thanh.
- Chuỗi giao diện tiếng Việt gom ở `apps/web/lib/strings/vi.ts`. Nghĩa của từ bằng tiếng Anh (CC-CEDICT).
- Tên biến, hàm, file bằng tiếng Anh. Tài liệu bằng tiếng Việt.
- Lỗi API theo định dạng `{ "error": { "code", "message" } }`. API nhận cả cookie và bearer token (để app native sau này dùng lại).
- Mọi đọc/ghi `localStorage` bọc `try/catch`. Tiến độ khách nằm ở khóa `guest_progress_v1`.
