# Từ điển

Wireframe: [07-dictionary.html](../../ideas/07-dictionary.html). Dùng tự do, không cần đăng nhập. Trang chi tiết render phía server để Google tìm thấy được.

## 1. Tìm kiếm

**Một ô tìm kiếm duy nhất**, tự nhận biết loại từ khóa. Có thêm chip lọc: Tất cả | Chữ Hán | Pinyin | English | Hán Việt.

| Loại từ khóa | Nhận biết | Cách tìm |
|---|---|---|
| Chữ Hán | Có ký tự CJK | Khớp đúng `simplified`/`traditional`, rồi các từ **bắt đầu bằng** từ khóa, rồi các từ **chứa** từ khóa |
| Pinyin | Chữ Latin, có thể có số thanh hoặc dấu thanh (`hao`, `hao3`, `hǎo`, `haochi`, `hao chi`) | Bỏ dấu cách và so với `pinyin_plain`. Nếu có thanh thì lọc thêm theo thanh |
| English | Chữ Latin, không khớp được pinyin nào, hoặc chọn chip English | Tìm toàn văn trên `definitions` (PostgreSQL `tsvector`, tiếng Anh) |
| Hán Việt | Có dấu tiếng Việt (`hảo`), hoặc chọn chip Hán Việt | Tìm chữ có `han_viet` khớp (không phân biệt hoa thường), rồi các từ chứa chữ đó. Không dấu (`hao`) thì chỉ tìm khi chọn chip Hán Việt |

- Chữ Latin không dấu vừa có thể là pinyin vừa là tiếng Anh (ví dụ `he`, `can`) thì tab Tất cả trả về cả hai nhóm, mỗi nhóm có tiêu đề riêng.
- **Thứ tự kết quả:**
  1. Khớp đúng.
  2. Có cấp HSK, cấp thấp trước.
  3. Từ ngắn trước.
  4. `is_variant_or_surname = false` trước.
  5. Thứ tự trong CC-CEDICT.
- Mỗi lần tối đa 30 kết quả, cuộn xuống thì tải thêm.
- **Gợi ý khi gõ:** tìm sau 250 ms kể từ phím cuối.
- **Tra gần đây:** 20 từ gần nhất, lưu trên máy.

**Mỗi dòng kết quả gồm:** chữ (màu thanh), pinyin, Hán Việt, 1–2 nghĩa đầu, nhãn HSK (nếu có).

## 2. Trang chi tiết từ: `/tu/{simplified}`

- **URL:** `/tu/好吃`. Từ có nhiều mục (đa âm) thì hiện tất cả trên một trang, mỗi mục một khối.
- **Phần đầu:**
  - Chữ lớn, pinyin, nút audio (theo [tts-audio §4](../01-content-data/tts-audio.md)), Hán Việt.
  - Nhãn: HSK, từ loại (nếu có), dạng phồn thể (nếu khác).
- **Nghĩa:** toàn bộ nghĩa tiếng Anh của CC-CEDICT, đánh số.
- **Nút “+ Thêm vào ôn tập”:**
  - Chỉ dành cho người đã đăng nhập. Khách bấm thì mời đăng nhập.
  - Nếu từ đã có thẻ thì hiện “Đã có trong ôn tập”.
  - Từ thêm từ đây có `source = dictionary`, tính chung giới hạn ôn mỗi ngày.
- **Từng chữ:** mỗi chữ một thẻ gồm chữ, pinyin, Hán Việt, phân tích bộ thủ (tên tiếng Việt). Bấm vào thẻ thì mở trang chữ.
- **Câu ví dụ:**
  - Tối đa 5 câu, ưu tiên câu có `max_hsk_level` thấp và ngắn.
  - Mỗi câu có chữ, pinyin, bản dịch tiếng Anh, nút audio nếu câu đã có audio.
  - Câu từ Tatoeba ghi “Tatoeba #id” kèm link.
- **Từ cùng chữ:** tối đa 12 từ chứa chữ của từ này, ưu tiên có cấp HSK.
- **Cuối trang:**
  - Ghi nguồn (CC-CEDICT · Tatoeba · Unihan · Make Me a Hanzi).
  - Nút “Báo lỗi” ([13-profile](../13-profile/profile.md)).
- **Thanh trên:** nút chia sẻ (Web Share API, không có thì sao chép link).

## 3. Trang chữ: `/chu/{char}`

- Chữ lớn với **hoạt ảnh thứ tự nét** (hanzi-writer, chế độ xem) và nút “Luyện viết”. Nút này mở chế độ Viết theo/Tự viết **không chấm vào SRS**.
- Pinyin (mọi cách đọc), Hán Việt (mọi âm), số nét, bộ thủ, phân tích cấu tạo, gợi ý nguồn gốc (tiếng Anh, từ Make Me a Hanzi).
- Các từ thông dụng chứa chữ này.

## 4. SEO

- Mỗi trang có `<title>` và mô tả riêng, ví dụ “好吃 hǎochī – nghĩa, cách đọc, Hán Việt hảo ngật | {tên website}”.
- **Sitemap** gồm trang của mọi từ HSK 1–6 và mọi chữ HSK. Không đưa cả 120.000 mục vào sitemap.
- Dữ liệu có cấu trúc `DefinedTerm` (schema.org).
- **Bộ nhớ đệm:** trang chi tiết render phía server rồi cache (ISR hoặc cache HTTP 1 ngày). Dữ liệu chỉ đổi khi chạy lại pipeline.
