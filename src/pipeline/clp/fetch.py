"""B1. Tải dữ liệu nguồn vào data/raw/<nguồn>/<ngày>/ và ghi manifest.json."""

import hashlib
import json
import shutil
from pathlib import Path

import httpx

MANIFEST = "manifest.json"


def load_sources(path: Path) -> dict[str, list[dict]]:
    import yaml

    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _read_manifest(raw_dir: Path) -> dict:
    p = raw_dir / MANIFEST
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def latest_dir(raw_dir: Path, source: str) -> Path:
    """Thư mục bản mới nhất của nguồn, theo manifest."""
    entry = _read_manifest(raw_dir).get(source)
    if not entry:
        raise FileNotFoundError(f"Chưa tải nguồn '{source}'. Chạy `clp fetch` trước.")
    return raw_dir / source / entry["date"]


def _download(client: httpx.Client, url: str, dest: Path) -> str:
    h = hashlib.sha256()
    with client.stream("GET", url, follow_redirects=True) as r:
        r.raise_for_status()
        with dest.open("wb") as f:
            for chunk in r.iter_bytes():
                h.update(chunk)
                f.write(chunk)
    return h.hexdigest()


def fetch_sources(
    sources: dict[str, list[dict]],
    raw_dir: Path,
    *,
    today: str,
    client: httpx.Client,
    names: list[str] | None = None,
) -> dict[str, str]:
    """Trả {nguồn: 'downloaded' | 'unchanged'}. `today` truyền vào để test được."""
    manifest = _read_manifest(raw_dir)
    result: dict[str, str] = {}
    for name in names or list(sources):
        files = sources[name]
        tmp = raw_dir / name / f".{today}.part"
        shutil.rmtree(tmp, ignore_errors=True)
        tmp.mkdir(parents=True)
        try:
            entries = [
                {
                    "name": f["name"],
                    "url": f["url"],
                    "sha256": _download(client, f["url"], tmp / f["name"]),
                }
                for f in files
            ]
        except BaseException:
            shutil.rmtree(tmp, ignore_errors=True)
            raise
        combined = hashlib.sha256("".join(e["sha256"] for e in entries).encode()).hexdigest()
        if manifest.get(name, {}).get("sha256") == combined:
            shutil.rmtree(tmp)
            result[name] = "unchanged"
            continue
        final = raw_dir / name / today
        shutil.rmtree(final, ignore_errors=True)
        tmp.rename(final)
        manifest[name] = {
            "date": today,
            "url": entries[0]["url"],
            "sha256": combined,
            "files": entries,
        }
        (raw_dir / MANIFEST).write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        result[name] = "downloaded"
    return result
