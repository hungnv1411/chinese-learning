"""Đọc content/, dựng ngữ cảnh từ DB và chạy quy tắc kiểm tra (không ghi DB)."""

from dataclasses import dataclass, field
from pathlib import Path

from clp.content.authoring import PlanUnit, StageEntry
from clp.content.loader import (
    ContentError,
    LoadedGrammar,
    LoadedUnit,
    load_grammar,
    load_plan,
    load_stages,
    load_unit,
)
from clp.content.rules import Context, Finding, Report, validate_content

# Khi chưa có content/stages.yaml (chỉ để `check-content` chạy được): thứ tự và cấp HSK mặc định.
DEFAULT_STAGE_ORDER = ["pron", "hsk1", "hsk2", "hsk3"]
DEFAULT_STAGE_LEVELS = {"hsk1": 1, "hsk2": 2, "hsk3": 3}
STAGE_ORDER = DEFAULT_STAGE_ORDER  # tên cũ, giữ cho nơi đang import


@dataclass
class Loaded:
    """Mọi file nội dung đã đọc; lỗi đọc file nằm trong `findings`."""

    stages: list[StageEntry] | None = None
    units: list[LoadedUnit] = field(default_factory=list)
    grammar: list[LoadedGrammar] = field(default_factory=list)
    plan_units: list[tuple[str, Path, PlanUnit]] = field(
        default_factory=list
    )  # (lộ trình, file, chủ đề)
    findings: list[Finding] = field(default_factory=list)

    @property
    def stage_order(self) -> list[str]:
        if self.stages is None:
            return DEFAULT_STAGE_ORDER
        return [s.id for s in sorted(self.stages, key=lambda s: s.order)]

    @property
    def stage_levels(self) -> dict[str, int]:
        if self.stages is None:
            return DEFAULT_STAGE_LEVELS
        return {s.id: s.level for s in self.stages if s.level is not None}


def discover_files(content_dir: Path) -> tuple[list[Path], list[Path]]:
    """File chủ đề `content/<lộ trình>/u*.yaml` và file ngữ pháp `content/grammar/*.yaml`."""
    stages = DEFAULT_STAGE_ORDER
    stages_file = content_dir / "stages.yaml"
    if stages_file.exists():
        try:
            stages = [s.id for s in sorted(load_stages(stages_file), key=lambda s: s.order)]
        except ContentError:
            pass
    units = [p for stage in stages for p in sorted((content_dir / stage).glob("u*.yaml"))]
    grammar = sorted((content_dir / "grammar").glob("*.yaml"))
    return units, grammar


def _errors(e: ContentError) -> list[Finding]:
    return [
        Finding("error", "invalid_file", f"{i.path}: {i.message}".lstrip(": "), i.file, i.line)
        for i in e.issues
    ]


def load_content(content_dir: Path) -> Loaded:
    loaded = Loaded()
    stages_file = content_dir / "stages.yaml"
    if stages_file.exists():
        try:
            loaded.stages = load_stages(stages_file)
        except ContentError as e:
            loaded.findings += _errors(e)
    unit_paths, grammar_paths = discover_files(content_dir)
    for path in unit_paths:
        try:
            loaded.units.append(load_unit(path))
        except ContentError as e:
            loaded.findings += _errors(e)
    for path in grammar_paths:
        try:
            loaded.grammar.append(load_grammar(path))
        except ContentError as e:
            loaded.findings += _errors(e)
    for stage in loaded.stage_order:
        plan = content_dir / stage / "_plan.yaml"
        if plan.exists():
            try:
                loaded.plan_units += [(stage, plan, u) for u in load_plan(plan).units]
            except ContentError as e:
                loaded.findings += _errors(e)
    return loaded


def load_context(conn, loaded: Loaded) -> Context:
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
        stage_levels=loaded.stage_levels,
        stage_order=loaded.stage_order,
        grammar_ids={p.id for g in loaded.grammar for p in g.points},
        sound_ids=None,  # chưa có pron/sounds.yaml (10-2)
        published_lesson_ids=published,
        tokenize=make_tokenizer(words).lcut if words else None,
    )


def check_loaded(conn, loaded: Loaded) -> Report:
    report = Report(findings=list(loaded.findings))
    report.findings += validate_content(
        loaded.units, loaded.grammar, load_context(conn, loaded)
    ).findings
    return report


def check_content(conn, content_dir: Path) -> Report:
    return check_loaded(conn, load_content(content_dir))
