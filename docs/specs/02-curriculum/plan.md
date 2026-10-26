# Plan thực hiện: 02 – Lộ trình nội dung (định dạng, nhập, soạn bằng AI)

Spec: [curriculum-structure.md](curriculum-structure.md), [content-format.md](content-format.md), [authoring-workflow.md](authoring-workflow.md). Quy ước chung: [00-foundation/plan.md](../00-foundation/plan.md).

Module có ba phần: (A) hợp đồng dữ liệu `lesson.content`, (B) `import_content` (B6 của pipeline), (C) script soạn và rà soát bằng AI, rồi (D) sản xuất nội dung theo đợt.

## 1. Phụ thuộc

- 01: `hsk_word`, `dict_entry`, `hanzi`, `sentence` phải có trước khi kiểm tra tham chiếu.
- Cung cấp cho: 05 (`CurriculumIndex`), 06 (`lesson.content`), 10 (bài Phát âm), 12 (`exam_item`, điều kiện phát hành).

## 2. (A) Hợp đồng `lesson.content` — `packages/core/src/content.ts`

YAML là định dạng **soạn**. `import_content` chuẩn hóa thành JSON lưu ở `lesson.content`. JSON này là hợp đồng giữa pipeline (Python) và web (TS):

```ts
type StepSpec =
  | { kind: 'intro'; word: string }                       // simplified của từ mới
  | { kind: 'sound_intro'; sound: string }                 // id trong pron/sounds.yaml
  | { kind: 'tone_contour_intro'; tone: 1 | 2 | 3 | 4 | 5 }
  | { kind: 'writing'; char: string }
  | { kind: 'grammar'; grammarId: string }
  | { kind: 'exercise'; type: ExerciseType; target?: string; sentence?: string }
  | { kind: 'exercise_auto'; count: number }
  | { kind: 'speaking'; mode: 'syllable' | 'word' | 'sentence' | 'answer'; ref: string };

interface LessonContent {
  contentVersion: string;
  type: 'normal' | 'checkpoint';
  newWords: { word: string; hskWordId: number | null; extra: boolean }[];
  newChars: string[];
  sentences: { id: string; zh: string; en: string; pinyin: string; tatoebaId?: number }[];
  tips: Record<string, string>;
  steps: StepSpec[];                                      // rỗng với checkpoint (sinh lúc chạy)
}
```

`ExerciseType` là đúng 14 mã ở [exercise-types.md](../06-lesson/exercise-types.md) + `pinyin_pick_audio` (10, bài kiểm tra pinyin).

- Pydantic ở pipeline sinh JSON; zod ở web parse. **Test hợp đồng:** pipeline xuất `pipeline/tests/fixtures/lesson_content/*.json` từ YAML mẫu; Vitest ở `packages/core` parse mọi file đó bằng `LessonContentSchema` không lỗi.
- `contentVersion` = sha256 rút gọn (12 ký tự) của JSON đã chuẩn hóa của bài. Sửa nội dung bài thì đổi; bài khác không đổi. `content_meta.content_version` là bản của cả lần nhập (git short sha).

## 3. (B) `import_content`

### Bước 1. Đọc và kiểm tra schema
- Đọc `content/stages.yaml`, `content/<stage>/_plan.yaml`, `content/<stage>/u*.yaml`, `content/grammar/*.yaml`, `content/pron/sounds.yaml`, `content/exam/*.yaml`.
- Pydantic model cho file chủ đề (đúng ví dụ ở content-format §2): `id, stage, order, title, description, illustration, lessons[]`; bài: `id, type?, title, grammar?, new_words, sentences, steps?, tips`.
- Lỗi báo **file + dòng** (dùng `ruamel.yaml` để có số dòng). Có lỗi thì **dừng**, không ghi DB.
- `--check`: chỉ kiểm tra, không ghi.

### Bước 2. Quy tắc kiểm tra (content-format §4, pronunciation §3)
Mỗi quy tắc một test với YAML mẫu sai:

| Quy tắc | Mức |
|---|---|
| `id` duy nhất toàn bộ nội dung | Chặn |
| Bài đã phát hành (id có trong DB) bị mất hoặc đổi id | Chặn |
| `word` không có trong `hsk_word` của cấp và không `extra: true` | Chặn |
| Một từ HSK là từ mới ở hai bài | Chặn |
| Bài thường HSK thiếu `intro`, `writing` (khi có chữ mới), `exercises` ≥ 6 sau khi tính `auto`, `speaking` ≥ 2 | Chặn |
| Bài `pron`: bài tập ≥ 6, nói ≥ 3; `writing` chỉ bắt buộc ở chủ đề 8 | Chặn |
| Câu thiếu `zh`, `en`, `pinyin` | Chặn |
| `type` bài tập không thuộc danh sách | Chặn |
| Tham chiếu `sentence`, `grammar`, `sound` không tồn tại | Chặn |
| Câu dùng từ chưa học (jieba so với từ đã học tính đến bài này) | Cảnh báo |

### Bước 3. Chuẩn hóa
- **Bố cục mặc định** khi `steps` trống (curriculum-structure §4): `intro` mỗi từ mới → `writing` mỗi chữ mới → `grammar` (nếu có) → `exercise_auto` đủ 8 câu → `speaking` 1 từ mới đầu tiên + 1 câu đầu tiên.
- `writing: auto` → mọi chữ trong `new_words` **chưa xuất hiện** ở bài nào trước đó (thứ tự toàn cục: stage → unit → lesson), bỏ chữ `has_stroke_data = false` và ghi cảnh báo.
- `speaking: { word }` → `mode: 'word'`; `{ sentence }` → `mode: 'sentence'`; ở `pron` âm tiết → `mode: 'syllable'`.
- Ghi `stage`, `unit` (kèm `published`), `lesson`, `lesson_word`, `lesson_char`, `grammar_point` trong **một transaction**.
- Chủ đề có trong `_plan.yaml` nhưng chưa có file → `unit.published = false` (hiện “Sắp ra mắt” ở 05).
- `stage.exam_open = true` khi: mọi chủ đề đã phát hành, độ phủ 100% (bước 4), ngân hàng đề đủ (12 kiểm tra và báo về).
- Test: bài không có `steps` sinh đúng thứ tự mặc định; chữ 好 đã học ở bài trước không vào `writing` của bài sau; chạy 2 lần không đổi DB.

### Bước 4. Báo cáo độ phủ
- `/pipeline/out/coverage-<stage>.md`: từ HSK chưa được dạy, ngữ pháp chưa dạy, chữ HSK chưa xuất hiện.
- Test: thiếu 1 từ trong YAML mẫu → báo cáo liệt kê đúng từ đó và `exam_open = false`.

## 4. (C) Soạn bằng AI — `/pipeline/authoring`

```
authoring/
  plan_units.py     bước 1: chia chủ đề → content/<stage>/_plan.yaml
  author_unit.py    bước 2: soạn một chủ đề → content/<stage>/uNN-*.yaml
  review_unit.py    bước 3: rà soát (model và prompt khác)
  crosscheck.py     bước 4: kiểm tra đối chiếu tự động
  prompts/*.md      prompt (tiếng Việt + yêu cầu riêng cho người Việt, mục 5 của spec)
  run_stage.py      chạy cả vòng cho một lộ trình
```

- Dùng Anthropic SDK (Python). Lượt soạn: `claude-opus-5-5`. Lượt rà soát: `claude-sonnet-5-5` với prompt rà soát riêng (spec yêu cầu model và prompt khác nhau). Model đặt trong cấu hình.
- Đầu ra của model bắt buộc theo schema (dùng tool/structured output), rồi ghi YAML.
- Lưu `content/<stage>/_meta/<unit>.json`: prompt, model, phiên bản script, thời điểm, số vòng.

### Bước 5. `plan_units`
- Đầu vào: từ, chữ, ngữ pháp HSK của cấp; gợi ý chủ đề ở curriculum-structure §3.
- Kiểm tra máy: phủ đủ 100% từ và ngữ pháp, không từ nào gán hai lần. Lệch → gửi lại cho model kèm danh sách lỗi (tối đa 2 lần), vẫn lệch thì dừng.
- Test (model giả): kế hoạch thiếu từ bị phát hiện; gán trùng bị phát hiện.

### Bước 6. `author_unit` + `review_unit`
- Đầu vào theo spec §2.2: từ của chủ đề (pinyin + nghĩa CC-CEDICT), Hán Việt + phân tích chữ, từ đã học tính đến chủ đề, câu Tatoeba đã lọc theo cấp, ngữ pháp.
- Vòng: soạn → rà soát (danh sách ở spec §3) → nếu có lỗi thì soạn lại phần lỗi → tối đa 2 vòng.
- AI **không** được viết âm Hán Việt vào YAML bài. Chữ thiếu Hán Việt trong Unihan: AI đề xuất, script ghi vào `overrides/han_viet.yaml` với `source: ai`.

### Bước 7. `crosscheck`
Đúng bảng ở authoring-workflow §4:

| Kiểm tra | Mức | Test |
|---|---|---|
| Pinyin từ ≠ pinyin mục CC-CEDICT đã ghép | Chặn | YAML ghi `hao4 chi1` cho 好吃 → lỗi |
| Pinyin câu ≠ `pypinyin` (bỏ qua khác biệt chỉ do biến điệu) | Cảnh báo; lệch ở chữ đa âm → đưa lại cho review riêng câu đó | |
| Âm Hán Việt trong YAML không khớp Unihan/overrides | Chặn | |
| Câu có `tatoebaId` mà `zh`/`en` khác nguyên văn | Chặn | |
| Từ chưa học trong câu | Cảnh báo | |
| Mẹo > 300 ký tự, giải thích ngữ pháp > 800 ký tự | Cảnh báo | |

### Bước 8. `radicals_vi.yaml`
- AI soạn tên + nghĩa tiếng Việt của 214 bộ thủ Khang Hy theo định dạng `{ radical, name_vi, meaning_vi }`. Kiểm tra máy: đủ 214 mục, không trùng.

## 5. (D) Sản xuất nội dung

| Đợt | Phạm vi | Điều kiện xong |
|---|---|---|
| D-1 (cho dev, trước M6) | Phát âm đủ 8 chủ đề + HSK 1 chủ đề 1–2 | `import_content --check` qua, có audio, dùng làm seed `dev` |
| D-2 | Toàn bộ HSK 1 + ngân hàng đề HSK 1 | Độ phủ 100%, `exam_open = true` |
| D-3 | HSK 2 | như trên |
| D-4 | HSK 3 | như trên |

Mỗi đợt: `run_stage.py <stage>` → `crosscheck` → `import_content --check` → `generate_audio` (01) → commit → nhập vào prod.

Nội dung Phát âm (`sounds.yaml`, bài `sound_intro`/`tone_contour_intro`, so sánh với tiếng Việt) xem thêm [10-pronunciation/plan.md](../10-pronunciation/plan.md).

## 6. Xong module khi
- YAML mẫu ở content-format §2 nhập được và ra đúng JSON hợp đồng.
- Mọi quy tắc chặn có test và chặn đúng, báo đúng file + dòng.
- Đợt D-1 đã nhập vào DB dev.
