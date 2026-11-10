from app.align import align, is_near_miss
from app.config import load_config

PAIRS = load_config().near_miss_pairs


def run(expected, heard):
    return align(expected.split(), heard.split(), PAIRS)


def test_identical_is_all_ok():
    r = run("ni hao", "ni hao")
    assert [a.content_ok for a in r] == [True, True]
    assert [a.near_miss for a in r] == [False, False]
    assert [a.heard_index for a in r] == [0, 1]


def test_near_miss_shi_si_is_ok_with_flag():
    r = run("shi", "si")
    assert r[0].content_ok and r[0].near_miss and r[0].heard == "si"


def test_ma_ba_is_wrong():
    r = run("ma", "ba")
    assert not r[0].content_ok and not r[0].near_miss


def test_missing_middle_syllable_only_that_one_wrong():
    r = run("wo xi huan ni", "wo huan ni")
    assert [a.content_ok for a in r] == [True, False, True, True]
    assert r[1].heard is None and r[1].heard_index is None
    assert [a.heard_index for a in r] == [0, None, 1, 2]


def test_extra_heard_syllable_does_not_break_others():
    r = run("ni hao", "ni men hao")
    assert [a.content_ok for a in r] == [True, True]
    assert [a.heard_index for a in r] == [0, 2]


def test_nothing_heard():
    r = run("ni hao", "")
    assert [a.content_ok for a in r] == [False, False]


def test_near_miss_pairs():
    assert is_near_miss("zhi", "zi", PAIRS)
    assert is_near_miss("cai", "chai", PAIRS)
    assert is_near_miss("nan", "lan", PAIRS)
    assert is_near_miss("jin", "jing", PAIRS)
    assert is_near_miss("ben", "beng", PAIRS)
    assert not is_near_miss("ma", "ba", PAIRS)
    assert not is_near_miss("zhi", "zhi", PAIRS)
    assert not is_near_miss("zhan", "zin", PAIRS)  # đổi cả thanh mẫu lẫn vận mẫu
