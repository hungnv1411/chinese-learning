"""B2. Nhập CC-CEDICT vào dict_entry."""

import gzip
import re
from pathlib import Path

from clp.db import upsert
from clp.pinyin import numbered_to_marked, to_plain

LINE = re.compile(r"^(\S+) (\S+) \[([^\]]*)\] /(.*)/\s*$")
FLAG_PREFIXES = ("surname ", "variant of", "old variant of", "see ")
KEY = ("simplified", "traditional", "pinyin_numbered")


def parse_line(line: str, order: int) -> dict | None:
    m = LINE.match(line)
    if not m:
        return None
    trad, simp, pin, defs = m.groups()
    definitions = [d for d in defs.split("/") if d]
    return {
        "simplified": simp,
        "traditional": trad,
        "pinyin_numbered": pin,
        "pinyin_marked": numbered_to_marked(pin, join=True),
        "pinyin_plain": to_plain(pin),
        "definitions": definitions,
        "is_variant_or_surname": bool(definitions)
        and all(d.startswith(FLAG_PREFIXES) for d in definitions),
        "cedict_order": order,
    }


def parse_file(path: Path) -> list[dict]:
    """Đọc CC-CEDICT (.gz hoặc text). Mục trùng khóa tự nhiên được gộp nghĩa, giữ thứ tự dòng đầu."""
    opener = gzip.open if path.suffix == ".gz" else open
    by_key: dict[tuple, dict] = {}
    with opener(path, "rt", encoding="utf-8") as f:
        order = 0
        for line in f:
            if line.startswith("#"):
                continue
            order += 1
            row = parse_line(line.rstrip("\n"), order)
            if row is None:
                continue
            key = tuple(row[k] for k in KEY)
            if key in by_key:
                prev = by_key[key]
                prev["definitions"] += [
                    d for d in row["definitions"] if d not in prev["definitions"]
                ]
                prev["is_variant_or_surname"] = (
                    prev["is_variant_or_surname"] and row["is_variant_or_surname"]
                )
            else:
                by_key[key] = row
    return list(by_key.values())


def import_cedict(conn, path: Path) -> dict[str, int]:
    return upsert(conn, "dict_entry", parse_file(path), list(KEY))
