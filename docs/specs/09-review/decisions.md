# Quyết định phát sinh – 09 Ôn tập

## 09-1: `srs.ts`
- Dùng `ts-fsrs` 6.0.0 qua API `fsrs()` / `createEmptyCard` (các kiểu `Card`, `RecordLogItem` đã đánh dấu deprecated nhưng vẫn chạy; API scheduler mới chưa cần). Bọc hết trong `packages/core/src/srs.ts`, phần còn lại của dự án chỉ thấy `SrsCard` thuần dữ liệu (camelCase, khớp cột `srs_card`).
- **Fuzz và seed:** `enable_fuzz = true`. ts-fsrs tự sinh seed từ (giờ ôn, `reps`, độ khó × stability), nên cùng thẻ + cùng `now` + cùng nút cho cùng lịch; không cần truyền seed vào. Test giữ tính ổn định này.
- **Cột thiếu `learning_steps`:** FSRS 6 cần số bước học hiện tại của thẻ (`learning_steps`) để chạy các bước 1 phút / 10 phút. Bảng `srs_card` (plan 00) chưa có cột này, nên `SrsCard.learningSteps` có mặt trong kiểu nhưng chưa lưu được. **Việc phải làm ở 09-2:** thêm cột `learning_steps smallint not null default 0` bằng migration, nếu không thẻ Again/Hard sẽ luôn quay về bước đầu.
- `masteryOfWord` trả `null` khi từ không còn thẻ nào đang bật (chưa có thẻ hoặc đều `suspended`), để nơi dùng phân biệt với `new`. Thẻ “mới” xác định bằng `reps === 0`.
- Ngưỡng (`REQUEST_RETENTION`, `MASTERED_STABILITY_DAYS = 21`, `LEECH_LAPSES = 3`, `DAILY_REVIEW_LIMITS`) là hằng số xuất ra từ `srs.ts`.
- Nhãn khoảng: dưới 1 giờ → phút (tối thiểu 1), dưới 1 ngày → giờ, dưới 30 ngày → ngày, dưới 365 ngày → tháng (30 ngày), còn lại năm.
