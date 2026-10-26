# Dịch vụ chấm phát âm (`speech`)

Dịch vụ Python chạy nội bộ: nhận bản ghi, so với nội dung mong đợi, trả điểm theo từng âm tiết. Theo D11, dịch vụ tự chạy trên server, không gọi dịch vụ trả phí, độ chính xác vừa phải là đủ.

**Vì sao không dùng Ollama:** Ollama chỉ chạy model văn bản, không nhận audio. Vì vậy dùng hai công cụ mã nguồn mở chuyên cho âm thanh:
- **faster-whisper** để nhận dạng nói đúng âm/chữ hay không.
- **Parselmouth** (Praat) để dò cao độ giọng và đoán thanh điệu.

## 1. Nguyên tắc chấm

1. **Thà dễ dãi còn hơn chấm oan.** Người học không được kẹt vì máy sai (xem phần “Tuyệt đối tránh” trong README). Khi không chắc chắn thì cho đúng.
2. Chỉ so với **nội dung mong đợi**. Không chấm nói tự do.
3. Kết quả phải giải thích được ở mức âm tiết: âm đúng/sai, thanh mong đợi, thanh nghe được.

## 2. API

`POST /score` (multipart)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `audio` | file | webm/opus, mp4/aac, wav. Tối đa 1 MB |
| `expected_hanzi` | string | `你叫什么名字`. Với `syllable` có thể để trống |
| `expected_pinyin` | string | Pinyin số, cách nhau bởi dấu cách: `ni3 jiao4 shen2 me5 ming2 zi5`. Đây là thanh **viết**, dịch vụ tự áp dụng biến điệu |
| `mode` | `syllable` \| `word` \| `sentence` | |

Phản hồi `200`:

```json
{
  "status": "ok",                     // ok | no_speech | too_noisy | too_short | too_long
  "score": 78,                        // 0–100, null nếu status khác ok
  "syllables": [
    { "expected": "shen2", "expected_tone_spoken": 2,
      "heard_syllable": "shen", "content_ok": true,
      "tone_detected": 1, "tone_ok": false, "tone_confidence": 0.71,
      "contour": [0.2, 0.3, 0.2, 0.25, 0.3],   // 5 điểm, semitone đã chuẩn hóa, để vẽ
      "start": 0.62, "end": 0.84 }
  ],
  "transcript": "你叫什么名字",
  "timing_ms": 1450
}
```

- `503` khi hàng đợi đầy. Web hiện “Máy chấm đang bận, thử lại sau vài giây” và **không** tính là một lần thử.
- `GET /healthz`.

## 3. Các bước xử lý

1. **Giải mã:** dùng ffmpeg chuyển sang WAV 16 kHz mono.
   - Dưới 0,3 giây → `too_short`.
   - Trên 15 giây → `too_long`.
2. **Phát hiện tiếng nói:** cắt khoảng lặng hai đầu (dùng VAD, ví dụ Silero VAD, giấy phép MIT).
   - Không có tiếng nói → `no_speech`.
   - Tỷ lệ tín hiệu trên nhiễu quá thấp → `too_noisy`.
3. **Nhận dạng (bỏ qua với `mode = syllable`):**
   - faster-whisper, model `base` (mặc định, đổi được qua cấu hình), `compute_type=int8`, `language="zh"`, `word_timestamps=True`.
   - **Không** đưa nội dung mong đợi vào `initial_prompt`, vì sẽ làm model “đoán giúp” nhiều hơn.
   - Chuyển kết quả sang giản thể (OpenCC), bỏ dấu câu.
4. **So âm:**
   - Chuyển transcript sang pinyin không thanh bằng `pypinyin`.
   - Gióng hàng (Levenshtein) với pinyin mong đợi không thanh.
   - Âm tiết mong đợi được gióng với một âm tiết nghe được giống hệt thì `content_ok = true`. So bằng pinyin chứ không bằng chữ, nên đọc đúng âm mà máy ra chữ đồng âm vẫn được tính đúng.
   - **Nới lỏng:** coi là giống nhau các cặp người học hay bị máy nghe nhầm dù đọc gần đúng: `zh/z`, `ch/c`, `sh/s`, `n/l`, `in/ing`, `en/eng`. Ghi trong danh sách cấu hình. Gặp các cặp này thì `content_ok = true`, kèm cờ `near_miss` để giao diện nhắc nhẹ.
5. **Chia thời gian cho từng âm tiết:**
   - Dùng mốc thời gian từ Whisper. Một token có nhiều chữ thì chia đều theo số chữ.
   - Với `syllable`, hoặc khi Whisper không cho mốc thời gian dùng được: chia theo các đoạn có giọng (voiced) mà Parselmouth tìm được. Số đoạn khác số âm tiết thì chia đều khoảng có tiếng nói.
6. **Dò cao độ:** Parselmouth `to_pitch` (bước 10 ms).
   - Chạy 2 lượt: lượt 1 với khoảng 75–600 Hz để ước lượng giọng, lượt 2 với khoảng hẹp quanh trung vị.
   - Đổi sang **semitone so với trung vị cao độ của cả câu**, để giọng trầm hay giọng cao đều so được.
7. **Đoán thanh từng âm tiết:**
   - Lấy các khung có giọng ở 80% giữa của đoạn, làm mượt, lấy mẫu lại thành 5 điểm (`contour`).
   - Tính đặc trưng: độ cao trung bình, độ dốc đầu → cuối, vị trí điểm thấp nhất, biên độ.
   - Phân loại theo luật khởi điểm dưới đây. Ngưỡng đặt trong file cấu hình:
     - **Thanh 4:** đầu cao hơn cuối ≥ 3 st.
     - **Thanh 2:** cuối cao hơn đầu ≥ 2 st, điểm thấp nhất nằm ở nửa đầu.
     - **Thanh 3:** độ cao trung bình ≤ −2 st, hoặc có điểm lõm ở giữa sâu ≥ 1,5 st. Trong câu, thanh 3 thường chỉ xuống thấp mà không lên lại (“nửa thanh 3”), vẫn tính là thanh 3.
     - **Thanh 1:** chênh đầu–cuối < 2 st và độ cao trung bình ≥ −1 st.
     - Không khớp luật nào thì chọn thanh có dạng mẫu gần nhất, với `tone_confidence` thấp.
   - **Với `syllable`:** không có “trung vị cả câu”, nên thanh 1 xét theo độ phẳng thay vì độ cao.
8. **Thanh mong đợi:**
   - Áp dụng `applyToneSandhi` lên thanh viết ([lesson-player §6](../06-lesson/lesson-player.md)). Có bản Python tương đương, và **cùng bộ test case** với bản TypeScript.
   - **Thanh nhẹ (5) không chấm.**
9. **Kết luận thanh:**
   - `tone_ok = true` nếu thanh đoán được trùng thanh mong đợi, **hoặc** `tone_confidence < 0.5` (không chắc thì cho đúng).
   - Đoạn không đủ khung có giọng thì `tone_ok = null` (không chấm).

## 4. Tính điểm

- **Mỗi âm tiết:**
  - `content` = 1 nếu `content_ok`, ngược lại 0.
  - `tone` = 1 nếu `tone_ok` true, 0 nếu false. Nếu null thì không tính phần thanh.
  - Điểm âm tiết = 50 × content + 50 × tone (không tính thanh thì 100 × content).
  - Âm tiết sai âm (`content_ok = false`) thì tone = 0.
- **Điểm câu** = trung bình điểm các âm tiết, làm tròn.
- **`mode = syllable`:** điểm = 100 × tone, nếu có giọng nói rõ ràng.
- Ngưỡng đạt (60) do web quyết định ([speaking-ui §3](speaking-ui.md)), không nằm trong dịch vụ.

## 5. Vận hành

- Nạp model một lần lúc khởi động.
- Xử lý song song tối đa `N = số CPU / 2` yêu cầu. Hàng đợi tối đa 20, quá thì trả `503`.
- **Thời gian mục tiêu:** khoảng 3 giây cho câu 5 giây trên cấu hình tối thiểu ([architecture](../00-foundation/architecture.md)). Model mặc định `base`, đổi sang `small` qua biến môi trường nếu máy đủ mạnh.
- Cấu hình tối thiểu chỉ chấm được 1–2 câu cùng lúc. Đây là điều chấp nhận được ở giai đoạn đầu (D15).
- **Không ghi file âm thanh ra đĩa.** Có thể dùng file tạm trong `/dev/shm` khi ffmpeg cần, nhưng phải xóa ngay sau khi xử lý.
- Log chỉ ghi: thời gian xử lý, mode, status, điểm. **Không** ghi transcript kèm định danh người dùng.

## 6. Kiểm thử

Theo D14, **không** làm thử nghiệm đo độ chính xác với bản ghi người thật. Cách chấm làm đúng như mô tả ở trên, với các ngưỡng khởi điểm. Kiểm thử để bắt lỗi lập trình, không để đo độ chính xác:

- **Bộ kiểm thử bằng audio TTS**, sinh tự động, không cần người thu:
  - Mỗi thanh 1–4 trên khoảng 20 âm tiết, 2 giọng.
  - Khoảng 20 từ hai âm tiết có biến điệu.
  - Khoảng 10 câu.
- **Kỳ vọng:**
  - Audio TTS đúng nội dung phải đạt ≥ 60 điểm.
  - Audio TTS của một từ **khác** (sai âm) phải bị chấm `content_ok = false`.
  - Âm tiết ghép với thanh sai: ví dụ đề là `ma1` nhưng gửi audio `ma4`, phải ra `tone_ok = false` ở phần lớn trường hợp.
- Chạy bộ này trong CI mỗi khi đổi model hoặc ngưỡng.
- **Sau khi ra mắt:** người vận hành theo dõi báo lỗi loại “Chấm sai” ([13-profile](../13-profile/profile.md)) để nới ngưỡng. Ngưỡng nằm trong file cấu hình, không viết cứng trong code.
