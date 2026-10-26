# Plan thực hiện: 12 – Bài kiểm tra cuối & chứng nhận

Spec: [final-exam.md](final-exam.md), [certificate.md](certificate.md). Quy ước chung: [00-foundation/plan.md](../00-foundation/plan.md).

## 1. Màn hình design

| Design | Route | Khối |
|---|---|---|
| `exam.html` | `/kiem-tra/[stage]` (`?skip=1` khi thi vượt) | `exam-conditions`, `exam-structure` (“Cấu trúc bài”), `dialog#confirm` (“Sẵn sàng làm bài?”: kiểm tra micro + tên trên chứng nhận), phần làm bài (`FocusLayout`), `exam-result` + “Điểm từng phần” |
| `certificate.html` | `/chung-nhan/[code]` | `.cert` (bản xem trước HTML), trạng thái, chia sẻ, Tải PDF |

## 2. Phụ thuộc

- 02: `exam_item`, `stage.exam_open`. 05: `UnlockState.finalExam`, `skipExam`. 06: các component bài tập (bản “không đáp án”). 07: `WritingQuiz`. 08: `SpeakingStep` (2 lượt). 09: `bumpDue`.
- Cung cấp cho: 05 (stage completed), 13 (Chứng nhận của tôi, đổi tên), 03 (thu hồi khi xóa tài khoản).

## 3. Phần A — Ngân hàng đề

### Bước 1. Sinh ngân hàng đề (pipeline, chạy trong `import_content`)
- `pipeline/clp/exam_bank.py`: sinh câu từ nội dung lộ trình (từ, câu, ngữ pháp đã học) theo dạng ở final-exam §2, gộp câu soạn tay `content/exam/<stage>.yaml`. Đi qua `crosscheck` như nội dung bài (02).
- Mỗi `exam_item`: `stage_id, skill, type, unit_id, content (JSONB: đề + lựa chọn), answer (JSONB, không bao giờ gửi client)`.
- Kiểm tra: mỗi phần có **≥ 3 ×** số câu cần (HSK 1: nghe ≥ 60, đọc ≥ 60, viết ≥ 15 chữ, nói ≥ 15). Thiếu → `stage.exam_open = false` và báo trong coverage report.
- Chữ phần Viết: chữ đã học trong lộ trình, ưu tiên chữ HSK của cấp đó.
- Test: lộ trình mẫu thiếu câu nói → `exam_open = false`; câu sinh ra đều chỉ dùng từ đã học trong lộ trình.

### Bước 2. Rút đề — `lib/exam/draw.ts`
`drawExam(stageId, bank, lastAttemptItemIds, rand): ExamPaper`
- Số câu theo bảng (HSK 1: 20/20/5/5; HSK 2: 25/25/8/6; HSK 3: 30/30/10/8) và thời gian (HSK 1: 15′/15′/5′/5′; HSK 2: 18′/18′/8′/6′; HSK 3: 20′/20′/10′/8′). Đặt trong `lib/exam/config.ts`.
- Rải đều theo chủ đề: mỗi chủ đề ≥ 1 câu ở phần Nghe hoặc Đọc.
- Tránh câu của lần làm gần nhất nếu ngân hàng đủ.
- `speak_answer` chỉ ở HSK 2–3.
- Test: 200 lần rút đều đủ số câu, đủ chủ đề; trùng với lần trước = 0 khi ngân hàng ≥ 3×.

## 4. Phần B — Làm bài

### Bước 3. Điều kiện — `packages/core` `examEligibility`
`examEligibility({ loggedIn, unlock, stageId, skip, lastFailedFinishedAt, now, examOpen, alreadyPassed })` → `{ ok: true } | { ok: false, reason: 'login' | 'locked' | 'cooldown' | 'not_published' | 'already_passed', until? }`:
- Phải đăng nhập; `examOpen`; chưa đạt trước đó (mỗi lộ trình một chứng nhận).
- Một trong hai: `unlock.finalExam[stage] = 'available'`, hoặc `skip && unlock.skipExam === stage`.
- Không có lần chưa đạt kết thúc trong 24 giờ qua → nếu có, `cooldown` kèm `until`.
- Test cho mỗi lý do; ca biên đúng 24 giờ sau → cho phép.

### Bước 4. Trước khi bắt đầu (`dialog#confirm`)
- **Kiểm tra micro:** thu thử 1 câu bằng `useRecorder` (08) và gửi chấm; không có micro / bị từ chối → không cho bắt đầu.
- **Tên trên chứng nhận:** “Tên trên chứng nhận: **{certificate_name}** · Sửa”, sửa tại chỗ, kiểm tra bằng `validateCertificateName` (bước 9).
- Thi vượt: khi bắt đầu, nếu `pron` chưa completed thì đặt `pron` completed `exam_skip` (04 §1, lựa chọn “Tôi đã học HSK 1”).

### Bước 5. API lượt làm bài
- `POST /api/exam/start { stageId, skip }`: kiểm tra `examEligibility`, `drawExam`, tạo `exam_attempt` (`item_ids`, `started_at`, `deadline_at = started_at + tổng thời gian các phần + 10 phút`, `sections` với thời điểm bắt đầu từng phần). Trả đề **không có đáp án**.
- Thứ tự cố định Nghe → Đọc → Viết → Nói. Server lưu thời điểm bắt đầu phần; hết giờ phần → chuyển phần, câu chưa trả lời tính sai. Client hiện đồng hồ đếm ngược theo giờ server.
- `POST /api/exam/answer { attemptId, itemId, answer }`: chỉ nhận câu thuộc phần đang mở và còn giờ. Nghe/Đọc: lưu lựa chọn. Viết: `{ misses, usedHint }` (chấp nhận rủi ro client gửi sai, spec §4). Nói: gọi qua `/api/speech/score` với `context = exam`, tối đa **2 lượt**, lấy cao nhất.
- Câu nghe trắc nghiệm không hiện chữ trước khi trả lời.
- Rời giữa chừng: quay lại trước `deadline_at` thì làm tiếp đúng chỗ. Quá hạn → tự nộp (kiểm tra lười ở mọi request + job định kỳ 5 phút nộp các lượt quá hạn).
- `POST /api/exam/finish { attemptId }`.
- Test: gửi đáp án phần Đọc khi đang ở phần Nghe → 409; gửi sau khi phần hết giờ → 409; response của `start` không chứa trường `answer`; lượt quá hạn được tự nộp khi gọi `GET /api/exam/[id]`.

### Bước 6. Chấm — `scoreExam` (core)
- Nghe, Đọc: tỉ lệ đúng × 25. Viết: trung bình `writingScore` / 100 × 25. Nói: trung bình điểm cao nhất mỗi câu / 100 × 25.
- Tổng 100. **Đạt**: tổng ≥ 70 **và** mỗi phần ≥ 12,5.
- Test: (25, 25, 10, 25) → tổng 85 nhưng chưa đạt (Viết < 12,5); (17.5, 17.5, 17.5, 17.5) → 70 đạt; câu chưa trả lời tính 0.

### Bước 7. Khi nộp bài (server, một transaction)
- Lưu điểm từng phần, `total`, `passed`, `finished_at`.
- **Đạt:** `stage_progress(stage) = completed` (`completed_via = exam_skip` nếu chưa đạt mọi bài ôn chủ đề, ngược lại `lessons`); cấp chứng nhận (bước 8); mở lộ trình sau. Thi vượt **không** tạo thẻ SRS cho từ của lộ trình.
- **Chưa đạt:** tiến độ giữ nguyên; các từ sai ở Nghe và Đọc → `bumpDue` (chỉ thẻ đã có, không tạo mới).

### Bước 8. Màn hình kết quả
- Tổng điểm, Đạt/Chưa đạt, thanh điểm từng phần.
- Đạt: bản xem trước chứng nhận, “Xem chứng nhận”, “Bắt đầu lộ trình HSK n+1”.
- Chưa đạt: phần dưới ngưỡng, thời điểm được thi lại, gợi ý ôn các từ đã đánh dấu.
- **Không** hiện đáp án đúng.

## 5. Phần C — Chứng nhận

### Bước 9. Mã và tên — `packages/core/src/certificate.ts`
- `generateCertificateCode(stageNumber, rand)`: `HSK{n}-XXXX-XXXX`, bảng ký tự `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (bỏ `0 O 1 I`). Server thử lại khi trùng (ràng buộc unique).
- `validateCertificateName(s)`: 1–60 ký tự, chỉ chữ cái Unicode (kể cả tiếng Việt có dấu), dấu cách, `-`, `.`; cắt khoảng trắng hai đầu, gộp khoảng trắng.
- Test: mã khớp `/^HSK[1-3]-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/`; `Nguyễn Văn An` hợp lệ; `An123`, chuỗi 61 ký tự, `<b>` không hợp lệ.

### Bước 10. Cấp chứng nhận và PDF
- Khi đạt: tạo `certificate(code, user_id, stage_id, exam_attempt_id, name_on_certificate, điểm, issued_at)`. Mỗi người một chứng nhận mỗi lộ trình (unique `(user_id, stage_id)` khi `revoked = false`).
- PDF bằng `@react-pdf/renderer`, A4 ngang, song ngữ Việt–Anh:
  - Tiêu đề **结业证书**, “Chứng nhận hoàn thành / Certificate of Completion”; tên; “HSK 1 · Sinh tồn” (+ tiếng Anh); mô tả “đã hoàn thành lộ trình tự học theo chuẩn HSK 2021 cấp 1, gồm {số từ} từ, {số chữ} chữ, đủ 4 kỹ năng nghe, nói, đọc, viết” (số đếm từ DB); điểm tổng + từng phần; ngày cấp; mã; QR tới `${SITE_URL}/chung-nhan/{code}`.
  - Dòng **bắt buộc**: “Đây là chứng nhận hoàn thành khóa học trên {SITE_NAME}, không phải chứng chỉ HSK chính thức do Chinese Testing International cấp.” + bản tiếng Anh.
  - Nhúng phông: một phông Latin có đủ dấu tiếng Việt (giấy phép OFL, ví dụ Be Vietnam Pro) và Noto Sans SC **chỉ tập con** các chữ dùng tới (tiêu đề + tên lộ trình). Subset lúc build bằng `fonttools pyftsubset`.
- Lưu R2 `certificates/{code}.pdf`. Tạo PDF lỗi → chứng nhận vẫn cấp, job thử lại.
- Test: PDF sinh ra có chuỗi cảnh báo bắt buộc (đọc text bằng `pdf-parse`), có mã, kích thước < 500 KB.

### Bước 11. Trang xác thực `/chung-nhan/[code]` (SSR)
- Công khai, `noindex` (meta + header `X-Robots-Tag`).
- Hợp lệ: bản xem trước HTML theo `certificate.html`, trạng thái **Hợp lệ**, tên, lộ trình, ngày cấp, điểm, nút “Tải PDF”.
- `revoked`: chỉ “Chứng nhận không còn hiệu lực”, không tên, không điểm.
- Không tồn tại: “Không tìm thấy chứng nhận”.
- Open Graph: ảnh tạo động bằng `next/og` (`opengraph-image.tsx`), ảnh của chứng nhận thu hồi không có tên.
- Chân trang có link `/nguon-du-lieu`.
- Test: ba trạng thái hiện đúng; HTML của chứng nhận thu hồi không chứa tên cũ; có `noindex`.

### Bước 12. Chia sẻ
- Sao chép link xác thực (toast). Web Share API trên điện thoại; desktop mở `https://www.facebook.com/sharer/sharer.php?u=…`.
- “Thêm vào hồ sơ LinkedIn”: `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=…&organizationName={SITE_NAME}&issueYear=…&issueMonth=…&certUrl=…&certId={code}`.
- Test: URL LinkedIn chứa đúng tham số đã mã hóa.

### Bước 13. Đổi tên sau khi cấp (13 gọi)
- `PATCH /api/certificates/[code]/name { name }`: tối đa 3 lần mỗi chứng nhận (đếm `certificate_name_change`), ghi lịch sử, tạo lại PDF **cùng mã**.
- Test: lần thứ 4 → 409; PDF mới có tên mới.

## 6. Xong module khi
- Test `examEligibility`, `drawExam`, `scoreExam`, mã, tên, API thời gian xanh (spec yêu cầu unit test chấm bài kiểm tra).
- Làm hết một bài kiểm tra HSK 1 trên điện thoại, nhận chứng nhận, mở trang xác thực từ QR.
