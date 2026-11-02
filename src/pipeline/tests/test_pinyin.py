import json
from pathlib import Path

import pytest

from clp.pinyin import numbered_to_marked, parse_numbered, split_syllables, to_plain

FIXTURE = Path(__file__).resolve().parents[2] / "packages" / "core" / "fixtures" / "pinyin.json"
CASES = json.loads(FIXTURE.read_text(encoding="utf-8"))


@pytest.mark.parametrize("c", CASES["numberedToMarked"], ids=lambda c: c["input"])
def test_numbered_to_marked(c):
    assert numbered_to_marked(c["input"], join=c.get("join", False)) == c["expected"]


@pytest.mark.parametrize("c", CASES["toPlain"], ids=lambda c: c["input"])
def test_to_plain(c):
    assert to_plain(c["input"]) == c["expected"]


@pytest.mark.parametrize("c", CASES["parseNumbered"], ids=lambda c: c["input"])
def test_parse_numbered(c):
    base, tone = parse_numbered(c["input"])
    assert {"base": base, "tone": tone} == c["expected"]


@pytest.mark.parametrize("c", CASES["splitSyllables"], ids=lambda c: c["input"] or "empty")
def test_split_syllables(c):
    assert split_syllables(c["input"]) == c["expected"]


def test_cli_pinyin_command():
    from typer.testing import CliRunner

    from clp.cli import app

    res = CliRunner().invoke(app, ["pinyin", "hao3 chi1", "--join"])
    assert res.exit_code == 0
    assert res.stdout.strip() == "hǎochī"
