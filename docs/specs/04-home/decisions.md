# Quyết định phát sinh: 04-home

## 04-3: thẻ chờ khi không còn gì mở

Plan ghi nhánh cuối `{ kind: 'waiting', reason, suggestReview }` nhưng chỉ có một lý do (`exam_cooldown`). Thêm `reason: 'nothing_open'` cho trường hợp không còn bài mở và không có `waiting` (ví dụ học hết phần đã phát hành). `waiting.until` được chuyển nguyên sang thẻ để màn hình hiện giờ mở lại.

## 04-4: pool rỗng xử lý ở nơi gọi

`characterOfDay(seed, date, pool)` ném `RangeError` khi pool rỗng vì hàm thuần không biết “bài tiếp theo”. `getCharOfDay` (server) lấy chữ của bài đã `completed`, rỗng thì lấy chữ của `nextLessonId`, vẫn rỗng thì trả `null`. Pool được khử trùng và sắp xếp trong core nên kết quả không phụ thuộc thứ tự truy vấn. Pinyin/nghĩa lấy từ mục từ điển đơn chữ không phải họ/biến thể có `cedict_order` nhỏ nhất.
