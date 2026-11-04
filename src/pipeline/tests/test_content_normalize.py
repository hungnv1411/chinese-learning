"""02-3 (phần thuần): chuẩn hóa YAML soạn → JSON `lesson.content`."""

from pathlib import Path

import pytest

from clp.content.loader import load_unit
from clp.content.models import LessonContent
from clp.content.normalize import DEFAULT_AUTO_EXERCISES, NormContext, normalize_content

STROKES = set("你好老师吗谢学习")
CTX = NormContext(
    stage_levels={"hsk1": 1, "hsk2": 2},
    stage_order=["pron", "hsk1", "hsk2"],
    hsk_word_ids={
        (1, "你好"): [10],
        (1, "老师"): [11],
        (1, "好"): [12, 13],
        (1, "吗"): [14],
        (2, "学习"): [20],
    },
    stroke_chars=STROKES,
)


def unit(tmp_path: Path, text: str, name="u.yaml"):
    p = tmp_path / name
    p.write_text(text, encoding="utf-8")
    return load_unit(p)


HEADER = "id: hsk1-u01\nstage: hsk1\norder: 1\ntitle: T\nlessons:\n"
L1 = """\
  - id: hsk1-u01-l01
    title: Xin chào
    new_words: [你好, 老师]
    sentences:
      - { id: s-1, zh: 老师好！, en: "Hello", pinyin: "lǎoshī hǎo!", tatoeba_id: 99 }
      - { id: s-2, zh: 你好吗？, en: "How are you?", pinyin: "nǐ hǎo ma?" }
    tips:
      你好: Hai thanh 3 đi liền nhau.
"""


def lessons(tmp_path, text, **kw):
    return normalize_content([unit(tmp_path, text)], CTX, **kw).lessons


def test_default_layout_when_steps_missing(tmp_path):
    (nl,) = lessons(tmp_path, HEADER + L1)
    kinds = [
        (s.kind, getattr(s, "word", None) or getattr(s, "char", None)) for s in nl.content.steps
    ]
    assert kinds == [
        ("intro", "你好"),
        ("intro", "老师"),
        ("writing", "你"),
        ("writing", "好"),
        ("writing", "老"),
        ("writing", "师"),
        ("exercise_auto", None),
        ("speaking", None),
        ("speaking", None),
    ]
    assert nl.content.steps[6].count == DEFAULT_AUTO_EXERCISES == 8
    assert [(s.mode, s.ref) for s in nl.content.steps[7:]] == [
        ("word", "你好"),
        ("sentence", "s-1"),
    ]


def test_default_layout_includes_grammar_step_when_lesson_has_grammar(tmp_path):
    text = HEADER + L1.replace(
        "    title: Xin chào\n", "    title: Xin chào\n    grammar: hsk1-g012\n"
    )
    (nl,) = lessons(tmp_path, text)
    kinds = [s.kind for s in nl.content.steps]
    assert kinds.index("grammar") == kinds.index("exercise_auto") - 1
    assert nl.content.steps[kinds.index("grammar")].grammar_id == "hsk1-g012"


def test_explicit_steps_are_converted_one_item_per_step(tmp_path):
    text = (
        HEADER
        + L1
        + """\
    steps:
      - intro: [你好, 老师]
      - writing: auto
      - exercises:
          - { type: pick_tone, target: 你好 }
          - { type: arrange, sentence: s-1 }
          - { type: auto, count: 4 }
      - speaking:
          - { word: 你好 }
          - { sentence: s-2 }
"""
    )
    (nl,) = lessons(tmp_path, text)
    got = [s.model_dump(mode="json", by_alias=True) for s in nl.content.steps]
    assert got[2:4] == [{"kind": "writing", "char": "你"}, {"kind": "writing", "char": "好"}][:2]
    assert {"kind": "exercise", "type": "pick_tone", "target": "你好"} in got
    assert {"kind": "exercise", "type": "arrange", "sentence": "s-1"} in got
    assert {"kind": "exercise_auto", "count": 4} in got
    assert got[-2:] == [
        {"kind": "speaking", "mode": "word", "ref": "你好"},
        {"kind": "speaking", "mode": "sentence", "ref": "s-2"},
    ]
    # thứ tự: intro, intro, writing×4, rồi bài tập, rồi nói
    assert [s["kind"] for s in got] == ["intro", "intro"] + ["writing"] * 4 + ["exercise"] * 2 + [
        "exercise_auto",
        "speaking",
        "speaking",
    ]


def test_writing_auto_skips_chars_seen_earlier_and_chars_without_strokes(tmp_path):
    first = unit(tmp_path, HEADER + L1, "a.yaml")
    second_text = (
        "id: hsk1-u02\nstage: hsk1\norder: 2\ntitle: T2\nlessons:\n"
        "  - id: hsk1-u02-l01\n    title: B\n    new_words: [吗, 老师]\n"
        "    sentences:\n      - { id: s-3, zh: 好吗？, en: ok, pinyin: hǎo ma? }\n"
    )
    ctx = NormContext(**{**CTX.__dict__, "stroke_chars": STROKES - {"吗"}})
    norm = normalize_content([unit(tmp_path, second_text, "b.yaml"), first], ctx)
    b = next(x for x in norm.lessons if x.lesson_id == "hsk1-u02-l01")
    assert [
        s.char for s in b.content.steps if s.kind == "writing"
    ] == []  # 师老已học, 吗 không có nét
    assert b.content.new_chars == ["吗"]
    assert any(w.code == "writing_skipped_no_strokes" and "吗" in w.message for w in norm.warnings)


def test_new_words_carry_hsk_word_id_and_extra_flag(tmp_path):
    text = HEADER + L1.replace("[你好, 老师]", "[好, { word: 西瓜, extra: true }]")
    (nl,) = lessons(tmp_path, text)
    assert [(w.word, w.hsk_word_id, w.extra) for w in nl.content.new_words] == [
        ("好", 12, False),
        ("西瓜", None, True),
    ]
    assert nl.word_ids == [
        12,
        13,
    ]  # mọi hàng hsk_word khớp (cùng cấp, cùng chữ), không tính từ extra
    assert nl.chars == ["好", "西", "瓜"]


def test_sentences_tips_and_tatoeba_id_are_copied(tmp_path):
    (nl,) = lessons(tmp_path, HEADER + L1)
    s1, s2 = nl.content.sentences
    assert (s1.id, s1.tatoeba_id, s2.tatoeba_id) == ("s-1", 99, None)
    assert nl.content.tips == {"你好": "Hai thanh 3 đi liền nhau."}


def test_checkpoint_has_no_steps_words_or_chars(tmp_path):
    text = HEADER + "  - id: hsk1-u01-cp\n    type: checkpoint\n    title: Ôn tập\n"
    (nl,) = lessons(tmp_path, text)
    assert nl.kind == "checkpoint"
    assert nl.content.steps == [] and nl.content.new_words == [] and nl.word_ids == []


def test_content_version_is_stable_and_per_lesson(tmp_path):
    two = (
        HEADER
        + L1
        + "  - id: hsk1-u01-l02\n    title: B\n    new_words: [吗]\n    sentences:\n      - { id: s-9, zh: 好吗？, en: ok, pinyin: hǎo ma? }\n"
    )
    a1 = {x.lesson_id: x.content.content_version for x in lessons(tmp_path, two)}
    a2 = {x.lesson_id: x.content.content_version for x in lessons(tmp_path, two)}
    assert a1 == a2
    edited = two.replace("Hai thanh 3 đi liền nhau.", "Hai thanh ba đi liền nhau.")
    b = {x.lesson_id: x.content.content_version for x in lessons(tmp_path, edited)}
    assert b["hsk1-u01-l01"] != a1["hsk1-u01-l01"]
    assert b["hsk1-u01-l02"] == a1["hsk1-u01-l02"]


def test_output_validates_against_the_contract(tmp_path):
    (nl,) = lessons(tmp_path, HEADER + L1)
    dumped = nl.content.model_dump(mode="json", by_alias=True)
    assert LessonContent.model_validate(dumped).content_version == nl.content.content_version


def test_positions_follow_file_order(tmp_path):
    two = HEADER + L1 + "  - id: hsk1-u01-cp\n    type: checkpoint\n    title: Ôn\n"
    res = lessons(tmp_path, two)
    assert [(x.lesson_id, x.unit_id, x.order) for x in res] == [
        ("hsk1-u01-l01", "hsk1-u01", 1),
        ("hsk1-u01-cp", "hsk1-u01", 2),
    ]


@pytest.mark.parametrize("auto_without_grammar", [True])
def test_grammar_auto_needs_lesson_grammar(tmp_path, auto_without_grammar):
    from clp.content.rules import Context, validate_content

    text = HEADER + L1 + "    steps:\n      - grammar: auto\n"
    ctx = Context(
        hsk_words={1: {"你好", "老师"}},
        stroke_chars=STROKES,
        stage_levels={"hsk1": 1},
        stage_order=["hsk1"],
        grammar_ids=set(),
    )
    report = validate_content([unit(tmp_path, text)], [], ctx)
    assert "grammar_auto_without_grammar" in [f.code for f in report.errors]
