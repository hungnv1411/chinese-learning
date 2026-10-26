# Plan thực hiện: 06 – Trình chạy bài học & các dạng bài tập

Spec: [lesson-player.md](lesson-player.md), [exercise-types.md](exercise-types.md). Quy ước chung: [00-foundation/plan.md](../00-foundation/plan.md).

## 1. Màn hình design

`lesson.html` → route `/bai/[lessonId]` (dùng `FocusLayout`, không có thanh tab):
- `focus-top`: nút ✕ (`dialog#exit`), `Progress`, số bước.
- `focus-body`: nội dung bước. Thẻ giới thiệu từ = `section[data-od-id=word-card]`.
- `focus-foot`: nút hành động (Tiếp / Kiểm tra / Tiếp tục), vùng phản hồi `.ok` / `.bad` có `verdict` và nút “Báo lỗi”.
- Màn tổng kết “Xong bài 2!”, `dialog#invite` (03), `dialog#reportdlg` (13).
- Bước viết dùng component của 07 (`writing.html`), bước nói dùng component của 08 (`speaking.html`).

## 2. Phụ thuộc

- 00: `FocusLayout`, `Sheet`, `AudioButton`, `useAudio`, `Hanzi`, `Pinyin`, `applyToneSandhi`.
- 02: `LessonContent`. 05: `assertLessonOpen`. 09: tạo thẻ, ghi ôn từ bài tập. 04: `useActiveTimer`.
- 07: `WritingStep`. 08: `SpeakingStep`. 10: `sound_intro`, `tone_contour_intro`, bài kiểm tra pinyin. 13: `ReportSheet`.

## 3. Cấu trúc

```
apps/web/lib/lesson/
  build.ts          buildLessonPayload(): mở rộng StepSpec → bước đã có đủ dữ liệu
  distractors.ts    chọn đáp án nhiễu
  autogen.ts        sinh bài tập `exercise_auto`
  checkpoint.ts     sinh bộ câu bài ôn chủ đề
  complete.ts       xử lý hoàn thành bài phía server
apps/web/components/lesson/
  LessonPlayer.tsx  khung + vòng đời
  player-reducer.ts máy trạng thái thuần (test được)
  steps/IntroCard.tsx, GrammarCard.tsx, Summary.tsx
  exercises/<Type>.tsx  mỗi dạng một file, cùng giao diện ExerciseProps
packages/core/src/completion.ts
```

## 4. Các bước

### Bước 1. Payload bài học — `buildLessonPayload(lessonId, viewer)`
- `GET /api/lessons/[id]` (người dùng: `assertLessonOpen`) và `GET /api/public/lessons/[id]` (khách, 03) cùng gọi hàm này.
- Trả `LessonPayload { lessonId, contentVersion, type, steps: Step[], audio: string[], strokes: string[] }`. Mỗi `Step` có `index` ổn định và dữ liệu đã giải sẵn: từ (chữ, pinyin số, Hán Việt từng chữ, nghĩa rút gọn từ `overrides/definitions.yaml` hoặc 1–3 nghĩa đầu CC-CEDICT, tách chữ + bộ thủ tiếng Việt, câu mẫu), câu, ngữ pháp, URL audio.
- Bài tập được **giải đầy đủ** (đề, 4 lựa chọn, đáp án) vì bài chạy ở client. (Bài kiểm tra cuối thì không, xem 12.)
- `audio` = danh sách URL để client tải trước khi bài mở (non-functional §2: mở bài < 1,5 giây).
- Test: payload của bài mẫu có đủ bước theo `steps`; thẻ intro của 你好 có dòng `spoken = ní hǎo` (từ `applyToneSandhi`), Hán Việt `nhĩ hảo`.

### Bước 2. Đáp án nhiễu — `distractors.ts`
`pickDistractors(target: WordRef, kind: 'hanzi' | 'meaning' | 'pinyin', ctx: { learned: WordRef[]; unitWords: WordRef[]; sameLevel: WordRef[] }, n = 3, rand): WordRef[]`
- Thứ tự ưu tiên: từ đã học dễ nhầm (cùng một chữ như 好吃/好看; pinyin gần nhau: cùng `pinyin_plain` khác thanh, hoặc khác một thanh mẫu trong cặp zh/z, ch/c, sh/s, n/l; chữ giống hình theo bảng nhỏ `content/overrides/lookalikes.yaml`: 人/入/八…) → đã học cùng chủ đề hoặc cùng từ loại → đã học khác → cùng cấp HSK chưa học.
- Loại đáp án nhiễu **trùng nghĩa** với đáp án đúng: chuẩn hóa nghĩa (chữ thường, bỏ `to `, `a `, `the `, bỏ ngoặc) rồi so tập nghĩa giao nhau.
- Test: 好吃 có 好看 trong lựa chọn khi đã học; hai từ cùng nghĩa “to look” không cùng xuất hiện; chưa học đủ 3 từ thì lấy từ cùng cấp; không bao giờ trả trùng đáp án đúng.

### Bước 3. Bài tập tự sinh — `autogen.ts`
`generateAutoExercises(count, ctx: { newWords; recentWeakWords; existing: ExerciseType[] }, rand): ExerciseSpec[]`
- Chọn từ: từ mới của bài trước, sau đó từ của 3 bài trước có độ nhớ thấp (stability thấp nhất từ SRS; khách đọc từ thẻ cục bộ).
- Không cùng một dạng quá 2 lần liên tiếp (tính cả bài tập khai báo tay đứng trước).
- Đảm bảo cả bài có ≥ 2 câu nghe và ≥ 2 câu đọc.
- `listen_dictation_pinyin` chỉ cho từ HSK ≥ 2. `pick_tone` không hỏi âm tiết thanh nhẹ.
- Test: 100 lần sinh ngẫu nhiên (seed khác nhau) đều thỏa ba ràng buộc trên.

### Bước 4. Các dạng bài tập (client)
Giao diện chung: `ExerciseProps { spec; onAnswer(result: { correct: boolean; answer: unknown; ms: number }) }`. Bố cục theo `.choices` / `.choice` (design), trạng thái chọn `aria-pressed`, đúng `.ok`, sai `.bad`, luôn kèm ✓/✗ + chữ (không chỉ dùng màu).

| Dạng | Ghi chú cách chấm |
|---|---|
| `listen_pick_hanzi`, `listen_pick_meaning`, `listen_pick_pinyin` | Không hiện chữ trước khi trả lời |
| `pick_tone` | Đáp án = thanh **đọc** (`applyToneSandhi`); đúng khi mọi âm tiết đúng; phản hồi hiện pinyin viết chuẩn + giải thích biến điệu |
| `listen_dictation_pinyin` | `normalizePinyinInput('Hao3 ')` → `hao3`; chấp nhận pinyin viết **hoặc** pinyin đọc; chấp nhận `v`/`u:` cho `ü` |
| `hanzi_to_meaning`, `meaning_to_hanzi`, `hanzi_to_pinyin`, `fill_blank`, `read_sentence` | Đúng/sai |
| `arrange` | Khớp **một trong** các thứ tự đúng đã khai báo |
| `match_pairs` | Đúng khi nối hết; mỗi lần nối nhầm ghi một lần sai |
| `write_char` | Component của 07, chế độ Tự viết, đạt khi điểm ≥ 60 |
| `speak` | Component của 08 |

Test mỗi dạng (Testing Library): chọn đúng → `onAnswer({ correct: true })`; `pick_tone` cho 你好 chọn 2,3 đúng, chọn 3,3 sai; `listen_dictation_pinyin` nhận `ni3hao3` và `ni2hao3` cho 你好 (từ HSK 2+ trong test mẫu); `arrange` chấp nhận thứ tự thay thế.

### Bước 5. Máy trạng thái trình chạy — `player-reducer.ts`
Trạng thái: `{ cursor; queue: StepRef[]; retryQueue: number[]; retried: Set<number>; results: Record<index, StepResult>; phase: 'step' | 'feedback' | 'summary' }`.
- Chạy theo thứ tự `steps`. Câu `exercise` sai → đưa vào `retryQueue` (mỗi câu tối đa 1 lần). Hàng hỏi lại chèn **ngay sau câu bài tập cuối cùng, trước phần nói**. Sai lần nữa → đi tiếp, ghi sai.
- Tổng số bước của thanh tiến độ = số bước + số câu đã đưa vào hàng hỏi lại.
- `writing` phải xong ở chế độ Tự viết mới đi tiếp. `speaking` đi tiếp khi đạt hoặc hết lượt (`nextSpeakingState`, 08).
- Test: 6 câu bài tập, sai câu 2 và 5 → thứ tự là 1..6, 2, 5, rồi phần nói; sai lại câu 2 → không hỏi lần ba; tổng bước tăng thêm 2.

### Bước 6. Lưu tiến độ, thoát, tiếp tục
- Sau mỗi bước: `POST /api/progress/step { lessonId, index, result, stepState, contentVersion, activeSeconds }`. Server lưu `current_step`, `step_state` (gồm `results`, `retryQueue`), cộng `daily_activity`. Ghi bất đồng bộ, có hàng đợi gửi lại khi mất mạng; giao diện không chờ.
- Bấm ✕ → `dialog#exit` “Tiến độ bài này sẽ được lưu” (không dùng `confirm()`).
- Mở lại bài: tiếp tục đúng `current_step` với `step_state`. Nếu `contentVersion` khác → bắt đầu lại từ đầu (những gì đã ghi vào SRS giữ nguyên).
- Test: lưu ở bước 5, tải lại trang → hiện bước 5 với hàng hỏi lại cũ; đổi `contentVersion` → bắt đầu từ bước 0.

### Bước 7. Bài tập ghi vào SRS
- Mỗi câu bài tập về một từ (bài thường, bài ôn chủ đề) gửi kèm `srs: { dictEntryId, cardType, rating }` theo ánh xạ: `listen_*` → `listen`, `hanzi_to_*` → `recognize`, `write_char` → `write`; đúng = `good`, sai = `again`.
- Server gọi `recordExerciseReview` (09): chỉ ghi nếu thẻ **đã có** và `due ≤ now + 24h`.
- Bài kiểm tra cuối **không** ghi.
- Test: thẻ đến hạn sau 2 ngày → không đổi; thẻ đến hạn sau 3 giờ → có log ôn.

### Bước 8. Hoàn thành bài
- `checkLessonCompletion(steps, stepState)` (core): đủ khi mọi `intro`/`grammar`/`sound_intro`/`tone_contour_intro` đã qua; mọi `writing` xong ở Tự viết; mọi `exercise` đã trả lời kể cả hàng hỏi lại; mọi `speaking` đạt hoặc đã hết lượt. Trả `missing` là danh sách index thiếu.
- `POST /api/progress/lesson-complete { lessonId }`: server đọc `step_state` **đã lưu** (không tin client), kiểm tra, rồi trong một transaction:
  1. `lesson_progress.completed`, `completed_at`, `best_score` = độ chính xác (lấy max khi học lại).
  2. Tạo thẻ SRS cho từ mới theo kiểu thẻ đang bật (`createCardsForLesson`, 09). Từ làm sai: lần ôn đầu dùng `again` thay `good`.
  3. Mở bài tiếp theo (tính lại `UnlockState`).
  4. `daily_activity.lessons_completed += 1`.
- Học lại bài đã xong: chỉ cập nhật `best_score`, không tạo lại thẻ.
- Khách: `GuestGateway.completeLesson` chạy cùng các bước trên dữ liệu cục bộ.
- Test (spec bắt buộc unit test điều kiện hoàn thành): thiếu một bước nói → `missing` có index đó và API trả 409; đủ → tạo đúng số thẻ (6 từ × 2 kiểu mặc định = 12); gọi 2 lần không tạo thẻ trùng.

### Bước 9. Thẻ giới thiệu, ngữ pháp, tổng kết
- **IntroCard:** chữ lớn tô màu thanh; pinyin dấu thanh; dòng “đọc là …” khi khác do biến điệu; Hán Việt từng chữ; nghĩa; audio tự phát một lần **từ thẻ thứ hai trở đi** (iOS), nút phát lại + đọc chậm; tách chữ; mẹo `tips`; câu mẫu có audio; nút “Báo lỗi”.
- **GrammarCard:** giải thích tiếng Việt (markdown), mẫu câu, 2–3 ví dụ có audio.
- **Summary:** số từ mới, độ chính xác, thời gian; danh sách từ, từ sai có nhãn “Sai 1 lần”; nút “Bài tiếp theo” và “Về trang Hôm nay”; khách → `trialPrompt` (03).
- Test: thẻ đầu tiên không tự phát audio, thẻ thứ hai có gọi `play`.

### Bước 10. Bài ôn chủ đề (checkpoint)
- `buildCheckpoint(unitId, viewer, rand)`: 15–20 câu từ toàn bộ từ và ngữ pháp của chủ đề; ≥ 3 nghe, 2 nói, 2 chữ tự viết, còn lại đọc; mỗi lần làm một bộ khác (seed theo lần thử).
- Chấm (`scoreCheckpoint`): mỗi câu nặng như nhau; câu nói đúng khi điểm ≥ 60, lấy lần cao nhất trong tối đa 2 lần thu (lượt “không nghe rõ” không đếm); chữ viết đúng khi ≥ 60. **Đạt ≥ 70%**.
- Không có hàng hỏi lại ở bài ôn. Chưa đạt → làm lại ngay, không giới hạn.
- Test: 14/20 → 70% đạt; 13/20 → chưa đạt, `lesson_progress` vẫn `in_progress`, `best_score` cập nhật; hai lần sinh liên tiếp khác bộ câu.

### Bước 11. Kiểm thử giao diện
- Playwright ở 360×800 và 390×844: chạy hết bài mẫu từ đầu đến tổng kết; bàn phím mở không che nút hành động; không cuộn ngang.
- Đo: từ lúc bấm “Bắt đầu” tới khi hiện bước đầu < 1,5 giây (trên dev, mạng 4G giả lập của Playwright).

## 5. Xong module khi
- Test `completion`, `distractors`, `autogen`, `player-reducer`, `scoreCheckpoint` xanh.
- Học hết một bài thường, một bài ôn chủ đề trên điện thoại (Safari iOS + Chrome Android thật).
