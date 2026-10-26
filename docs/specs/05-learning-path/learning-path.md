# Lộ trình (con đường học)

Wireframe: [02-roadmap.html](../../ideas/02-roadmap.html).

## 1. Quy tắc khóa và mở (D6)

Đây là phần logic quan trọng nhất, phải có unit test đầy đủ.

**Mở lộ trình**
- Giai đoạn Phát âm: luôn mở.
- HSK *n*: mở khi lộ trình trước đó `completed`.
- Một lộ trình `completed` khi:
  - Đạt bài kiểm tra cuối của nó, hoặc
  - Với giai đoạn Phát âm: đạt bài kiểm tra pinyin.
  - Học hết bài mà chưa đạt bài kiểm tra cuối thì **chưa** tính hoàn thành.

**Mở chủ đề**
- Chủ đề đầu tiên của một lộ trình mở khi lộ trình mở.
- Chủ đề tiếp theo mở khi **đạt** bài ôn của chủ đề trước.

**Mở bài**
- Trong một chủ đề, bài 1 mở khi chủ đề mở.
- Bài *k + 1* mở khi bài *k* `completed`.
- Bài ôn chủ đề mở khi mọi bài thường của chủ đề `completed`.

**Bài kiểm tra cuối**
- Mở khi mọi bài ôn chủ đề của lộ trình đạt.
- Hoặc qua **thi vượt** (xem mục 3).

**Học lại**
- Bài đã `completed` luôn học lại được, không giới hạn.
- Học lại không thay đổi trạng thái mở khóa, nhưng có cập nhật `best_score`.

**Server là nơi quyết định** với người đã đăng nhập. Client chỉ hiển thị trạng thái server trả về. API mở bài phải từ chối nếu bài chưa mở.

**Với khách:** logic khóa/mở viết thành **một module TypeScript dùng chung** cho client và server. Client chạy module này trên dữ liệu khách trong localStorage. Server chạy lại đúng module đó khi chuyển tiến độ khách vào tài khoản ([03-auth §5](../03-auth/auth.md)). Nội dung bài cho khách được phục vụ qua API công khai, giới hạn ở các bài thuộc học thử.

## 2. Màn hình

### A. Con đường trong một lộ trình
- **Thanh trên cùng:** tên lộ trình đang xem (bấm vào thì mở màn hình C) và % hoàn thành.
- **Mỗi chủ đề:** banner tên chủ đề, số bài đã xong trên tổng số bài, vài từ tiêu biểu. Chủ đề khóa thì banner màu xám.
- **Mỗi bài là một nút tròn** trên con đường uốn lượn:
  - Xong: màu xanh, hiện chữ Hán tiêu biểu của bài.
  - Hiện tại: màu đỏ, có viền sáng.
  - Khóa: xám, có biểu tượng ổ khóa.
- **Bài ôn chủ đề:** nút hình chữ nhật bo góc có ngôi sao.
- **Bấm vào bài đang mở:** hiện thẻ mô tả gồm số thứ tự bài, tên, số từ mới, thời gian ước tính, các kỹ năng, và nút “Bắt đầu” (hoặc “Học lại”).
- **Bấm vào bài khóa:** hiện thông báo nhỏ nói cần làm gì để mở (màn hình B).
- Khi mở màn hình, tự cuộn tới bài hiện tại.
- Cuối lộ trình có nút **Bài kiểm tra cuối** và hình chứng nhận đang chờ.
- Chủ đề chưa phát hành hiện “Sắp ra mắt” ([authoring-workflow §5](../02-curriculum/authoring-workflow.md)).

### C. Tổng quan các lộ trình
- **Danh sách các lộ trình**, mỗi lộ trình hiện trạng thái (Xong / Đang học / Khóa) và tiến độ.
- **Tiến độ** tính bằng số từ, số chữ **đã thuộc** trên tổng số của cấp (lấy từ SRS, xem [09-review §6](../09-review/review.md)), kèm số chủ đề đã xong.
- **Lộ trình đang khóa** hiện điều kiện mở.
- **Ô “Đã học ở nơi khác?”:** dẫn tới thi vượt (mục 3).

## 3. Thi vượt **[Đề xuất]**

Người đã có nền tảng không phải học lại từ đầu.

- Người dùng đã đăng nhập có thể làm **bài kiểm tra cuối của lộ trình HSK đang mở**, khi chưa học xong lộ trình đó.
- Dùng cùng ngân hàng đề, cùng cách chấm, cùng luật chờ 24 giờ với bài kiểm tra cuối bình thường.
- **Đạt:**
  - Lộ trình tính là `completed` với `completed_via = exam_skip`.
  - Nhận chứng nhận.
  - Mở lộ trình sau.
  - Mọi bài của lộ trình đó chuyển sang mở để học lại khi muốn.
  - **Không** tự tạo thẻ SRS cho các từ của lộ trình bị vượt.
  - Ở màn hình tổng quan, lộ trình này hiện **“Hoàn thành (thi vượt)”** thay cho % từ đã thuộc.
- **Chưa đạt:** tiến độ hiện tại giữ nguyên.
- Chỉ được thi vượt **lộ trình kế tiếp đang mở**, không nhảy hai cấp một lúc.
