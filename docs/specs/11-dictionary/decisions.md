# Quyết định phát sinh – 11 Từ điển

## 11-1: nhận biết loại từ khóa
- `packages/core` không đọc file, nên danh sách âm tiết của 10 nằm ở `packages/core/src/syllables.json`, **sinh bởi** `clp syllables` cùng lúc với `content/pron/syllables.yaml`; test Python (`test_core_syllables_json_matches_standard_list`) bắt buộc hai bản khớp. File được `.prettierignore` để Prettier không đổi định dạng.
- Phân biệt Hán Việt và pinyin theo dấu kết hợp Unicode (NFD): dấu hỏi, ngã, nặng, móc (ơ ư), mũ (â ê ô), trăng (ă) và `đ` chỉ có ở tiếng Việt → `hanviet`. Dấu sắc/huyền dùng chung với pinyin nên **`hào`, `mà` được coi là pinyin** (người dùng muốn Hán Việt thì chọn chip, hoặc gõ dạng có dấu hỏi/ngã/nặng như `hảo`). Macron, caron, ü → pinyin.
- Chuỗi Latin không dấu gồm âm tiết hợp lệ (`he`, `haochi`, `xi'an`, cả `women`) → `['pinyin', 'english']`; tách âm tiết chọn cách ít âm tiết nhất, trùng thì âm đầu dài nhất; dấu `'` tách tường minh.
- `parsePinyinQuery`: trả `plain` (ü → u) và thanh từng âm tiết (`null` nếu không ghi thanh, `5` nếu ghi `ma5`); nhận cả số thanh và dấu thanh, kể cả viết liền (`hǎochī`).
