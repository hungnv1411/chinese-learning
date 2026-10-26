# Plan thực hiện: 03 – Tài khoản, học thử, chuyển tiến độ khách

Spec: [auth.md](auth.md). Quy ước chung: [00-foundation/plan.md](../00-foundation/plan.md).

Đăng nhập Google cơ bản (Better Auth, phiên 30 ngày, bearer token) **đã làm ở 00 §10 bước 5**. Module này làm phần còn lại.

## 1. Màn hình design

| Design | Dùng cho |
|---|---|
| `onboarding.html` → `dialog#login` (“Đăng nhập để học tiếp”, chữ 存) | Màn hình hết học thử (không có “Để sau”), và khi chọn “Tôi đã học HSK 1” |
| `lesson.html` → `dialog#invite` (“Lưu lại tiến độ của bạn”) | Lời mời sau bài 1 và bài 2 |
| `profile.html` → khối Tài khoản, `dialog#delete` | Đăng xuất, xóa tài khoản (thêm ô gõ xác nhận, xem 00 §3 #7) |

## 2. Phụ thuộc

- 00: `GuestStore`, `GuestGateway`, `getViewer`, `rateLimit`.
- 05: `computeUnlockState` (chạy lại khi chuyển tiến độ khách).
- 06, 09, 04: định dạng `lesson_progress`, thẻ SRS, `daily_activity` của khách.
- Cung cấp cho: 06 (lời mời ở màn hình tổng kết), 05 (chặn bài thứ 4), 13 (đăng xuất, xóa tài khoản).

## 3. Các bước

### Bước 1. `GuestProgressV1` — `packages/core/src/guest.ts`
```ts
interface GuestProgressV1 {
  v: 1;
  start: 'zero' | 'pinyin' | null;
  settings: Partial<UserSettings>;          // gồm dailyGoalMinutes
  pinyinTest: { passed: boolean; at: string } | null;
  lessons: Record<string, { status: 'in_progress' | 'completed'; currentStep: number; stepState: unknown; bestScore: number | null; contentVersion: string; completedAt?: string }>;
  cards: GuestCard[];                        // trạng thái FSRS + dictEntryId + cardType
  reviewLog: { cardKey: string; rating: Rating; at: string; ms: number }[];
  daily: Record<string /* YYYY-MM-DD */, { minutes: number; lessonsCompleted: number; reviewsDone: number }>;
}
```
- `GuestProgressV1Schema` (zod) **chặt**: sai kiểu ở một mục thì bỏ mục đó, không bỏ cả gói (parse từng phần tử).
- Test: dữ liệu hợp lệ parse đúng; một bài có `status: 'hacked'` bị bỏ, các bài khác giữ.

### Bước 2. Tập bài học thử và giới hạn
- **Tập học thử** (`trialLessonIds(curriculum)`): 3 bài thường đầu tiên (theo thứ tự) của `pron` và 3 bài thường đầu tiên của `hsk1`. Khách không mở được bài ôn chủ đề.
- `GUEST_LESSON_LIMIT = 3`: khách được **hoàn thành tối đa 3 bài thường**.
- `trialPrompt(completedNormal)`: `1 → 'invite'`, `2 → 'invite_last'` (kèm “Còn 1 bài học thử”), `≥ 3` khi bấm bài mới → `'blocked'`, còn lại `null`.
- API công khai `GET /api/public/lessons/[id]`: chỉ trả bài thuộc tập học thử, ngoài ra 403 `NOT_IN_TRIAL`.
- Test: `trialLessonIds` với chương trình mẫu ra đúng 6 id; API trả 403 cho bài thứ 4 và cho bài ôn chủ đề.

### Bước 3. Lời mời và màn hình chặn
- `components/auth/LoginSheet` (dùng `Sheet`), nút “Tiếp tục với Google” gọi `signIn.social({ provider: 'google', callbackURL: <trang hiện tại> })`.
  - `variant='invite'`: có “Để sau”.
  - `variant='invite_last'`: thêm dòng “Còn 1 bài học thử”.
  - `variant='blocked'`: không có “Để sau”; có link về `/pinyin` và `/tra-tu`.
- Màn hình tổng kết bài (06) gọi `trialPrompt` sau bài thường của khách. Lộ trình (05) gọi khi khách bấm bài mới và đã đủ 3.
- Màn hình đầu tiên (04) có link “Đã có tài khoản? Đăng nhập”.
- Cảnh báo `GuestStore.persistent === false`: banner nhỏ “Tiến độ sẽ mất khi đóng trang” ở `/hom-nay` và màn hình tổng kết.
- Test component: ba biến thể hiện đúng nút; Playwright: khách học xong bài 1 thấy sheet có “Để sau”.

### Bước 4. Chuyển tiến độ khách — `mergeGuestProgress`
`mergeGuestProgress(account: AccountSnapshot, guest: GuestProgressV1, ctx: { curriculum: CurriculumIndex; trialIds: Set<string>; now: Date }): MergePlan`

`MergePlan` là danh sách thao tác ghi thuần dữ liệu (`upsertLessonProgress`, `insertCards`, `addDaily`, `setStageCompleted`, `setSettings`), server áp dụng trong **một transaction**.

Quy tắc (auth §5):
1. **Lọc:** chỉ giữ bài thuộc `trialIds` và qua được kiểm tra thứ tự: chạy `computeUnlockState` dần trên dữ liệu khách, bài nào lúc đó không `available/in_progress/completed` thì bỏ. Tối đa 3 bài `completed`.
2. `pinyinTest.passed` → `setStageCompleted('pron', 'exam_skip')`, **không** kiểm tra lại.
3. Tài khoản **chưa có tiến độ**: nhận toàn bộ (kể cả `settings`).
4. Tài khoản **đã có tiến độ**:
   - Bài: lấy trạng thái tiến xa hơn (`completed` > `in_progress`; cùng `in_progress` thì `currentStep` lớn hơn); `bestScore` lấy max.
   - Thẻ: khóa `(dictEntryId, cardType)` đã có thì giữ của tài khoản, chưa có thì thêm. Thẻ khách cho từ không thuộc bài hợp lệ thì bỏ.
   - `daily`: cộng dồn theo ngày.
   - `settings`: giữ của tài khoản.
5. Không bao giờ tạo `certificate`, không đặt `completed` cho bài ngoài tập học thử.

API `POST /api/guest/merge` (`requireUser`): parse → merge → áp dụng → trả `{ merged: { lessons, cards, days } }`. Client xóa `guest_progress_v1` **chỉ sau** khi nhận 200. Gọi tự động một lần sau khi đăng nhập (cờ `merge_pending` trong `sessionStorage`).

Test (spec bắt buộc 3 ca, thêm ca biên):
- Tài khoản mới: nhận đủ 2 bài, 12 thẻ, cài đặt của khách.
- Tài khoản đã có tiến độ: bài khách `completed` + tài khoản `in_progress` → `completed`; thẻ trùng giữ bản tài khoản; ngày trùng cộng phút.
- Dữ liệu bị sửa tay: bài `hsk1-u05-l02` (ngoài tập thử) bị bỏ; 5 bài `completed` chỉ nhận 3 bài hợp lệ đầu; bài 3 `completed` khi bài 2 chưa xong bị bỏ.
- `pinyinTest.passed` → `stage_progress('pron') = completed, completed_via = exam_skip`.
- Gọi merge 2 lần với cùng dữ liệu → kết quả DB như gọi 1 lần.

### Bước 5. Đăng xuất
- `signOut()` rồi xóa `guest_progress_v1` và các cache cục bộ (TanStack Query, tra gần đây giữ lại vì không phải tiến độ).
- Test: sau đăng xuất `localStorage` không còn `guest_progress_v1`.

### Bước 6. Xóa tài khoản
- `dialog#delete` theo design + ô `.field` yêu cầu gõ đúng chuỗi `XÓA TÀI KHOẢN` mới bật nút.
- `POST /api/account/delete` (`requireUser`, body `{ confirm: 'XÓA TÀI KHOẢN' }`), trong một transaction:
  - Với mỗi `certificate` của user: `revoked = true`, xóa `name_on_certificate`, điểm, `user_id`, `pdf_url`; xóa `certificate_name_change` của chứng nhận đó.
  - Xóa `user` (dây chuyền xóa mọi dữ liệu người dùng, 00 bước 4) và `session`, `account`.
  - Sau commit: xóa `certificates/{code}.pdf` trên R2 (lỗi thì ghi log và thử lại bằng job dọn dẹp, không chặn).
- Test: sau khi xóa, không còn dòng nào có `user_id` đó ở mọi bảng người dùng; `certificate` còn `code, stage_id, issued_at, revoked = true` và các cột khác null; trang `/chung-nhan/{code}` hiện “Chứng nhận không còn hiệu lực” (test ở 12).

### Bước 7. E2E luồng chính (non-functional §8)
`e2e/main-flow.spec.ts`, viewport 390×844:
1. Khách mở `/`, chọn “Tôi chưa biết gì”, học xong bài đầu tiên.
2. Thấy lời mời, bấm “Tiếp tục với Google” (Google OAuth được giả lập bằng route test chỉ có ở `dev`/CI: `/api/test/login?email=…` tạo session).
3. Tiến độ khách được chuyển: lộ trình hiện bài 1 xong, bài 2 đang mở.
4. Học xong bài 2 (trên tài khoản).
5. Vào Ôn tập, ôn hết thẻ đến hạn (đặt `due` về quá khứ bằng route test).

Route test bị **tắt** khi `NODE_ENV=production` (test kiểm tra trả 404).

## 4. Xong module khi
- 5 ca merge xanh; E2E luồng chính xanh ở 390×844 và 360×800.
- Xóa tài khoản để lại đúng dữ liệu chứng nhận đã thu hồi.
