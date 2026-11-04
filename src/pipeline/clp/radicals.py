"""Đọc và kiểm tra content/radicals_vi.yaml (214 bộ thủ Khang Hy, tên và nghĩa tiếng Việt)."""

from pathlib import Path

import yaml

REQUIRED = ("number", "radical", "name_vi", "meaning_vi")


class RadicalsError(ValueError):
    pass


def load_radicals(path: Path) -> list[dict]:
    rows = yaml.safe_load(path.read_text(encoding="utf-8")) or []
    for i, r in enumerate(rows, 1):
        for k in REQUIRED:
            if not str(r.get(k, "")).strip():
                raise RadicalsError(f"Mục {i}: thiếu {k}")
        r.setdefault("variants", [])
    heads = [r["radical"] for r in rows]
    if len(set(heads)) != len(heads):
        dup = sorted({h for h in heads if heads.count(h) > 1})
        raise RadicalsError(f"Bộ thủ trùng: {dup}")
    if len(rows) != 214:
        raise RadicalsError(f"Cần đúng 214 bộ thủ, có {len(rows)}")
    if [r["number"] for r in rows] != list(range(1, 215)):
        raise RadicalsError("`number` phải là 1..214 theo thứ tự")
    return rows
