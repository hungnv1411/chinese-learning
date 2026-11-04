from pathlib import Path

import pytest

from clp.radicals import RadicalsError, load_radicals

CONTENT = Path(__file__).resolve().parents[3] / "content" / "radicals_vi.yaml"


def test_real_file_has_214_unique_radicals():
    rows = load_radicals(CONTENT)
    assert len(rows) == 214
    assert [r["number"] for r in rows] == list(range(1, 215))
    assert len({r["radical"] for r in rows}) == 214
    for r in rows:
        assert r["name_vi"].strip() and r["meaning_vi"].strip()
    by = {r["radical"]: r for r in rows}
    assert by["水"]["number"] == 85 and "氵" in by["水"]["variants"]
    assert by["人"]["name_vi"].lower().startswith("nhân")


def test_variants_do_not_collide_with_radicals():
    rows = load_radicals(CONTENT)
    heads = {r["radical"] for r in rows}
    seen = set()
    for r in rows:
        for v in r["variants"]:
            assert v not in heads and v not in seen, v
            seen.add(v)


def write(tmp_path, text):
    p = tmp_path / "r.yaml"
    p.write_text(text, encoding="utf-8")
    return p


def test_rejects_wrong_count(tmp_path):
    p = write(tmp_path, "- {number: 1, radical: 一, name_vi: nhất, meaning_vi: số một}\n")
    with pytest.raises(RadicalsError, match="214"):
        load_radicals(p)


def test_rejects_duplicate_and_missing_fields(tmp_path):
    rows = "".join(
        f"- {{number: {i}, radical: 一, name_vi: a, meaning_vi: b}}\n" for i in range(1, 215)
    )
    with pytest.raises(RadicalsError, match="trùng"):
        load_radicals(write(tmp_path, rows))
    with pytest.raises(RadicalsError, match="meaning_vi"):
        load_radicals(write(tmp_path, "- {number: 1, radical: 一, name_vi: a}\n"))
