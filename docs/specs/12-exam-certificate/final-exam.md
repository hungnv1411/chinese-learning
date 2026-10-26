# Bài kiểm tra cuối lộ trình

Wireframe: [09-certificate.html](../../ideas/09-certificate.html), màn hình A và B.

Mỗi lộ trình HSK có một bài kiểm tra 4 kỹ năng: nghe, nói, đọc, viết (D10). Đạt thì lộ trình hoàn thành và nhận chứng nhận.

## 1. Điều kiện làm bài

- Đã đăng nhập.
- **Một trong hai:**
  - Mọi bài ôn chủ đề của lộ trình đã đạt.
  - Lộ trình đang là lộ trình kế tiếp được mở, và người dùng chọn **thi vượt** ([05-learning-path §3](../05-learning-path/learning-path.md)).
- Không có lần làm chưa đạt nào kết thúc trong vòng **24 giờ** qua **[Đề xuất]**.
- Lộ trình đã phát hành đủ ([authoring-workflow §5](../02-curriculum/authoring-workflow.md)).

## 2. Cấu trúc **[Đề xuất]**

| Phần | HSK 1 | HSK 2 | HSK 3 | Dạng bài |
|---|---|---|---|---|
| Nghe | 20 câu · 15′ | 25 câu · 18′ | 30 câu · 20′ | `listen_pick_hanzi`, `listen_pick_meaning`, `pick_tone`, nghe câu chọn nghĩa |
| Đọc | 20 câu · 15′ | 25 câu · 18′ | 30 câu · 20′ | `hanzi_to_meaning`, `fill_blank`, `arrange`, `read_sentence` |
| Viết | 5 chữ · 5′ | 8 chữ · 8′ | 10 chữ · 10′ | `write_char` (Tự viết) |
| Nói | 5 câu · 5′ | 6 câu · 6′ | 8 câu · 8′ | `speak_word`, `speak_sentence`, `speak_answer` (HSK 2–3) |

- Thứ tự cố định: Nghe → Đọc → Viết → Nói. Mỗi phần có đồng hồ riêng. Hết giờ thì tự chuyển phần, câu chưa trả lời tính sai.
- **Trước khi bắt đầu:**
  - **Kiểm tra micro** (thu thử 1 câu). Không có micro thì không cho bắt đầu, để không bị kẹt ở phần Nói.
  - Xác nhận **tên trên chứng nhận** ([certificate.md §2](certificate.md)).

## 3. Ngân hàng đề

- Mỗi lộ trình có ngân hàng đề với số câu **ít nhất gấp 3 lần** số câu cần cho mỗi phần.
- **Nguồn đề:**
  - Sinh tự động từ nội dung lộ trình: từ, câu, ngữ pháp đã học.
  - Cộng thêm câu soạn tay trong `/content/exam/<stage>.yaml`.
  - Sinh tự động phải được chạy lúc nhập nội dung, và đi qua cùng các bước rà soát và kiểm tra đối chiếu như nội dung bài ([authoring-workflow](../02-curriculum/authoring-workflow.md)).
- **Rút đề cho mỗi lần làm:** rải đều theo chủ đề (mỗi chủ đề có ít nhất 1 câu ở phần Nghe hoặc Đọc). Tránh lặp câu của lần làm gần nhất nếu ngân hàng đủ.
- Chữ ở phần Viết lấy từ chữ đã học trong lộ trình, ưu tiên chữ HSK của cấp đó.

## 4. Chống gian lận ở mức hợp lý

Chứng nhận là chứng nhận **hoàn thành khóa học**, không phải kỳ thi có giám sát. Biện pháp ở mức vừa phải:
- Client **không** nhận đáp án đúng. Đáp án gửi lên server và server chấm.
- Câu nghe trắc nghiệm không hiện chữ trước khi trả lời.
- Phần Nói: server chấm qua dịch vụ speech. **Mỗi câu tối đa 2 lần thu**, lấy điểm cao nhất.
- Phần Viết: hanzi-writer chấm ở client rồi gửi số lần sai, số gợi ý đã dùng. **Chấp nhận** rủi ro client gửi sai, vì đây chỉ là chứng nhận hoàn thành. Người xây có thể gửi thêm dữ liệu nét để server chấm lại nếu dễ làm.
- **Rời giữa chừng:**
  - Lượt làm vẫn tiếp tục tính giờ. Quay lại trong thời hạn thì làm tiếp.
  - Thời hạn của cả lượt = tổng thời gian các phần + 10 phút.
  - Quá thời hạn thì tự nộp.

## 5. Chấm điểm

- Mỗi phần quy về **25 điểm**:
  - Nghe, Đọc: tỷ lệ câu đúng × 25.
  - Viết: trung bình điểm từng chữ ([07-writing §4](../07-writing/writing.md)) / 100 × 25.
  - Nói: trung bình điểm từng câu (lấy lần cao nhất) / 100 × 25.
- **Tổng 100.** **Đạt** khi tổng ≥ 70 **và** mỗi phần ≥ 12,5 (50%) **[Đề xuất]**.
- Server chấm và lưu `exam_attempt`.

## 6. Màn hình kết quả (B)

- Tổng điểm, Đạt/Chưa đạt, thanh điểm từng phần.
- **Đạt:**
  - Xem trước chứng nhận, nút “Xem chứng nhận” và “Bắt đầu lộ trình HSK *n+1*”.
  - Lộ trình chuyển `completed` và mở lộ trình sau.
- **Chưa đạt:**
  - Chỉ ra phần nào dưới ngưỡng.
  - Thời điểm được thi lại.
  - Gợi ý: các từ sai ở phần Nghe và Đọc được đánh dấu để ôn sớm. Đặt `due = now` cho các thẻ SRS đã có, **không** tạo thẻ mới.
- Không hiện đáp án đúng của từng câu, để giữ ngân hàng đề.
