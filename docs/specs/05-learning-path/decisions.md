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
- Chưa có: tiến độ lộ trình theo số từ/chữ “đã thuộc” (05-3).
