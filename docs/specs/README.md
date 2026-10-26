# Spec: Website tự học tiếng Trung cho người Việt

Tài liệu này mô tả đầy đủ sản phẩm để một người xây dựng có thể lập kế hoạch và làm mà không cần hỏi lại chủ dự án. Wireframe từng màn hình nằm ở [docs/ideas/](../ideas/index.html). Spec là nguồn đúng khi có chỗ khác với wireframe.

## 1. Ý định

Người Việt chưa biết tiếng Trung muốn tự học nhưng thiếu một lộ trình rõ ràng, miễn phí, hợp với cách học trên điện thoại lúc rảnh. Website này cho họ một con đường từ con số 0 đến HSK 3, theo chuẩn HSK 2021. Mỗi ngày học vài phút, đủ 4 kỹ năng nghe, nói, đọc, viết. Hết mỗi lộ trình có bài kiểm tra và chứng nhận hoàn thành.

Dự án **phi lợi nhuận**, không quảng cáo, xây trên dữ liệu mở và ghi nguồn đầy đủ.

## 2. Người dùng

- Người Việt, chưa biết tiếng Trung (hoặc mới biết chút ít), tự học, không có giáo viên.
- Học vào lúc rảnh, phiên học ngắn, **chủ yếu trên điện thoại** (trình duyệt di động).
- Giao diện tiếng Việt. Nghĩa của từ hiển thị bằng **tiếng Anh**, vì không có từ điển Trung–Việt mở. Mỗi chữ có thêm **âm Hán Việt**, đây là lợi thế riêng của người Việt.

## 3. Mục tiêu, không làm, và những điều tuyệt đối tránh

**Mục tiêu**
- Lộ trình khóa theo thứ tự kiểu Duolingo: Phát âm → HSK 1 → HSK 2 → HSK 3 (chuẩn HSK 2021).
- Mỗi bài 5–10 phút, bắt buộc đủ 4 kỹ năng, kể cả **viết chữ** và **nói**.
- Ôn tập ngắt quãng (SRS) tự động cho mọi từ đã học.
- Bài kiểm tra 4 kỹ năng cuối mỗi lộ trình HSK. Đạt thì nhận chứng nhận có link xác thực.
- Từ điển tra cứu công khai, mỗi từ có trang riêng mà Google tìm thấy được.

**Không làm (trong bản này)**
- App native và thông báo đẩy (để dành cho app native sau này).
- Chạy offline hoặc cài như app (PWA).
- HSK 4 trở lên.
- Nghĩa tiếng Việt cho từng từ.
- Nhận dạng chữ viết tay để tra từ.
- Đăng nhập bằng email, mật khẩu hay mạng xã hội khác. Chỉ có Google.
- Tính năng cộng đồng: bảng xếp hạng, bạn bè, bình luận.

**Tuyệt đối tránh** (nếu xảy ra thì coi là thất bại, dù tính năng vẫn chạy)
- Người học bị kẹt không đi tiếp được vì máy chấm sai. Mọi cơ chế chấm tự động phải có lối thoát hợp lý (xem từng module).
- Chứng nhận bị hiểu nhầm là chứng chỉ HSK chính thức.
- Vi phạm giấy phép dữ liệu, kể cả thiếu ghi nguồn.
- Phiên học trên điện thoại chậm, giật, hoặc vỡ bố cục ở màn hình rộng 360px.
- Có chi phí vận hành thay đổi theo lượng dùng mà không kiểm soát được (ví dụ trả tiền theo phút cho dịch vụ chấm phát âm).

## 4. Quyết định đã chốt

Chủ dự án đã quyết những điểm sau. Người xây không được thay đổi.

| # | Quyết định |
|---|---|
| D1 | Theo **chuẩn HSK 2021 (GF0025-2021)**, cấp 1–3. Không theo đề cương thi 2025/2026. |
| D2 | Nghĩa của từ bằng **tiếng Anh** (CC-CEDICT). Giao diện và lời giải thích bằng tiếng Việt. |
| D3 | Audio mẫu dùng **giọng đọc máy (TTS)**. |
| D4 | **Có tài khoản**, chỉ **đăng nhập với Google**. Được **học thử** trước khi đăng nhập. |
| D5 | **Không** cần offline/PWA. **Không** thông báo đẩy ở bản web. |
| D6 | **Khóa bài theo thứ tự**, không học vượt. Màn hình lộ trình dạng con đường kiểu Duolingo. |
| D7 | **Luyện viết bắt buộc.** |
| D8 | **Luyện nói bắt buộc**, không bỏ qua được. |
| D9 | Ôn tập mặc định **2 nút Quên / Nhớ**, cài đặt cho phép đổi sang 4 nút. |
| D10 | **Mỗi lộ trình HSK có một chứng nhận**. Phải đạt bài kiểm tra cuối gồm **nghe, nói, đọc, viết**. Giai đoạn Phát âm **không** có chứng nhận. |
| D11 | Chấm phát âm **tự chạy trên server**, không dùng dịch vụ trả phí. Độ chính xác vừa phải là đủ. |
| D12 | Cách xây dựng: Next.js + PostgreSQL + Better Auth + dịch vụ chấm phát âm bằng Python, chạy trên một VPS (chi tiết ở [00-foundation/architecture.md](00-foundation/architecture.md)). |
| D13 | **AI tự viết toàn bộ nội dung** (Phát âm + HSK 1–3), dựa trên các nguồn đã nghiên cứu. Không có người duyệt. Chất lượng giữ bằng AI tự rà soát, kiểm tra đối chiếu tự động và báo lỗi của người học ([02-curriculum/authoring-workflow.md](02-curriculum/authoring-workflow.md)). |
| D14 | **Không làm thử nghiệm đo độ chính xác** chấm phát âm. Chấm theo cách đã mô tả (Whisper + dò cao độ), chỉ có kiểm thử bằng audio TTS. |
| D15 | **Chưa tính đến số lượng người dùng.** Dựng cấu hình tối thiểu đủ chạy. |
| D16 | **Mã nguồn công khai.** Tên website và tên miền **chưa có**, phải để trong cấu hình. |

## 5. Quyết định do người viết spec đặt

Chủ dự án chưa xác nhận những điểm dưới đây. Chúng được đánh dấu **[Đề xuất]** trong từng file. Người xây cứ làm theo, chủ dự án có thể đổi sau mà không ảnh hưởng kiến trúc.

- **Học thử:** tối đa 3 bài trước khi phải đăng nhập. Bảng pinyin và từ điển luôn dùng tự do.
- **Thi vượt:** làm đạt bài kiểm tra cuối của lộ trình hiện tại mà chưa học hết bài thì vẫn được tính hoàn thành, nhận chứng nhận và mở lộ trình sau.
- **Điểm đạt:**
  - Bài kiểm tra cuối: tổng từ 70/100 và mỗi kỹ năng từ 50%. Chưa đạt thì 24 giờ sau mới làm lại.
  - Bài ôn chủ đề: từ 70%.
  - Một câu luyện nói: từ 60/100. Sau 3 lần chưa đạt thì cho đi tiếp, câu đó được đưa vào ôn tập.
- **Âm thanh:** TTS dùng Azure Neural TTS, tạo sẵn và lưu trên Cloudflare R2.
- **Nội dung lưu dưới dạng file YAML** trong repo (xem [02-curriculum](02-curriculum/)).
- **Chấm phát âm:** dùng faster-whisper (model `base`) + Parselmouth, ngưỡng để trong file cấu hình.
- **Giấy phép mã nguồn:** web và pipeline dùng MIT, dịch vụ speech dùng GPL-3.0, nội dung dùng CC BY-SA 4.0.
- **Máy chủ tối thiểu:** 2 vCPU / 4 GB RAM.
- **Bài chọn thanh (`pick_tone`):** đáp án là thanh nghe được, tức là đã biến điệu (你好 → 2, 3).
- **Câu nói chưa đạt:** đưa vào ôn tập theo từ, không tạo thẻ cho cả câu.
- **Khách đạt bài kiểm tra pinyin:** server chấp nhận kết quả mà không kiểm tra lại. Logic khóa/mở là một module TypeScript dùng chung cho client và server.
- **Xóa tài khoản:** chứng nhận chỉ giữ mã và trạng thái “không còn hiệu lực”. Tên, điểm và PDF bị xóa.
- **File audio** đặt tên kèm pinyin để phân biệt chữ đa âm (`行_xing2`).

## 6. Các module

| Module | Nội dung | Wireframe |
|---|---|---|
| [00-foundation](00-foundation/) | Kiến trúc, mô hình dữ liệu, yêu cầu phi chức năng | – |
| [01-content-data](01-content-data/) | Nguồn dữ liệu & giấy phép, pipeline nhập dữ liệu, audio TTS | – |
| [02-curriculum](02-curriculum/) | Cấu trúc lộ trình, định dạng file nội dung, quy trình biên soạn | – |
| [03-auth](03-auth/) | Đăng nhập Google, học thử, chuyển tiến độ khách vào tài khoản | [01](../ideas/01-home.html) |
| [04-home](04-home/) | Màn hình đầu tiên, chọn điểm xuất phát, Hôm nay, chuỗi ngày học | [01](../ideas/01-home.html) |
| [05-learning-path](05-learning-path/) | Con đường lộ trình, quy tắc khóa/mở bài | [02](../ideas/02-roadmap.html) |
| [06-lesson](06-lesson/) | Trình chạy bài học, các dạng bài tập | [03](../ideas/03-lesson.html) |
| [07-writing](07-writing/) | Luyện viết chữ | [04](../ideas/04-writing.html) |
| [08-speaking](08-speaking/) | Giao diện luyện nói, dịch vụ chấm phát âm | [10](../ideas/10-speaking.html) |
| [09-review](09-review/) | Ôn tập ngắt quãng (FSRS) | [05](../ideas/05-review.html) |
| [10-pronunciation](10-pronunciation/) | Giai đoạn Phát âm, bảng pinyin, luyện nghe thanh | [06](../ideas/06-pinyin.html) |
| [11-dictionary](11-dictionary/) | Từ điển, trang chi tiết từ và chữ | [07](../ideas/07-dictionary.html) |
| [12-exam-certificate](12-exam-certificate/) | Bài kiểm tra cuối lộ trình, chứng nhận, trang xác thực | [09](../ideas/09-certificate.html) |
| [13-profile](13-profile/) | Tiến độ, cài đặt, nguồn dữ liệu, báo lỗi nội dung | [08](../ideas/08-profile.html) |

## 7. Thứ tự xây dựng gợi ý

1. Nền tảng (00) và pipeline dữ liệu (01).
2. Từ điển (11). Đây là cách kiểm tra dữ liệu đã nhập đúng chưa.
3. Script soạn nội dung bằng AI và kiểm tra đối chiếu (02). Sinh giai đoạn Phát âm và vài chủ đề HSK 1 trước.
4. Dịch vụ chấm phát âm (08) và bộ kiểm thử TTS.
5. Trình chạy bài học, luyện viết, luyện nói, ôn tập (06, 07, 08, 09).
6. Lộ trình, Hôm nay, đăng nhập (05, 04, 03).
7. Bài kiểm tra và chứng nhận (12), trang cá nhân (13).
8. Sinh toàn bộ nội dung HSK 1, sau đó HSK 2 và 3.

## 8. Thuật ngữ

| Từ | Nghĩa trong tài liệu này |
|---|---|
| Lộ trình (stage) | Một trong: Phát âm, HSK 1, HSK 2, HSK 3 |
| Chủ đề (unit) | Nhóm bài theo chủ đề trong một lộ trình, ví dụ “Chào hỏi” |
| Bài (lesson) | Một phiên học 5–10 phút |
| Bài ôn chủ đề (checkpoint) | Bài tổng hợp ở cuối mỗi chủ đề, phải đạt mới mở chủ đề sau |
| Bài kiểm tra cuối (final exam) | Bài thi 4 kỹ năng cuối lộ trình HSK, đạt thì có chứng nhận |
| Thẻ (card) | Một mục ôn tập SRS, gắn với một từ và một kiểu thẻ |
| Khách (guest) | Người dùng chưa đăng nhập |
| Hán Việt | Âm Hán Việt của chữ, ví dụ 学 → học |
