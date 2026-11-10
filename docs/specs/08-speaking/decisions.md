# Quyết định phát sinh: 08-speaking

## 08a-1: `queue_max` tính cả yêu cầu đang chạy

Plan ghi “số yêu cầu đang chờ > `queue_max` → 503” và test “21 yêu cầu → thứ 21 nhận 503”. Hai câu chỉ khớp nếu `queue_max = 20` là tổng (đang chạy + đang chờ). Làm theo test: `ScoreQueue` từ chối khi tổng ≥ `queue_max`.
