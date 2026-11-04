"""`clp check-content`: đọc content/, dựng ngữ cảnh từ DB, chạy quy tắc kiểm tra (không ghi DB)."""

from pathlib import Path

from clp.content.loader import ContentError, LoadedGrammar, LoadedUnit, load_grammar, load_unit
from clp.content.rules import Context, Finding, Report, validate_content

# Đến khi có stages.yaml (02-3): thứ tự và cấp HSK của từng lộ trình.
STAGE_ORDER = ["pron", "hsk1", "hsk2", "hsk3"]
STAGE_LEVELS = {"hsk1": 1, "hsk2": 2, "hsk3": 3}


def discover_files(content_dir: Path) -> tuple[list[Path], list[Path]]:
    """File chủ đề `content/<lộ trình>/u*.yaml` và file ngữ pháp `content/grammar/*.yaml`."""
    units = [p for stage in STAGE_ORDER for p in sorted((content_dir / stage).glob("u*.yaml"))]
    grammar = sorted((content_dir / "grammar").glob("*.yaml"))
    return units, grammar


def load_context(conn, grammar_ids: set[str]) -> Context:
    from clp.tatoeba import make_tokenizer

    with conn.cursor() as cur:
        cur.execute("SELECT level, simplified FROM hsk_word WHERE NOT deprecated")
        hsk: dict[int, set[str]] = {}
        for level, word in cur.fetchall():
            hsk.setdefault(level, set()).add(word)
        cur.execute("SELECT char FROM hanzi WHERE has_stroke_data")
        strokes = {c for (c,) in cur.fetchall()}
        cur.execute("SELECT id FROM lesson")
        published = {i for (i,) in cur.fetchall()}
    words = sorted({w for ws in hsk.values() for w in ws})
    return Context(
        hsk_words=hsk,
        stroke_chars=strokes,
        stage_levels=STAGE_LEVELS,
        stage_order=STAGE_ORDER,
        grammar_ids=grammar_ids,
        sound_ids=None,  # chưa có pron/sounds.yaml (10-2)
        published_lesson_ids=published,
        tokenize=make_tokenizer(words).lcut if words else None,
    )


def check_content(conn, content_dir: Path) -> Report:
    unit_paths, grammar_paths = discover_files(content_dir)
    report = Report()
    units: list[LoadedUnit] = []
    grammar: list[LoadedGrammar] = []
    for loader, paths, bucket in (
        (load_unit, unit_paths, units),
        (load_grammar, grammar_paths, grammar),
    ):
        for path in paths:
            try:
                bucket.append(loader(path))  # type: ignore[arg-type]
            except ContentError as e:
                report.findings += [
                    Finding(
                        "error",
                        "invalid_file",
                        f"{i.path}: {i.message}".lstrip(": "),
                        i.file,
                        i.line,
                    )
                    for i in e.issues
                ]
    ctx = load_context(conn, {p.id for g in grammar for p in g.points})
    report.findings += validate_content(units, grammar, ctx).findings
    return report
