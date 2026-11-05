"""02-4. Báo cáo độ phủ từng lộ trình HSK và điều kiện mở bài kiểm tra cuối (`stage.exam_open`).

Độ phủ tính từ DB sau khi ghi nội dung (cùng transaction): từ HSK chưa là từ mới ở bài nào, điểm ngữ
pháp HSK chưa được dạy, chữ HSK chưa xuất hiện, chủ đề chưa phát hành, ngân hàng đề chưa đủ."""

import re
from dataclasses import dataclass, field
from pathlib import Path

from clp.content.authoring import StageEntry

BANK_FACTOR = 3  # ngân hàng đề cần ≥ 3 × số câu của một đề (12-exam-certificate/plan.md)
# Số câu mỗi phần trong một đề (final-exam.md §2). `skill` trong exam_item dùng các khóa này.
EXAM_PAPER: dict[str, dict[str, int]] = {
    "hsk1": {"listening": 20, "reading": 20, "writing": 5, "speaking": 5},
    "hsk2": {"listening": 25, "reading": 25, "writing": 8, "speaking": 6},
    "hsk3": {"listening": 30, "reading": 30, "writing": 10, "speaking": 8},
}
MAX_LISTED = 200
LEVEL_CHARS = "一二三四五六七八九"
GRAMMAR_CODE = re.compile(r"^([一二三四五六七八九])级-语法-(\d+)$")


def exam_bank_needs(stage: str) -> dict[str, int]:
    return {k: v * BANK_FACTOR for k, v in EXAM_PAPER.get(stage, {}).items()}


def grammar_code_to_level_index(code: str) -> tuple[int, int] | None:
    """`一级-语法-012` -> (1, 12): điểm ngữ pháp thứ 12 của cấp 1 trong danh sách HSK."""
    m = GRAMMAR_CODE.match(code)
    return (LEVEL_CHARS.index(m.group(1)) + 1, int(m.group(2))) if m else None


@dataclass
class StageCoverage:
    stage: str
    level: int
    units_total: int = 0
    units_unpublished: list[str] = field(default_factory=list)
    words_total: int = 0
    words_missing: list[tuple[int, str, str]] = field(default_factory=list)  # (id, từ, pinyin)
    grammar_total: int = 0
    grammar_missing: list[tuple[str, str]] = field(default_factory=list)  # (mã, tên)
    grammar_unmapped: list[str] = field(
        default_factory=list
    )  # id điểm ngữ pháp tự soạn không ghép được
    chars_total: int = 0
    chars_missing: list[str] = field(default_factory=list)
    exam_have: dict[str, int] = field(default_factory=dict)
    exam_missing: dict[str, tuple[int, int]] = field(default_factory=dict)  # skill -> (có, cần)

    @property
    def blockers(self) -> list[str]:
        out = []
        if self.units_total == 0:
            out.append("chưa có chủ đề nào")
        if self.units_unpublished:
            out.append(f"{len(self.units_unpublished)} chủ đề chưa phát hành")
        if self.words_missing:
            out.append(f"{len(self.words_missing)} từ HSK chưa dạy")
        if self.grammar_missing:
            out.append(f"{len(self.grammar_missing)} điểm ngữ pháp chưa dạy")
        if self.exam_missing:
            out.append("ngân hàng đề chưa đủ: " + ", ".join(self.exam_missing))
        return out

    @property
    def exam_open(self) -> bool:
        return not self.blockers


def compute_stage_coverage(cur, stage: StageEntry) -> StageCoverage:
    """Đọc DB (trong transaction vừa ghi nội dung) và tính độ phủ của một lộ trình có `level`."""
    assert stage.level is not None
    cov = StageCoverage(stage=stage.id, level=stage.level)

    cur.execute('SELECT id, published FROM unit WHERE stage_id = %s ORDER BY "order"', (stage.id,))
    units = cur.fetchall()
    cov.units_total = len(units)
    cov.units_unpublished = [i for i, published in units if not published]

    cur.execute(
        "SELECT w.id, w.simplified, w.pinyin FROM hsk_word w WHERE w.level = %s AND NOT w.deprecated"
        " AND NOT EXISTS (SELECT 1 FROM lesson_word lw JOIN lesson l ON l.id = lw.lesson_id"
        " JOIN unit u ON u.id = l.unit_id WHERE lw.hsk_word_id = w.id AND u.stage_id = %s)"
        " ORDER BY w.id",
        (stage.level, stage.id),
    )
    cov.words_missing = cur.fetchall()
    cur.execute("SELECT count(*) FROM hsk_word WHERE level = %s AND NOT deprecated", (stage.level,))
    cov.words_total = cur.fetchone()[0]

    cur.execute(
        "SELECT code, name_zh FROM hsk_grammar WHERE level = %s ORDER BY code", (stage.level,)
    )
    grammar = cur.fetchall()
    cov.grammar_total = len(grammar)
    cur.execute(
        "SELECT DISTINCT g.id, g.hsk_code FROM lesson l JOIN unit u ON u.id = l.unit_id,"
        " jsonb_array_elements(l.content->'steps') s"
        " JOIN grammar_point g ON g.id = s->>'grammarId'"
        " WHERE u.stage_id = %s AND s->>'kind' = 'grammar'",
        (stage.id,),
    )
    taught: set[str] = set()
    for gid, hsk_code in cur.fetchall():
        pos = grammar_code_to_level_index(hsk_code or "")
        if pos and pos[0] == stage.level and 1 <= pos[1] <= len(grammar):
            taught.add(grammar[pos[1] - 1][0])
        else:
            cov.grammar_unmapped.append(gid)
    cov.grammar_unmapped.sort()
    cov.grammar_missing = [g for g in grammar if g[0] not in taught]

    cur.execute("SELECT count(*) FROM hsk_char WHERE level = %s", (stage.level,))
    cov.chars_total = cur.fetchone()[0]
    cur.execute(
        "SELECT c.char FROM hsk_char c WHERE c.level = %s"
        " AND NOT EXISTS (SELECT 1 FROM lesson_char lc WHERE lc.char = c.char) ORDER BY c.id",
        (stage.level,),
    )
    cov.chars_missing = [c for (c,) in cur.fetchall()]

    cur.execute(
        "SELECT skill, count(*) FROM exam_item WHERE stage_id = %s GROUP BY skill", (stage.id,)
    )
    cov.exam_have = dict(cur.fetchall())
    for skill, need in exam_bank_needs(stage.id).items():
        have = cov.exam_have.get(skill, 0)
        if have < need:
            cov.exam_missing[skill] = (have, need)
    return cov


def _listing(title: str, items: list[str], noun: str) -> list[str]:
    if not items:
        return []
    shown = items[:MAX_LISTED]
    lines = ["", f"## {title}", "", ", ".join(shown)]
    if len(items) > MAX_LISTED:
        lines += ["", f"… và {len(items) - MAX_LISTED} {noun} nữa"]
    return lines


def render_coverage(cov: StageCoverage) -> str:
    taught_words = cov.words_total - len(cov.words_missing)
    taught_grammar = cov.grammar_total - len(cov.grammar_missing)
    seen_chars = cov.chars_total - len(cov.chars_missing)
    lines = [
        f"# Độ phủ {cov.stage}",
        "",
        f"Cấp HSK {cov.level}. exam_open: **{'có' if cov.exam_open else 'không'}**"
        + ("" if cov.exam_open else f" ({'; '.join(cov.blockers)})"),
        "",
        "| Hạng mục | Đạt / Tổng |",
        "|---|---|",
        f"| Chủ đề đã phát hành | {cov.units_total - len(cov.units_unpublished)} / {cov.units_total} |",
        f"| Từ HSK đã dạy | {taught_words} / {cov.words_total} |",
        f"| Điểm ngữ pháp đã dạy | {taught_grammar} / {cov.grammar_total} |",
        f"| Chữ HSK đã xuất hiện | {seen_chars} / {cov.chars_total} |",
    ]
    for skill, need in exam_bank_needs(cov.stage).items():
        lines.append(f"| Ngân hàng đề: {skill} | {cov.exam_have.get(skill, 0)} / {need} |")
    lines += _listing("Chủ đề chưa phát hành", cov.units_unpublished, "chủ đề")
    lines += _listing("Từ HSK chưa dạy", [f"{w} ({p})" for _id, w, p in cov.words_missing], "từ")
    lines += _listing(
        "Ngữ pháp chưa dạy", [f"{code} {name}" for code, name in cov.grammar_missing], "điểm"
    )
    if cov.grammar_unmapped:
        lines += _listing(
            "Điểm ngữ pháp tự soạn không ghép được với danh sách HSK (kiểm tra `hsk_code`)",
            cov.grammar_unmapped,
            "điểm",
        )
    lines += _listing("Chữ HSK chưa xuất hiện", cov.chars_missing, "chữ")
    if cov.exam_missing:
        lines += ["", "## Ngân hàng đề chưa đủ", ""]
        lines += [
            f"- {skill}: có {have}, cần {need}" for skill, (have, need) in cov.exam_missing.items()
        ]
    return "\n".join(lines) + "\n"


def write_coverage(out_dir: Path, covs: dict[str, StageCoverage]) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for stage, cov in covs.items():
        path = out_dir / f"coverage-{stage}.md"
        path.write_text(render_coverage(cov), encoding="utf-8")
        paths.append(path)
    return paths
