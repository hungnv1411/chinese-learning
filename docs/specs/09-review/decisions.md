# Quyết định phát sinh – 09 Ôn tập

## 09-1: `srs.ts`
- Dùng `ts-fsrs` 6.0.0 qua API `fsrs()` / `createEmptyCard` (các kiểu `Card`, `RecordLogItem` đã đánh dấu deprecated nhưng vẫn chạy; API scheduler mới chưa cần). Bọc hết trong `packages/core/src/srs.ts`, phần còn lại của dự án chỉ thấy `SrsCard` thuần dữ liệu (camelCase, khớp cột `srs_card`).
- **Fuzz và seed:** `enable_fuzz = true`. ts-fsrs tự sinh seed từ (giờ ôn, `reps`, độ khó × stability), nên cùng thẻ + cùng `now` + cùng nút cho cùng lịch; không cần truyền seed vào. Test giữ tính ổn định này.
- **Cột thiếu `learning_steps`:** FSRS 6 cần số bước học hiện tại của thẻ (`learning_steps`) để chạy các bước 1 phút / 10 phút. Bảng `srs_card` (plan 00) chưa có cột này, nên `SrsCard.learningSteps` có mặt trong kiểu nhưng chưa lưu được. **Việc phải làm ở 09-2:** thêm cột `learning_steps smallint not null default 0` bằng migration, nếu không thẻ Again/Hard sẽ luôn quay về bước đầu.
- `masteryOfWord` trả `null` khi từ không còn thẻ nào đang bật (chưa có thẻ hoặc đều `suspended`), để nơi dùng phân biệt với `new`. Thẻ “mới” xác định bằng `reps === 0`.
- Ngưỡng (`REQUEST_RETENTION`, `MASTERED_STABILITY_DAYS = 21`, `LEECH_LAPSES = 3`, `DAILY_REVIEW_LIMITS`) là hằng số xuất ra từ `srs.ts`.
- Nhãn khoảng: dưới 1 giờ → phút (tối thiểu 1), dưới 1 ngày → giờ, dưới 30 ngày → ngày, dưới 365 ngày → tháng (30 ngày), còn lại năm.

## 09-2: `lib/srs/cards.ts`
- Migration `0004_*`: thêm `srs_card.learning_steps` (xem 09-1) và **sửa hai giá trị mặc định của `user_settings` cho khớp spec**: `review_buttons` 4 → 2 (spec 09 §3, 13 plan: mặc định 2 nút) và `review_card_types` `{recognize}` → `{recognize,listen}` (spec 09 §2). Schema cũ lệch spec; chưa có dữ liệu thật nên không cần vá hàng cũ.
- Hàm nhận `postgres.Sql` (cùng kiểu `lib/reports/create.ts`) và `now` từ ngoài; chưa nối API nào.
- **Lần ôn đầu khi tạo thẻ:** plan nói “lần ôn đầu dùng again thay good”, hiểu là thẻ tạo ra đã qua một lần ôn ngay lúc hoàn thành bài: từ làm đúng `good`, từ làm sai `again`; ghi cả `srs_review_log`. Thẻ từ điển (`addFromDictionary`) và thẻ `speaking_fail` thì chưa ôn lần nào (`reps = 0`, đến hạn ngay).
- **Thẻ `write` cho từ ≥ 3 chữ** dùng mục từ điển của từng chữ đơn (bỏ mục họ/biến thể, ưu tiên có cấp HSK); chữ không có mục thì bỏ qua. Vì `srs_card` bắt buộc `dict_entry_id`, nên thẻ này mang `hsk_word_id = null`.
- `speakingFail`: thẻ `listen` có sẵn và đang bật → `due = now`. Chưa có thẻ thì tạo mới **chỉ khi** người học còn bật kiểu `listen` (nếu đã tắt thì tôn trọng cài đặt, không tạo).
- `bumpDue` bỏ qua thẻ `suspended`.
- `addFromDictionary` đọc kiểu thẻ từ `user_settings.review_card_types`; chưa có hàng cài đặt thì dùng `DEFAULT_CARD_TYPES`. `already: true` khi không tạo thêm được thẻ nào.
- Chưa làm: bỏ qua chủ đề 1–7 của Phát âm và tạo thẻ `recognize` cho chủ đề 8 (spec nói nơi gọi quyết, làm cùng 06-8 / 10).
