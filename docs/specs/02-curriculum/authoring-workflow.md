# Quy trình biên soạn nội dung

Đây là phần tốn công nhất dự án. HSK 1–3 có khoảng 2.245 từ, 210 điểm ngữ pháp và khoảng 65 chủ đề.

**Quyết định của chủ dự án (D13):** AI tự viết **toàn bộ** nội dung, dựa trên các nguồn đã nghiên cứu ([sources-and-licenses](../01-content-data/sources-and-licenses.md)). **Không có người duyệt.** Vì vậy chất lượng được giữ bằng ba lớp:
- Đối chiếu tự động với dữ liệu nguồn.
- AI tự rà soát ở một lượt riêng.
- Người học báo lỗi.

## 1. Vai trò

- **AI soạn:** một mô hình ngôn ngữ mạnh (ví dụ Claude), được gọi bằng script trong `/pipeline/authoring`. Sinh file YAML theo [content-format.md](content-format.md).
- **AI rà soát:** một lượt gọi riêng, dùng model và prompt khác lượt soạn. Đọc YAML đã sinh và đánh dấu lỗi theo danh sách ở mục 3.
- **Máy kiểm tra:** `import_content --check` và các kiểm tra đối chiếu ở mục 4.
- **Người học:** báo lỗi qua nút “Báo lỗi nội dung” ([13-profile](../13-profile/profile.md)). Người vận hành dự án sửa YAML theo báo cáo.

## 2. Các bước cho mỗi lộ trình

1. **Chia chủ đề:**
   - Đầu vào: danh sách từ, chữ và ngữ pháp HSK 2021 của cấp đó.
   - AI đề xuất danh sách chủ đề và gán từng từ, từng điểm ngữ pháp vào một chủ đề.
   - Lưu thành `/content/<stage>/_plan.yaml`.
   - Máy kiểm tra: phủ đủ 100%, không từ nào bị gán hai lần.
2. **Soạn từng chủ đề:**
   - **Đầu vào cho AI:**
     - Từ của chủ đề, kèm pinyin và nghĩa CC-CEDICT.
     - Âm Hán Việt (Unihan) và phân tích chữ (Make Me a Hanzi).
     - Danh sách từ đã học tính đến chủ đề này.
     - Các câu Tatoeba phù hợp (đã lọc theo cấp).
     - Điểm ngữ pháp của chủ đề.
   - **AI sinh:** chia bài (khoảng 6 từ mỗi bài), chọn hoặc soạn câu ví dụ (ưu tiên câu Tatoeba), mẹo tiếng Việt, giải thích ngữ pháp tiếng Việt, nghĩa tiếng Anh rút gọn.
3. **AI rà soát** (mục 3). Lỗi nào được đánh dấu thì đưa lại cho lượt soạn sửa. Tối đa 2 vòng.
4. **Máy kiểm tra** (mục 4). Lỗi chặn thì sửa rồi chạy lại.
5. **Tạo audio** cho từ và câu mới (`generate_audio`).
6. Commit, rồi nhập vào môi trường thật.

Script lưu lại prompt, model và phiên bản của mỗi lần sinh trong `/content/<stage>/_meta/`, để sinh lại được khi cần.

## 3. Danh sách rà soát của AI

- Pinyin của từ và câu đúng, nhất là chữ đa âm (了, 得, 行, 长…) và thanh nhẹ.
- Ghi chú biến điệu đúng chỗ.
- Nghĩa tiếng Anh ngắn gọn, đúng ngữ cảnh bài.
- Câu ví dụ tự nhiên, bản dịch tiếng Anh đúng.
- Câu chỉ dùng từ đã học.
- Giải thích ngữ pháp và mẹo tiếng Việt đúng, dễ hiểu, không quá 3–4 câu.
- Không có nội dung nhạy cảm (chính trị, tôn giáo, bạo lực).

## 4. Kiểm tra đối chiếu tự động

Thêm vào các kiểm tra schema ở [content-format §4](content-format.md):

| Kiểm tra | Cách làm | Khi lệch |
|---|---|---|
| Pinyin từ | So với pinyin của mục CC-CEDICT đã ghép | **Chặn** |
| Pinyin câu | So với `pypinyin` (có từ điển cụm từ) | Cảnh báo. Lệch ở chữ đa âm thì AI rà soát lại riêng câu đó |
| Âm Hán Việt | Chỉ lấy từ Unihan/overrides, AI không được tự viết âm Hán Việt | **Chặn** nếu YAML có âm không khớp nguồn |
| Câu Tatoeba | Chữ `zh` và `en` phải khớp nguyên văn bản gốc | **Chặn** |
| Từ chưa học trong câu | Tách từ bằng jieba, so với danh sách đã học | Cảnh báo |
| Độ dài | Mẹo ≤ 300 ký tự, giải thích ngữ pháp ≤ 800 ký tự | Cảnh báo |

**Âm Hán Việt thiếu trong Unihan:** AI được đề xuất âm, nhưng ghi vào `overrides/han_viet.yaml` với cờ `source: ai`. Giao diện vẫn hiện bình thường. Trang nguồn dữ liệu ghi rõ một số âm do AI bổ sung.

## 5. Nội dung tự viết cho người Việt

Đây là phần làm khác biệt so với app nước ngoài. Prompt cho AI phải yêu cầu rõ:
- Mẹo phát âm so với tiếng Việt (zh/ch/sh, ü, r, thanh 3 so với thanh hỏi…).
- Mẹo nhớ chữ dựa vào âm Hán Việt và bộ thủ.
- Lỗi người Việt hay mắc (ví dụ dùng 是 với tính từ: ~~我是忙~~ → 我很忙).

## 6. Phát hành

- Phạm vi: **toàn bộ Phát âm + HSK 1–3** (D13).
- Một lộ trình được phát hành khi:
  - Đủ 100% độ phủ.
  - Không còn lỗi chặn.
  - Ngân hàng đề kiểm tra cuối đủ số câu ([12-exam-certificate](../12-exam-certificate/final-exam.md)).
- Có thể phát hành lần lượt: Phát âm + HSK 1 trước, HSK 2 và 3 sau. Chủ đề chưa phát hành hiện “Sắp ra mắt”. **Bài kiểm tra cuối chỉ mở khi lộ trình đã đủ.**
