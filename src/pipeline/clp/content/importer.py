"""02-3: `import_content`. Đọc → kiểm tra (dừng nếu có lỗi) → chuẩn hóa → ghi DB trong một transaction."""

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path

from clp.content.check import Loaded, check_loaded, load_content, load_context
from clp.content.coverage import StageCoverage, compute_stage_coverage, write_coverage
from clp.content.normalize import Normalized, NormContext, normalize_content
from clp.content.rules import Finding, Report


class ContentCheckError(Exception):
    """Nội dung có lỗi chặn: không ghi gì vào DB."""

    def __init__(self, report: Report):
        self.report = report
        super().__init__("\n".join(str(f) for f in report.errors))


@dataclass
class ImportResult:
    content_version: str
    lessons: int = 0
    units_published: int = 0
    units_planned: int = 0
    warnings: list[Finding] = field(default_factory=list)
    coverage: dict[str, StageCoverage] = field(default_factory=dict)


def _unit_rows(loaded: Loaded) -> list[dict]:
    """Chủ đề có file (published) rồi chủ đề chỉ có trong _plan.yaml (Sắp ra mắt)."""
    rows = {
        lu.unit.id: {
            "id": lu.unit.id,
            "stage": lu.unit.stage,
            "order": lu.unit.order,
            "title": lu.unit.title,
            "description": lu.unit.description,
            "image": lu.unit.illustration,
            "published": True,
        }
        for lu in loaded.units
    }
    for stage, _path, p in loaded.plan_units:
        rows.setdefault(
            p.id,
            {
                "id": p.id,
                "stage": stage,
                "order": p.order,
                "title": p.title,
                "description": p.description,
                "image": p.illustration,
                "published": False,
            },
        )
    return list(rows.values())


def _precheck(loaded: Loaded, report: Report, units: list[dict]) -> None:
    if loaded.stages is None:
        report.findings.append(Finding("error", "stages_missing", "Thiếu content/stages.yaml"))
        return
    seen: dict[tuple[str, int], str] = {}
    for u in units:
        key = (u["stage"], u["order"])
        if key in seen:
            report.findings.append(
                Finding(
                    "error",
                    "duplicate_unit_order",
                    f"Chủ đề {u['id']} và {seen[key]} cùng thứ tự {u['order']} trong lộ trình {u['stage']}",
                )
            )
        seen[key] = u["id"]


def _norm_context(conn, loaded: Loaded, strokes: set[str]) -> NormContext:
    ids: dict[tuple[int, str], list[int]] = {}
    with conn.cursor() as cur:
        cur.execute("SELECT id, level, simplified FROM hsk_word WHERE NOT deprecated ORDER BY id")
        for id_, level, word in cur.fetchall():
            ids.setdefault((level, word), []).append(id_)
    return NormContext(
        stage_levels=loaded.stage_levels,
        stage_order=loaded.stage_order,
        hsk_word_ids=ids,
        stroke_chars=strokes,
    )


def _version_of(norm: Normalized) -> str:
    joined = "".join(
        f"{n.lesson_id}:{n.content.content_version};"
        for n in sorted(norm.lessons, key=lambda n: n.lesson_id)
    )
    return hashlib.sha256(joined.encode()).hexdigest()[:12]


def import_content(
    conn, content_dir: Path, version: str | None = None, out_dir: Path | None = None
) -> ImportResult:
    loaded = load_content(content_dir)
    report = check_loaded(conn, loaded)
    units = _unit_rows(loaded)
    _precheck(loaded, report, units)
    if not report.ok:
        raise ContentCheckError(report)

    ctx = load_context(conn, loaded)
    norm = normalize_content(loaded.units, _norm_context(conn, loaded, ctx.stroke_chars))
    result = ImportResult(
        content_version=version or _version_of(norm),
        lessons=len(norm.lessons),
        units_published=sum(1 for u in units if u["published"]),
        units_planned=sum(1 for u in units if not u["published"]),
        warnings=report.warnings + norm.warnings,
    )
    result.coverage = _write(conn, loaded, units, norm, result.content_version)
    if out_dir is not None:
        write_coverage(out_dir, result.coverage)
    return result


def _write(
    conn, loaded: Loaded, units: list[dict], norm: Normalized, version: str
) -> dict[str, StageCoverage]:
    lesson_ids = [n.lesson_id for n in norm.lessons]
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("SELECT char FROM hanzi")
        known_chars = {c for (c,) in cur.fetchall()}

        for s in loaded.stages or []:
            cur.execute(
                'INSERT INTO stage (id, "order", title, description, has_certificate)'
                " VALUES (%s,%s,%s,%s,%s) ON CONFLICT (id) DO UPDATE SET"
                ' "order"=EXCLUDED."order", title=EXCLUDED.title, description=EXCLUDED.description,'
                " has_certificate=EXCLUDED.has_certificate",
                (s.id, s.order, s.title, s.description, s.has_certificate),
            )

        # Đổi chỗ thứ tự không vấp ràng buộc duy nhất: đặt tạm số âm rồi ghi giá trị cuối.
        cur.execute(
            'UPDATE unit SET "order" = -"order" WHERE id = ANY(%s)', ([u["id"] for u in units],)
        )
        cur.execute('UPDATE lesson SET "order" = -"order" WHERE id = ANY(%s)', (lesson_ids,))

        for u in units:
            cur.execute(
                'INSERT INTO unit (id, stage_id, "order", title, description, image, published)'
                " VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO UPDATE SET"
                ' stage_id=EXCLUDED.stage_id, "order"=EXCLUDED."order", title=EXCLUDED.title,'
                " description=EXCLUDED.description, image=EXCLUDED.image, published=EXCLUDED.published",
                (
                    u["id"],
                    u["stage"],
                    u["order"],
                    u["title"],
                    u["description"],
                    u["image"],
                    u["published"],
                ),
            )

        for n in norm.lessons:
            body = json.dumps(n.content.model_dump(mode="json", by_alias=True), ensure_ascii=False)
            cur.execute(
                'INSERT INTO lesson (id, unit_id, "order", title, kind, content)'
                " VALUES (%s,%s,%s,%s,%s,%s::jsonb) ON CONFLICT (id) DO UPDATE SET"
                ' unit_id=EXCLUDED.unit_id, "order"=EXCLUDED."order", title=EXCLUDED.title,'
                " kind=EXCLUDED.kind, content=EXCLUDED.content",
                (n.lesson_id, n.unit_id, n.order, n.title, n.kind, body),
            )

        cur.execute("DELETE FROM lesson_word WHERE lesson_id = ANY(%s)", (lesson_ids,))
        cur.execute("DELETE FROM lesson_char WHERE lesson_id = ANY(%s)", (lesson_ids,))
        for n in norm.lessons:
            for wid in dict.fromkeys(n.word_ids):
                cur.execute(
                    "INSERT INTO lesson_word (lesson_id, hsk_word_id) VALUES (%s,%s)",
                    (n.lesson_id, wid),
                )
            for ch in n.chars:
                if ch in known_chars:  # chữ ngoài bảng hanzi (từ extra) không vào thống kê chữ
                    cur.execute(
                        "INSERT INTO lesson_char (lesson_id, char) VALUES (%s,%s)",
                        (n.lesson_id, ch),
                    )

        for g in loaded.grammar:
            for p in g.points:
                cur.execute(
                    "INSERT INTO grammar_point (id, hsk_code, title, body_md, examples)"
                    " VALUES (%s,%s,%s,%s,%s::jsonb) ON CONFLICT (id) DO UPDATE SET"
                    " hsk_code=EXCLUDED.hsk_code, title=EXCLUDED.title, body_md=EXCLUDED.body_md,"
                    " examples=EXCLUDED.examples",
                    (
                        p.id,
                        p.hsk_code,
                        p.title,
                        f"{p.explanation_vi.strip()}\n\n**Cấu trúc:** {p.pattern}",
                        json.dumps([e.model_dump() for e in p.examples], ensure_ascii=False),
                    ),
                )

        cur.execute(
            "INSERT INTO content_meta (key, value) VALUES ('content_version', %s)"
            " ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            (version,),
        )

        # Độ phủ tính trên dữ liệu vừa ghi; exam_open chỉ mở khi mọi điều kiện đủ, và đóng lại nếu lùi.
        coverage: dict[str, StageCoverage] = {}
        for stage in loaded.stages or []:
            if stage.level is None:
                continue
            cov = compute_stage_coverage(cur, stage)
            coverage[stage.id] = cov
            cur.execute("UPDATE stage SET exam_open = %s WHERE id = %s", (cov.exam_open, stage.id))
    conn.commit()
    return coverage
