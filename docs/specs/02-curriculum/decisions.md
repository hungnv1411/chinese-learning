# Quyết định phát sinh – 02 Lộ trình

## 02-8: `content/radicals_vi.yaml`
- Mỗi mục: `{number, radical, name_vi, meaning_vi, variants}`. Plan chỉ nêu `{radical, name_vi, meaning_vi}`; thêm `number` (1–214) vì bảng `radical_vi` có cột `number` NOT NULL UNIQUE, và `variants` (dạng viết bên/rút gọn như 氵, 讠, 钅) để 01-5 ánh xạ trường `radical` của Make Me a Hanzi về bộ gốc.
- `radical` dùng dạng phồn thể của bảng Khang Hy (見, 言, 金…), không dùng ký tự khối Kangxi Radicals (U+2F00).
- Tên Hán Việt có thể trùng nhau giữa các bộ (ví dụ 冖 và 糸 đều là "mịch", 夊 "tuy"…); khóa là `radical` nên không ảnh hưởng.
- Nội dung AI soạn, chưa có người duyệt (D13). Kiểm tra máy ở `clp/radicals.py`: đủ 214, `number` 1..214 liên tục, không trùng, không rỗng, `variants` không trùng bộ nào.

## 02-1: hợp đồng `lesson.content` và đọc YAML
- **Hợp đồng hai phía:** `packages/core/src/content.ts` (zod: `StepSpecSchema`, `LessonContentSchema`) và `pipeline/clp/content/models.py` (Pydantic). Test hợp đồng: `test_content_contract.py` dựng 3 bài mẫu (`normal`, `checkpoint`, `pron`), so với `pipeline/tests/fixtures/lesson_content/*.json` (ghi lại bằng `CLP_UPDATE_FIXTURES=1`), và `content.test.ts` parse đúng các file đó bằng zod.
- **Mã bài tập dùng chung** `packages/core/fixtures/exercise-types.json` (15 mã: 14 của exercise-types.md + `pinyin_pick_audio`); TS giữ bản `as const` để có kiểu chữ, hai phía đều có test so với fixture, và Python so thêm với bảng trong `exercise-types.md`.
- **Bất biến thêm vào hợp đồng:** bài `checkpoint` phải có `steps` rỗng, bài `normal` phải có ít nhất một bước (plan chỉ nói checkpoint rỗng). Câu bắt buộc đủ `zh`, `en`, `pinyin` không rỗng. `hskWordId` luôn có mặt (null nếu từ `extra`); trường tùy chọn khác vắng mặt thì không xuất.
- **`content_version(normalized)`:** sha256 rút gọn 12 hex của JSON chuẩn hóa (khóa được sắp, không tính chính `contentVersion`). Hàm nhận dict đã chuẩn hóa (đúng đầu ra của model), không nhận YAML thô; 02-3 gọi sau khi sinh bố cục mặc định.
- **Định dạng soạn** (`clp/content/authoring.py`): mỗi bước là một mục một khóa (`intro`, `writing`, `grammar`, `exercises`, `speaking`, `sound_intro`, `tone_contour_intro`); `new_words` nhận cả `{word: 你好}` lẫn chuỗi trần `你好`; `steps` vắng = `None` (dùng bố cục mặc định ở 02-3), khác với `[]`; trường lạ là lỗi (bắt gõ nhầm); `type: auto` bắt buộc có `count`, các loại khác cấm `count`; mục `speaking` cần đúng một trong `word`/`sentence`/`syllable`/`answer`.
- **Lỗi theo `file:dòng`:** `ruamel.yaml` (round-trip) giữ số dòng; lỗi Pydantic được ánh xạ về dòng của phần tử sâu nhất tìm thấy (khóa vắng thì dòng của mục chứa nó). Báo **mọi** lỗi trong một file, sắp theo dòng; khóa YAML trùng, lỗi cú pháp, gốc không đúng dạng đều có dòng.
- `packages/core` thêm phụ thuộc `zod` (cho `content.ts` và `guest.ts` sau này), vẫn không có IO.
- **Chưa làm (02-1 chỉ là hình dạng):** `stages.yaml`, `_plan.yaml`, `exam/*.yaml`, `pron/sounds.yaml`; quy tắc nội dung (02-2); chuẩn hóa và ghi DB (02-3).
