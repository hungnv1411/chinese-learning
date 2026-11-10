# Quyết định phát sinh – 05 Lộ trình

## 05-1: `unlock.ts`
- `UnlockState.stages` và `finalExam` luôn có đủ 4 khóa `StageId`; lộ trình không có trong chương trình (ví dụ `hsk3` chưa nhập) là `locked` / `none`.
- **Bài chốt chủ đề** (bài mở chủ đề sau) là bài `checkpoint`; chủ đề không có bài ôn thì lấy bài cuối cùng.
- Chủ đề `exam_skip`: mọi chủ đề đã phát hành là `available`, mọi bài chưa xong là `available`; chủ đề chưa phát hành vẫn `coming_soon`.
- Bài có tiến độ `in_progress` mà quy tắc coi là khóa thì vẫn hiện `locked` (tiến độ không bị xóa, nhưng không mở bằng đường tắt). Bài `completed` luôn hiện `completed`.
- `finalExam.hsk*` = `available` khi lộ trình không khóa, `examOpen`, và **mọi** chủ đề đã phát hành và đạt bài chốt (chủ đề chưa phát hành chặn bài kiểm tra cuối).
- `skipExam` là lộ trình HSK đầu tiên đang `available`, chưa `completed`, `examOpen`; vì lộ trình sau chỉ mở khi lộ trình trước `completed` nên luôn tối đa một.
- `lockReason` trả `null` khi bài không khóa hoặc không tồn tại. Với `kind: 'stage'`, `stageId` là lộ trình **cần hoàn thành** (lộ trình đứng trước). Bài thường khóa → bài thường ngay trước nó; bài ôn khóa → bài thường đầu tiên chưa xong; chủ đề khóa → `checkpoint` của chủ đề trước, hoặc `coming_soon` nếu có chủ đề chưa phát hành đứng trước.

## 05-2: `/api/path` và `assertLessonOpen`
- `lib/path/load.ts`: `loadCurriculum` đọc stage/unit/lesson một lần rồi cache trong bộ nhớ theo `content_version` (không có phiên bản thì không cache); `loadProgressSnapshot` đọc `lesson_progress` và `stage_progress` (chỉ `status = 'completed'` có `completed_via`).
- `assertLessonOpen` (`lib/path/guard.ts`): không có bài → 404, bài `locked` → 403 `LESSON_LOCKED` (`errors.lessonLocked()`). Bài `in_progress` và `completed` cho qua. Chưa gắn vào API nào (06-1 và các API ghi tiến độ gọi nó).
- `GET /api/path` chỉ cho người đã đăng nhập (401 với khách). Khách dùng `GuestGateway.getPath()` ở client với cùng `computeUnlockState`; chưa làm (cần `GuestStore` có tiến độ bài, làm cùng 03/04).
- Dữ liệu hiển thị mỗi bài: `type`, `estimatedMinutes`, `newWordCount`, `skills` (suy từ các bước: `listen`, `read`, `write`, `speak`), `keyChar` (chữ đầu của `newChars`, chỉ trả khi bài đã xong), `lockReason`. Mỗi chủ đề: `sampleWords` (3 từ mới đầu tiên không trùng), `doneCount`/`total`. Mỗi lộ trình: `status`, `finalExam`; gốc: `skipExam`.

## 05-3: Tiến độ lộ trình (màn C)
- `stageProgress(sql, userId, stageId)` (`lib/path/progress.ts`): **tổng** từ/chữ của cấp lấy từ danh sách HSK (`hsk_word`/`hsk_char` theo `level` = n của `hsk n`, bỏ từ `deprecated`), không lấy theo các bài đã soạn, để % không nhảy lên 100% khi mới có vài chủ đề. Từ “đã thuộc” gộp thẻ của từ theo `masteryOfWord` (09 §6); chữ đã thuộc = chữ khác nhau của cấp này xuất hiện trong từ đã thuộc. Lộ trình `pron` trả `null` (không có từ HSK).
- `GET /api/path` thêm `progress` cho mỗi lộ trình: `words`, `chars` (hoặc `null`), `units: {done,total}` (chủ đề xong = mọi bài `completed`, có ít nhất 1 bài), `completedVia` (`exam_skip` → UI hiện “Hoàn thành (thi vượt)”), `requires` (lộ trình đứng trước, chỉ khi đang khóa → “Hoàn thành HSK 1 để mở”).
- Ô “Đã học ở nơi khác?” dùng `skipExam` có sẵn ở gốc; phần giao diện thuộc 05-4. Phiên bản cho khách (`GuestGateway.getPath()`) chưa có.

## 05-4: Màn hình con đường
- `PathView` (client) gọi `GET /api/path`; 401 (khách) hiện lời mời đăng nhập, **chưa có nút** vì `LoginSheet` chưa làm (03). Khách thật sự dùng `GuestGateway.getPath()` sau.
- Lộ trình mở đầu: lộ trình `available` đầu tiên, nếu không có thì lộ trình xong cuối cùng. Bài hiện tại: bài `in_progress` đầu tiên, nếu không thì bài `available` đầu tiên (chỉ trong chủ đề mở). `%` trên thanh trên = từ đã thuộc/tổng; `pron` (không có từ) dùng chủ đề xong/tổng; thi vượt = 100%.
- Độ lệch ngang nút bài lặp chu kỳ `[28, 0, -28, -8, 12]` theo chỉ số trong chủ đề (`nodeOffset`).
- Bài khóa: toast (không dùng popover khóa của design) theo `lockReason`, đúng plan. Nút ô chọn lộ trình chọn lộ trình để xem (design cũ của `pron` trỏ tới `pinyin.html`, bỏ).
- Chưa làm: nút “Bài kiểm tra pinyin” cho `pron` (module 10 định tuyến), hình chứng nhận chờ cuối lộ trình, trang đích `/bai/[id]` và `/kiem-tra/[stage]` (06, 12) nên liên kết hiện còn 404.
- `ToastProvider` chưa gắn ở layout gốc nên `PathView` tự bọc.
