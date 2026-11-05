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

## 02-2: quy tắc kiểm tra nội dung
- **Cài đặt:** `clp/content/rules.py` (`validate_content(units, grammar, ctx) -> Report`) nhận `Context` (từ HSK theo cấp, chữ có dữ liệu nét, id bài đã có trong DB, id ngữ pháp/âm, bộ tách từ). Mỗi phát hiện có `code`, file, dòng; `check-content` (`clp/content/check.py`) dựng `Context` từ DB và đọc `content/<lộ trình>/u*.yaml`, `content/grammar/*.yaml`, in báo cáo, thoát mã 1 nếu có lỗi, không ghi DB. `loader.load_unit/load_grammar` trả kèm cây YAML để tra dòng.
- **Thứ tự "đã học":** lộ trình (`pron, hsk1, hsk2, hsk3`) → `order` chủ đề → thứ tự bài trong file; đưa file theo thứ tự nào cũng được. Hằng số lộ trình nằm ở `check.py` cho tới khi có `stages.yaml` (02-3).
- **Chặn (lỗi):** `duplicate_id` (chủ đề, bài, câu, điểm ngữ pháp), `published_lesson_missing`, `unknown_stage`, `word_not_in_hsk` (so với `hsk_word` đúng cấp của lộ trình, trừ `extra: true`), `word_taught_twice`, `missing_intro`, `intro_not_new`, `missing_writing`, `too_few_exercises` (≥ 6, tính cả `auto`), `too_few_speaking` (≥ 2; Phát âm ≥ 3), `default_layout_incomplete`, `checkpoint_has_steps`, `unknown_sentence`, `unknown_grammar`, `unknown_sound`, `unknown_word_ref`, và với Phát âm: `pron_steps_required`, `missing_pron_cards` / `too_many_pron_cards` (1–4 thẻ), `writing_outside_unit_8`, `missing_writing` ở chủ đề 8.
- **Cảnh báo:** `sentence_unlearned_word` (câu dùng từ chưa học đến bài đó; cần bộ tách từ), `word_not_introduced` (từ mới không có trong `intro`), `grammar_step_missing` (bài có `grammar` nhưng `steps` không có bước ngữ pháp).
- **Quyết định phải làm rõ khi viết quy tắc:**
  - `missing_writing` chỉ đòi khi bài có chữ mới **chưa học ở bài nào trước** *và* chữ đó có dữ liệu nét; chữ không có nét bị 02-3 bỏ khỏi `writing: auto` kèm cảnh báo.
  - Mục tham chiếu `sentence` chỉ được dùng câu **của chính bài** (payload của bài chỉ chứa câu của bài).
  - `target` của bài tập và `word` của mục nói phải là từ hoặc chữ đã học đến bài đó (kể cả từ `extra`); bài Phát âm không kiểm tra `target` (là âm tiết).
  - Phát âm: `write_char` và bước `writing` ngoài chủ đề 8 là lỗi; mọi bài (không phải checkpoint) ở chủ đề 8 phải có bước `writing`.
  - Quy tắc "câu thiếu `zh`/`en`/`pinyin`" và "`type` bài tập không hợp lệ" nằm ở bước đọc file (02-1), không lặp lại ở đây.
- **Phát hiện từ dữ liệu thật:** danh sách HSK 2021 **không có `你好`** (chỉ có `你` và `好`), nhưng ví dụ trong spec (`content-format.md`) dạy `你好` làm từ mới của HSK 1. Bộ kiểm tra bắt đúng điều này. Khi soạn đợt D-1 phải chọn: dạy `你`, `好` rồi dùng `你好` như cụm trong câu, hoặc đánh `extra: true`. Sửa ví dụ trong spec cho khỏi gây hiểu nhầm là việc cho chủ dự án/02-3.

## 02-3: chuẩn hóa và nhập nội dung
- **Định dạng đề xuất (chủ dự án đổi được):**
  - `content/stages.yaml`: danh sách `{id, order, title, description?, has_certificate?, level?}`; `level` là cấp HSK dùng cho quy tắc từ mới (`pron` không có). Đã tạo file với 4 lộ trình (pron=1, hsk1=2, hsk2=3, hsk3=4). Không có file này thì `check-content` dùng mặc định, còn `import-content` dừng (`stages_missing`).
  - `content/<lộ trình>/_plan.yaml`: `{units: [{id, order, title, description?, illustration?, words?, grammar?}]}`. 02-3 chỉ dùng id, thứ tự, tên; `words`/`grammar` để dành cho `plan_units` (02-5) và báo cáo độ phủ (02-4).
- **Chủ đề "Sắp ra mắt":** chủ đề có trong `_plan.yaml` mà chưa có file → hàng `unit` với `published = false`, không có bài. Có file → `published = true`, thông tin lấy từ file. Hai chủ đề cùng `(lộ trình, order)` là lỗi `duplicate_unit_order`.
- **Chuẩn hóa** (`clp/content/normalize.py`, hàm thuần): mỗi mục trong bước YAML thành một bước JSON (`intro: [a, b]` → hai bước `intro`; `exercises` → từng `exercise`, `type: auto` → `exercise_auto`; `speaking`, `sound_intro`, `tone_contour_intro` tương tự). `grammar: auto` lấy `lesson.grammar` (thiếu thì lỗi `grammar_auto_without_grammar`).
- **Bố cục mặc định** (khi `steps` vắng): intro mỗi từ mới → writing mỗi chữ mới có nét → grammar (nếu bài có) → `exercise_auto` 8 câu → nói từ mới đầu tiên và câu đầu tiên.
- **`newChars`** = chữ xuất hiện **lần đầu** trong bài theo thứ tự toàn cục (kể cả chữ không có nét); `writing: auto` chỉ lấy chữ trong đó có `has_stroke_data` và ghi cảnh báo `writing_skipped_no_strokes` cho chữ bị bỏ. `lesson_char` chỉ ghi chữ đã có trong bảng `hanzi` (chữ của từ `extra` ngoài bảng không vào thống kê chữ).
- **`hskWordId` / `lesson_word`:** tra theo `(cấp của lộ trình, chữ)`. Một chữ có thể có nhiều hàng `hsk_word` cùng cấp (nhiều cách đọc): `hskWordId` trong JSON là id nhỏ nhất, `lesson_word` ghi **mọi** hàng khớp để độ phủ tính đủ. Từ `extra` không có `hskWordId` và không vào `lesson_word`. Bài `checkpoint` không có từ, chữ, bước.
- **`contentVersion`** tính trên JSON chuẩn hóa nên chỉ đổi khi bài đó đổi (có test). `content_meta.content_version` mặc định là hash của tất cả `contentVersion` (đổi khi bất kỳ bài nào đổi); truyền `--version <git sha>` để ghi bản của lần nhập như plan.
- **Ghi DB một transaction** (`clp/content/importer.py`): stage → unit → lesson → lesson_word/lesson_char (xóa rồi ghi lại theo bài) → grammar_point → content_meta. Đổi thứ tự bài/chủ đề không vướng ràng buộc duy nhất nhờ đặt tạm thứ tự âm trước khi ghi. Có lỗi chặn thì dừng **trước khi** ghi (`ContentCheckError`). `grammar_point.body_md` = `explanation_vi` + dòng `**Cấu trúc:** <pattern>`.
- **Lệnh:** `clp import-content [--content-dir] [--version] [--check]`; `--check` giống `check-content`.
- **Chưa làm (02-4):** báo cáo độ phủ và `stage.exam_open`; `estimated_minutes` để NULL.

## 02-4: báo cáo độ phủ và `exam_open`
- **Cài đặt:** `clp/content/coverage.py`. `import_content` tính độ phủ **trong cùng transaction** sau khi ghi nội dung, ghi `out/coverage-<lộ trình>.md` (chỉ lộ trình có `level`; `pron` không có bài kiểm tra cuối kiểu chứng nhận) và cập nhật `stage.exam_open`. Nếu nội dung hoặc dữ liệu HSK lùi (ví dụ thêm từ HSK mới) thì lần nhập sau đóng lại `exam_open`.
- **Điều kiện mở bài kiểm tra cuối** (`StageCoverage.blockers`): có ít nhất một chủ đề, mọi chủ đề đã phát hành, 100% từ HSK (kể cả mọi cách đọc) và 100% điểm ngữ pháp của cấp đã dạy, ngân hàng đề đủ. Chữ HSK chưa xuất hiện chỉ báo cáo, không chặn (content-format §5 chỉ đòi từ và ngữ pháp). Lỗi chặn của nội dung đã làm `import_content` dừng từ trước.
- **Từ đã dạy:** có hàng `lesson_word` trong bài của lộ trình đó. Chữ đã xuất hiện: có `lesson_char` ở **bất kỳ** bài nào (một chữ HSK 2 học sớm ở HSK 1 vẫn tính).
- **Ghép điểm ngữ pháp tự soạn với danh sách HSK** (giả định, cần chủ dự án xác nhận): `grammar_point.hsk_code` dạng `一级-语法-012` được hiểu là điểm thứ 12 (theo thứ tự `hsk30-gNNN`) của danh sách `hsk_grammar` cấp 1. Mã không đúng dạng, sai cấp hoặc ngoài phạm vi vào danh sách `grammar_unmapped` và **không** tính là đã dạy. Điểm ngữ pháp "được dạy" khi có bài dùng bước `grammar` trỏ tới nó.
- **Ngân hàng đề:** cần ≥ 3 × số câu một đề (HSK 1: 60/60/15/15, HSK 2: 75/75/24/18, HSK 3: 90/90/30/24). Khóa `skill` của `exam_item` giả định là `listening`, `reading`, `writing`, `speaking`; module 12 phải dùng đúng hoặc sửa `EXAM_PAPER` ở một chỗ này. Bảng số câu mỗi đề lặp lại `lib/exam/config.ts` (12) vì pipeline chạy độc lập; nên có test đối chiếu khi viết 12.
- **Báo cáo** liệt kê tối đa 200 mục mỗi danh sách, kèm "… và N … nữa".
- **Số thật hiện tại:** HSK 1: 512 từ, 48 điểm ngữ pháp, 300 chữ chưa có bài; HSK 2: 776 và 82; HSK 3: 973 và 81. `exam_open = false` ở cả ba.
