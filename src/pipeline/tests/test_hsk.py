import pytest

from clp.hsk import (
    check_counts,
    import_hsk,
    match_word,
    parse_level,
    read_chars,
    read_grammar,
    read_words,
)

WORDS_CSV = """ID,Simplified,Traditional,Pinyin,POS,Level,WebNo,WebPinyin,OCR,CEDICT,Example
L1-0001,爱好,愛好,àihào,V/N,1,21,àihào,爱好,,
L1-0002,行,行,xíng,V,1,1,xíng,行,,
L1-0003,行,行,xíng,V,1,1,xíng,行,,
L1-0004,坐下,坐下,zuò xia,V,2,1,zuòxia,坐下,,
L7-0001,谦虚,謙虛,qiānxū,Adj,7-9,1,qiānxū,谦虚,,
"""
CHARS_CSV = """Hanzi,Level,WritingLevel,Traditional,Freq,Examples
爱,1,1,愛,20,爱好
八,7-9,1,八,7,八
"""
GRAMMAR_CSV = """No,Level,Group,Category,Details,Content
1,1,词类,名词,方位名词,上、下
2,7-9,词类,助词,,矣
"""


def entry(id, simp, marked, defs=1, variant=False, numbered=""):
    return {
        "id": id,
        "simplified": simp,
        "pinyin_marked": marked,
        "pinyin_numbered": numbered,
        "n_defs": defs,
        "is_variant_or_surname": variant,
    }


def word(simp="行", pin="xíng", level=1):
    return {"simplified": simp, "pinyin": pin, "level": level}


def test_parse_level():
    assert parse_level("3") == 3
    assert parse_level("7-9") == 7


def test_rule1_simplified_and_pinyin_ignoring_spaces_and_case():
    cands = [entry(1, "坐下", "zuòxia"), entry(2, "坐下", "zuòxià")]
    assert match_word(word("坐下", "Zuò Xia"), cands, None)["id"] == 1


def test_rule2_unique_simplified():
    assert match_word(word("爱好", "àihào"), [entry(5, "爱好", "àihǎo")], None)["id"] == 5


def test_rule3_prefers_non_variant_then_most_definitions():
    cands = [
        entry(1, "行", "háng", defs=9, variant=True),
        entry(2, "行", "hàng", defs=2),
        entry(3, "行", "hèng", defs=5),
    ]
    assert match_word(word("行", "xíng"), cands, None)["id"] == 3


def test_rule1_picks_by_hsk_pinyin_among_readings():
    cands = [entry(1, "行", "xíng", defs=2), entry(2, "行", "háng", defs=8)]
    assert match_word(word("行", "xíng"), cands, None)["id"] == 1


def test_override_beats_every_rule():
    cands = [entry(1, "行", "xíng", numbered="xing2"), entry(2, "行", "háng", numbered="hang2")]
    ov = {"pinyin_numbered": "hang2"}
    assert match_word(word("行", "xíng"), cands, ov)["id"] == 2


def test_no_candidates_is_none():
    assert match_word(word("谦虚", "qiānxū"), [], None) is None


def test_readers_dedupe_and_map_levels(tmp_path):
    w = tmp_path / "w.csv"
    w.write_text(WORDS_CSV, encoding="utf-8")
    words = read_words(w)
    assert len(words) == 4  # 行 trùng được gộp
    assert {x["level"] for x in words} == {1, 2, 7}
    c = tmp_path / "c.csv"
    c.write_text(CHARS_CSV, encoding="utf-8")
    assert read_chars(c) == [{"char": "爱", "level": 1}, {"char": "八", "level": 7}]
    g = tmp_path / "g.csv"
    g.write_text(GRAMMAR_CSV, encoding="utf-8")
    rows = read_grammar(g)
    assert rows[0]["code"] == "hsk30-g001" and rows[0]["level"] == 1
    assert rows[0]["name_zh"] == "名词·方位名词：上、下"
    assert rows[1]["name_zh"] == "助词：矣"


def test_check_counts_warns_on_mismatch():
    words = [word(f"w{i}", "x", 1) for i in range(499)]
    warns = check_counts(words, [], [])
    assert any("cấp 1" in w and "500" in w and "499" in w for w in warns)
    assert (
        check_counts(
            [word(f"a{i}", "x", 1) for i in range(500)]
            + [word(f"b{i}", "x", 2) for i in range(772)]
            + [word(f"c{i}", "x", 3) for i in range(973)],
            [{"char": str(i), "level": lv} for lv in (1, 2, 3) for i in range(300)],
            [{"level": 1}] * 48 + [{"level": 2}] * 81 + [{"level": 3}] * 81,
        )
        == []
    )


def _seed(conn):
    for simp, trad, num, marked, defs, var in [
        ("爱好", "愛好", "ai4 hao4", "àihào", ["hobby"], False),
        ("行", "行", "xing2", "xíng", ["to walk", "OK"], False),
        ("行", "行", "hang2", "háng", ["row"], False),
        ("坐下", "坐下", "zuo4 xia5", "zuòxia", ["sit down"], False),
    ]:
        conn.execute(
            "INSERT INTO dict_entry (simplified, traditional, pinyin_numbered, pinyin_marked,"
            " pinyin_plain, definitions, is_variant_or_surname) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (simp, trad, num, marked, marked, defs, var),
        )
    conn.commit()


def _files(tmp_path):
    for n, t in (("w", WORDS_CSV), ("c", CHARS_CSV), ("g", GRAMMAR_CSV)):
        (tmp_path / f"{n}.csv").write_text(t, encoding="utf-8")
    return tmp_path / "w.csv", tmp_path / "c.csv", tmp_path / "g.csv"


def test_import_hsk_links_levels_and_reports_unmatched(db_conn, tmp_path):
    _seed(db_conn)
    w, c, g = _files(tmp_path)
    out = tmp_path / "out"
    res = import_hsk(db_conn, w, c, g, overrides=[], out_dir=out)
    assert res["words"] == {"inserted": 4, "updated": 0}
    assert res["unmatched"] == 1  # 谦虚
    q = lambda s: db_conn.execute(s).fetchall()
    assert q("SELECT hsk_level FROM dict_entry WHERE pinyin_numbered='xing2'") == [(1,)]
    assert q("SELECT hsk_level FROM dict_entry WHERE pinyin_numbered='hang2'") == [(None,)]
    assert q("SELECT hsk_level FROM dict_entry WHERE simplified='坐下'") == [(2,)]
    csv_text = (out / "hsk_unmatched.csv").read_text(encoding="utf-8")
    assert csv_text.splitlines()[0] == "simplified,pinyin,level,candidates"
    assert "谦虚,qiānxū,7," in csv_text
    assert q("SELECT count(*) FROM hsk_char")[0][0] == 2
    assert q("SELECT count(*) FROM hsk_grammar")[0][0] == 2


def test_import_hsk_twice_is_idempotent_and_keeps_deprecated(db_conn, tmp_path):
    _seed(db_conn)
    w, c, g = _files(tmp_path)
    import_hsk(db_conn, w, c, g, overrides=[], out_dir=tmp_path / "o")
    db_conn.execute("UPDATE hsk_word SET deprecated = true WHERE simplified = '爱好'")
    db_conn.commit()
    res = import_hsk(db_conn, w, c, g, overrides=[], out_dir=tmp_path / "o")
    assert res["words"] == {"inserted": 0, "updated": 4}
    assert db_conn.execute("SELECT count(*) FROM hsk_word").fetchone()[0] == 4
    assert db_conn.execute(
        "SELECT deprecated FROM hsk_word WHERE simplified='爱好'"
    ).fetchone() == (True,)


def test_import_hsk_override_applies(db_conn, tmp_path):
    _seed(db_conn)
    w, c, g = _files(tmp_path)
    ov = [{"simplified": "行", "pinyin": "xíng", "pinyin_numbered": "hang2"}]
    import_hsk(db_conn, w, c, g, overrides=ov, out_dir=tmp_path / "o")
    assert db_conn.execute(
        "SELECT hsk_level FROM dict_entry WHERE pinyin_numbered='hang2'"
    ).fetchone() == (1,)
    assert db_conn.execute(
        "SELECT hsk_level FROM dict_entry WHERE pinyin_numbered='xing2'"
    ).fetchone() == (None,)


@pytest.mark.parametrize("raw,expected", [("2", 2), ("7-9", 7)])
def test_parse_level_param(raw, expected):
    assert parse_level(raw) == expected
