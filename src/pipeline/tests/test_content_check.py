from pathlib import Path

from clp.content.check import STAGE_ORDER, check_content, discover_files

GOOD_UNIT = """\
id: hsk1-u01
stage: hsk1
order: 1
title: Chào hỏi
lessons:
  - id: hsk1-u01-l01
    title: Xin chào
    grammar: hsk1-g012
    new_words: [你好, 老师, 好]
    sentences:
      - { id: s-1, zh: 老师好！, en: "Hello, teacher!", pinyin: "lǎoshī hǎo!" }
"""
GRAMMAR = (
    "- { id: hsk1-g012, hsk_code: x, title: t, explanation_vi: e, pattern: p, examples: [] }\n"
)


def seed(conn):
    for lv, w in [(1, "你好"), (1, "老师"), (1, "好"), (2, "学习")]:
        conn.execute("INSERT INTO hsk_word (level, simplified, pinyin) VALUES (%s,%s,'x')", (lv, w))
    for ch in "你好老师":
        conn.execute("INSERT INTO hanzi (char, has_stroke_data) VALUES (%s, true)", (ch,))
    conn.commit()


def write_tree(root: Path, unit: str = GOOD_UNIT) -> Path:
    (root / "hsk1").mkdir(parents=True)
    (root / "grammar").mkdir()
    (root / "hsk1" / "u01-greetings.yaml").write_text(unit, encoding="utf-8")
    (root / "hsk1" / "_plan.yaml").write_text("units: []\n", encoding="utf-8")  # không phải chủ đề
    (root / "grammar" / "hsk1.yaml").write_text(GRAMMAR, encoding="utf-8")
    return root


def test_discover_only_unit_and_grammar_files(tmp_path):
    root = write_tree(tmp_path / "content")
    units, grammar = discover_files(root)
    assert [p.name for p in units] == ["u01-greetings.yaml"]
    assert [p.name for p in grammar] == ["hsk1.yaml"]
    assert STAGE_ORDER == ["pron", "hsk1", "hsk2", "hsk3"]


def test_clean_tree_passes_against_db(db_conn, tmp_path):
    seed(db_conn)
    report = check_content(db_conn, write_tree(tmp_path / "content"))
    assert report.errors == []
    assert [w.code for w in report.warnings] == ["grammar_step_missing"] or report.warnings == []


def test_db_context_catches_unknown_word_and_missing_published_lesson(db_conn, tmp_path):
    seed(db_conn)
    db_conn.execute(
        "INSERT INTO stage (id, \"order\", title, has_certificate) VALUES ('hsk1',1,'HSK 1',true)"
    )
    db_conn.execute(
        "INSERT INTO unit (id, stage_id, \"order\", title) VALUES ('hsk1-u09','hsk1',9,'U')"
    )
    db_conn.execute(
        "INSERT INTO lesson (id, unit_id, \"order\", title, content) VALUES ('hsk1-u09-l01','hsk1-u09',1,'L','{}')"
    )
    db_conn.commit()
    bad = GOOD_UNIT.replace("[你好, 老师, 好]", "[你好, 西瓜]")
    report = check_content(db_conn, write_tree(tmp_path / "content", bad))
    codes = {f.code for f in report.errors}
    assert {"word_not_in_hsk", "published_lesson_missing"} <= codes


def test_syntax_error_in_a_file_is_reported_with_its_location(db_conn, tmp_path):
    seed(db_conn)
    broken = GOOD_UNIT.replace("title: Chào hỏi\n", "")
    report = check_content(db_conn, write_tree(tmp_path / "content", broken))
    (f,) = report.errors
    assert (
        f.code == "invalid_file" and f.file and f.file.name == "u01-greetings.yaml" and f.line == 1
    )


def test_check_content_runs_the_cross_checks(db_conn, tmp_path):
    """Chốt việc nối crosscheck (02-7) vào check_content: tip khẳng định sai Hán Việt phải bị chặn."""
    seed(db_conn)
    db_conn.execute(
        "INSERT INTO hanzi (char, han_viet) VALUES ('好', ARRAY['hảo'])"
        " ON CONFLICT (char) DO UPDATE SET han_viet = ARRAY['hảo']"
    )
    db_conn.commit()
    bad = GOOD_UNIT + "    tips:\n      好: 好 có âm Hán Việt là xyz.\n"
    report = check_content(db_conn, write_tree(tmp_path / "content", bad))
    assert "han_viet_mismatch" in [f.code for f in report.errors]
    clean = check_content(db_conn, write_tree(tmp_path / "ok", GOOD_UNIT))
    assert "han_viet_mismatch" not in [f.code for f in clean.errors]
