"""02-3: import_content ghi DB trong một transaction; chạy lại không đổi."""

import json
from pathlib import Path

import pytest

from clp.content.importer import ContentCheckError, import_content
from clp.content.models import LessonContent

STAGES = """\
- { id: pron, order: 1, title: Phát âm, description: Đọc được pinyin }
- { id: hsk1, order: 2, title: HSK 1, has_certificate: true, level: 1 }
- { id: hsk2, order: 3, title: HSK 2, has_certificate: true, level: 2 }
- { id: hsk3, order: 4, title: HSK 3, has_certificate: true, level: 3 }
"""
GRAMMAR = """\
- id: hsk1-g012
  hsk_code: "一级-语法-012"
  title: Câu hỏi với 吗
  explanation_vi: Thêm 吗 vào cuối câu.
  pattern: "Câu trần thuật + 吗？"
  examples:
    - { zh: 你是老师吗？, en: Are you a teacher? }
"""
UNIT_HEAD = """\
id: hsk1-u01
stage: hsk1
order: 1
title: Chào hỏi
description: Chào hỏi cơ bản.
illustration: units/hsk1-u01.svg
lessons:
"""
L01 = """\
  - id: hsk1-u01-l01
    title: Xin chào
    grammar: hsk1-g012
    new_words: [你, 好, 老师]
    sentences:
      - { id: s-1, zh: 老师好！, en: "Hello", pinyin: "lǎoshī hǎo!", tatoeba_id: 5 }
    tips:
      好: Thanh 3.
"""
L02 = """\
  - id: hsk1-u01-l02
    title: Có/không
    new_words: [吗]
    sentences:
      - { id: s-2, zh: 你好吗？, en: "How are you?", pinyin: "nǐ hǎo ma?" }
"""
CHECKPOINT = """\
  - id: hsk1-u01-cp
    type: checkpoint
    title: Ôn tập chủ đề
"""
UNIT = UNIT_HEAD + L01 + L02 + CHECKPOINT

PLAN = """\
units:
  - { id: hsk1-u01, order: 1, title: Chào hỏi }
  - { id: hsk1-u02, order: 2, title: Gia đình, description: Người thân }
"""


def write_tree(root: Path, unit: str = UNIT, plan: str | None = PLAN, stages: str | None = STAGES):
    (root / "hsk1").mkdir(parents=True, exist_ok=True)
    (root / "grammar").mkdir(exist_ok=True)
    if stages is not None:
        (root / "stages.yaml").write_text(stages, encoding="utf-8")
    (root / "hsk1" / "u01-greetings.yaml").write_text(unit, encoding="utf-8")
    if plan is not None:
        (root / "hsk1" / "_plan.yaml").write_text(plan, encoding="utf-8")
    (root / "grammar" / "hsk1.yaml").write_text(GRAMMAR, encoding="utf-8")
    return root


def seed(conn):
    for w, py in [("你", "nǐ"), ("好", "hǎo"), ("老师", "lǎoshī"), ("吗", "ma")]:
        conn.execute("INSERT INTO hsk_word (level, simplified, pinyin) VALUES (1,%s,%s)", (w, py))
    for ch, strokes in [("你", True), ("好", True), ("老", True), ("师", True), ("吗", False)]:
        conn.execute("INSERT INTO hanzi (char, has_stroke_data) VALUES (%s,%s)", (ch, strokes))
    conn.commit()


def snapshot(conn):
    q = lambda sql: conn.execute(sql).fetchall()
    return {
        "stage": q('SELECT id, "order", title, has_certificate FROM stage ORDER BY id'),
        "unit": q('SELECT id, stage_id, "order", title, published, image FROM unit ORDER BY id'),
        "lesson": q(
            'SELECT id, unit_id, "order", title, kind, content::text FROM lesson ORDER BY id'
        ),
        "word": q("SELECT lesson_id, hsk_word_id FROM lesson_word ORDER BY 1, 2"),
        "char": q("SELECT lesson_id, char FROM lesson_char ORDER BY 1, 2"),
        "grammar": q("SELECT id, hsk_code, title FROM grammar_point ORDER BY id"),
        "meta": q("SELECT key, value FROM content_meta ORDER BY key"),
    }


def test_full_import_writes_every_table(db_conn, tmp_path):
    seed(db_conn)
    res = import_content(db_conn, write_tree(tmp_path / "c"))
    s = snapshot(db_conn)
    assert [r[0] for r in s["stage"]] == ["hsk1", "hsk2", "hsk3", "pron"]
    units = {r[0]: r for r in s["unit"]}
    assert units["hsk1-u01"][4] is True and units["hsk1-u01"][5] == "units/hsk1-u01.svg"
    assert units["hsk1-u02"][4] is False  # có trong _plan.yaml nhưng chưa có file: Sắp ra mắt
    assert units["hsk1-u02"][3] == "Gia đình"
    lessons = {r[0]: r for r in s["lesson"]}
    assert [(i, lessons[i][2], lessons[i][4]) for i in sorted(lessons)] == [
        ("hsk1-u01-cp", 3, "checkpoint"),
        ("hsk1-u01-l01", 1, "normal"),
        ("hsk1-u01-l02", 2, "normal"),
    ]
    for r in lessons.values():
        LessonContent.model_validate(json.loads(r[5]))  # JSON trong DB đúng hợp đồng
    content = json.loads(lessons["hsk1-u01-l01"][5])
    assert content["newChars"] == ["你", "好", "老", "师"]
    assert [w["hskWordId"] is not None for w in content["newWords"]] == [True, True, True]
    assert len(s["word"]) == 4  # 你 好 老师 | 吗
    assert [r[1] for r in s["char"] if r[0] == "hsk1-u01-l02"] == ["吗"]
    assert s["grammar"] == [("hsk1-g012", "一级-语法-012", "Câu hỏi với 吗")]
    assert dict(s["meta"])["content_version"] == res.content_version
    assert res.lessons == 3 and res.units_published == 1 and res.units_planned == 1


def test_warns_about_chars_without_stroke_data(db_conn, tmp_path):
    seed(db_conn)
    res = import_content(db_conn, write_tree(tmp_path / "c"))
    assert any(w.code == "writing_skipped_no_strokes" and "吗" in w.message for w in res.warnings)


def test_second_run_changes_nothing(db_conn, tmp_path):
    seed(db_conn)
    root = write_tree(tmp_path / "c")
    first = import_content(db_conn, root)
    before = snapshot(db_conn)
    second = import_content(db_conn, root)
    assert snapshot(db_conn) == before
    assert second.content_version == first.content_version


def test_explicit_version_is_stored(db_conn, tmp_path):
    seed(db_conn)
    import_content(db_conn, write_tree(tmp_path / "c"), version="abc1234")
    assert dict(snapshot(db_conn)["meta"])["content_version"] == "abc1234"


def test_editing_one_lesson_changes_only_its_content_version(db_conn, tmp_path):
    seed(db_conn)
    root = write_tree(tmp_path / "c")
    import_content(db_conn, root)
    v1 = {r[0]: json.loads(r[5])["contentVersion"] for r in snapshot(db_conn)["lesson"]}
    write_tree(root, UNIT.replace("好: Thanh 3.", "好: Thanh ba."))
    import_content(db_conn, root)
    v2 = {r[0]: json.loads(r[5])["contentVersion"] for r in snapshot(db_conn)["lesson"]}
    assert v1["hsk1-u01-l01"] != v2["hsk1-u01-l01"]
    assert v1["hsk1-u01-l02"] == v2["hsk1-u01-l02"]


def test_reordering_lessons_does_not_hit_unique_constraint(db_conn, tmp_path):
    seed(db_conn)
    root = write_tree(tmp_path / "c")
    import_content(db_conn, root)
    write_tree(root, UNIT_HEAD + L02 + L01 + CHECKPOINT)  # đổi chỗ hai bài
    import_content(db_conn, root)
    order = {r[0]: r[2] for r in snapshot(db_conn)["lesson"]}
    assert order == {"hsk1-u01-l02": 1, "hsk1-u01-l01": 2, "hsk1-u01-cp": 3}


def test_check_errors_stop_before_writing(db_conn, tmp_path):
    seed(db_conn)
    bad = UNIT.replace("[你, 好, 老师]", "[你, 好, 西瓜]")  # 西瓜 không có trong HSK 1
    with pytest.raises(ContentCheckError) as e:
        import_content(db_conn, write_tree(tmp_path / "c", bad))
    assert "word_not_in_hsk" in [f.code for f in e.value.report.errors]
    db_conn.rollback()
    assert all(not rows for rows in snapshot(db_conn).values())


def test_invalid_yaml_stops_with_location(db_conn, tmp_path):
    seed(db_conn)
    with pytest.raises(ContentCheckError) as e:
        import_content(
            db_conn, write_tree(tmp_path / "c", UNIT.replace("title: Chào hỏi\n", "", 1))
        )
    (f,) = [f for f in e.value.report.errors if f.code == "invalid_file"]
    assert f.file and f.file.name == "u01-greetings.yaml" and f.line == 1


def test_published_lesson_cannot_disappear(db_conn, tmp_path):
    seed(db_conn)
    root = write_tree(tmp_path / "c")
    import_content(db_conn, root)
    with pytest.raises(ContentCheckError) as e:
        import_content(db_conn, write_tree(root, UNIT_HEAD + L01 + CHECKPOINT))  # mất bài l02
    assert "published_lesson_missing" in [f.code for f in e.value.report.errors]


def test_unit_order_clash_between_plan_and_file(db_conn, tmp_path):
    seed(db_conn)
    clash = PLAN.replace("order: 2", "order: 1")
    with pytest.raises(ContentCheckError) as e:
        import_content(db_conn, write_tree(tmp_path / "c", plan=clash))
    assert "duplicate_unit_order" in [f.code for f in e.value.report.errors]


def test_missing_stages_file(db_conn, tmp_path):
    seed(db_conn)
    with pytest.raises(ContentCheckError) as e:
        import_content(db_conn, write_tree(tmp_path / "c", stages=None))
    assert "stages_missing" in [f.code for f in e.value.report.errors]
