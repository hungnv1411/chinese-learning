# Cấu trúc lộ trình

## 1. Ba tầng

```
Lộ trình (stage)  →  Chủ đề (unit)  →  Bài (lesson)
Phát âm               8 chủ đề           3–4 bài + 1 bài ôn chủ đề
HSK 1                 ~15 chủ đề         4–6 bài + 1 bài ôn chủ đề
HSK 2                 ~22 chủ đề         như trên
HSK 3                 ~28 chủ đề         như trên
```

Số chủ đề chỉ là ước tính. Con số thật phụ thuộc nội dung, nhưng phải giữ được nhịp **khoảng 6 từ mới mỗi bài** và bài dài 5–10 phút.

Cuối mỗi lộ trình HSK có **bài kiểm tra cuối** và chứng nhận ([12-exam-certificate](../12-exam-certificate/)). Cuối giai đoạn Phát âm có **bài kiểm tra pinyin**, đạt thì mở HSK 1, không có chứng nhận.

## 2. Giai đoạn Phát âm (`pron`)

Mục tiêu: đọc được pinyin, nghe và nói đúng 4 thanh, nắm biến điệu cơ bản, viết được các nét cơ bản và khoảng 20 chữ đầu tiên.

| # | Chủ đề | Nội dung chính |
|---|---|---|
| 1 | Bốn thanh điệu | Thanh 1–4, thanh nhẹ. So với dấu tiếng Việt (ngang, sắc, hỏi, huyền/nặng) và chỗ khác nhau |
| 2 | Vận mẫu đơn | a o e i u ü |
| 3 | Thanh mẫu 1 | b p m f d t n l |
| 4 | Thanh mẫu 2 | g k h j q x |
| 5 | Thanh mẫu 3 | zh ch sh r z c s (khó nhất với người Việt) |
| 6 | Vận mẫu kép & mũi | ai ei ao ou an en ang eng ong, i-/u-/ü- + vận mẫu |
| 7 | Biến điệu & thanh nhẹ | 3+3, 不, 一, thanh nhẹ trong từ hai âm tiết |
| 8 | Nét & chữ đầu tiên | 8 nét cơ bản, quy tắc thứ tự nét, 20 chữ đơn giản (一二三人口大小中…) |

Các dạng bài trong giai đoạn này nằm ở [10-pronunciation](../10-pronunciation/pronunciation.md).

## 3. Lộ trình HSK 1–3

**Nguồn từ vựng:** danh sách HSK 2021 cấp tương ứng (D1). Mỗi từ của cấp phải xuất hiện là **từ mới** trong đúng một bài của lộ trình đó.
- Nếu một bài cần dùng từ ngoài danh sách (ví dụ tên riêng) thì đánh dấu `extra: true`. Từ này không tính vào tiến độ và không có trong bài kiểm tra.

**Sắp chủ đề:** theo nhu cầu giao tiếp, không theo thứ tự trong danh sách HSK. Gợi ý cho HSK 1: số đếm, đại từ, chào hỏi, gia đình, quốc tịch & ngôn ngữ, thời gian & ngày tháng, ăn uống, mua sắm & tiền, nơi chốn & phương hướng, trường học & công việc, sở thích, thời tiết, đi lại, sức khỏe, hẹn gặp.

**Ngữ pháp:** mỗi điểm ngữ pháp HSK của cấp được dạy trong đúng một bài, rồi được dùng lại trong bài tập về sau. Thứ tự tham khảo Chinese Grammar Wiki A1/A2 (chỉ tham khảo, không chép).

**Chữ Hán:** mọi chữ xuất hiện trong từ mới mà người học **chưa từng gặp** đều được luyện viết trong bài đó. Chữ đã học thì không bắt viết lại trong bài mới, mà chỉ ôn qua SRS và bài ôn chủ đề.

## 4. Cấu trúc một bài thường

| Thứ tự | Bước | Bắt buộc | Chi tiết |
|---|---|---|---|
| 1 | Giới thiệu từ mới | Có | Mỗi từ mới 1 thẻ: chữ, pinyin, Hán Việt, nghĩa tiếng Anh, audio, tách chữ, câu mẫu |
| 2 | Luyện viết | Có | Mỗi chữ mới: Xem → Viết theo → Tự viết ([07-writing](../07-writing/writing.md)) |
| 3 | Ngữ pháp | Nếu bài có | Thẻ giải thích bằng tiếng Việt kèm 2–3 ví dụ |
| 4 | Bài tập | Có | 6–10 câu, trộn nhiều dạng, đủ nghe và đọc ([06-lesson/exercise-types.md](../06-lesson/exercise-types.md)) |
| 5 | Luyện nói | Có | Ít nhất 2 câu: 1 từ mới và 1 câu ([08-speaking](../08-speaking/speaking-ui.md)) |
| 6 | Tổng kết | Có | Từ đã học, độ chính xác, thời gian |

Câu làm sai ở bước 4 được hỏi lại ở cuối bước 4. Bài hoàn thành khi đi hết mọi bước bắt buộc (chi tiết ở [06-lesson/lesson-player.md](../06-lesson/lesson-player.md)).

## 5. Bài ôn chủ đề (checkpoint)

- 15–20 câu, ôn các từ và ngữ pháp của **cả chủ đề**.
- Đủ 4 kỹ năng: ít nhất 3 câu nghe, 2 câu nói, 2 chữ tự viết, còn lại là đọc.
- **Đạt từ 70%** thì mở chủ đề tiếp theo **[Đề xuất]**. Mỗi câu nặng như nhau:
  - Câu nói tính đúng khi điểm ≥ 60, lấy lần cao nhất trong tối đa 2 lần thu. Lượt không tính (máy không nghe rõ) thì không đếm.
  - Chữ tự viết tính đúng khi điểm chữ ≥ 60.
- Chưa đạt thì làm lại ngay được, mỗi lần một bộ câu khác.
- Không có giới hạn số lần làm lại.

## 6. Bài kiểm tra pinyin (cuối giai đoạn Phát âm)

- 20 câu: nghe chọn âm tiết, nghe chọn thanh, đọc pinyin chọn audio, đọc to 5 âm tiết (chấm thanh).
- Đạt từ 70% thì mở HSK 1.
- Ai cũng làm được ngay từ đầu, không cần học hết giai đoạn. Đây là đường cho người chọn “Tôi đọc được pinyin” ở màn hình đầu tiên ([04-home](../04-home/home.md)).
