import gzip

from clp.cedict import import_cedict, parse_file, parse_line

SAMPLE = """# CC-CEDICT
#! version=1
好吃 好吃 [hao3 chi1] /tasty/delicious/
綠 绿 [lu:4] /green/
王 王 [Wang2] /surname Wang/
汪 汪 [Wang1] /surname Wang/to flow/
夥 伙 [huo3] /variant of 伙[huo3]/
亞 亚 [Ya4] /see 亚[ya4]/old variant of X/
好吃 好吃 [hao3 chi1] /yummy/
"""


def test_parse_line_basic():
    r = parse_line("好吃 好吃 [hao3 chi1] /tasty/delicious/", 7)
    assert r["simplified"] == "好吃" and r["traditional"] == "好吃"
    assert r["pinyin_numbered"] == "hao3 chi1"
    assert r["pinyin_marked"] == "hǎochī"
    assert r["pinyin_plain"] == "haochi"
    assert r["definitions"] == ["tasty", "delicious"]
    assert r["cedict_order"] == 7
    assert r["is_variant_or_surname"] is False


def test_parse_line_u_umlaut():
    r = parse_line("綠 绿 [lu:4] /green/", 1)
    assert (r["traditional"], r["simplified"]) == ("綠", "绿")
    assert r["pinyin_marked"] == "lǜ" and r["pinyin_plain"] == "lu"


def test_parse_line_skips_comments_and_blank():
    assert parse_line("# comment", 1) is None
    assert parse_line("", 1) is None


def test_surname_only_is_flagged_but_mixed_is_not():
    assert parse_line("王 王 [Wang2] /surname Wang/", 1)["is_variant_or_surname"] is True
    assert parse_line("汪 汪 [Wang1] /surname Wang/to flow/", 1)["is_variant_or_surname"] is False


def test_variant_and_see_prefixes():
    assert parse_line("夥 伙 [huo3] /variant of 伙[huo3]/", 1)["is_variant_or_surname"] is True
    assert parse_line("A B [a1] /old variant of X/see Y/", 1)["is_variant_or_surname"] is True


def test_parse_file_reads_gz_and_merges_duplicate_keys(tmp_path):
    p = tmp_path / "c.txt.gz"
    p.write_bytes(gzip.compress(SAMPLE.encode()))
    rows = parse_file(p)
    keys = [(r["simplified"], r["traditional"], r["pinyin_numbered"]) for r in rows]
    assert len(keys) == len(set(keys)) == 6
    first = next(r for r in rows if r["simplified"] == "好吃")
    assert first["definitions"] == ["tasty", "delicious", "yummy"]
    assert first["cedict_order"] == 1  # thứ tự dòng đầu tiên, bỏ qua dòng chú thích


def test_import_twice_keeps_row_count(db_conn, tmp_path):
    p = tmp_path / "c.txt"
    p.write_text(SAMPLE, encoding="utf-8")
    first = import_cedict(db_conn, p)
    assert first == {"inserted": 6, "updated": 0}
    second = import_cedict(db_conn, p)
    assert second == {"inserted": 0, "updated": 6}
    n = db_conn.execute("SELECT count(*) FROM dict_entry").fetchone()[0]
    assert n == 6


def test_import_preserves_hsk_level(db_conn, tmp_path):
    p = tmp_path / "c.txt"
    p.write_text(SAMPLE, encoding="utf-8")
    import_cedict(db_conn, p)
    db_conn.execute("UPDATE dict_entry SET hsk_level = 1 WHERE simplified = '好吃'")
    db_conn.commit()
    import_cedict(db_conn, p)
    lvl = db_conn.execute("SELECT hsk_level FROM dict_entry WHERE simplified='好吃'").fetchone()[0]
    assert lvl == 1
