# Quyết định phát sinh – 02 Lộ trình

## 02-8: `content/radicals_vi.yaml`
- Mỗi mục: `{number, radical, name_vi, meaning_vi, variants}`. Plan chỉ nêu `{radical, name_vi, meaning_vi}`; thêm `number` (1–214) vì bảng `radical_vi` có cột `number` NOT NULL UNIQUE, và `variants` (dạng viết bên/rút gọn như 氵, 讠, 钅) để 01-5 ánh xạ trường `radical` của Make Me a Hanzi về bộ gốc.
- `radical` dùng dạng phồn thể của bảng Khang Hy (見, 言, 金…), không dùng ký tự khối Kangxi Radicals (U+2F00).
- Tên Hán Việt có thể trùng nhau giữa các bộ (ví dụ 冖 và 糸 đều là "mịch", 夊 "tuy"…); khóa là `radical` nên không ảnh hưởng.
- Nội dung AI soạn, chưa có người duyệt (D13). Kiểm tra máy ở `clp/radicals.py`: đủ 214, `number` 1..214 liên tục, không trùng, không rỗng, `variants` không trùng bộ nào.
