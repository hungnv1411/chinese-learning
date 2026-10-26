# Yêu cầu phi chức năng

## 1. Thiết bị & trình duyệt

- **Mobile-first.** Thiết kế cho màn hình rộng 360–430px trước. Trên desktop, nội dung nằm ở cột giữa (tối đa khoảng 480px cho phần học). Từ điển và trang chứng nhận có thể rộng hơn.
- Hỗ trợ: Chrome Android (2 bản gần nhất), Safari iOS 16+, Chrome/Edge/Firefox/Safari desktop (2 bản gần nhất).
- **iOS Safari là trường hợp khó nhất**, phải thử trên máy thật:
  - Thu âm (`MediaRecorder` trên iOS ra định dạng mp4/AAC, không phải webm/opus).
  - Phát audio cần thao tác chạm của người dùng trước.
  - Viết chữ bằng ngón tay không được làm cuộn trang.
- Không vỡ bố cục khi phóng to chữ hệ thống lên 130%.

## 2. Hiệu năng

- Trang đầu tiên (LCP) dưới 2,5 giây trên mạng 4G trung bình.
- Mở một bài học (từ lúc bấm đến khi hiện bước đầu) dưới 1,5 giây. Audio của bài được tải trước ngay khi bài mở.
- Chấm một câu nói (dài tối đa 5 giây) trả kết quả khoảng **3 giây** khi ít người dùng. Chưa đặt mục tiêu về tải (D15). Nếu hàng đợi dài thì hiện trạng thái “Đang chấm…”, không được treo giao diện.
- Phông chữ CJK (chữ Hán) dùng phông có sẵn trên hệ thống. Không tải web font chữ Hán vì quá nặng. Tham khảo `--font-cjk` trong [wireframe CSS](../../ideas/style.css).

## 3. Ngôn ngữ & hiển thị

- Toàn bộ giao diện bằng tiếng Việt. Không cần đa ngôn ngữ giao diện ở bản này, nhưng chuỗi giao diện nên gom vào một chỗ để dễ dịch sau.
- Chữ Hán mặc định **giản thể**, có tùy chọn phồn thể (lấy từ CC-CEDICT).
- **Màu thanh điệu** dùng thống nhất ở mọi nơi: thanh 1 đỏ, thanh 2 xanh lá, thanh 3 xanh dương, thanh 4 tím, thanh nhẹ xám (theo wireframe). Có thể tắt trong cài đặt. Màu không được là cách duy nhất để biết thanh: pinyin luôn có dấu thanh.
- Âm Hán Việt có thể tắt trong cài đặt.

## 4. Khả năng tiếp cận

- Độ tương phản đạt WCAG AA.
- Vùng chạm tối thiểu 44×44px.
- Mọi nút chỉ có biểu tượng (phát audio, micro…) phải có nhãn cho trình đọc màn hình.
- Không phụ thuộc vào màu để biết đúng hay sai: kèm biểu tượng ✓/✗ và chữ.

## 5. Quyền riêng tư

- Chỉ lưu thông tin Google trả về: email, tên, ảnh đại diện.
- **Không lưu file ghi âm.** Audio chỉ được xử lý trong bộ nhớ của dịch vụ speech rồi bỏ đi. Nút “Giọng của bạn” phát lại bản ghi đang có trên máy.
- Không dùng tracking hay quảng cáo của bên thứ ba. Số liệu sử dụng lấy từ database của chính dự án.
- Có trang Chính sách quyền riêng tư (tiếng Việt, ngắn gọn) và chức năng **xóa tài khoản** (xóa toàn bộ dữ liệu người dùng). Chứng nhận đã cấp thì chuyển sang trạng thái “đã thu hồi”, xóa tên, điểm và PDF ([03-auth §6](../03-auth/auth.md)).

## 6. Bảo mật

- Mọi API có ghi dữ liệu đều yêu cầu phiên đăng nhập, trừ các API cho khách được nêu ở [03-auth](../03-auth/auth.md).
- Giới hạn tần suất:
  - Chấm nói: 30 lần/phút/người dùng, khách 10 lần/phút/IP.
  - Tìm kiếm từ điển: 60 lần/phút/IP.
  - Bắt đầu bài kiểm tra cuối: theo luật 24 giờ.
- Dịch vụ speech không mở ra Internet.
- File tải lên chỉ nhận audio, tối đa 1 MB, tối đa 15 giây.

## 7. Chi phí vận hành mục tiêu

- **Chi phí cố định:** một VPS và tên miền. **Không có** chi phí tăng theo số lượt chấm phát âm.
- **TTS:** gần như chỉ trả một lần lúc tạo audio, nằm trong gói miễn phí hoặc vài USD. Từ điển tạo audio khi có người cần thì phải có giới hạn số lượng mỗi ngày (xem [01-content-data/tts-audio.md](../01-content-data/tts-audio.md)).
- **R2:** trong gói miễn phí ở quy mô ban đầu.

## 8. Kiểm thử

- Có unit test cho:
  - Logic khóa/mở bài.
  - Điều kiện hoàn thành bài.
  - Chấm bài kiểm tra.
  - Chuyển tiến độ của khách vào tài khoản.
  - Xếp lịch SRS.
  - Biến điệu pinyin (thanh 3 + 3, 不, 一).
- Dịch vụ speech có bộ bản ghi mẫu để kiểm thử hồi quy (xem [speech-service.md](../08-speaking/speech-service.md)).
- Có test E2E (Playwright) cho luồng chính: khách học thử 1 bài → đăng nhập → học tiếp → ôn tập.
