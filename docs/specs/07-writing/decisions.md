# Quyết định phát sinh – 07 Luyện viết

## 07-1: `writingScore`
- `packages/core/src/scoring.ts` hiện chỉ có phần viết: `WRITING_PASS = 60`, `WRITING_HINT_CAP = 50`, `writingScore`, `isWritingPass`, `writingRating` (đạt = `good`, không đạt = `again`). Các hằng số khác của file (`SPEAKING_PASS`, `CHECKPOINT_PASS`, `EXAM_*`) thêm ở bước của module 08 và 12.
- `misses` không phải số nguyên ≥ 0 thì ném `RangeError` thay vì tự sửa thành 0 (tránh cho điểm tối đa vì dữ liệu hỏng). Nơi gọi trên server phải bắt lỗi này khi nhận `{ misses, usedHint }` từ client.
- Vì trần khi dùng gợi ý (50) thấp hơn ngưỡng đạt (60), chữ viết có dùng gợi ý không bao giờ đạt; có test riêng.
