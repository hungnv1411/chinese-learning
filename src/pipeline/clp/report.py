"""B8. Sinh pipeline/out/report.md để kiểm tra nhanh kết quả nhập dữ liệu."""

from pathlib import Path

from clp.hsk import check_counts

TABLES = (
    "dict_entry",
    "hsk_word",
    "hsk_char",
    "hsk_grammar",
    "hanzi",
    "radical_vi",
    "sentence",
    "sentence_word",
    "audio_asset",
)


def _one(conn, sql: str) -> int:
    with conn.cursor() as cur:
        cur.execute(sql)
        return cur.fetchone()[0]


def _levels(conn, table: str, where: str = "") -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(f"SELECT level FROM {table} {where}")
        return [{"level": lv} for (lv,) in cur.fetchall()]


def collect_stats(conn) -> dict:
    tables = {t: _one(conn, f"SELECT count(*) FROM {t}") for t in TABLES}
    low = "FROM hsk_char c JOIN hanzi h ON h.char = c.char WHERE c.level <= 3"
    with conn.cursor() as cur:
        cur.execute(
            "SELECT w.level, count(*) FROM hsk_word w WHERE w.level <= 3 AND NOT w.deprecated"
            " AND NOT EXISTS (SELECT 1 FROM sentence_word sw JOIN sentence s ON s.id = sw.sentence_id"
            " WHERE sw.dict_entry_id = w.dict_entry_id AND s.max_hsk_level <= w.level)"
            " GROUP BY 1"
        )
        missing = dict(cur.fetchall())
    words = _levels(conn, "hsk_word", "WHERE NOT deprecated")
    return {
        "tables": tables,
        "hsk_unmatched": _one(
            conn, "SELECT count(*) FROM hsk_word WHERE dict_entry_id IS NULL AND NOT deprecated"
        ),
        "hanviet_missing": _one(conn, f"SELECT count(*) {low} AND h.han_viet = '{{}}'"),
        "strokes_missing": _one(conn, f"SELECT count(*) {low} AND NOT h.has_stroke_data"),
        "words_without_sentence": {lv: missing.get(lv, 0) for lv in (1, 2, 3)},
        "warnings": check_counts(words, _levels(conn, "hsk_char"), _levels(conn, "hsk_grammar")),
    }


def render(stats: dict, now: str) -> str:
    lines = ["# Báo cáo pipeline", "", f"Tạo lúc {now}.", "", "## Số dòng mỗi bảng", ""]
    lines += ["| Bảng | Số dòng |", "|---|---|"]
    lines += [f"| {t} | {n} |" for t, n in stats["tables"].items()]
    lines += [
        "",
        "## Dữ liệu thiếu",
        "",
        f"- Từ HSK chưa ghép được với từ điển: **{stats['hsk_unmatched']}** (`out/hsk_unmatched.csv`)",
        f"- Chữ HSK 1–3 thiếu Hán Việt: **{stats['hanviet_missing']}** (`out/hanviet_missing.csv`)",
        f"- Chữ HSK 1–3 thiếu dữ liệu nét: **{stats['strokes_missing']}** (`out/strokes_missing.csv`)",
        "- Từ HSK 1–3 không có câu ví dụ nào có `max_hsk_level` ≤ cấp của từ:",
        "",
        "| Cấp | Số từ |",
        "|---|---|",
    ]
    lines += [f"| {lv} | {n} |" for lv, n in stats["words_without_sentence"].items()]
    lines += ["", "## Cảnh báo lệch chuẩn", ""]
    lines += [f"- {w}" for w in stats["warnings"]] or ["Không có."]
    return "\n".join(lines) + "\n"


def write_report(conn, out_dir: Path, now: str) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "report.md"
    path.write_text(render(collect_stats(conn), now), encoding="utf-8")
    return path
