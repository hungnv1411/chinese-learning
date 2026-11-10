# Quyết định phát sinh: 08-speaking

## 08a-1: `queue_max` tính cả yêu cầu đang chạy

Plan ghi “số yêu cầu đang chờ > `queue_max` → 503” và test “21 yêu cầu → thứ 21 nhận 503”. Hai câu chỉ khớp nếu `queue_max = 20` là tổng (đang chạy + đang chờ). Làm theo test: `ScoreQueue` từ chối khi tổng ≥ `queue_max`.

## 08a-2: VAD theo năng lượng thay vì Silero; file hỏng trả 422

- Spec ghi “ví dụ Silero VAD”. Silero kéo theo torch/onnxruntime (image nặng, mạng chậm) mà bước này chỉ cần cắt lặng và loại file im lặng/nhiễu. Dùng VAD theo năng lượng (khung 20 ms, sàn tuyệt đối −45 dBFS, SNR = phân vị 90 − phân vị 10, ngưỡng `min_snr_db`). Nếu 08a-4 đo thấy cắt sai thì đổi sang Silero.
- Hạn chế đã biết: một đoạn nói liên tục không có khoảng lặng nào có thể bị xếp `too_noisy`.
- File ffmpeg không giải mã được không thuộc 5 trạng thái của spec: trả `422 BAD_AUDIO`, web coi như lỗi thu âm.
- `py-speech` (compose dev) build từ `services/speech/Dockerfile.dev` để có ffmpeg.
