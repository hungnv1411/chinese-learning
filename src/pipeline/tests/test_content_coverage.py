"""02-4: báo cáo độ phủ và stage.exam_open."""

from pathlib import Path

import pytest
from test_content_import import CHECKPOINT, GRAMMAR, L01, L02, UNIT_HEAD, seed, write_tree

from clp.content.coverage import (
    BANK_FACTOR,
    EXAM_PAPER,
    exam_bank_needs,
    grammar_code_to_level_index,
    render_coverage,
)
from clp.content.importer import import_content

PLAN_ONLY_U01 = "units:\n  - { id: hsk1-u01, order: 1, title: Chào hỏi }\n"


def seed_reference(conn):
    seed(conn)
    conn.execute("INSERT INTO hsk_word (level, simplified, pinyin) VALUES (1,'再见','zàijiàn')")
    for code, name in [("hsk30-g001", "ngữ pháp 1"), ("hsk30-g002", "ngữ pháp 2")]:
        conn.execute(
            "INSERT INTO hsk_grammar (code, level, name_zh) VALUES (%s,1,%s)", (code, name)
        )
    for ch in "你好老师吗再见":
        conn.execute(
            "INSERT INTO hsk_char (level, char) VALUES (1,%s) ON CONFLICT DO NOTHING", (ch,)
        )
    conn.execute("INSERT INTO hanzi (char, has_stroke_data) VALUES ('再', true), ('见', true)")
    conn.commit()


def fill_exam_bank(conn, stage="hsk1"):
    # exam_item có khóa ngoại tới stage; import_content sẽ cập nhật lại hàng này
    conn.execute(
        'INSERT INTO stage (id, "order", title, has_certificate) VALUES (%s, 2, %s, true)'
        " ON CONFLICT DO NOTHING",
        (stage, stage.upper()),
    )
    need = exam_bank_needs(stage)
    rows = [(stage, skill, "x", "{}", "{}") for skill, n in need.items() for _ in range(n)]
    for r in rows:
        conn.execute(
            "INSERT INTO exam_item (stage_id, skill, kind, content, answer) VALUES (%s,%s,%s,%s::jsonb,%s::jsonb)",
            r,
        )
    conn.commit()


def exam_open(conn, stage="hsk1"):
    return conn.execute("SELECT exam_open FROM stage WHERE id = %s", (stage,)).fetchone()[0]


def run(conn, root: Path, out: Path):
    return import_content(conn, root, out_dir=out)


class TestHelpers:
    def test_bank_needs_are_three_times_the_paper(self):
        assert BANK_FACTOR == 3
        assert EXAM_PAPER["hsk1"] == {"listening": 20, "reading": 20, "writing": 5, "speaking": 5}
        assert exam_bank_needs("hsk1") == {
            "listening": 60,
            "reading": 60,
            "writing": 15,
            "speaking": 15,
        }
        assert exam_bank_needs("hsk3")["speaking"] == 24
        assert exam_bank_needs("pron") == {}

    @pytest.mark.parametrize(
        "code,expected",
        [
            ("一级-语法-012", (1, 12)),
            ("二级-语法-003", (2, 3)),
            ("三级-语法-100", (3, 100)),
            ("1级-语法-1", None),
            ("一级-词汇-012", None),
            ("", None),
        ],
    )
    def test_grammar_code_parsing(self, code, expected):
        assert grammar_code_to_level_index(code) == expected


class TestImportCoverage:
    def tree(self, tmp_path, unit=None, plan=PLAN_ONLY_U01, grammar_code="一级-语法-001"):
        root = write_tree(tmp_path / "c", unit or (UNIT_HEAD + L01 + L02 + CHECKPOINT), plan=plan)
        (root / "grammar" / "hsk1.yaml").write_text(
            GRAMMAR.replace("一级-语法-012", grammar_code), encoding="utf-8"
        )
        return root

    def test_missing_word_is_listed_and_exam_stays_closed(self, db_conn, tmp_path):
        seed_reference(db_conn)
        fill_exam_bank(db_conn)
        res = run(db_conn, self.tree(tmp_path), tmp_path / "out")
        cov = res.coverage["hsk1"]
        assert [w[1] for w in cov.words_missing] == ["再见"]
        assert cov.exam_open is False and exam_open(db_conn) is False
        text = (tmp_path / "out" / "coverage-hsk1.md").read_text(encoding="utf-8")
        assert "再见" in text and "zàijiàn" in text
        assert "exam_open: **không**" in text

    def test_second_grammar_point_missing_keeps_exam_closed(self, db_conn, tmp_path):
        seed_reference(db_conn)
        fill_exam_bank(db_conn)
        extra_lesson = (
            "  - id: hsk1-u01-l03\n    title: Tạm biệt\n    new_words: [再见]\n"
            "    sentences:\n      - { id: s-3, zh: 再见！, en: Bye, pinyin: zàijiàn! }\n"
        )
        tree = self.tree(tmp_path, UNIT_HEAD + L01 + L02 + extra_lesson + CHECKPOINT)
        res = run(db_conn, tree, tmp_path / "out")
        cov = res.coverage["hsk1"]
        assert cov.words_missing == [] and cov.grammar_missing[0][0] == "hsk30-g002"
        assert cov.exam_open is False  # còn thiếu điểm ngữ pháp thứ hai

    def test_everything_covered_and_bank_full(self, db_conn, tmp_path):
        seed_reference(db_conn)
        db_conn.execute("DELETE FROM hsk_grammar WHERE code = 'hsk30-g002'")
        db_conn.commit()
        fill_exam_bank(db_conn)
        extra_lesson = (
            "  - id: hsk1-u01-l03\n    title: Tạm biệt\n    new_words: [再见]\n"
            "    sentences:\n      - { id: s-3, zh: 再见！, en: Bye, pinyin: zàijiàn! }\n"
        )
        tree = self.tree(tmp_path, UNIT_HEAD + L01 + L02 + extra_lesson + CHECKPOINT)
        res = run(db_conn, tree, tmp_path / "out")
        cov = res.coverage["hsk1"]
        assert (cov.words_missing, cov.grammar_missing, cov.chars_missing) == ([], [], [])
        assert cov.exam_open is True and exam_open(db_conn) is True
        assert "exam_open: **có**" in (tmp_path / "out" / "coverage-hsk1.md").read_text(
            encoding="utf-8"
        )

    def test_unpublished_unit_keeps_exam_closed(self, db_conn, tmp_path):
        seed_reference(db_conn)
        db_conn.execute("DELETE FROM hsk_grammar WHERE code = 'hsk30-g002'")
        db_conn.commit()
        fill_exam_bank(db_conn)
        plan = PLAN_ONLY_U01 + "  - { id: hsk1-u02, order: 2, title: Gia đình }\n"
        extra_lesson = (
            "  - id: hsk1-u01-l03\n    title: Tạm biệt\n    new_words: [再见]\n"
            "    sentences:\n      - { id: s-3, zh: 再见！, en: Bye, pinyin: zàijiàn! }\n"
        )
        tree = self.tree(tmp_path, UNIT_HEAD + L01 + L02 + extra_lesson + CHECKPOINT, plan=plan)
        cov = run(db_conn, tree, tmp_path / "out").coverage["hsk1"]
        assert cov.words_missing == [] and cov.units_unpublished == ["hsk1-u02"]
        assert cov.exam_open is False

    def test_exam_bank_too_small_keeps_exam_closed(self, db_conn, tmp_path):
        seed_reference(db_conn)
        db_conn.execute("DELETE FROM hsk_grammar WHERE code = 'hsk30-g002'")
        db_conn.commit()
        fill_exam_bank(db_conn)
        db_conn.execute(
            "DELETE FROM exam_item WHERE skill = 'speaking' AND id IN (SELECT id FROM exam_item WHERE skill = 'speaking' LIMIT 1)"
        )
        db_conn.commit()
        extra_lesson = (
            "  - id: hsk1-u01-l03\n    title: Tạm biệt\n    new_words: [再见]\n"
            "    sentences:\n      - { id: s-3, zh: 再见！, en: Bye, pinyin: zàijiàn! }\n"
        )
        tree = self.tree(tmp_path, UNIT_HEAD + L01 + L02 + extra_lesson + CHECKPOINT)
        cov = run(db_conn, tree, tmp_path / "out").coverage["hsk1"]
        assert cov.exam_missing == {"speaking": (14, 15)}
        assert cov.exam_open is False
        assert "speaking" in (tmp_path / "out" / "coverage-hsk1.md").read_text(encoding="utf-8")

    def test_exam_closes_again_when_content_regresses(self, db_conn, tmp_path):
        seed_reference(db_conn)
        db_conn.execute("DELETE FROM hsk_grammar WHERE code = 'hsk30-g002'")
        db_conn.commit()
        fill_exam_bank(db_conn)
        extra_lesson = (
            "  - id: hsk1-u01-l03\n    title: Tạm biệt\n    new_words: [再见]\n"
            "    sentences:\n      - { id: s-3, zh: 再见！, en: Bye, pinyin: zàijiàn! }\n"
        )
        root = self.tree(tmp_path, UNIT_HEAD + L01 + L02 + extra_lesson + CHECKPOINT)
        run(db_conn, root, tmp_path / "out")
        assert exam_open(db_conn) is True
        db_conn.execute(
            "INSERT INTO hsk_word (level, simplified, pinyin) VALUES (1,'谢谢','xièxie')"
        )
        db_conn.commit()
        run(db_conn, root, tmp_path / "out")
        assert exam_open(db_conn) is False

    def test_chars_and_unmapped_grammar_are_reported(self, db_conn, tmp_path):
        seed_reference(db_conn)
        db_conn.execute("INSERT INTO hsk_char (level, char) VALUES (1,'谢')")
        db_conn.commit()
        cov = run(
            db_conn, self.tree(tmp_path, grammar_code="四级-语法-001"), tmp_path / "out"
        ).coverage["hsk1"]
        assert "谢" in cov.chars_missing and "再" in cov.chars_missing
        assert cov.grammar_unmapped == ["hsk1-g012"]
        assert len(cov.grammar_missing) == 2  # không ghép được nên chưa tính là đã dạy

    def test_pron_stage_is_not_given_an_exam(self, db_conn, tmp_path):
        seed_reference(db_conn)
        res = run(db_conn, self.tree(tmp_path), tmp_path / "out")
        assert "pron" not in res.coverage and exam_open(db_conn, "pron") is False


def test_render_lists_everything_and_truncates_long_lists():
    from clp.content.coverage import StageCoverage

    cov = StageCoverage(
        stage="hsk1",
        level=1,
        units_total=2,
        units_unpublished=["hsk1-u02"],
        words_total=500,
        words_missing=[(i, f"词{i}", "p") for i in range(300)],
        grammar_total=48,
        grammar_missing=[("hsk30-g001", "ngữ pháp 1")],
        grammar_unmapped=[],
        chars_total=300,
        chars_missing=["谢"],
        exam_have={"listening": 60},
        exam_missing={"listening": (10, 60)},
    )
    text = render_coverage(cov)
    assert "# Độ phủ hsk1" in text
    assert "200 / 500" in text
    assert "hsk1-u02" in text and "hsk30-g001" in text and "谢" in text
    assert "… và 100 từ nữa" in text
