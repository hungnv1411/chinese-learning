import pytest

from app.segment import char_segments, split_by_voiced, split_evenly


def test_two_char_token_of_0_6s_gives_two_0_3s_segments():
    segs = char_segments([("你好", 1.0, 1.6)])
    assert segs == [pytest.approx((1.0, 1.3)), pytest.approx((1.3, 1.6))]


def test_single_and_multiple_tokens_in_order():
    segs = char_segments([("我", 0.0, 0.4), ("喜欢", 0.5, 1.1)])
    assert len(segs) == 3
    assert segs[1] == pytest.approx((0.5, 0.8))


def test_punctuation_in_token_is_ignored():
    assert len(char_segments([("你好,", 0.0, 0.6)])) == 2


def test_split_evenly():
    assert split_evenly(0.0, 1.0, 4) == [
        pytest.approx(x) for x in [(0, 0.25), (0.25, 0.5), (0.5, 0.75), (0.75, 1.0)]
    ]


def test_voiced_segments_match_count():
    v = [(0.0, 0.3), (0.4, 0.8)]
    assert split_by_voiced(v, 2, 0.0, 0.8) == v


def test_three_voiced_for_two_syllables_splits_evenly():
    v = [(0.0, 0.2), (0.3, 0.5), (0.6, 0.8)]
    assert split_by_voiced(v, 2, 0.0, 0.8) == [
        pytest.approx((0.0, 0.4)),
        pytest.approx((0.4, 0.8)),
    ]
