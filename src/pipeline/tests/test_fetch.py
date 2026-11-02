import json

import httpx
import respx

from clp.fetch import fetch_sources, latest_dir

SOURCES = {
    "cedict": [{"url": "https://example.test/cedict.txt.gz", "name": "cedict.txt.gz"}],
    "tatoeba": [
        {"url": "https://example.test/cmn.tsv.bz2", "name": "cmn.tsv.bz2"},
        {"url": "https://example.test/eng.tsv.bz2", "name": "eng.tsv.bz2"},
    ],
}


def run(tmp_path, today, names=None):
    with httpx.Client() as client:
        return fetch_sources(SOURCES, tmp_path, today=today, client=client, names=names)


@respx.mock
def test_manifest_has_checksums(tmp_path):
    respx.get("https://example.test/cedict.txt.gz").respond(content=b"abc")
    respx.get("https://example.test/cmn.tsv.bz2").respond(content=b"cmn")
    respx.get("https://example.test/eng.tsv.bz2").respond(content=b"eng")
    res = run(tmp_path, "2026-11-02")
    assert res == {"cedict": "downloaded", "tatoeba": "downloaded"}
    m = json.loads((tmp_path / "manifest.json").read_text())
    # sha256("abc")
    assert m["cedict"]["files"][0]["sha256"] == (
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )
    assert m["cedict"]["date"] == "2026-11-02"
    assert m["cedict"]["url"] == "https://example.test/cedict.txt.gz"
    assert [f["name"] for f in m["tatoeba"]["files"]] == ["cmn.tsv.bz2", "eng.tsv.bz2"]
    assert (tmp_path / "cedict" / "2026-11-02" / "cedict.txt.gz").read_bytes() == b"abc"


@respx.mock
def test_same_checksum_is_not_stored_again(tmp_path):
    respx.get("https://example.test/cedict.txt.gz").respond(content=b"abc")
    run(tmp_path, "2026-11-02", names=["cedict"])
    before = (tmp_path / "manifest.json").read_text()
    res = run(tmp_path, "2026-11-03", names=["cedict"])
    assert res == {"cedict": "unchanged"}
    assert (tmp_path / "manifest.json").read_text() == before
    assert not (tmp_path / "cedict" / "2026-11-03").exists()


@respx.mock
def test_changed_content_creates_new_dated_dir(tmp_path):
    route = respx.get("https://example.test/cedict.txt.gz")
    route.respond(content=b"abc")
    run(tmp_path, "2026-11-02", names=["cedict"])
    route.respond(content=b"abcd")
    assert run(tmp_path, "2026-11-03", names=["cedict"]) == {"cedict": "downloaded"}
    assert latest_dir(tmp_path, "cedict") == tmp_path / "cedict" / "2026-11-03"


@respx.mock
def test_failed_download_leaves_no_partial_state(tmp_path):
    respx.get("https://example.test/cmn.tsv.bz2").respond(content=b"cmn")
    respx.get("https://example.test/eng.tsv.bz2").respond(status_code=503)
    try:
        run(tmp_path, "2026-11-02", names=["tatoeba"])
    except httpx.HTTPStatusError:
        pass
    else:
        raise AssertionError("expected HTTPStatusError")
    assert not (tmp_path / "manifest.json").exists()
    assert not (tmp_path / "tatoeba" / "2026-11-02").exists()


def test_latest_dir_missing_source(tmp_path):
    import pytest

    with pytest.raises(FileNotFoundError):
        latest_dir(tmp_path, "cedict")
