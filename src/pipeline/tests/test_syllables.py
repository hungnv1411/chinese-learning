import json

import pytest
import yaml

from clp.syllables import (
    STANDARD,
    build_entries,
    collect_chars,
    compare_with_cedict,
    render_core_json,
    render_yaml,
    split_syllable,
)


def test_standard_list_is_sane():
    assert 395 <= len(STANDARD) <= 420
    assert len(set(STANDARD)) == len(STANDARD)
    assert not any("v" in s for s in STANDARD)
    assert {"lü", "nü", "lüe", "nüe", "zhi", "yu", "ju", "er", "ma"} <= set(STANDARD)


@pytest.mark.parametrize(
    "syl,initial,final",
    [
        ("ma", "m", "a"),
        ("zhi", "zh", "i"),
        ("ju", "j", "ü"),
        ("jue", "j", "üe"),
        ("xun", "x", "ün"),
        ("lü", "l", "ü"),
        ("nüe", "n", "üe"),
        ("yu", "", "ü"),
        ("yun", "", "ün"),
        ("yi", "", "i"),
        ("ya", "", "ia"),
        ("you", "", "iu"),
        ("yong", "", "iong"),
        ("wu", "", "u"),
        ("wei", "", "ui"),
        ("wen", "", "un"),
        ("weng", "", "ueng"),
        ("a", "", "a"),
        ("er", "", "er"),
        ("diu", "d", "iu"),
        ("gui", "g", "ui"),
    ],
)
def test_split_syllable(syl, initial, final):
    assert split_syllable(syl) == (initial, final)


def test_every_standard_syllable_splits_and_is_unique_by_initial_final():
    seen = {}
    for s in STANDARD:
        key = split_syllable(s)
        # zhi/chi/shi/ri/zi/ci/si dùng chung vận mẫu "i" nhưng khác thanh mẫu, nên khóa vẫn duy nhất
        assert key not in seen, f"{s} và {seen[key]} cùng {key}"
        seen[key] = s


def test_bi_ong_does_not_exist():
    entries = build_entries({}, set())
    keys = {(e["initial"], e["final"]) for e in entries}
    assert ("b", "ong") not in keys
    assert ("l", "ü") in keys and ("n", "ü") in keys


def seed(conn):
    rows = [
        ("妈", "ma1", ["ma", "mom, mum", "mother"], 1, False),
        ("麻", "ma2", ["hemp", "flax"], 4, False),
        ("马", "ma3", ["horse"], 1, False),
        ("骂", "ma4", ["to scold"], 3, False),
        ("嘛", "ma5", ["particle"], 5, False),
        ("蚂", "ma3", ["ant (variant)"], 7, True),
        ("绿", "lu:4", ["green"], 1, False),
        ("栗", "lv4", ["x"], 2, False),  # "lv" được chuẩn hóa thành lü, thua 绿 (cấp 1)
        ("妈妈", "ma1 ma5", ["mom"], 1, False),  # nhiều âm tiết: bỏ qua
        ("冷", "leng3", ["cold"], None, False),  # không có cấp HSK: không dùng làm chữ ví dụ
    ]
    for ch, num, defs, lvl, var in rows:
        conn.execute(
            "INSERT INTO dict_entry (simplified, traditional, pinyin_numbered, pinyin_marked,"
            " pinyin_plain, definitions, hsk_level, is_variant_or_surname)"
            " VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
            (ch, ch, num, "x", "x", defs, lvl, var),
        )
    conn.commit()


def test_collect_chars_picks_best_per_tone(db_conn):
    seed(db_conn)
    best = collect_chars(db_conn)
    assert best[("ma", 1)]["char"] == "妈" and best[("ma", 1)]["gloss"] == "mom"
    assert best[("ma", 2)]["char"] == "麻"
    assert best[("ma", 3)]["char"] == "马"  # 蚂 là biến thể, cấp cao
    assert best[("ma", 4)]["char"] == "骂"
    assert best[("lü", 4)]["char"] == "绿"
    assert not any("v" in syl for syl, _ in best)
    assert ("leng", 3) not in best


def test_build_entries_and_yaml_roundtrip(db_conn):
    seed(db_conn)
    entries = build_entries(collect_chars(db_conn), {"syl/xiaoxiao/ma1.mp3"})
    ma = next(e for e in entries if e["syllable"] == "ma")
    assert [t["tone"] for t in ma["tones"]] == [1, 2, 3, 4]
    assert [t.get("char") for t in ma["tones"]] == ["妈", "麻", "马", "骂"]
    assert [t["audio"] for t in ma["tones"]] == [True, False, False, False]
    bi = next(e for e in entries if e["syllable"] == "bi")
    assert all("char" not in t for t in bi["tones"])  # chưa có chữ ví dụ
    loaded = yaml.safe_load(render_yaml(entries))
    assert loaded == entries
    assert len(loaded) == len(STANDARD)


def test_compare_with_cedict_reports_both_directions():
    diff = compare_with_cedict({"ma", "lü", "zzz", "yo"})
    assert "zzz" in diff["only_in_cedict"] and "yo" in diff["only_in_cedict"]
    assert "ma" not in diff["only_in_cedict"]
    assert "bao" in diff["only_in_standard"]


def test_core_syllables_json_matches_standard_list():
    from pathlib import Path

    path = Path(__file__).resolve().parents[2] / "packages" / "core" / "src" / "syllables.json"
    assert path.read_text(encoding="utf-8") == render_core_json(), "Chạy lại `clp syllables`"
    assert json.loads(path.read_text(encoding="utf-8")) == STANDARD
