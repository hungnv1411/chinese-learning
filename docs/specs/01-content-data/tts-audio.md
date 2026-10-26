# Audio TTS

Mọi audio mẫu là giọng đọc máy (D3). Audio được tạo sẵn, lưu thành file tĩnh trên R2. **Không** dùng giọng đọc có sẵn của trình duyệt (Web Speech API), vì giọng tiếng Trung trên điện thoại mỗi máy một khác và nhiều máy không có.

## 1. Dịch vụ **[Đề xuất]**

- Azure Neural TTS, ngôn ngữ `zh-CN`. Dùng một giọng nữ và một giọng nam.
  - Dùng `zh-CN-XiaoxiaoNeural` (nữ, mặc định) và `zh-CN-YunxiNeural` (nam). Đổi được qua cấu hình.
- Định dạng: MP3 mono 24 kHz, 48 kbps.
- Người xây có thể đổi sang dịch vụ TTS khác nếu có SSML và đọc được pinyin có thanh. Phải giữ nguyên cách đặt tên file.

## 2. Những gì cần tạo

| Loại | Key trên R2 | Số lượng ước tính | Cách tạo |
|---|---|---|---|
| Từ trong lộ trình HSK 1–3 | `word/{voice}/{simplified}_{pinyin_numbered}.mp3` (ví dụ `行_xing2`, `好吃_hao3chi1`) và `….slow.mp3` | khoảng 2.245 × 2 tốc độ × 2 giọng | Đọc chữ Hán. Từ đa âm thì dùng SSML `<phoneme>` theo pinyin của bài |
| Câu trong bài học và ngân hàng đề | `sent/{voice}/{sentence_id}.mp3` và `.slow.mp3` | vài nghìn | Đọc chữ Hán |
| Âm tiết pinyin × 4 thanh (bảng pinyin) | `syl/{voice}/{pinyin_numbered}.mp3`, ví dụ `ma3` | khoảng 400 âm tiết × 4 | SSML phoneme với pinyin. **Cần thử trước** xem TTS đọc âm tiết đứng riêng có tự nhiên không. Nếu không thì đọc chữ ví dụ có đúng âm và thanh đó |
| Từ trong từ điển ngoài lộ trình | `word/{voice}/{simplified}_{pinyin_numbered}.mp3` | theo nhu cầu | **Tạo khi có người cần** (xem mục 4) |

- Tốc độ chậm: SSML `<prosody rate="-30%">`.
- Đọc chậm hoặc nhanh khi phát lại thì làm ở client bằng `playbackRate` nếu chất lượng chấp nhận được. Khi đó không cần tạo file `.slow`. **Người xây quyết sau khi nghe thử.**

## 3. Script `generate_audio`

- Duyệt danh sách cần tạo. Bỏ qua file đã có trên R2 với cùng `text + voice + rate`, kiểm tra bằng hash trong `audio_asset`.
- Giới hạn tốc độ gọi theo quota của dịch vụ. Lỗi thì thử lại tối đa 3 lần.
- Ghi `audio_asset`.
- Có chế độ `--dry-run`: in số ký tự sẽ gửi đi để ước tính chi phí trước khi chạy.

## 4. Audio theo yêu cầu cho từ điển

- Từ điển có khoảng 120.000 mục, không tạo trước hết.
- Khi người dùng bấm ▶ ở một từ chưa có audio: web gọi TTS, lưu lên R2, ghi `audio_asset`, trả URL.
- Giới hạn toàn hệ thống: tối đa **500 lần tạo mới mỗi ngày**. Vượt giới hạn thì nút ▶ hiện thông báo “Chưa có âm thanh cho từ này”.
- Chỉ người đã đăng nhập mới kích hoạt được việc tạo mới.

## 5. Phát audio phía client

- Tải trước toàn bộ audio của bài khi bài mở.
- Trên iOS, audio chỉ phát được sau thao tác chạm đầu tiên. Bước đầu tiên của bài luôn có nút bấm trước khi tự phát.
- Cài đặt “Giọng đọc” (nữ/nam) chọn thư mục `{voice}` tương ứng.
