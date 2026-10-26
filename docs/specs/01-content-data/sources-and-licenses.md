# Nguồn dữ liệu & giấy phép

Giấy phép trong bảng dưới đã được kiểm tra trên trang dự án hoặc file LICENSE vào tháng 10/2026. Trước khi ra mắt, phải đọc lại file LICENSE gốc của từng nguồn, vì người viết spec không phải luật sư.

| Nguồn | Dùng cho | Giấy phép | Nghĩa vụ |
|---|---|---|---|
| **CC-CEDICT** (cc-cedict.org, tải tại mdbg.net) | Từ điển Trung–Anh: chữ giản/phồn thể, pinyin, nghĩa | CC BY-SA (3.0 theo wiki dự án) | Ghi nguồn. Dữ liệu dự án **chỉnh sửa từ CC-CEDICT** (ví dụ nghĩa đã rút gọn cho bài học) phải chia sẻ lại theo CC BY-SA |
| **ivankra/hsk30** (GitHub) | Danh sách HSK 2021: từ (11.092), chữ (3.000), ngữ pháp, theo cấp | MIT (cho repo). Dữ liệu gốc là văn bản của chính phủ Trung Quốc | Ghi nguồn. Đây là nguồn chính cho D1 (HSK 2021) |
| **drkameleon/complete-hsk-vocabulary** | Nguồn dự phòng hoặc đối chiếu cho danh sách HSK | MIT | Ghi nguồn nếu dùng |
| **Unicode Unihan** (`Unihan_Readings.txt`, trường `kVietnamese`) | Âm Hán Việt | Unicode License (thoáng) | Ghi nguồn |
| **Make Me a Hanzi** | Phân tích chữ (`dictionary.txt`) và dữ liệu nét (`graphics.txt`) | `dictionary.txt`: LGPL v3+. `graphics.txt`: Arphic Public License | Ghi nguồn, kèm văn bản giấy phép trên trang nguồn dữ liệu |
| **hanzi-writer** + **hanzi-writer-data** | Hoạt ảnh nét, chấm nét khi viết | Code: MIT. Data: Arphic PL (bắt nguồn từ Make Me a Hanzi) | Như trên |
| **Tatoeba** (bản xuất câu `cmn` và cặp `cmn–eng`) | Câu ví dụ kèm bản dịch tiếng Anh | Câu: CC BY 2.0 FR. **Không dùng audio của Tatoeba** | Ghi nguồn, link về tatoeba.org, ghi ID câu |
| **Azure Neural TTS** **[Đề xuất]** | Audio mẫu | Theo điều khoản dịch vụ Azure. Audio tạo ra được dùng trong ứng dụng | Đọc lại điều khoản trước khi dùng |
| **faster-whisper** / model Whisper | Nhận dạng giọng nói | MIT | |
| **Parselmouth** (Praat) | Dò cao độ giọng | GPL v3 | Dịch vụ speech chạy nội bộ, không phân phối cho người dùng. Nếu mở mã nguồn thì phần speech theo GPL |

## Không dùng

- **Chinese Grammar Wiki (AllSet Learning):** chỉ tham khảo thứ tự ngữ pháp, **không chép nội dung**. Lý do: chưa xác nhận được loại giấy phép Creative Commons cụ thể.
- **MIT OpenCourseWare (CC BY-NC-SA), FSI:** chỉ tham khảo cấu trúc bài, không chép.
- Mọi từ điển Trung–Việt không có giấy phép mở rõ ràng.

## Giấy phép của dữ liệu dự án tự tạo

- **Nội dung lộ trình** (phân chủ đề, lời giải thích, mẹo, câu tự soạn) và **dữ liệu chỉnh sửa từ CC-CEDICT** được phát hành theo **CC BY-SA 4.0**. Có link tải về từ trang Nguồn dữ liệu ([13-profile](../13-profile/profile.md)).
- **Mã nguồn: công khai** (D16), repo GitHub công khai. **[Đề xuất]**
  - `/apps/web`, `/pipeline`: MIT.
  - `/services/speech`: GPL-3.0, vì dùng Parselmouth (GPL).
  - `/content`: CC BY-SA 4.0. Trang nguồn dữ liệu trỏ link tải về thẳng thư mục này trên GitHub.
  - Repo có file `LICENSE` ở gốc giải thích cách chia này, và file LICENSE riêng trong từng thư mục.

## Trang ghi nguồn

Phải có một trang công khai “Nguồn dữ liệu & giấy phép” liệt kê mọi nguồn ở bảng trên. Mỗi nguồn ghi: tên, link, giấy phép, link tới văn bản giấy phép. Trang chi tiết từ trong từ điển ghi nguồn ngắn ở cuối trang (ví dụ “Nguồn: CC-CEDICT · Tatoeba #12345 · Unihan”).
