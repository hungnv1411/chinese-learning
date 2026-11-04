# Quyết định phát sinh – 10 Phát âm

## 10-1: `content/pron/syllables.yaml`
- File **sinh bằng** `clp syllables` (pipeline), không sửa tay. Danh sách chuẩn 408 âm tiết ghi trong `clp/syllables.py`; CC-CEDICT không có âm tiết chuẩn nào thiếu. 31 âm tiết/chuỗi chỉ có trong CC-CEDICT (đơn vị đo như `bai3ke`, thán từ `hm`, `ng`, `yo`, âm phương ngữ hiếm `biang`, `nun`, `tei`, `rua`…) bị bỏ vì không thuộc bảng pinyin chuẩn.
- **Thanh mẫu / vận mẫu:** `ju, qu, xu` có vận mẫu `ü` (cột ü), `y-`/`w-` quy về vận mẫu thật (`yi` → `i`, `you` → `iu`, `wei` → `ui`, `wen` → `un`, `weng` → `ueng`, `yu` → `ü`) với `initial` rỗng; `zhi chi shi ri zi ci si` dùng vận mẫu `i`. `lü`, `nü`, `lüe`, `nüe` giữ nguyên, không có `lv`/`nv`.
- **Chữ ví dụ:** chỉ lấy chữ đơn có `hsk_level` (kể cả cấp 7 = HSK 7–9), thanh 1–4. Ưu tiên không phải họ/biến thể, cấp thấp, nhiều nghĩa. Kết quả: 918/1.632 thanh có chữ ví dụ; thanh còn lại không có `char` (UI ghi "không có chữ thông dụng"). Chữ cấp 7 là chữ ngoài HSK 1–6, UI có thể chọn không hiển thị nghĩa nếu muốn tránh chữ khó.
- `gloss`: nghĩa tiếng Anh ngắn đầu tiên của CC-CEDICT, bỏ nghĩa trùng âm tiết, `surname`, `variant of`, tham chiếu `see`/`CL:`; cắt ở `;` `,` `(`, tối đa 40 ký tự.
- `audio` luôn `false` cho đến khi 01-7b sinh audio; chạy lại `clp syllables` sau đó để cập nhật cờ này (đọc `audio_asset.key` dạng `syl/xiaoxiao/{âm tiết}{thanh}.mp3`).
