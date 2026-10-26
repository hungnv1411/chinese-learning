# Plan thực hiện: 08b – Luyện nói (giao diện + API trên web)

Spec: [speaking-ui.md](speaking-ui.md). Dịch vụ chấm: [plan-speech-service.md](plan-speech-service.md). Quy ước chung: [00-foundation/plan.md](../00-foundation/plan.md).

## 1. Màn hình design

`speaking.html`:
- `target-sentence`: chữ Hán, pinyin tô màu (theo cài đặt), nghĩa, nút ▶ mẫu + đọc chậm.
- `#rec` (`record-area`): nút micro `.mic`, sóng âm `.wave`.
- `#res` (`speech-result`): điểm `.score`, nhãn Đạt/Chưa đạt, ô âm tiết `.syl`, so sánh đường thanh (`.contour`), nút ▶ Giọng mẫu / ▶ Giọng của bạn, Nói lại / Tiếp.
- `#blocked` (`mic-blocked`): “Cần bật micro để học tiếp”, hướng dẫn theo trình duyệt, Thử lại / Lưu & thoát.

## 2. Phụ thuộc

- 08a: `POST speech:8000/score`. 00: `rateLimit`, `ToneContour`, `useAudio`, `applyToneSandhi`.
- 09: `speakingFail(userId, dictEntryIds)`. 06: bước `speaking`. 12: phần Nói của bài kiểm tra.

## 3. Các bước

### Bước 1. API proxy `POST /api/speech/score`
- `getViewer`: người dùng 30 lần/phút/người dùng; khách 10 lần/phút/IP (`rateLimit`). Vượt → 429.
- Nhận multipart: `audio` (≤ 1 MB, chỉ `audio/*`), `itemRef`, `expectedHanzi`, `expectedPinyin`, `mode`, `context` (`lesson` | `checkpoint` | `exam` | `pinyin_test`, kèm id).
- `expectedPinyin` lấy **từ server** theo `itemRef` (không tin client), client gửi chỉ để đối chiếu.
- Chuyển tiếp sang `SPEECH_URL/score`, timeout 10 giây. `503` từ speech → trả `503 SPEECH_BUSY` (“Máy chấm đang bận, thử lại sau vài giây”), không tính lượt.
- Người dùng: ghi `speaking_attempt(user_id, item_ref, score, syllables, created_at)`. **Không lưu audio**.
- Test: khách lần thứ 11 trong 1 phút → 429; file 2 MB → 413; speech 503 → 503 với mã lỗi đúng; DB không có cột/bảng chứa audio.

### Bước 2. Thu âm — `useRecorder`
- `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })` + `MediaRecorder`. Chọn `mimeType` đầu tiên được hỗ trợ trong `['audio/webm;codecs=opus', 'audio/mp4', 'audio/aac']`. Gửi nguyên định dạng.
- Chế độ `hold` (mặc định): `pointerdown` bắt đầu, `pointerup`/`pointercancel` dừng và gửi. Chế độ `toggle` (cài đặt `record_mode`): bấm bắt đầu, bấm lần nữa dừng.
- Ngắn hơn 0,4 giây → bỏ, hiện “Giữ nút trong khi nói”. Tối đa 8 giây → tự dừng.
- Sóng âm từ `AnalyserNode` (`requestAnimationFrame`, tắt khi `prefers-reduced-motion` → thanh mức âm tĩnh).
- Bản ghi giữ trong bộ nhớ (`Blob` + object URL) tới khi chuyển câu, rồi `revokeObjectURL`.
- Không dùng Web Speech API.
- Test (mock MediaRecorder): giữ 0,3 giây → không gửi, có gợi ý; giữ 9 giây → tự dừng ở 8 giây; Safari giả lập chỉ hỗ trợ `audio/mp4` → chọn `audio/mp4`.

### Bước 3. Quyền micro (màn C)
- Xin quyền **lần đầu khi tới câu nói đầu tiên**. Trước đó hiện màn giải thích “Bạn sẽ đọc to để luyện phát âm. Bản ghi không được lưu lại.” với nút “Cho phép micro”.
- Bị từ chối / không có micro → `#blocked` với hướng dẫn theo trình duyệt (phát hiện Chrome Android, Safari iOS, desktop qua `navigator.userAgent`), nút **Thử lại** và **Lưu & thoát** (lưu bài ở đúng bước nói, 06). **Không** có nút bỏ qua.
- Test: `getUserMedia` ném `NotAllowedError` → hiện `#blocked`, không có nút nào chuyển sang bước tiếp.

### Bước 4. Logic lượt thử — `packages/core/src/speaking.ts`
`nextSpeakingState(state, result, { maxTries })`:
- `state = { tries: number; best: number | null; done: boolean; outcome?: 'passed' | 'failed' }`.
- `result.status !== 'ok'` (no_speech, too_noisy, too_short, too_long) hoặc lỗi mạng/timeout/503 → **không tính** lượt.
- `score ≥ 60` → `done, passed`.
- Bài học: sau 3 lượt chưa đạt → `done, failed` (nút Tiếp bật). Bài kiểm tra cuối: tối đa 2 lượt, lấy điểm cao nhất, xong sau lượt 2 dù điểm bao nhiêu. Bài ôn chủ đề: tối đa 2 lượt, lấy cao nhất.
- Test: [40, no_speech, 50, 55] với maxTries 3 → xong sau lượt tính thứ 3 (`failed`, best 55); [70] → `passed`; exam [50, 65] → best 65, xong.

### Bước 5. Màn kết quả
- Điểm 0–100 + nhãn Đạt/Chưa đạt (kèm biểu tượng ✓/✗).
- Ô âm tiết: xanh nếu `content_ok && tone_ok !== false`, đỏ nếu sai âm hoặc sai thanh; `near_miss` → nhắc nhẹ (“gần đúng: chú ý zh/z”).
- Âm tiết sai thanh: `ToneContour tone={expected_tone_spoken} userContour={contour}` (đường nét đứt), câu giải thích dạng “cần thanh 2 (đi lên), bạn đọc gần thanh 1 (ngang)” — mô tả 4 thanh lấy từ `vi.ts`; mẹo tiếng Việt nếu có (`content/pron/sounds.yaml`, 10).
- ▶ Giọng mẫu (audio R2), ▶ Giọng của bạn (bản ghi trên máy).
- Đang chấm: vòng xoay “Đang chấm…”; quá 10 giây → báo lỗi, cho thu lại, không tính lượt.
- Trạng thái không ok → “Không nghe rõ, hãy nói to hơn hoặc tìm chỗ yên tĩnh”.
- Test component: kết quả mẫu có `tone_ok = false` ở âm 2 → hiện contour so sánh cho đúng âm đó; nút Tiếp disabled khi chưa đạt và chưa hết lượt.

### Bước 6. Ghi ôn tập khi chưa đạt sau 3 lần (bài học)
- `speak_word`: gọi `speakingFail(userId, [dictEntryId])` → thẻ `listen` có rồi thì `due = now`, chưa có thì tạo với `source = speaking_fail`.
- `speak_sentence` / `speak_answer`: các từ HSK chứa âm tiết bị chấm sai (ánh xạ âm tiết → từ dựa trên tách từ của câu lưu lúc nhập nội dung).
- `speak_syllable`: không ghi.
- Bài vẫn tính hoàn thành.
- Khách: làm tương tự trên thẻ cục bộ.
- Test: câu 我很好 sai âm ở 好 → chỉ thẻ của 好 bị đặt `due = now`.

### Bước 7. `SpeakingStep` và tích hợp
- Component `SpeakingStep { item, context, maxTries, onDone(outcome, best) }`, dùng ở 06 (bước nói, bài ôn chủ đề), 10 (bài kiểm tra pinyin, `mode = syllable`), 12 (phần Nói).
- Test E2E (Playwright, micro giả bằng `--use-file-for-fake-audio-capture` với file TTS mẫu): thu âm → nhận điểm → Tiếp.
- Thử tay trên Safari iOS 16+ (mp4/AAC) và Chrome Android.

## 4. Xong module khi
- Test `nextSpeakingState`, `useRecorder`, API proxy xanh.
- Luồng thu → chấm → kết quả chạy trên iOS Safari và Chrome Android thật; từ chối micro không làm kẹt bài.
