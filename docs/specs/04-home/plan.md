# Plan thực hiện: 04 – Màn hình đầu tiên & Hôm nay

Spec: [home.md](home.md). Quy ước chung: [00-foundation/plan.md](../00-foundation/plan.md).

## 1. Màn hình design

| Design | Route | Khối (`data-od-id`) |
|---|---|---|
| `onboarding.html` | `/` | `onboarding-hero`, `onboarding-form` (“Bạn đang ở đâu?”, “Mỗi ngày bạn rảnh khoảng”) |
| `today.html` | `/hom-nay` | lời chào + chip chuỗi, `daily-goal`, `continue-lesson` (thẻ chính), `character-of-day`, `streak-card`, `week-chart`, rail “HSK 1 · Sinh tồn” |

## 2. Phụ thuộc

- 05: `computeUnlockState` (bài tiếp theo, trạng thái chờ thi lại).
- 06: bài đang dở (`lesson_progress.in_progress`).
- 09: số thẻ đến hạn, `dailyReviewLimit`.
- 11: dữ liệu chữ (`hanzi`, `radical_vi`) cho “Chữ của ngày”.
- Cung cấp cho: 06, 09, 10, 12 (`useActiveTimer`, ghi `daily_activity`).

## 3. Các bước

### Bước 1. Chuỗi ngày học — `packages/core/src/streak.ts`
- `isActiveDay(d)`: `d.lessonsCompleted >= 1 || d.reviewsDone >= 10`.
- `computeStreak(days, today): { current: number; activeToday: boolean; freezeDates: string[] }`:
  - Duyệt lùi từ **hôm qua** (hôm nay chưa học thì chưa mất chuỗi; hôm nay học rồi thì cộng thêm 1).
  - Ngày có học: `current += 1`.
  - Ngày không học: nếu tuần ISO (thứ Hai–Chủ Nhật) của ngày đó **chưa** dùng ngày nghỉ → đánh dấu `freezeDates`, không cộng, đi tiếp. Đã dùng → dừng.
  - Ngày nghỉ tự động không tính vào số ngày của chuỗi.
- Ngày dạng `YYYY-MM-DD` theo múi giờ trình duyệt (client gửi `tz`, server tính ngày bằng `Intl`; mặc định `Asia/Ho_Chi_Minh`).
- Test:
  - Học 5 ngày liền tới hôm qua, hôm nay chưa học → 5, `activeToday = false`.
  - Hôm nay ôn 10 thẻ → tính là ngày học; ôn 9 thẻ → không.
  - Nghỉ 1 ngày giữa tuần → chuỗi giữ, `freezeDates` có ngày đó.
  - Nghỉ 2 ngày trong cùng một tuần → chuỗi dừng ở ngày nghỉ thứ hai.
  - Nghỉ Chủ Nhật và thứ Hai liền nhau (hai tuần khác nhau) → chuỗi giữ.
- Mất chuỗi: chip hiện “Bắt đầu chuỗi mới hôm nay”, không có thông báo nào khác.

### Bước 2. Thời gian học — `useActiveTimer`
- `useActiveTimer({ active: boolean })` ở `lib/activity/`: đếm giây khi `active` **và** có thao tác (`pointerdown`, `keydown`, phát audio) trong 60 giây gần nhất; tab ẩn thì dừng.
- Bật ở: trình chạy bài, phiên ôn, luyện nghe thanh, bài kiểm tra.
- Gửi số phút kèm `POST /api/progress/step` (06) và `POST /api/review/answer` (09); thêm `POST /api/activity` cho luyện nghe thanh. Server cộng vào `daily_activity.minutes` (làm tròn theo giây tích lũy, lưu giây ở cột `seconds`, hiển thị phút).
- Test (fake timers): 30 giây có thao tác → 30; 90 giây không thao tác → chỉ đếm 60 giây đầu; ẩn tab → dừng.

### Bước 3. Thẻ chính — `packages/core/src/today.ts`
`pickMainCard(input): MainCard`, với `input = { inProgress?: LessonRef; dueCount: number; dailyLimit: number; nextLesson?: LessonRef; waiting?: { kind: 'exam_cooldown'; until: string } }`:
1. Có `inProgress` → `{ kind: 'continue', lesson }` (mở đúng bước dở).
2. `dueCount > dailyLimit × 1.5` → `{ kind: 'review' }`.
3. Có `nextLesson` → `{ kind: 'next', lesson }`.
4. Còn lại → `{ kind: 'waiting', reason, suggestReview: dueCount > 0 }`.

Test cho từng nhánh, và ca biên `dueCount = 150, dailyLimit = 100` → `next` (không lớn hơn), `151` → `review`.

### Bước 4. Chữ của ngày
- `characterOfDay(seed, date, pool)`: chọn `pool[hash(seed + date) % pool.length]` (hash FNV-1a). `seed` = `userId`, khách dùng một id ngẫu nhiên lưu trong `guest_progress_v1`.
- `pool` = chữ đã học (từ các bài `completed`); rỗng thì lấy chữ của bài tiếp theo.
- Hiện chữ, pinyin, Hán Việt, nghĩa, tách bộ thủ (dữ liệu từ `hanzi` + `radical_vi`). Bấm vào mở `/chu/{char}`.
- Test: cùng seed + ngày → cùng chữ; ngày khác → (thường) khác; pool rỗng → chữ của bài tiếp theo.

### Bước 5. API `GET /api/today?tz=…`
Trả `{ greeting, streak, goal: { minutesToday, target }, main: MainCard, review: { due, estMinutes } | null, charOfDay, week: { date, minutes }[7], currentStage: { id, title, pct } }`.
- Ước tính ôn: `due × 6 giây`, làm tròn lên phút (09 §5).
- Khách: `GuestGateway.getToday()` tính cùng dữ liệu tại chỗ bằng các hàm core.
- Test API với dữ liệu mẫu: trả đúng 7 ngày (có ngày 0 phút), `main.kind` khớp `pickMainCard`.

### Bước 6. Màn hình đầu tiên `/`
- Hiện khi **chưa đăng nhập và chưa có** `guest_progress_v1`. Có phiên → chuyển `/hom-nay`. Khách đã có dữ liệu → `/hom-nay`.
- Ba lựa chọn (radio dạng `.choice`), mục tiêu 5/10/20 (`.seg`, mặc định 10), nút bắt đầu:
  - “Tôi chưa biết gì” → tạo `guest_progress_v1` (`start: 'zero'`), mở bài đầu tiên của `pron`.
  - “Tôi đọc được pinyin” → mở bài kiểm tra pinyin (10). Đạt → `pinyinTest.passed`, mở HSK 1. Chưa đạt → `/lo-trinh` ở `pron` với toast “Bạn nên học lại phần phát âm trước”.
  - “Tôi đã học HSK 1” → `LoginSheet` (03), sau đăng nhập mở `/kiem-tra/hsk1?skip=1` (12). Đặt `pron` completed khi bắt đầu thi vượt (12 làm).
- Link “Đã có tài khoản? Đăng nhập”.
- Test Playwright: mỗi lựa chọn dẫn đúng nơi; mục tiêu chọn 20 được lưu vào cài đặt.

### Bước 7. Màn hình Hôm nay `/hom-nay`
- Dựng theo `today.html`, thứ tự khối đúng spec §2. Lời chào theo giờ (“Chào buổi sáng/chiều/tối”).
- Thanh mục tiêu dùng `Progress`; biểu đồ 7 ngày theo `.bars` của design (cột cao theo phút, nhãn thứ).
- Trạng thái: đang tải (khung xương theo kích thước khối), lỗi (thẻ báo lỗi + Thử lại), chưa có dữ liệu (chuỗi 0, biểu đồ rỗng).
- Không có thông báo đẩy hay email (spec §5).
- Test Playwright ở 360×800 và 1440×900: đủ khối, không cuộn ngang; ở ≥ 1100px rail bên phải như design.

## 4. Xong module khi
- Test `streak`, `pickMainCard`, `characterOfDay`, `useActiveTimer` xanh.
- `/` và `/hom-nay` khớp design và chạy cho cả khách lẫn người dùng.
