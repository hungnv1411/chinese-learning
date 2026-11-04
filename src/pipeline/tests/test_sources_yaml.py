from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]
SOURCES = yaml.safe_load((ROOT / "content" / "sources.yaml").read_text(encoding="utf-8"))
FETCH = yaml.safe_load((ROOT / "src" / "pipeline" / "sources.yaml").read_text(encoding="utf-8"))
FIELDS = ("id", "name", "url", "used_for", "license", "license_url", "attribution")


def test_every_source_has_all_fields():
    assert SOURCES
    for s in SOURCES:
        for f in FIELDS:
            assert str(s.get(f, "")).strip(), f"{s.get('id')}: thiếu {f}"
        assert s["url"].startswith("https://") and s["license_url"].startswith("https://")


def test_ids_are_unique():
    ids = [s["id"] for s in SOURCES]
    assert len(ids) == len(set(ids))


def test_every_downloaded_source_is_listed():
    ids = {s["id"] for s in SOURCES}
    assert set(FETCH) <= ids, f"Nguồn tải về chưa có trong content/sources.yaml: {set(FETCH) - ids}"


def test_runtime_tools_are_listed():
    ids = {s["id"] for s in SOURCES}
    assert {"azure-tts", "faster-whisper", "parselmouth"} <= ids


def test_not_allowed_sources_are_absent():
    text = (ROOT / "content" / "sources.yaml").read_text(encoding="utf-8").lower()
    for banned in ("chinese grammar wiki", "allset", "opencourseware", "fsi"):
        assert banned not in text
