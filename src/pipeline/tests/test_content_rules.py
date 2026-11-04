"""02-2: quy tắc kiểm tra nội dung (chặn / cảnh báo). Mỗi quy tắc một test với YAML mẫu sai."""

from pathlib import Path

import pytest

from clp.content.loader import load_grammar, load_unit
from clp.content.rules import Context, validate_content
from clp.tatoeba import make_tokenizer

HSK1 = {"你好", "老师", "好", "吗", "谢谢", "再见"}
CTX_KW = {
    "hsk_words": {1: HSK1, 2: {"学习", "朋友"}},
    "stroke_chars": set("你好老师吗谢再见学习朋友"),
    "stage_levels": {"hsk1": 1, "hsk2": 2, "hsk3": 3},
    "stage_order": ["pron", "hsk1", "hsk2", "hsk3"],
    "grammar_ids": {"hsk1-g012"},
}

HSK_LESSON = """\
  - id: {id}
    title: Xin chào
    new_words: {words}
    sentences:
      - {{ id: {sid}, zh: 老师好！, en: "Hello, teacher!", pinyin: "lǎoshī hǎo!" }}
    steps:
      - intro: {words}
      - writing: auto
      - exercises:
          - {{ type: listen_pick_hanzi, target: 你好 }}
          - {{ type: hanzi_to_meaning, target: 老师 }}
          - {{ type: arrange, sentence: {sid} }}
          - {{ type: auto, count: 3 }}
      - speaking:
          - {{ word: 你好 }}
          - {{ sentence: {sid} }}
"""


def hsk_unit(
    lessons: str | None = None, unit_id="hsk1-u01", stage="hsk1", order=1, words="[你好, 老师, 好]"
):
    body = lessons or HSK_LESSON.format(id=f"{unit_id}-l01", words=words, sid=f"s-{unit_id}-1")
    return f"id: {unit_id}\nstage: {stage}\norder: {order}\ntitle: Chào hỏi\nlessons:\n{body}"


PRON_UNIT = """\
id: pron-u0{n}
stage: pron
order: {n}
title: Thanh điệu
lessons:
  - id: pron-u0{n}-l01
    title: Bốn thanh
    steps:
      - tone_contour_intro: [1, 2]
      - exercises:
{ex}
      - speaking:
{sp}
"""
PRON_EX = "\n".join("          - { type: pick_tone, target: ma1 }" for _ in range(6))
PRON_SP = "\n".join("          - { syllable: ma1 }" for _ in range(3))


def pron_unit(n=1, ex=PRON_EX, sp=PRON_SP):
    return PRON_UNIT.format(n=n, ex=ex, sp=sp)


class Env:
    def __init__(self, tmp_path: Path):
        self.dir = tmp_path
        self.units, self.grammar = [], []

    def unit(self, text: str, name: str | None = None):
        p = self.dir / (name or f"u{len(self.units)}.yaml")
        p.write_text(text, encoding="utf-8")
        self.units.append(load_unit(p))
        return p

    def check(self, **over):
        ctx = Context(**{**CTX_KW, **over})
        return validate_content(self.units, self.grammar, ctx)


@pytest.fixture
def env(tmp_path):
    return Env(tmp_path)


def codes(report, level="error"):
    return [f.code for f in (report.errors if level == "error" else report.warnings)]


class TestValid:
    def test_clean_content_has_no_findings(self, env):
        env.unit(hsk_unit())
        tok = make_tokenizer(sorted(HSK1))
        r = env.check(tokenize=tok.lcut)
        assert r.errors == [] and r.warnings == []
        assert r.ok

    def test_units_may_be_given_in_any_order(self, env):
        env.unit(hsk_unit(unit_id="hsk2-u01", stage="hsk2", words="[学习]"), "b.yaml")
        env.unit(hsk_unit(), "a.yaml")
        assert env.check().errors == []


class TestIds:
    def test_duplicate_lesson_id_across_files(self, env):
        env.unit(hsk_unit())
        env.unit(hsk_unit(unit_id="hsk1-u02", order=2).replace("hsk1-u02-l01", "hsk1-u01-l01"))
        assert "duplicate_id" in codes(env.check())

    def test_duplicate_sentence_unit_and_grammar_ids(self, env):
        env.unit(hsk_unit())
        env.unit(hsk_unit(unit_id="hsk1-u01", order=2, words="[吗]").replace("-l01", "-lx"))
        found = [f for f in env.check().errors if f.code == "duplicate_id"]
        assert any("hsk1-u01" in f.message for f in found)  # id chủ đề
        assert any("s-hsk1-u01-1" in f.message for f in found)  # id câu

    def test_duplicate_grammar_id(self, env, tmp_path):
        g = tmp_path / "g.yaml"
        item = "- { id: hsk1-g012, hsk_code: x, title: t, explanation_vi: e, pattern: p, examples: [] }\n"
        g.write_text(item * 2, encoding="utf-8")
        env.grammar.append(load_grammar(g))
        assert "duplicate_id" in codes(env.check())

    def test_published_lesson_must_still_exist(self, env):
        env.unit(hsk_unit())
        r = env.check(published_lesson_ids={"hsk1-u01-l01", "hsk1-u01-l09"})
        (f,) = [f for f in r.errors if f.code == "published_lesson_missing"]
        assert "hsk1-u01-l09" in f.message
        assert env.check(published_lesson_ids={"hsk1-u01-l01"}).errors == []


class TestWords:
    def test_word_must_be_in_hsk_list_of_the_stage_level(self, env):
        env.unit(hsk_unit(words="[你好, 老师, 好, 西瓜]"))
        (f,) = [f for f in env.check().errors if f.code == "word_not_in_hsk"]
        assert "西瓜" in f.message and f.file is not None and f.line

    def test_word_of_another_level_is_not_accepted(self, env):
        env.unit(hsk_unit(words="[你好, 老师, 好, 学习]"))  # 学习 là HSK 2
        assert "word_not_in_hsk" in codes(env.check())

    def test_extra_word_is_exempt(self, env):
        lesson = HSK_LESSON.format(id="hsk1-u01-l01", words="[你好, 老师, 好]", sid="s-1").replace(
            "[你好, 老师, 好]", "[你好, 老师, 好, { word: 西瓜, extra: true }]", 1
        )
        env.unit(hsk_unit(lesson))
        assert "word_not_in_hsk" not in codes(env.check())

    def test_hsk_word_new_in_two_lessons(self, env):
        env.unit(hsk_unit())
        env.unit(hsk_unit(unit_id="hsk1-u02", order=2, words="[你好]"))
        (f,) = [f for f in env.check().errors if f.code == "word_taught_twice"]
        assert "你好" in f.message and "hsk1-u01-l01" in f.message

    def test_extra_word_may_repeat(self, env):
        extra = "{ word: 西瓜, extra: true }"
        env.unit(
            hsk_unit(
                HSK_LESSON.format(id="a-l01", words="[你好, 老师, 好]", sid="s-a").replace(
                    "[你好, 老师, 好]", f"[你好, 老师, 好, {extra}]", 1
                )
            )
        )
        second = HSK_LESSON.format(id="b-l01", words="[吗]", sid="s-b").replace(
            "new_words: [吗]", f"new_words: [{extra}, 吗]", 1
        )
        env.unit(hsk_unit(second, unit_id="hsk1-u02", order=2))
        assert "word_taught_twice" not in codes(env.check())


class TestNormalHskLessonLayout:
    def lesson(self, steps: str, words="[你好, 老师, 好]") -> str:
        return (
            "  - id: hsk1-u01-l01\n    title: T\n"
            f"    new_words: {words}\n"
            '    sentences:\n      - { id: s-1, zh: 老师好！, en: "Hi", pinyin: "lǎoshī hǎo!" }\n'
            f"    steps:\n{steps}"
        )

    EX6 = (
        "      - exercises:\n"
        + "\n".join("          - { type: hanzi_to_meaning, target: 你好 }" for _ in range(6))
        + "\n"
    )
    SP2 = "      - speaking:\n          - { word: 你好 }\n          - { sentence: s-1 }\n"
    INTRO = "      - intro: [你好, 老师, 好]\n"
    WR = "      - writing: auto\n"

    def check(self, env, steps, **kw):
        env.unit(hsk_unit(self.lesson(steps, **kw)))
        return env.check()

    def test_complete_lesson_passes(self, env):
        assert self.check(env, self.INTRO + self.WR + self.EX6 + self.SP2).errors == []

    def test_missing_intro(self, env):
        assert "missing_intro" in codes(self.check(env, self.WR + self.EX6 + self.SP2))

    def test_new_words_missing_from_intro_is_a_warning(self, env):
        r = self.check(env, "      - intro: [你好]\n" + self.WR + self.EX6 + self.SP2)
        assert "word_not_introduced" in codes(r, "warning")

    def test_intro_of_word_that_is_not_new(self, env):
        r = self.check(
            env, "      - intro: [你好, 老师, 好, 谢谢]\n" + self.WR + self.EX6 + self.SP2
        )
        assert "intro_not_new" in codes(r)

    def test_missing_writing_when_there_are_new_chars(self, env):
        assert "missing_writing" in codes(self.check(env, self.INTRO + self.EX6 + self.SP2))

    def test_writing_not_needed_when_no_char_is_new(self, env):
        env.unit(hsk_unit())  # đã học 你好老师
        lesson = (
            "  - id: hsk1-u02-l01\n    title: T\n    new_words: [{ word: 好好, extra: true }]\n"
            '    sentences:\n      - { id: s-2, zh: 好好！, en: "Fine", pinyin: "hǎohǎo!" }\n'
            "    steps:\n      - intro: [好好]\n"
            + self.EX6.replace("你好", "好好")
            + "      - speaking:\n          - { word: 好好 }\n          - { sentence: s-2 }\n"
        )
        env.unit(hsk_unit(lesson, unit_id="hsk1-u02", order=2))
        assert "missing_writing" not in codes(env.check())

    def test_writing_not_needed_for_chars_without_stroke_data(self, env):
        r = self.check(env, self.INTRO + self.EX6 + self.SP2)
        assert "missing_writing" in codes(r)
        env.units.clear()
        env.unit(hsk_unit(self.lesson(self.INTRO + self.EX6 + self.SP2)), "no-stroke.yaml")
        assert "missing_writing" not in codes(env.check(stroke_chars=set()))

    def test_too_few_exercises_counts_auto(self, env):
        five = (
            "      - exercises:\n"
            + "\n".join(["          - { type: hanzi_to_meaning, target: 你好 }"] * 3)
            + "\n          - { type: auto, count: 2 }\n"
        )
        assert "too_few_exercises" in codes(self.check(env, self.INTRO + self.WR + five + self.SP2))
        env.units.clear()
        six = five.replace("count: 2", "count: 3")
        env.unit(hsk_unit(self.lesson(self.INTRO + self.WR + six + self.SP2)), "six.yaml")
        assert "too_few_exercises" not in codes(env.check())

    def test_too_few_speaking(self, env):
        one = "      - speaking:\n          - { word: 你好 }\n"
        assert "too_few_speaking" in codes(self.check(env, self.INTRO + self.WR + self.EX6 + one))

    def test_default_layout_needs_a_word_and_a_sentence(self, env):
        lesson = "  - id: hsk1-u01-l01\n    title: T\n    new_words: [你好]\n"
        env.unit(hsk_unit(lesson))
        assert "default_layout_incomplete" in codes(env.check())

    def test_default_layout_with_word_and_sentence_is_fine(self, env):
        lesson = (
            "  - id: hsk1-u01-l01\n    title: T\n    new_words: [你好, 老师, 好]\n"
            '    sentences:\n      - { id: s-1, zh: 老师好！, en: "Hi", pinyin: "lǎoshī hǎo!" }\n'
        )
        env.unit(hsk_unit(lesson))
        assert env.check().errors == []

    def test_checkpoint_has_no_steps_and_no_requirements(self, env):
        lesson = "  - id: hsk1-u01-cp\n    type: checkpoint\n    title: Ôn tập\n"
        env.unit(hsk_unit(lesson))
        assert env.check().errors == []
        env.units.clear()
        env.unit(hsk_unit(lesson + "    steps:\n      - intro: [你好]\n"), "cp2.yaml")
        assert "checkpoint_has_steps" in codes(env.check())


class TestPronunciation:
    def test_valid_pron_lesson(self, env):
        env.unit(pron_unit())
        assert env.check().errors == []

    def test_pron_needs_6_exercises_3_speaking_and_cards(self, env):
        env.unit(pron_unit(ex="\n".join(PRON_EX.splitlines()[:5])), "a.yaml")
        assert "too_few_exercises" in codes(env.check())
        env.units.clear()
        env.unit(pron_unit(sp="\n".join(PRON_SP.splitlines()[:2])), "b.yaml")
        assert "too_few_speaking" in codes(env.check())
        env.units.clear()
        env.unit(pron_unit().replace("      - tone_contour_intro: [1, 2]\n", ""), "c.yaml")
        assert "missing_pron_cards" in codes(env.check())

    def test_pron_lesson_must_declare_steps(self, env):
        env.unit(
            "id: pron-u01\nstage: pron\norder: 1\ntitle: T\nlessons:\n  - id: pron-u01-l01\n    title: T\n"
        )
        assert "pron_steps_required" in codes(env.check())

    def test_writing_only_in_unit_8(self, env):
        w = pron_unit(n=1).replace("      - speaking:", "      - writing: [一]\n      - speaking:")
        env.unit(w)
        assert "writing_outside_unit_8" in codes(env.check())
        env.units.clear()
        ex = PRON_EX + "\n          - { type: write_char, target: 一 }"
        env.unit(pron_unit(ex=ex), "wc.yaml")
        assert "writing_outside_unit_8" in codes(env.check())

    def test_unit_8_lessons_need_writing(self, env):
        env.unit(pron_unit(n=8))
        assert "missing_writing" in codes(env.check())
        env.units.clear()
        w = pron_unit(n=8).replace("      - speaking:", "      - writing: [一]\n      - speaking:")
        env.unit(w, "ok8.yaml")
        assert "missing_writing" not in codes(env.check())


class TestReferences:
    def with_steps(self, env, extra_exercise: str = "", speaking: str = "", grammar: str = ""):
        lesson = HSK_LESSON.format(id="hsk1-u01-l01", words="[你好, 老师, 好]", sid="s-1")
        if extra_exercise:
            lesson = lesson.replace(
                "          - { type: auto, count: 3 }",
                extra_exercise + "\n          - { type: auto, count: 3 }",
            )
        if speaking:
            lesson = lesson.replace("          - { word: 你好 }", speaking)
        if grammar:
            lesson = lesson.replace("    steps:", grammar + "    steps:")
        env.unit(hsk_unit(lesson))
        return env.check()

    def test_unknown_sentence_in_exercise_and_speaking(self, env):
        r = self.with_steps(
            env, extra_exercise="          - { type: arrange, sentence: s-khong-co }"
        )
        assert "unknown_sentence" in codes(r)
        env.units.clear()
        r = self.with_steps(env, speaking="          - { sentence: s-khong-co }")
        assert "unknown_sentence" in codes(r)

    def test_unknown_grammar_on_lesson(self, env):
        assert "unknown_grammar" in codes(self.with_steps(env, grammar="    grammar: hsk1-g999\n"))
        env.units.clear()
        assert "unknown_grammar" not in codes(
            self.with_steps(env, grammar="    grammar: hsk1-g012\n")
        )

    def test_lesson_grammar_without_grammar_step_is_a_warning(self, env):
        r = self.with_steps(env, grammar="    grammar: hsk1-g012\n")
        assert "grammar_step_missing" in codes(r, "warning")

    def test_unknown_sound_only_checked_when_sounds_are_known(self, env):
        text = pron_unit().replace(
            "      - tone_contour_intro: [1, 2]\n", "      - sound_intro: [init-zz]\n"
        )
        env.unit(text)
        assert "unknown_sound" not in codes(env.check())
        assert "unknown_sound" in codes(env.check(sound_ids={"init-b"}))
        assert "unknown_sound" not in codes(env.check(sound_ids={"init-zz"}))

    def test_exercise_target_must_be_learned_by_this_lesson(self, env):
        r = self.with_steps(
            env, extra_exercise="          - { type: hanzi_to_meaning, target: 谢谢 }"
        )
        (f,) = [f for f in r.errors if f.code == "unknown_word_ref"]
        assert "谢谢" in f.message

    def test_target_learned_in_an_earlier_lesson_is_fine(self, env):
        env.unit(hsk_unit(words="[你好, 老师, 好, 谢谢]"))
        lesson = HSK_LESSON.format(id="hsk1-u02-l01", words="[吗]", sid="s-9").replace(
            "          - { type: auto, count: 3 }",
            "          - { type: hanzi_to_meaning, target: 谢谢 }\n          - { type: auto, count: 3 }",
        )
        env.unit(hsk_unit(lesson, unit_id="hsk1-u02", order=2), "u2.yaml")
        assert "unknown_word_ref" not in codes(env.check())

    def test_speaking_word_must_be_learned(self, env):
        r = self.with_steps(env, speaking="          - { word: 谢谢 }")
        assert "unknown_word_ref" in codes(r)

    def test_unknown_stage(self, env):
        env.unit(hsk_unit(stage="hsk9"))
        assert "unknown_stage" in codes(env.check())


class TestWarnings:
    def test_sentence_with_unlearned_word(self, env):
        env.unit(hsk_unit(words="[你好, 老师]"))  # 好 chưa học
        tok = make_tokenizer(sorted(HSK1))
        r = env.check(tokenize=tok.lcut)
        (w,) = r.warnings
        assert w.code == "sentence_unlearned_word" and "好" in w.message
        assert r.errors == []  # chỉ cảnh báo, không chặn

    def test_word_learned_in_an_earlier_lesson_counts(self, env):
        env.unit(hsk_unit(unit_id="hsk1-u02", order=2, words="[你好, 老师]"), "later.yaml")
        env.unit(
            hsk_unit(unit_id="hsk1-u00", order=1, words="[好]").replace("-l01", "-l00"),
            "earlier.yaml",
        )
        tok = make_tokenizer(sorted(HSK1))
        r = env.check(tokenize=tok.lcut)
        assert [
            w for w in r.warnings if w.code == "sentence_unlearned_word" and "hsk1-u02" in w.message
        ] == []

    def test_no_tokenizer_no_warning(self, env):
        env.unit(hsk_unit(words="[你好, 老师]"))
        assert env.check().warnings == []


class TestFindingLocation:
    def test_finding_points_at_file_and_line(self, env):
        p = env.unit(hsk_unit(words="[你好, 老师, 好, 西瓜]"))
        (f,) = [f for f in env.check().errors if f.code == "word_not_in_hsk"]
        text = p.read_text(encoding="utf-8").splitlines()
        assert f.file == p
        assert "西瓜" in text[f.line - 1]
        assert str(f).startswith(f"{p}:{f.line}: ")

    def test_report_is_sorted_and_summarised(self, env):
        env.unit(hsk_unit(words="[你好, 老师, 好, 西瓜]"))
        r = env.check()
        assert not r.ok
        assert r.errors == sorted(r.errors, key=lambda f: (str(f.file), f.line or 0, f.code))
