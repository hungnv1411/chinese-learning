# Plan thực hiện: 09 – Ôn tập ngắt quãng (FSRS)

Spec: [review.md](review.md). Quy ước chung: [00-foundation/plan.md](../00-foundation/plan.md).

## 1. Màn hình design

`review.html`:
- Route `/on-tap`: `due-today` (số thẻ, thời gian ước tính, “Bắt đầu ôn”), `mastery` (Mức độ thuộc), `card-types` (Kiểu thẻ), nút “Luyện thêm các từ hay quên”.
- Route `/on-tap/phien` (`FocusLayout`): mặt trước / mặt sau thẻ, nút tự đánh giá (2 hoặc 4), “Xong phiên ôn tập!”.

## 2. Phụ thuộc

- 00: `ts-fsrs` qua `packages/core/src/srs.ts`. 07: `WritingQuiz` cho thẻ `write`. 11: trang từ trong lớp phủ.
- Cung cấp cho: 06 (`createCardsForLesson`, `recordExerciseReview`), 08 (`speakingFail`), 11 (`addFromDictionary`), 12 (`bumpDue`), 05/13 (mức “Đã thuộc”), 04 (số thẻ đến hạn).

## 3. Các bước

### Bước 1. Lõi SRS — `packages/core/src/srs.ts`
- Bọc `ts-fsrs` với tham số mặc định, `request_retention = 0.9`, `enable_fuzz = true` (fuzz dùng seed truyền vào để test ổn định).
- `newCard(now)`, `review(card, rating, now): { card, log }`, `previewIntervals(card, now, buttons: 2 | 4): { rating, label }[]` (nhãn tiếng Việt: “10 phút”, “3 ngày”, “2 tháng”).
- `dailyReviewLimit(goal)`: 5 → 50, 10 → 100, 20 → 200.
- `masteryOfWord(cards)`: gộp các thẻ không `suspended` của một từ, lấy trạng thái **yếu nhất**: chưa ôn lần nào → `new`; `lapses ≥ 3 && stability < 21` → `leech` (Hay quên); `stability < 21` → `learning`; còn lại `mastered`. Thứ tự yếu → mạnh: new < leech < learning < mastered.
- Test: `previewIntervals` 2 nút trả đúng 2 mục Again/Good; thẻ mới qua `good` có `due > now`; ba ca mức độ thuộc ở bảng spec §6, và ca từ có một thẻ `mastered` + một thẻ `learning` → `learning`.

### Bước 2. Tạo thẻ (hàm server dùng chung) — `lib/srs/cards.ts`
- `createCardsForLesson(userId, words: { dictEntryId; hskWordId; chars: string[]; wrong: boolean }[], enabledTypes, now)`:
  - Mỗi từ, mỗi kiểu đang bật. `write` chỉ cho từ 1–2 chữ; từ dài hơn → thẻ `write` cho **từng chữ** chưa có thẻ.
  - Từ làm sai: áp ngay một lần `review(again)` thay cho `good` ở lần ôn đầu (spec 06 §8).
  - `INSERT … ON CONFLICT DO NOTHING` theo `(user_id, dict_entry_id, card_type)`.
- `recordExerciseReview(userId, dictEntryId, cardType, rating, now)`: chỉ khi thẻ có và `due ≤ now + 24h`.
- `speakingFail(userId, dictEntryIds, now)`: thẻ `listen` có → `due = now`; chưa có → tạo `source = speaking_fail`.
- `addFromDictionary(userId, dictEntryId)`: tạo thẻ các kiểu đang bật, `source = dictionary`. Đã có → trả `{ already: true }`.
- `bumpDue(userId, dictEntryIds, now)`: đặt `due = now` cho thẻ **đã có**, không tạo mới (12).
- Chủ đề 1–7 của Phát âm không tạo thẻ; chủ đề 8 tạo thẻ `recognize` cho chữ đã học (10).
- Test: từ 3 chữ với `write` bật → 3 thẻ `write` theo chữ; gọi 2 lần không trùng; `recordExerciseReview` ngoài 24 giờ không ghi.

### Bước 3. Phiên ôn — `lib/srs/session.ts`
- `buildSession(userId, now, { limitToday, practiceLeeches = false })`:
  - Đếm số thẻ đã ôn hôm nay (theo `srs_review_log` + ngày theo `tz`). Còn lại = `dailyReviewLimit(goal) − đã ôn`.
  - Lấy thẻ đến hạn, không `suspended`, sắp `due` tăng dần, tối đa `min(20, còn lại)`.
  - Trộn nhẹ: không để hai thẻ cùng `dict_entry_id` đứng liền nhau (đổi chỗ với thẻ kế tiếp khác từ).
- Phiên “Luyện thêm các từ hay quên”: 20 thẻ có `lapses` cao nhất; trả lời **không** cập nhật lịch FSRS, không ghi log.
- Trả lời `again` trong phiên → thẻ quay lại cuối phiên (theo bước learning của FSRS, client chèn lại khi `due` mới ≤ hết phiên).
- Hết 20 thẻ → “Ôn tiếp 20 thẻ nữa?”.
- Test: 30 thẻ đến hạn, giới hạn 100 → phiên 20 thẻ; đã ôn 95 hôm nay → phiên 5 thẻ; không có hai thẻ cùng từ liền nhau trong 200 phiên ngẫu nhiên; phiên luyện từ hay quên không đổi `due`.

### Bước 4. API
- `GET /api/review/summary`: `{ dueToday, estMinutes (6 giây/thẻ), mastery: { new, learning, leech, mastered }, cardTypes: { recognize, listen, write }, nextDueAt }`.
- `POST /api/review/session { mode: 'due' | 'leeches' }` → danh sách thẻ đã giải sẵn (chữ, pinyin, Hán Việt, nghĩa, câu ví dụ, audio, `previewIntervals`).
- `POST /api/review/answer { cardId, rating, ms, activeSeconds }` → cập nhật thẻ + `srs_review_log`, `daily_activity.reviews_done += 1`. Thẻ `write` nhận `{ misses, usedHint }` thay cho `rating`; server tính `writingScore` → good/again.
- `PATCH /api/review/card-types { recognize, listen, write }`: tắt → `suspended = true`; bật → bỏ `suspended`, tạo thẻ còn thiếu cho mọi từ đã học. Lưu vào `user_settings.review_card_types`.
- Khách: `GuestGateway` chạy cùng logic trên thẻ cục bộ.
- Test: tắt `listen` rồi bật lại → các thẻ cũ giữ `stability`; thẻ `write` 2 lần sai → `good`.

### Bước 5. Màn hình
- `/on-tap` theo design; không có thẻ đến hạn → “Hôm nay bạn đã ôn xong” + thời điểm thẻ tiếp theo (`nextDueAt`).
- Thẻ: `recognize` mặt trước chữ Hán; `listen` mặt trước tự phát audio + nút phát lại; `write` mặt trước nghĩa + pinyin, viết bằng `WritingQuiz`, không có nút tự đánh giá.
- Lật bằng nút “Lật thẻ” hoặc chạm thẻ. Mặt sau: pinyin, Hán Việt, nghĩa, câu ví dụ, audio, link “xem chi tiết từ” mở trang từ (11) trong `Sheet` lớn, đóng lại về đúng thẻ; nút “Báo lỗi” (13).
- Nút đánh giá theo `review_buttons`: 2 nút Quên/Nhớ hoặc 4 nút Quên/Khó/Được/Dễ, mỗi nút ghi khoảng thời gian.
- Cuối phiên: số thẻ đã ôn, tỷ lệ nhớ, số thẻ còn đến hạn hôm nay.
- `useActiveTimer` bật trong phiên.
- Test Playwright 360×800: ôn hết 3 thẻ mẫu; mở lớp phủ chi tiết từ rồi đóng vẫn ở thẻ cũ.

## 4. Xong module khi
- Test `srs.ts`, `cards.ts`, `session.ts` xanh (spec yêu cầu unit test xếp lịch SRS).
- Phiên ôn chạy cho khách và người dùng, đúng giới hạn ngày.
