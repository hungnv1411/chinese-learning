from pathlib import Path

import pytest

from clp.content.loader import ContentError, load_grammar_file, load_unit_file

SAMPLES = Path(__file__).resolve().parent / "fixtures" / "content_samples"


def write(tmp_path: Path, text: str, name: str = "u01.yaml") -> Path:
    p = tmp_path / name
    p.write_text(text, encoding="utf-8")
    return p


def issues(path: Path, loader=load_unit_file):
    with pytest.raises(ContentError) as e:
        loader(path)
    return e.value.issues


BASE = """\
id: hsk1-u01
stage: hsk1
order: 1
title: Số đếm
lessons:
  - id: hsk1-u01-l01
    title: Một hai ba
    new_words: [一]
    sentences:
      - id: s-1
        zh: 一
        en: One
        pinyin: yī
"""


class TestValidFiles:
    def test_sample_unit_loads(self):
        unit = load_unit_file(SAMPLES / "hsk1" / "u03-greetings.yaml")
        assert (unit.id, unit.stage, unit.order) == ("hsk1-u03", "hsk1", 3)
        l1, l4, cp = unit.lessons
        assert [w.word for w in l1.new_words] == ["你好", "您", "老师"]
        assert [w.extra for w in l1.new_words] == [False, True, False]
        assert l1.type == "normal" and cp.type == "checkpoint"
        assert l4.grammar == "hsk1-g012"
        assert l1.tips["你好"].startswith("Hai thanh 3")

    def test_steps_become_typed_in_order(self):
        steps = load_unit_file(SAMPLES / "hsk1" / "u03-greetings.yaml").lessons[0].steps
        assert [s.kind for s in steps or []] == ["intro", "writing", "exercises", "speaking"]
        assert steps[0].intro == ["你好", "您", "老师"]
        assert steps[1].writing == "auto"
        assert [(i.type, i.count) for i in steps[2].exercises][-1] == ("auto", 3)
        assert [(i.mode, i.ref) for i in steps[3].speaking] == [
            ("word", "你好"),
            ("sentence", "s-hsk1-u03-001"),
        ]

    def test_missing_steps_is_none_not_empty(self):
        unit = load_unit_file(SAMPLES / "hsk1" / "u03-greetings.yaml")
        assert unit.lessons[1].steps is None

    def test_grammar_file(self):
        g = load_grammar_file(SAMPLES / "grammar-hsk1.yaml")
        assert g[0].id == "hsk1-g012" and g[0].examples[1].en == "How are you?"


class TestErrorsCarryFileAndLine:
    def test_missing_required_field_points_to_the_lesson(self, tmp_path):
        p = write(tmp_path, BASE.replace("        zh: 一\n", ""))
        (issue,) = issues(p)
        assert issue.file == p
        assert issue.line == 10  # mục câu trong danh sách sentences
        assert "zh" in str(issue)
        assert str(issue).startswith(f"{p}:10:")

    def test_empty_pinyin_points_to_the_pinyin_line(self, tmp_path):
        p = write(tmp_path, BASE.replace("pinyin: yī", 'pinyin: ""'))
        (issue,) = issues(p)
        assert issue.line == 13 and "pinyin" in issue.path

    def test_unknown_exercise_type(self, tmp_path):
        text = BASE + "    steps:\n      - exercises:\n          - { type: khong_co, target: 一 }\n"
        (issue,) = issues(write(tmp_path, text))
        assert issue.line == 16 and "khong_co" in str(issue)

    def test_step_with_two_keys_or_unknown_key(self, tmp_path):
        text = BASE + "    steps:\n      - intro: [一]\n        writing: auto\n"
        (i1,) = issues(write(tmp_path, text))
        assert i1.line == 15 and "đúng một" in str(i1)
        text = BASE + "    steps:\n      - dance: [一]\n"
        (i2,) = issues(write(tmp_path, text, "u02.yaml"))
        assert i2.line == 15 and "dance" in str(i2)

    def test_speaking_item_needs_exactly_one_target(self, tmp_path):
        text = BASE + "    steps:\n      - speaking:\n          - { word: 一, sentence: s-1 }\n"
        (issue,) = issues(write(tmp_path, text))
        assert issue.line == 16

    def test_reports_every_problem_not_only_the_first(self, tmp_path):
        text = BASE.replace("title: Số đếm\n", "").replace("        en: One\n", "")
        found = issues(write(tmp_path, text))
        assert len(found) == 2
        assert [i.line for i in found] == sorted(i.line for i in found)

    def test_unknown_field_is_an_error_to_catch_typos(self, tmp_path):
        text = BASE.replace("order: 1\n", "order: 1\nordr: 2\n")
        (issue,) = issues(write(tmp_path, text))
        assert issue.line == 4 and "ordr" in issue.path

    def test_yaml_syntax_error_has_line(self, tmp_path):
        (issue,) = issues(write(tmp_path, "id: x\nlessons: [\n  - a\n  : :\n"))
        assert issue.line >= 2

    def test_duplicate_yaml_key_is_rejected(self, tmp_path):
        (issue,) = issues(write(tmp_path, "id: a\nid: b\n"))
        assert issue.line == 2 and "id" in str(issue)

    def test_not_a_mapping(self, tmp_path):
        (issue,) = issues(write(tmp_path, "- 1\n- 2\n"))
        assert issue.line == 1

    def test_grammar_file_errors_have_line(self, tmp_path):
        text = "- id: g1\n  hsk_code: x\n  title: t\n  pattern: p\n  examples: []\n"
        (issue,) = issues(write(tmp_path, text, "g.yaml"), load_grammar_file)
        assert issue.line == 1 and "explanation_vi" in str(issue)
