"""B3. Nhập danh sách HSK 2021 (ivankra/hsk30) và ghép từ HSK với dict_entry."""

import csv
import re
import unicodedata
from collections import Counter
from pathlib import Path

from clp.db import upsert

# Chuẩn HSK 2021 cấp 1–3 (spec import-pipeline.md B3): (từ, chữ, ngữ pháp) riêng từng cấp.
EXPECTED = {1: (500, 300, 48), 2: (772, 300, 81), 3: (973, 300, 81)}
BAND_7_9 = 7  # hsk30 gộp cấp 7–9 thành một nhóm "7-9"; lưu là 7.


def parse_level(raw: str) -> int:
    return BAND_7_9 if "-" in raw else int(raw)


def _read(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def read_words(path: Path) -> list[dict]:
    """Khóa tự nhiên (level, simplified, pinyin); dòng trùng trong nguồn được gộp."""
    seen: dict[tuple, dict] = {}
    for r in _read(path):
        w = {
            "level": parse_level(r["Level"]),
            "simplified": r["Simplified"],
            "pinyin": r["Pinyin"],
            "pos": r["POS"] or None,
        }
        seen.setdefault((w["level"], w["simplified"], w["pinyin"]), w)
    return list(seen.values())


def read_chars(path: Path) -> list[dict]:
    return [{"char": r["Hanzi"], "level": parse_level(r["Level"])} for r in _read(path)]


def read_grammar(path: Path) -> list[dict]:
    rows = []
    for r in _read(path):
        head = "·".join(x for x in (r["Category"], r["Details"]) if x)
        rows.append(
            {
                "code": f"hsk30-g{int(r['No']):03d}",
                "level": parse_level(r["Level"]),
                "name_zh": f"{head}：{r['Content']}",
            }
        )
    return rows


def check_counts(words: list[dict], chars: list[dict], grammar: list[dict]) -> list[str]:
    """Cảnh báo khi số lượng cấp 1–3 lệch chuẩn. Không dừng pipeline."""
    got = [Counter(x["level"] for x in xs) for xs in (words, chars, grammar)]
    warns = []
    for level, expected in EXPECTED.items():
        for label, exp, counter in zip(("từ", "chữ", "ngữ pháp"), expected, got):
            if counter[level] != exp:
                warns.append(f"HSK cấp {level}: {label} {counter[level]}, chuẩn {exp}")
    return warns


def _norm(pinyin: str) -> str:
    s = unicodedata.normalize("NFC", pinyin).lower()
    return re.sub(r"[\s'’\-·]", "", s)


def _best(cands: list[dict]) -> dict:
    """Ưu tiên mục không phải họ/biến thể, rồi mục nhiều nghĩa nhất, rồi id nhỏ nhất."""
    return min(cands, key=lambda e: (e["is_variant_or_surname"], -e["n_defs"], e["id"]))


def match_word(word: dict, candidates: list[dict], override: dict | None) -> dict | None:
    """candidates: các dict_entry có cùng `simplified`. Trả mục khớp hoặc None."""
    if override:
        for e in candidates:
            if e["pinyin_numbered"] == override["pinyin_numbered"]:
                return e
    if not candidates:
        return None
    want = _norm(word["pinyin"])
    same_pinyin = [e for e in candidates if _norm(e["pinyin_marked"]) == want]
    if same_pinyin:
        return _best(same_pinyin)
    if len(candidates) == 1:
        return candidates[0]
    return _best(candidates)


def _load_candidates(conn, simplified: list[str]) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, simplified, pinyin_marked, pinyin_numbered, is_variant_or_surname,"
            " coalesce(array_length(definitions, 1), 0) FROM dict_entry WHERE simplified = ANY(%s)",
            (simplified,),
        )
        for id_, simp, marked, numbered, variant, n in cur.fetchall():
            out.setdefault(simp, []).append(
                {
                    "id": id_,
                    "simplified": simp,
                    "pinyin_marked": marked,
                    "pinyin_numbered": numbered,
                    "is_variant_or_surname": variant,
                    "n_defs": n,
                }
            )
    return out


def import_hsk(
    conn,
    words_csv: Path,
    chars_csv: Path,
    grammar_csv: Path,
    *,
    overrides: list[dict],
    out_dir: Path,
) -> dict:
    words = read_words(words_csv)
    chars = read_chars(chars_csv)
    grammar = read_grammar(grammar_csv)
    by_override = {(o["simplified"], _norm(o["pinyin"])): o for o in overrides}
    cands = _load_candidates(conn, sorted({w["simplified"] for w in words}))

    rows, unmatched, level_of = [], [], {}
    for w in words:
        pool = cands.get(w["simplified"], [])
        hit = match_word(w, pool, by_override.get((w["simplified"], _norm(w["pinyin"]))))
        rows.append({**w, "dict_entry_id": hit["id"] if hit else None})
        if hit:
            level_of[hit["id"]] = min(level_of.get(hit["id"], w["level"]), w["level"])
        else:
            unmatched.append((w, " | ".join(e["pinyin_marked"] for e in pool)))

    res = {"words": upsert(conn, "hsk_word", rows, ["level", "simplified", "pinyin"])}
    res["chars"] = upsert(conn, "hsk_char", chars, ["char"])
    res["grammar"] = upsert(conn, "hsk_grammar", grammar, ["code"])

    with conn.cursor() as cur:
        cur.execute("UPDATE dict_entry SET hsk_level = NULL WHERE hsk_level IS NOT NULL")
        for level in sorted(set(level_of.values())):
            ids = [i for i, lv in level_of.items() if lv == level]
            cur.execute("UPDATE dict_entry SET hsk_level = %s WHERE id = ANY(%s)", (level, ids))
    conn.commit()

    out_dir.mkdir(parents=True, exist_ok=True)
    with (out_dir / "hsk_unmatched.csv").open("w", encoding="utf-8", newline="") as f:
        wr = csv.writer(f)
        wr.writerow(["simplified", "pinyin", "level", "candidates"])
        for w, c in unmatched:
            wr.writerow([w["simplified"], w["pinyin"], w["level"], c])

    res["unmatched"] = len(unmatched)
    res["warnings"] = check_counts(words, chars, grammar)
    return res
