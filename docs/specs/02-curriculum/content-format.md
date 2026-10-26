# Định dạng file nội dung

Nội dung lộ trình là file YAML trong repo, sửa bằng Git và nhập vào DB bằng `import_content` ([01-content-data/import-pipeline.md](../01-content-data/import-pipeline.md)). Bản đầu không có trang quản trị để soạn nội dung.

## 1. Cấu trúc thư mục

```
/content
  stages.yaml                    # danh sách lộ trình
  radicals_vi.yaml               # tên & nghĩa tiếng Việt của bộ thủ
  grammar/hsk1.yaml              # giải thích ngữ pháp
  pron/u01-tones.yaml            # một file cho mỗi chủ đề
  hsk1/u01-numbers.yaml
  hsk1/u03-greetings.yaml
  exam/hsk1.yaml                 # ngân hàng đề kiểm tra cuối
  overrides/hsk_dict_map.yaml    # ghép tay từ HSK với từ điển
  overrides/han_viet.yaml        # bổ sung/sửa âm Hán Việt
  overrides/definitions.yaml     # nghĩa tiếng Anh rút gọn cho bài học
```

## 2. File chủ đề (ví dụ)

```yaml
id: hsk1-u03
stage: hsk1
order: 3
title: Chào hỏi
description: Chào hỏi, hỏi tên, hỏi thăm sức khỏe, tạm biệt.
illustration: units/hsk1-u03.svg

lessons:
  - id: hsk1-u03-l01
    title: Xin chào
    new_words:
      - { word: 你好 }
      - { word: 您 }
      - { word: 老师 }
    sentences:                       # câu dùng trong bài (giới thiệu, bài tập, nói)
      - id: s-hsk1-u03-001
        zh: 老师好！
        en: Hello, teacher!
        pinyin: lǎoshī hǎo!           # bắt buộc ghi rõ, đã qua kiểm tra đối chiếu
    steps:                           # có thể bỏ trống, khi đó dùng bố cục mặc định
      - intro: [你好, 您, 老师]
      - writing: auto                 # tự lấy các chữ chưa học trong new_words
      - exercises:
          - { type: listen_pick_hanzi, target: 你好 }
          - { type: hanzi_to_meaning, target: 老师 }
          - { type: meaning_to_hanzi, target: 您 }
          - { type: pick_tone, target: 你好 }   # đáp án: 2, 3 (thanh đọc thực tế)
          - { type: arrange, sentence: s-hsk1-u03-001 }
          - { type: auto, count: 3 }   # máy tự sinh thêm 3 câu từ từ đã học
      - speaking:
          - { word: 你好 }
          - { sentence: s-hsk1-u03-001 }
    tips:                            # mẹo tiếng Việt, hiện ở thẻ giới thiệu từ
      你好: Hai thanh 3 đi liền nhau thì thanh đầu đọc thành thanh 2 → ní hǎo.

  - id: hsk1-u03-l04
    title: Câu hỏi với 吗
    grammar: hsk1-g012                # tham chiếu tới grammar/hsk1.yaml
    new_words: [ ... ]

  - id: hsk1-u03-cp
    type: checkpoint
    title: Ôn tập chủ đề
    # để trống: máy tự sinh từ toàn bộ từ và ngữ pháp của chủ đề
```

## 3. File ngữ pháp (ví dụ)

```yaml
- id: hsk1-g012
  hsk_code: "一级-语法-012"            # mã trong danh sách HSK 2021
  title: Câu hỏi có/không với 吗
  explanation_vi: |
    Thêm **吗 (ma)** vào cuối câu trần thuật để thành câu hỏi có/không.
    Không đổi trật tự từ, giống “… không?” trong tiếng Việt.
  pattern: "Câu trần thuật + 吗？"
  examples:
    - { zh: 你是老师吗？, en: Are you a teacher? }
    - { zh: 你好吗？, en: How are you? }
```

## 4. Quy tắc kiểm tra (`import_content` phải từ chối nếu sai)

- `id` là duy nhất trên toàn bộ nội dung. **Không được đổi `id` của bài đã phát hành.**
- Mọi `word` phải có trong `hsk_word` của cấp đó, hoặc được đánh dấu `extra: true`.
- Một từ HSK không được là từ mới ở hai bài.
- Mọi bài thường của lộ trình HSK có đủ: `intro`, `writing` (trừ khi bài không có chữ mới), `exercises` (≥ 6 câu sau khi tự sinh), `speaking` (≥ 2 câu). Bài của giai đoạn Phát âm theo luật riêng ở [10-pronunciation §3](../10-pronunciation/pronunciation.md).
- Mọi câu trong `sentences` có `zh`, `en`, `pinyin`. Câu chỉ dùng từ đã học đến bài đó, hoặc từ có `extra`. Cảnh báo, không chặn, nếu câu có từ chưa học.
- `type` của bài tập phải là một dạng đã định nghĩa ở [exercise-types.md](../06-lesson/exercise-types.md).

## 5. Báo cáo độ phủ

`import_content` sinh báo cáo cho mỗi cấp HSK:
- Bao nhiêu từ và điểm ngữ pháp của danh sách HSK **chưa** được dạy trong bài nào.
- Bao nhiêu chữ của danh sách chữ HSK chưa xuất hiện.

Lộ trình chỉ được phát hành khi phủ đủ 100% từ và ngữ pháp của cấp đó.
