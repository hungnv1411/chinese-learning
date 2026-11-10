import json
from pathlib import Path

import pytest

from app.sandhi import apply_tone_sandhi

FIXTURE = Path(__file__).resolve().parents[3] / "packages/core/fixtures/tone-sandhi.json"
CASES = json.loads(FIXTURE.read_text(encoding="utf-8"))["cases"]


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["name"])
def test_matches_shared_fixture(case):
    got = apply_tone_sandhi(
        [(s["pinyin"], s.get("hanzi")) for s in case["syllables"]],
        word_lengths=case.get("wordLengths"),
        ordinal_indexes=case.get("ordinalIndexes"),
    )
    assert got == case["expected"]


def test_fixture_is_not_empty():
    assert len(CASES) >= 10


def test_syllable_without_tone_digit_is_neutral():
    assert apply_tone_sandhi([("ma", None)]) == [5]


def test_does_not_mutate_input():
    syl = [("ni3", None), ("hao3", None)]
    apply_tone_sandhi(syl)
    assert syl == [("ni3", None), ("hao3", None)]
