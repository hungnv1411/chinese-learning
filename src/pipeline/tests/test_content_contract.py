"""Hợp đồng lesson.content: model Pydantic xuất JSON mà zod ở packages/core parse được."""

import json
import os
import re
from pathlib import Path

import pytest
from pydantic import ValidationError

from clp.content.models import EXERCISE_TYPES, LessonContent, content_version

ROOT = Path(__file__).resolve().parents[3]
FIXTURES = Path(__file__).resolve().parent / "fixtures" / "lesson_content"
CORE_FIXTURE = ROOT / "src" / "packages" / "core" / "fixtures" / "exercise-types.json"
EXERCISE_DOC = ROOT / "docs" / "specs" / "06-lesson" / "exercise-types.md"

NORMAL = {
    "type": "normal",
    "newWords": [
        {"word": "你好", "hskWordId": 12, "extra": False},
        {"word": "您", "hskWordId": None, "extra": True},
    ],
    "newChars": ["你", "好", "您"],
    "sentences": [
        {
            "id": "s-hsk1-u03-001",
            "zh": "老师好！",
            "en": "Hello, teacher!",
            "pinyin": "lǎoshī hǎo!",
            "tatoebaId": 4321,
        }
    ],
    "tips": {"你好": "Hai thanh 3 đi liền nhau thì thanh đầu đọc thành thanh 2."},
    "steps": [
        {"kind": "intro", "word": "你好"},
        {"kind": "writing", "char": "好"},
        {"kind": "grammar", "grammarId": "hsk1-g012"},
        {"kind": "exercise", "type": "pick_tone", "target": "你好"},
        {"kind": "exercise", "type": "arrange", "sentence": "s-hsk1-u03-001"},
        {"kind": "exercise_auto", "count": 3},
        {"kind": "speaking", "mode": "word", "ref": "你好"},
        {"kind": "speaking", "mode": "sentence", "ref": "s-hsk1-u03-001"},
    ],
}
CHECKPOINT = {
    "type": "checkpoint",
    "newWords": [],
    "newChars": [],
    "sentences": [],
    "tips": {},
    "steps": [],
}
PRON = {
    "type": "normal",
    "newWords": [],
    "newChars": [],
    "sentences": [],
    "tips": {"b": "b giống p không bật hơi."},
    "steps": [
        {"kind": "sound_intro", "sound": "init-b"},
        {"kind": "tone_contour_intro", "tone": 1},
        {"kind": "exercise", "type": "listen_pick_pinyin", "target": "ba1"},
        {"kind": "exercise", "type": "pinyin_pick_audio", "target": "ba1"},
        {"kind": "speaking", "mode": "syllable", "ref": "ba1"},
    ],
}
SAMPLES = {"normal": NORMAL, "checkpoint": CHECKPOINT, "pron": PRON}


def export(sample: dict) -> str:
    lesson = LessonContent.model_validate({**sample, "contentVersion": content_version(sample)})
    return (
        json.dumps(lesson.model_dump(mode="json", by_alias=True), ensure_ascii=False, indent=2)
        + "\n"
    )


@pytest.mark.parametrize("name", SAMPLES)
def test_fixture_matches_model_output(name):
    """File fixture mà Vitest parse phải đúng bằng đầu ra của model. CLP_UPDATE_FIXTURES=1 để ghi lại."""
    path = FIXTURES / f"{name}.json"
    text = export(SAMPLES[name])
    if os.environ.get("CLP_UPDATE_FIXTURES"):
        FIXTURES.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    assert path.read_text(encoding="utf-8") == text


def test_exercise_types_match_core_fixture_and_spec_doc():
    core = json.loads(CORE_FIXTURE.read_text(encoding="utf-8"))
    assert list(EXERCISE_TYPES) == core
    doc = EXERCISE_DOC.read_text(encoding="utf-8")
    in_doc = re.findall(r"^\| `([a-z_]+)` \|", doc, flags=re.MULTILINE)
    assert len(in_doc) == 14
    assert [t for t in core if t != "pinyin_pick_audio"] == in_doc


def test_content_version_is_stable_12_hex_and_changes_with_content():
    v = content_version(NORMAL)
    assert re.fullmatch(r"[0-9a-f]{12}", v)
    assert content_version(NORMAL) == v
    assert content_version({**NORMAL, "tips": {}}) != v
    # không phụ thuộc thứ tự khóa
    assert content_version(dict(reversed(list(NORMAL.items())))) == v
    # contentVersion có sẵn trong dữ liệu không được tính vào chính nó
    assert content_version({**NORMAL, "contentVersion": "000000000000"}) == v


def test_rejects_bad_contract_data():
    ok = {**NORMAL, "contentVersion": "abcdef012345"}
    LessonContent.model_validate(ok)
    for mutate in (
        lambda d: d.update(contentVersion="XYZ"),
        lambda d: d.update(steps=[]),
        lambda d: d["steps"].append({"kind": "exercise", "type": "khong_co", "target": "x"}),
        lambda d: d["steps"].append({"kind": "tone_contour_intro", "tone": 6}),
        lambda d: d["sentences"][0].update(pinyin=""),
        lambda d: d.update(type="weird"),
    ):
        bad = json.loads(json.dumps(ok))
        mutate(bad)
        with pytest.raises(ValidationError):
            LessonContent.model_validate(bad)
    with pytest.raises(ValidationError):  # checkpoint phải có steps rỗng
        LessonContent.model_validate(
            {
                **CHECKPOINT,
                "contentVersion": "abcdef012345",
                "steps": [{"kind": "writing", "char": "好"}],
            }
        )
