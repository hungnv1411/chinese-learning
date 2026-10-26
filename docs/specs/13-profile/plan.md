# Plan thực hiện: 13 – Tôi: tiến độ, cài đặt, nguồn dữ liệu, báo lỗi

Spec: [profile.md](profile.md). Quy ước chung: [00-foundation/plan.md](../00-foundation/plan.md).

## 1. Màn hình design

| Design | Route | Khối |
|---|---|---|
| `profile.html` | `/toi` | `stats` (4 ô), mức độ thuộc + lộ trình đang học, `display-settings`, `learning-settings`, `account-card`, `dialog#delete`, `dialog#reportdlg` |
| `sources.html` | `/nguon-du-lieu` | danh sách nguồn (`.src`), `our-data` (“Dữ liệu của chúng tôi”) |
| (style của `sources.html`) | `/gioi-thieu`, `/quyen-rieng-tu`, `/dieu-khoan` | trang tĩnh |

## 2. Phụ thuộc

- 09: mức độ thuộc, số từ có thẻ. 07: `char_written`. 04: chuỗi ngày, tổng thời gian. 05: lộ trình đang học + %. 12: chứng nhận, đổi tên. 03: đăng xuất, xóa tài khoản. 01: `content/sources.yaml`.
- Cung cấp cho: mọi module có nút “Báo lỗi” (`ReportSheet`); `SettingsProvider` (00) đọc cài đặt từ đây.

## 3. Các bước

### Bước 1. Thống kê
- `GET /api/me/stats`: `{ wordsLearned (số từ có thẻ SRS không suspended), charsWritten (đếm char_written), streak, totalMinutes, mastery: { new, learning, leech, mastered }, currentStage: { id, title, pct } }`.
- Bốn ô theo `.stats` (2 cột trên điện thoại, 4 cột từ 640px). Không có bảng xếp hạng hay so sánh.
- Khách: tính từ `guest_progress_v1`.
- Test: dữ liệu mẫu ra đúng 4 con số; chữ đạt Tự viết 2 lần chỉ đếm 1.

### Bước 2. Cài đặt
| Mục | Trường `user_settings` | Giá trị | Mặc định |
|---|---|---|---|
| Hiện pinyin | `show_pinyin` | `always` / `new` / `never` | `always` |
| Hiện âm Hán Việt | `show_han_viet` | bool | true |
| Màu theo thanh điệu | `tone_colors` | bool | true |
| Chữ phồn thể | `traditional` | bool | false |
| Mục tiêu mỗi ngày | `daily_goal_minutes` | 5 / 10 / 20 | từ màn hình đầu tiên |
| Giọng đọc | `voice` | `female` / `male` | `female` |
| Nút tự đánh giá | `review_buttons` | 2 / 4 | 2 |
| Kiểu thẻ ôn | `review_card_types` | mảng | `recognize`, `listen` |
| Cách thu âm | `record_mode` | `hold` / `toggle` | `hold` |

- `PATCH /api/me/settings` (zod), khách ghi vào `guest_progress_v1.settings`.
- **Có hiệu lực ngay:** `SettingsProvider` cập nhật lạc quan, đổi class `body` (`no-hv`, `no-tone`, `no-py`) và context cho `Hanzi`, `AudioButton`, `useRecorder`, phiên ôn.
- Đổi kiểu thẻ ôn gọi `PATCH /api/review/card-types` (09).
- **“Chỉ với từ mới”:** pinyin hiện ở thẻ giới thiệu từ và với từ học trong 7 ngày qua; chỗ khác ẩn, chạm vào chữ để hiện. Cài đặt `Pinyin` nhận prop `isNew` (component kiểm tra `learnedAt` của từ, cung cấp bởi payload bài/phiên ôn).
- Test: đổi “Màu theo thanh điệu” → `body.no-tone` ngay, không tải lại trang; `show_pinyin = new` → pinyin của từ học 10 ngày trước bị ẩn, chạm thì hiện.

### Bước 3. Tài khoản
- Ảnh, tên, email Google. Tên trên chứng nhận (sửa được, `validateCertificateName`): chưa có chứng nhận → chỉ sửa `user.certificate_name`; đã có → hỏi có muốn cập nhật cả chứng nhận đã cấp (gọi 12 bước 13, tối đa 3 lần).
- “Chứng nhận của tôi”: danh sách (lộ trình, ngày, nút xem). Chưa có → lộ trình đang học và còn bao xa (“Còn 2 chủ đề + bài kiểm tra cuối”).
- Đăng xuất, Xóa tài khoản (03).
- Khách: thay khối này bằng nút “Đăng nhập với Google để lưu tiến độ”.

### Bước 4. Trang Nguồn dữ liệu `/nguon-du-lieu`
- SSR tĩnh từ `content/sources.yaml` (01 bước 9): tên, mô tả ngắn, link, giấy phép, link văn bản giấy phép.
- Mục “Dữ liệu của chúng tôi”: nội dung lộ trình + dữ liệu chỉnh sửa từ CC-CEDICT theo CC BY-SA 4.0, link tải về thư mục `/content` trên GitHub (URL repo từ cấu hình `REPO_URL`).
- Ghi rõ: một số âm Hán Việt do AI bổ sung (số lượng lấy từ `hanzi.han_viet_source = 'ai'`).
- Link tới trang này ở trang Tôi và **chân trang mọi trang công khai** (từ điển, xác thực chứng nhận): component `PublicFooter`.
- Test: mọi nguồn trong `sources.yaml` xuất hiện trên trang với link giấy phép; `PublicFooter` có trên `/tu/…` và `/chung-nhan/…`.

### Bước 5. Báo lỗi nội dung
- `ReportSheet { target: { kind: 'lesson' | 'word' | 'sentence' | 'general'; id?: string } }` theo `dialog#reportdlg`:
  - Loại lỗi: Sai pinyin / Sai nghĩa / Sai Hán Việt / Sai audio / Câu ví dụ không tự nhiên / Chấm sai / Khác.
  - Mô tả không bắt buộc, tối đa 500 ký tự (đếm ký tự hiển thị).
- Đặt nút ở: thẻ giới thiệu từ, phản hồi bài tập (06), mặt sau thẻ ôn (09), trang từ (11), trang Tôi (báo lỗi chung).
- `POST /api/reports`: tự đính kèm `target`, `content_version`, `user_agent`; `user_id` nếu có. Khách giới hạn 10 báo cáo/ngày/IP (`rateLimit(…, 10, 86400)`).
- Test: mô tả 501 ký tự → 400; khách báo cáo thứ 11 trong ngày → 429; báo cáo từ phản hồi bài tập có `content_version` của bài.

### Bước 6. Trang quản trị `/admin/reports`
- Chỉ email trong `ADMIN_EMAILS` (danh sách phân cách dấu phẩy); người khác → 404.
- Danh sách báo cáo, lọc theo trạng thái (`open`, `resolved`, `ignored`), loại lỗi; xem đối tượng (link tới bài/từ); đánh dấu Đã xử lý / Bỏ qua.
- Sửa lỗi thật vẫn làm trong YAML (02).
- Test: không phải admin → 404; đổi trạng thái được lưu.

### Bước 7. Trang tĩnh
- `/gioi-thieu`: dự án phi lợi nhuận, mục tiêu, cách liên hệ.
- `/quyen-rieng-tu`: chỉ lưu email, tên, ảnh Google; không lưu ghi âm; không tracking bên thứ ba; cách xóa tài khoản (non-functional §5).
- `/dieu-khoan`: ngắn, kèm lưu ý chứng nhận không phải chứng chỉ HSK chính thức.
- Nội dung là file MDX trong `apps/web/content/pages/`, tên website đọc từ `SITE_NAME`.

### Bước 8. Kiểm thử giao diện
- Playwright ở 360×800, 820×1180, 1440×900: `/toi` cho khách và người dùng; đổi cài đặt có hiệu lực ngay ở màn hình khác (mở `/tra-tu` thấy đổi màu thanh).

## 4. Xong module khi
- Trang Tôi khớp `profile.html`, thống kê đúng, cài đặt có hiệu lực ngay.
- Báo lỗi gửi được từ mọi vị trí; admin xử lý được.
- `/nguon-du-lieu` đủ mọi nguồn, link từ mọi trang công khai.
