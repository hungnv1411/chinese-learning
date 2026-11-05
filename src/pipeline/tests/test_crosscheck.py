"""02-7: kiểm tra đối chiếu tự động (pinyin từ, pinyin câu, Hán Việt, Tatoeba, độ dài)."""

from pathlib import Path

from clp.content.crosscheck import (
    CrossData,
    align_pinyin,
    crosscheck,
    find_han_viet_claims,
    load_cross_data,
)
from clp.content.loader import load_grammar, load_unit

HEADER = "id: hsk1-u01\nstage: hsk1\norder: 1\ntitle: T\nlessons:\n"


def lesson(words="[好吃]", sentences="", tips="", extra=""):
    body = f"  - id: hsk1-u01-l01\n    title: T\n    new_words: {words}\n"
    if sentences:
        body += "    sentences:\n" + sentences
    if tips:
        body += "    tips:\n" + tips
    return HEADER + body + extra


def unit(tmp_path: Path, text: str):
    p = tmp_path / "u.yaml"
    p.write_text(text, encoding="utf-8")
    return load_unit(p)


DATA = CrossData(
    word_pinyin={(1, "好吃"): {"hao3 chi1"}, (1, "老师"): {"lao3 shi1"}},
    any_pinyin={"西瓜": {"xi1 gua1"}},
    tatoeba={"4321": ("老师好！", "Hello, teacher!")},
    han_viet={"好": {"hảo", "hiếu"}, "吃": {"khật", "ngật"}, "老": {"lão"}, "师": {"sư"}},
    stage_levels={"hsk1": 1},
)


def run(tmp_path, text, data=DATA, grammar=()):
    return crosscheck([unit(tmp_path, text)], list(grammar), data)


def codes(findings, level=None):
    return [f.code for f in findings if level is None or f.level == level]


class TestWordPinyin:
    def test_matching_pinyin_passes_in_numbered_and_marked_forms(self, tmp_path):
        for p in ("hao3 chi1", "hao3chi1", "hǎochī", "hǎo chī", "Hao3 Chi1"):
            text = lesson(f"[{{ word: 好吃, pinyin: {p} }}]")
            assert "word_pinyin_mismatch" not in codes(run(tmp_path, text)), p

    def test_wrong_reading_is_blocked(self, tmp_path):
        found = run(tmp_path, lesson("[{ word: 好吃, pinyin: hao4 chi1 }]"))
        (f,) = [f for f in found if f.code == "word_pinyin_mismatch"]
        assert f.level == "error" and "hao4 chi1" in f.message and "hao3 chi1" in f.message
        assert f.file and f.line == 8  # dòng của từ trong new_words

    def test_no_pinyin_field_means_nothing_to_check(self, tmp_path):
        assert run(tmp_path, lesson("[好吃, 老师]")) == []

    def test_extra_words_are_checked_against_any_dictionary_reading(self, tmp_path):
        ok = lesson("[{ word: 西瓜, extra: true, pinyin: xi1 gua1 }]")
        assert run(tmp_path, ok) == []
        bad = lesson("[{ word: 西瓜, extra: true, pinyin: xi1 gua4 }]")
        assert "word_pinyin_mismatch" in codes(run(tmp_path, bad))

    def test_word_unknown_to_the_dictionary_is_reported(self, tmp_path):
        text = lesson("[{ word: 火星, extra: true, pinyin: huo3 xing1 }]")
        assert "word_pinyin_unverifiable" in codes(run(tmp_path, text), "error")


class TestSentencePinyin:
    S = '      - {{ id: s-1, zh: "{zh}", en: "x", pinyin: "{py}" }}\n'

    def sent(self, tmp_path, zh, py):
        return run(tmp_path, lesson("[老师]", sentences=self.S.format(zh=zh, py=py)))

    def test_exact_match_ignores_spacing_case_and_punctuation(self, tmp_path):
        assert self.sent(tmp_path, "老师好！", "Lǎoshī hǎo!") == []
        assert self.sent(tmp_path, "老师好！", "lǎo shī hǎo") == []

    def test_third_tone_sandhi_is_not_a_difference(self, tmp_path):
        assert self.sent(tmp_path, "你好", "ní hǎo") == []  # 3+3 -> 2+3
        assert self.sent(tmp_path, "你好", "nǐ hǎo") == []

    def test_bu_and_yi_sandhi(self, tmp_path):
        assert self.sent(tmp_path, "不是", "bú shì") == []
        assert self.sent(tmp_path, "一个", "yí ge") == []

    def test_neutral_tone_written_by_the_author_is_accepted(self, tmp_path):
        assert self.sent(tmp_path, "喜欢", "xǐhuan") == []

    def test_real_tone_difference_is_a_warning(self, tmp_path):
        found = self.sent(tmp_path, "老师", "lǎoshí")
        (f,) = found
        assert f.level == "warning" and f.code == "sentence_pinyin_mismatch"
        assert "shí" in f.message and "shī" in f.message and f.line

    def test_polyphone_difference_is_flagged_for_separate_review(self, tmp_path):
        found = self.sent(tmp_path, "行不行", "xíng bù háng")  # 行 là chữ đa âm
        assert [f.code for f in found] == ["sentence_pinyin_polyphone"]
        assert found[0].level == "warning"

    def test_tone_difference_on_a_polyphone_char_is_also_flagged_for_review(self, tmp_path):
        assert codes(self.sent(tmp_path, "老师好", "lǎoshī háo")) == ["sentence_pinyin_polyphone"]

    def test_wrong_letters_or_length(self, tmp_path):
        assert codes(self.sent(tmp_path, "老师", "lǎo")) == ["sentence_pinyin_mismatch"]
        assert codes(self.sent(tmp_path, "老师", "lǎoshī ma")) == ["sentence_pinyin_mismatch"]
        assert codes(self.sent(tmp_path, "老师", "lǎoxī")) == ["sentence_pinyin_mismatch"]


class TestAlign:
    def test_returns_none_when_letters_do_not_line_up(self):
        assert align_pinyin("lǎoshī", [("老", "lao3"), ("师", "shi1"), ("好", "hao3")]) is None

    def test_reports_each_tone_difference(self):
        diffs = align_pinyin("lǎoshíhǎo", [("老", "lao3"), ("师", "shi1"), ("好", "hao3")])
        assert diffs == [(1, 1, 2)]  # (vị trí, thanh pypinyin, thanh ghi trong YAML)


class TestTatoeba:
    S = '      - {{ id: s-1, zh: "{zh}", en: "{en}", pinyin: "lǎoshī hǎo!", tatoeba_id: {tid} }}\n'

    def test_identical_text_passes(self, tmp_path):
        s = self.S.format(zh="老师好！", en="Hello, teacher!", tid=4321)
        assert "tatoeba_text_mismatch" not in codes(run(tmp_path, lesson("[老师]", sentences=s)))

    def test_changed_text_is_blocked(self, tmp_path):
        for zh, en in (("老师好。", "Hello, teacher!"), ("老师好！", "Hello teacher")):
            s = self.S.format(zh=zh, en=en, tid=4321)
            found = run(tmp_path, lesson("[老师]", sentences=s))
            (f,) = [f for f in found if f.code == "tatoeba_text_mismatch"]
            assert f.level == "error" and "4321" in f.message

    def test_unknown_tatoeba_id_is_blocked(self, tmp_path):
        s = self.S.format(zh="老师好！", en="Hello, teacher!", tid=999)
        assert "tatoeba_not_found" in codes(run(tmp_path, lesson("[老师]", sentences=s)), "error")


class TestHanViet:
    def test_claim_parser(self):
        assert find_han_viet_claims("好吃 có âm Hán Việt là hảo khật nhé") == [
            ("好吃", ["hảo", "khật"])
        ]
        assert find_han_viet_claims("Chữ 师 (Hán Việt: sư) nghĩa là thầy") == [("师", ["sư"])]
        assert find_han_viet_claims("Không nói gì về âm") == []
        assert find_han_viet_claims("Hán Việt là gì thế") == []  # không có chữ Hán đứng trước

    def test_correct_claim_passes(self, tmp_path):
        tips = "      好吃: 好吃 có âm Hán Việt là hảo khật.\n"
        assert "han_viet_mismatch" not in codes(run(tmp_path, lesson(tips=tips)))
        tips = "      好吃: 好吃 có âm Hán Việt là hiếu ngật.\n"  # mọi âm trong Unihan đều chấp nhận được
        assert "han_viet_mismatch" not in codes(run(tmp_path, lesson(tips=tips)))

    def test_wrong_claim_is_blocked(self, tmp_path):
        tips = "      好吃: 好吃 có âm Hán Việt là hảo ăn.\n"
        (f,) = [f for f in run(tmp_path, lesson(tips=tips)) if f.code == "han_viet_mismatch"]
        assert f.level == "error" and "ăn" in f.message and f.line

    def test_claim_about_a_char_without_source_is_blocked(self, tmp_path):
        tips = "      西瓜: 西瓜 có âm Hán Việt là tây qua.\n"
        assert "han_viet_unverifiable" in codes(run(tmp_path, lesson(tips=tips)), "error")

    def test_claims_in_grammar_explanations_are_checked(self, tmp_path):
        g = tmp_path / "g.yaml"
        g.write_text(
            "- id: g1\n  hsk_code: x\n  title: t\n  pattern: p\n  examples: []\n"
            "  explanation_vi: 师 có âm Hán Việt là xyz.\n",
            encoding="utf-8",
        )
        found = crosscheck([], [load_grammar(g)], DATA)
        assert codes(found) == ["han_viet_mismatch"]


class TestLengths:
    def test_long_tip_and_explanation_are_warnings(self, tmp_path):
        tips = f"      好吃: {'a' * 301}\n"
        found = run(tmp_path, lesson(tips=tips))
        assert [(f.code, f.level) for f in found] == [("tip_too_long", "warning")]
        ok = run(tmp_path, lesson(tips=f"      好吃: {'a' * 300}\n"))
        assert ok == []
        g = tmp_path / "g.yaml"
        g.write_text(
            "- id: g1\n  hsk_code: x\n  title: t\n  pattern: p\n  examples: []\n"
            f"  explanation_vi: {'b' * 801}\n",
            encoding="utf-8",
        )
        assert codes(crosscheck([], [load_grammar(g)], DATA)) == ["grammar_too_long"]


def test_load_cross_data_from_database(db_conn):
    db_conn.execute(
        "INSERT INTO dict_entry (id, simplified, traditional, pinyin_numbered, pinyin_marked, pinyin_plain, definitions)"
        " VALUES (1,'好吃','好吃','hao3 chi1','hǎochī','haochi',ARRAY['tasty']),"
        " (2,'好吃','好吃','hao4 chi1','hàochī','haochi',ARRAY['x']),(3,'西瓜','西瓜','xi1 gua1','xīguā','xigua',ARRAY['melon'])"
    )
    db_conn.execute(
        "INSERT INTO hsk_word (level, simplified, pinyin, dict_entry_id) VALUES (1,'好吃','hǎochī',1)"
    )
    db_conn.execute("INSERT INTO hanzi (char, han_viet) VALUES ('好', ARRAY['hảo','hiếu'])")
    db_conn.execute(
        "INSERT INTO sentence (zh, pinyin, en, source, source_ref) VALUES ('老师好！','p','Hello, teacher!','tatoeba','4321'),"
        " ('自编','p','x','authored','a1')"
    )
    db_conn.commit()
    data = load_cross_data(db_conn, {"hsk1": 1})
    assert data.word_pinyin == {
        (1, "好吃"): {"hao3 chi1"}
    }  # chỉ mục đã ghép với HSK, không phải hao4 chi1
    assert data.any_pinyin["好吃"] == {"hao3 chi1", "hao4 chi1"} and data.any_pinyin["西瓜"] == {
        "xi1 gua1"
    }
    assert data.tatoeba == {"4321": ("老师好！", "Hello, teacher!")}
    assert data.han_viet == {"好": {"hảo", "hiếu"}}
    assert data.stage_levels == {"hsk1": 1}
