# Plan thực hiện: 08a – Dịch vụ chấm phát âm (`services/speech`)

Spec: [speech-service.md](speech-service.md). Quy ước chung: [00-foundation/plan.md](../00-foundation/plan.md). Giao diện nói: [plan-speaking-ui.md](plan-speaking-ui.md).

Python 3.11+, FastAPI, faster-whisper, Parselmouth, pypinyin, OpenCC, Silero VAD, ffmpeg. Giấy phép GPL-3.0. Chỉ chạy trong mạng nội bộ Docker.

## 1. Cấu trúc

```
/services/speech
  pyproject.toml
  config/scoring.yaml      mọi ngưỡng (không viết cứng trong code)
  app/main.py              FastAPI: POST /score, GET /healthz
  app/queue.py             giới hạn song song + hàng đợi
  app/decode.py            ffmpeg → WAV 16 kHz mono (trong /dev/shm)
  app/vad.py               Silero VAD, SNR
  app/asr.py               faster-whisper
  app/align.py             gióng hàng pinyin + nới lỏng
  app/segment.py           chia thời gian theo âm tiết
  app/pitch.py             Parselmouth 2 lượt, semitone
  app/tone.py              đặc trưng + phân loại thanh
  app/sandhi.py            bản Python của applyToneSandhi
  app/score.py             tính điểm
  tests/                   unit test + bộ hồi quy TTS
  tools/make_tts_corpus.py sinh bộ audio kiểm thử
  Dockerfile
```

`config/scoring.yaml` (giá trị khởi điểm từ spec):
```yaml
model: base            # đổi qua env WHISPER_MODEL
compute_type: int8
min_duration_s: 0.3
max_duration_s: 15
max_upload_bytes: 1048576
min_snr_db: 10
near_miss_pairs: [[zh, z], [ch, c], [sh, s], [n, l], [in, ing], [en, eng]]
tone:
  t4_drop_st: 3.0
  t2_rise_st: 2.0
  t3_mean_max_st: -2.0
  t3_dip_st: 1.5
  t1_flat_max_st: 2.0
  t1_mean_min_st: -1.0
  confidence_accept_below: 0.5
  min_voiced_frames: 5
concurrency: auto      # số CPU / 2
queue_max: 20
```

## 2. Các bước

### Bước 1. Khung + API + hàng đợi
- `POST /score` multipart: `audio`, `expected_hanzi`, `expected_pinyin`, `mode`. `GET /healthz` (model đã nạp chưa).
- Model nạp một lần lúc khởi động.
- `queue.py`: `asyncio.Semaphore(N)` với `N = max(1, cpu // 2)`; số yêu cầu đang chờ > `queue_max` → `503`.
- Upload > 1 MB → 413.
- Log một dòng JSON: `timing_ms, mode, status, score`. **Không** ghi transcript, không ghi định danh người dùng.
- Test: 21 yêu cầu giả (xử lý bị chặn) → yêu cầu thứ 21 nhận 503; log không có trường `transcript`.

### Bước 2. Giải mã và phát hiện tiếng nói
- ffmpeg qua pipe (stdin → stdout) để không ghi đĩa; khi định dạng cần seek (mp4 từ Safari) thì dùng file tạm trong `/dev/shm` và xóa trong `finally`.
- `< 0.3 s` → `too_short`; `> 15 s` → `too_long`.
- Silero VAD cắt lặng hai đầu; không có đoạn tiếng nói → `no_speech`; SNR < `min_snr_db` → `too_noisy`.
- Test: file webm/opus, mp4/aac, wav mẫu đều giải mã được; file 0,2 giây → `too_short`; file im lặng → `no_speech`; nhiễu trắng → `too_noisy`; sau mỗi yêu cầu `/dev/shm` không còn file tạm.

### Bước 3. Biến điệu (Python)
- `apply_tone_sandhi(syllables, word_lengths=None, ordinal_indexes=None) -> list[int]`, cùng thuật toán với 00 §10 bước 6.
- Test đọc `packages/core/fixtures/tone-sandhi.json`, kết quả phải giống hệt bản TS.

### Bước 4. Nhận dạng và so âm (bỏ qua với `mode = syllable`)
- faster-whisper: `language="zh"`, `word_timestamps=True`, `compute_type` từ cấu hình, **không** truyền `initial_prompt`.
- Kết quả → giản thể (OpenCC `t2s`) → bỏ dấu câu → pinyin không thanh (`pypinyin`, style `NORMAL`).
- `align(expected: list[str], heard: list[str]) -> list[AlignedSyllable]`: Levenshtein theo âm tiết. Giống hệt → `content_ok = True`. Khác nhưng thuộc `near_miss_pairs` (so thanh mẫu và vận mẫu) → `content_ok = True, near_miss = True`.
- Test: `ni hao` vs `ni hao` → cả hai đúng; `shi` vs `si` → đúng + `near_miss`; `ma` vs `ba` → sai; thiếu một âm tiết giữa câu → âm tiết đó sai, các âm còn lại vẫn gióng đúng; chữ đồng âm khác chữ vẫn đúng (so bằng pinyin).

### Bước 5. Chia thời gian theo âm tiết
- Dùng mốc từ của Whisper; một token nhiều chữ → chia đều theo số chữ.
- `syllable` hoặc mốc không dùng được: lấy các đoạn có giọng từ Parselmouth; số đoạn ≠ số âm tiết → chia đều khoảng có tiếng nói.
- Test: token 2 chữ dài 0,6 s → hai đoạn 0,3 s; 3 đoạn voiced cho 2 âm tiết → chia đều.

### Bước 6. Dò cao độ và đoán thanh
- `pitch.py`: `to_pitch(time_step=0.01)` lượt 1 với 75–600 Hz, lượt 2 với khoảng hẹp quanh trung vị (ví dụ 0,6× → 1,8× trung vị). Đổi sang semitone so với trung vị của cả câu.
- `tone.py`: lấy khung có giọng ở 80% giữa đoạn, làm mượt, lấy mẫu lại 5 điểm (`contour`). Đặc trưng: trung bình, đầu−cuối, vị trí điểm thấp nhất, độ lõm giữa. Luật theo thứ tự 4 → 2 → 3 → 1 với ngưỡng cấu hình; không khớp → thanh có mẫu gần nhất (khoảng cách tới 4 mẫu chuẩn 55/35/214/51), `tone_confidence` thấp. `syllable`: thanh 1 xét theo độ phẳng, không xét độ cao.
- Không đủ `min_voiced_frames` → `tone_ok = None`.
- **Test bằng tín hiệu tổng hợp** (tạo sóng có cao độ theo đường cong, không cần TTS): ngang → 1; đi lên 3 st → 2; xuống rồi lên → 3; rơi 5 st → 4; đoạn quá ngắn → `None`. Đổi giọng nền 120 Hz vs 250 Hz cho cùng kết quả.

### Bước 7. Kết luận và tính điểm
- Thanh mong đợi = `apply_tone_sandhi(thanh viết)`. Thanh 5 không chấm.
- `tone_ok = True` nếu trùng **hoặc** `tone_confidence < 0.5`.
- Điểm âm tiết: `50 × content + 50 × tone`; không chấm thanh → `100 × content`; sai âm → tone = 0. Điểm câu = trung bình, làm tròn. `syllable`: `100 × tone`.
- Phản hồi đúng định dạng JSON của spec §2 (`status, score, syllables[], transcript, timing_ms`).
- Test: bảng các ca tính điểm (đúng hết → 100; sai thanh 1/4 âm tiết → 88; sai âm 1 âm tiết → 75; `tone_ok = None` ở 1 âm → âm đó tính 100 × content); `ni3 hao3` mong đợi, nghe thanh 2 ở `ni` → đúng (sau biến điệu).

### Bước 8. Bộ hồi quy TTS (D14)
- `tools/make_tts_corpus.py` (dùng `TtsProvider` của 01): ~20 âm tiết × 4 thanh × 2 giọng; ~20 từ hai âm tiết có biến điệu; ~10 câu. Lưu vào R2 `test-corpus/` (không commit file lớn), có `manifest.json`.
- `tests/test_regression.py` (đánh dấu `@pytest.mark.corpus`, CI tải corpus):
  - Audio đúng nội dung → điểm ≥ 60 ở mọi mẫu.
  - Audio của từ khác → `content_ok = False`.
  - Đề `ma1`, audio `ma4` → `tone_ok = False` ở ≥ 70% cặp ghép thanh sai.
- Chạy trong CI khi đổi `config/scoring.yaml`, model, hoặc mã trong `app/`.

### Bước 9. Hiệu năng và triển khai
- Dockerfile: ffmpeg, model `base` tải sẵn trong image.
- Đo trên máy 2 vCPU / 4 GB: câu 5 giây ~3 giây. Ghi số đo vào `services/speech/BENCHMARK.md`.
- Compose (00): không mở cổng ra ngoài, chỉ `web` gọi được.

## 3. Xong module khi
- Unit test + bộ hồi quy TTS xanh.
- Biến điệu Python khớp fixture TS.
- Đã đo thời gian xử lý trên cấu hình tối thiểu.
