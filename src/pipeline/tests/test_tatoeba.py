import bz2
import io
import tarfile

import pytest

from clp.tatoeba import (
    analyze,
    han_count,
    import_tatoeba,
    keep_sentence,
    make_tokenizer,
    pick_pairs,
    sentence_pinyin,
    to_simplified,
)


def test_han_count_ignores_punctuation_and_digits():
    assert han_count("我有3个苹果。") == 5


@pytest.mark.parametrize(
    "zh,ok",
    [
        ("我很喜欢你。", True),
        ("你好", False),  # 2 chữ < 4
        ("我" * 26, False),  # > 25
        ("我" * 25, True),
        ("我喜欢iPhone手机。", False),  # có chữ Latin
        ("我有3个苹果，你呢？", True),  # số và dấu câu được phép
    ],
)
def test_keep_sentence(zh, ok):
    assert keep_sentence(zh) is ok


def test_to_simplified():
    assert to_simplified("我說話。") == "我说话。"
    assert to_simplified("我说话。") == "我说话。"


def test_pick_pairs_chooses_shortest_english():
    cmn = {1: "我很喜欢你。"}
    eng = {10: "I like you very much indeed.", 11: "I like you.", 12: "x"}
    links = [(1, 10), (1, 11), (11, 1), (99, 12)]
    assert pick_pairs(cmn, eng, links) == [(1, "I like you.")]


def test_sentence_pinyin_uses_marks_and_skips_punctuation():
    assert sentence_pinyin("我很好。") == "wǒ hěn hǎo"
    assert sentence_pinyin("你们好吗？") == "nǐ men hǎo ma"


HSK = {"我": 1, "很": 1, "好": 1, "喜欢": 2}


def test_analyze_max_level_and_entries():
    tk = make_tokenizer(list(HSK))
    level, tokens = analyze("我很好。", tk, HSK)
    assert level == 1 and tokens == ["我", "很", "好"]
    level, tokens = analyze("我喜欢量子力学。", tk, HSK)
    assert level == 7  # từ ngoài HSK
    assert "喜欢" in tokens


def _bz2(text):
    return bz2.compress(text.encode())


def make_files(tmp_path):
    cmn = (
        "1\tcmn\t我很喜欢你。\n"
        "2\tcmn\t你好\n"
        "3\tcmn\t我喜欢iPhone手机。\n"
        "4\tcmn\t我說話很好。\n"
        "5\tcmn\t我很喜欢你。\n"
        "6\tcmn\t我喜欢量子力学。\n"
    )
    eng = (
        "10\teng\tI like you a lot.\n"
        "11\teng\tI like you.\n"
        "12\teng\tHi.\n"
        "13\teng\tI speak well.\n"
        "14\teng\tI like quantum mechanics.\n"
        "15\teng\tNo cmn here.\n"
    )
    links = "1\t10\n1\t11\n2\t12\n4\t13\n5\t11\n6\t14\n"
    c, e, lk = tmp_path / "cmn.bz2", tmp_path / "eng.bz2", tmp_path / "links.tar.bz2"
    c.write_bytes(_bz2(cmn))
    e.write_bytes(_bz2(eng))
    with tarfile.open(lk, "w:bz2") as tf:
        data = links.encode()
        info = tarfile.TarInfo("links.csv")
        info.size = len(data)
        tf.addfile(info, io.BytesIO(data))
    return c, e, lk


def seed(conn):
    entries = [
        ("我", "wo3", "wǒ"),
        ("很", "hen3", "hěn"),
        ("好", "hao3", "hǎo"),
        ("喜欢", "xi3 huan5", "xǐhuan"),
        ("你", "ni3", "nǐ"),
    ]
    for i, (s, n, m) in enumerate(entries):
        conn.execute(
            "INSERT INTO dict_entry (simplified, traditional, pinyin_numbered, pinyin_marked,"
            " pinyin_plain, definitions, hsk_level) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (s, s, n, m, m, ["x"], 2 if s == "喜欢" else 1),
        )
        conn.execute(
            "INSERT INTO hsk_word (level, simplified, pinyin) VALUES (%s,%s,%s)",
            (2 if s == "喜欢" else 1, s, m),
        )
    conn.commit()


def test_import_tatoeba_filters_and_links(db_conn, tmp_path):
    seed(db_conn)
    c, e, lk = make_files(tmp_path)
    res = import_tatoeba(db_conn, c, e, lk)
    assert res["sentences"] == {"inserted": 3, "updated": 0}  # 1, 4, 6; còn lại bị lọc/trùng
    rows = dict(
        db_conn.execute(
            "SELECT source_ref, zh || '|' || en || '|' || max_hsk_level FROM sentence"
        ).fetchall()
    )
    assert rows["1"] == "我很喜欢你。|I like you.|2"
    assert rows["4"] == "我说话很好。|I speak well.|7"  # 说话 ngoài HSK
    assert rows["6"].endswith("|7")
    words = db_conn.execute(
        "SELECT d.simplified FROM sentence_word sw JOIN dict_entry d ON d.id = sw.dict_entry_id"
        " JOIN sentence s ON s.id = sw.sentence_id WHERE s.source_ref = '1' ORDER BY d.simplified"
    ).fetchall()
    assert {w[0] for w in words} == {"我", "很", "喜欢", "你"}
    pin = db_conn.execute("SELECT pinyin FROM sentence WHERE source_ref='1'").fetchone()[0]
    assert pin == "wǒ hěn xǐ huān nǐ"


def test_import_tatoeba_idempotent_and_keeps_authored(db_conn, tmp_path):
    seed(db_conn)
    db_conn.execute(
        "INSERT INTO sentence (zh, pinyin, en, source, source_ref) VALUES ('自编。','z','mine','authored','a1')"
    )
    db_conn.commit()
    c, e, lk = make_files(tmp_path)
    import_tatoeba(db_conn, c, e, lk)
    res = import_tatoeba(db_conn, c, e, lk)
    assert res["sentences"] == {"inserted": 0, "updated": 3}
    assert db_conn.execute("SELECT count(*) FROM sentence").fetchone()[0] == 4
    n = db_conn.execute("SELECT count(*) FROM sentence_word").fetchone()[0]
    import_tatoeba(db_conn, c, e, lk)
    assert db_conn.execute("SELECT count(*) FROM sentence_word").fetchone()[0] == n
