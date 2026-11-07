"""`uv run clp <lệnh>`. Các lệnh được thêm dần theo từng bước của plan 01."""

from pathlib import Path
from typing import Annotated

import typer

app = typer.Typer(help="Pipeline dữ liệu cho website học tiếng Trung.", no_args_is_help=True)

# Đăng ký lệnh ở đây: fetch (01-2), import-cedict (01-3), import-hsk (01-4),
# import-hanzi (01-5), import-tatoeba (01-6), report (01-8), generate-audio (01-7b).


@app.callback()
def main() -> None:
    """Pipeline dữ liệu."""


@app.command()
def pinyin(text: str, join: bool = False) -> None:
    """Đổi pinyin số thanh sang có dấu: `clp pinyin "hao3 chi1" --join`."""
    from clp.pinyin import numbered_to_marked

    typer.echo(numbered_to_marked(text, join=join))


PIPELINE_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = PIPELINE_DIR.parents[1] / "data" / "raw"


@app.command()
def fetch(
    names: Annotated[
        list[str] | None, typer.Argument(help="Tên nguồn; bỏ trống để tải tất cả.")
    ] = None,
    raw_dir: Annotated[Path, typer.Option(help="Thư mục dữ liệu thô.")] = RAW_DIR,
    sources: Annotated[Path, typer.Option(help="File URL các nguồn.")] = PIPELINE_DIR
    / "sources.yaml",
) -> None:
    """B1: tải dữ liệu nguồn vào data/raw/<nguồn>/<ngày>/ và ghi manifest.json."""
    import datetime

    import httpx

    from clp.fetch import fetch_sources, load_sources

    today = datetime.date.today().isoformat()
    with httpx.Client(timeout=120) as client:
        result = fetch_sources(
            load_sources(sources), raw_dir, today=today, client=client, names=names or None
        )
    for name, state in result.items():
        typer.echo(f"{name}: {state}")


@app.command(name="import-cedict")
def import_cedict_cmd(
    raw_dir: Annotated[Path, typer.Option(help="Thư mục dữ liệu thô.")] = RAW_DIR,
) -> None:
    """B2: nhập CC-CEDICT bản mới nhất theo manifest vào dict_entry."""
    import datetime

    from clp.cedict import import_cedict
    from clp.db import connect, log_run
    from clp.fetch import latest_dir

    src = next(latest_dir(raw_dir, "cedict").glob("*.txt*"))
    with connect() as conn:
        res = import_cedict(conn, src)
    log_run(
        PIPELINE_DIR / "out" / "runs.log",
        "import-cedict",
        inserted=res["inserted"],
        updated=res["updated"],
        skipped=0,
        now=datetime.datetime.now().isoformat(timespec="seconds"),
    )
    typer.echo(f"dict_entry: +{res['inserted']} mới, {res['updated']} cập nhật")


@app.command(name="import-hsk")
def import_hsk_cmd(
    raw_dir: Annotated[Path, typer.Option(help="Thư mục dữ liệu thô.")] = RAW_DIR,
    overrides: Annotated[Path, typer.Option(help="File ghép tay HSK → dict_entry.")] = (
        PIPELINE_DIR.parents[1] / "content" / "overrides" / "hsk_dict_map.yaml"
    ),
) -> None:
    """B3: nhập HSK 2021 (từ, chữ, ngữ pháp), ghép với dict_entry, cập nhật hsk_level."""
    import datetime

    import yaml

    from clp.db import connect, log_run
    from clp.fetch import latest_dir
    from clp.hsk import import_hsk

    d = latest_dir(raw_dir, "hsk30")
    ov = yaml.safe_load(overrides.read_text(encoding="utf-8")) if overrides.exists() else []
    out_dir = PIPELINE_DIR / "out"
    with connect() as conn:
        res = import_hsk(
            conn,
            d / "hsk30-expanded.csv",
            d / "hsk30-chars.csv",
            d / "hsk30-grammar.csv",
            overrides=ov or [],
            out_dir=out_dir,
        )
    total = {k: res[k]["inserted"] for k in ("words", "chars", "grammar")}
    log_run(
        out_dir / "runs.log",
        "import-hsk",
        inserted=sum(total.values()),
        updated=sum(res[k]["updated"] for k in total),
        skipped=res["unmatched"],
        now=datetime.datetime.now().isoformat(timespec="seconds"),
    )
    typer.echo(f"hsk: {total}, chưa ghép được: {res['unmatched']} (out/hsk_unmatched.csv)")
    for w in res["warnings"]:
        typer.echo(f"CẢNH BÁO {w}")


@app.command(name="import-hanzi")
def import_hanzi_cmd(
    raw_dir: Annotated[Path, typer.Option(help="Thư mục dữ liệu thô.")] = RAW_DIR,
    strokes_dir: Annotated[
        Path, typer.Option(help="Nơi ghi nét khi chưa cấu hình R2.")
    ] = PIPELINE_DIR.parents[1] / "data" / "strokes",
) -> None:
    """B4: nhập bộ thủ, âm Hán Việt, phân tích chữ, dữ liệu nét (R2 nếu có R2_*, không thì cục bộ)."""
    import datetime
    import os

    import yaml

    from clp.db import connect, log_run
    from clp.fetch import latest_dir
    from clp.hanzi import LocalStrokeStore, import_hanzi, make_r2_store
    from clp.radicals import load_radicals

    content = PIPELINE_DIR.parents[1] / "content"
    ov_path = content / "overrides" / "han_viet.yaml"
    overrides = (
        yaml.safe_load(ov_path.read_text(encoding="utf-8")) if ov_path.exists() else {}
    ) or {}
    store = make_r2_store(dict(os.environ))
    typer.echo("Nét: " + ("R2" if store else f"thư mục cục bộ {strokes_dir} (chưa có R2_*)"))
    out_dir = PIPELINE_DIR / "out"
    with connect() as conn:
        res = import_hanzi(
            conn,
            unihan_zip=latest_dir(raw_dir, "unihan") / "Unihan.zip",
            mmh_dictionary=latest_dir(raw_dir, "makemeahanzi") / "dictionary.txt",
            strokes_tgz=next(latest_dir(raw_dir, "hanzi-writer-data").glob("*.tgz")),
            radicals=load_radicals(content / "radicals_vi.yaml"),
            overrides=overrides,
            store=store or LocalStrokeStore(strokes_dir),
            out_dir=out_dir,
        )
    log_run(
        out_dir / "runs.log",
        "import-hanzi",
        inserted=res["hanzi"]["inserted"],
        updated=res["hanzi"]["updated"],
        skipped=res["hanviet_missing"],
        now=datetime.datetime.now().isoformat(timespec="seconds"),
    )
    typer.echo(
        f"hanzi: {res['hanzi']}, nét mới tải: {res['uploaded']}, "
        f"thiếu Hán Việt (HSK 1–3): {res['hanviet_missing']}, thiếu nét: {res['strokes_missing']}"
    )


@app.command(name="import-tatoeba")
def import_tatoeba_cmd(
    raw_dir: Annotated[Path, typer.Option(help="Thư mục dữ liệu thô.")] = RAW_DIR,
) -> None:
    """B5: nhập câu ví dụ Tatoeba (cmn ↔ eng), tách từ, nối từ điển, tính max_hsk_level."""
    import datetime

    from clp.db import connect, log_run
    from clp.fetch import latest_dir
    from clp.tatoeba import import_tatoeba

    d = latest_dir(raw_dir, "tatoeba")
    out_dir = PIPELINE_DIR / "out"
    with connect() as conn:
        res = import_tatoeba(
            conn, d / "cmn_sentences.tsv.bz2", d / "eng_sentences.tsv.bz2", d / "links.tar.bz2"
        )
    log_run(
        out_dir / "runs.log",
        "import-tatoeba",
        inserted=res["sentences"]["inserted"],
        updated=res["sentences"]["updated"],
        skipped=res["dropped"],
        now=datetime.datetime.now().isoformat(timespec="seconds"),
    )
    typer.echo(
        f"sentence: {res['sentences']}, bỏ qua: {res['dropped']}, liên kết từ: {res['links']}"
    )


@app.command()
def report() -> None:
    """B8: sinh out/report.md (số dòng mỗi bảng, dữ liệu thiếu, cảnh báo lệch chuẩn)."""
    import datetime

    from clp.db import connect
    from clp.report import write_report

    with connect() as conn:
        path = write_report(
            conn, PIPELINE_DIR / "out", now=datetime.datetime.now().isoformat(timespec="seconds")
        )
    typer.echo(f"Đã ghi {path}")


@app.command()
def syllables() -> None:
    """10-1: sinh content/pron/syllables.yaml; báo chênh lệch với âm tiết trong CC-CEDICT."""
    from clp.db import connect
    from clp.pinyin import parse_numbered
    from clp.syllables import (
        build_entries,
        collect_chars,
        compare_with_cedict,
        render_core_json,
        render_yaml,
    )

    with connect() as conn:
        chars = collect_chars(conn)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT DISTINCT pinyin_numbered FROM dict_entry"
                " WHERE char_length(simplified) = 1 AND pinyin_numbered !~ ' '"
            )
            cedict = {parse_numbered(p.lower())[0] for (p,) in cur.fetchall()}
            cur.execute("SELECT key FROM audio_asset WHERE key LIKE 'syl/%'")
            audio = {k for (k,) in cur.fetchall()}
    diff = compare_with_cedict(cedict)
    entries = build_entries(chars, audio)
    path = PIPELINE_DIR.parents[1] / "content" / "pron" / "syllables.yaml"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_yaml(entries), encoding="utf-8")
    core = PIPELINE_DIR.parents[0] / "packages" / "core" / "src" / "syllables.json"
    core.write_text(render_core_json(), encoding="utf-8")
    typer.echo(f"Đã ghi {path}: {len(entries)} âm tiết, {len(chars)} thanh có chữ ví dụ")
    typer.echo(
        f"Chỉ có trong CC-CEDICT ({len(diff['only_in_cedict'])}): {' '.join(diff['only_in_cedict'])}"
    )
    typer.echo(
        f"Chỉ có trong danh sách chuẩn ({len(diff['only_in_standard'])}): {' '.join(diff['only_in_standard'])}"
    )


@app.command(name="check-content")
def check_content_cmd(
    content_dir: Annotated[Path, typer.Option(help="Thư mục nội dung.")] = (
        PIPELINE_DIR.parents[1] / "content"
    ),
) -> None:
    """02-2: kiểm tra nội dung YAML (chặn/cảnh báo) với dữ liệu trong DB; không ghi DB."""
    from clp.content.check import check_content
    from clp.db import connect

    with connect() as conn:
        report = check_content(conn, content_dir)
        conn.rollback()
    for f in report.errors + report.warnings:
        typer.echo(str(f))
    typer.echo(f"{len(report.errors)} lỗi, {len(report.warnings)} cảnh báo")
    if not report.ok:
        raise typer.Exit(1)


@app.command(name="import-content")
def import_content_cmd(
    content_dir: Annotated[Path, typer.Option(help="Thư mục nội dung.")] = (
        PIPELINE_DIR.parents[1] / "content"
    ),
    version: Annotated[
        str | None, typer.Option(help="content_version của lần nhập (vd. git short sha).")
    ] = None,
    check: Annotated[bool, typer.Option("--check", help="Chỉ kiểm tra, không ghi DB.")] = False,
) -> None:
    """B6: kiểm tra, chuẩn hóa và ghi nội dung lộ trình vào DB (một transaction)."""
    import datetime

    from clp.content.check import check_content
    from clp.content.importer import ContentCheckError, import_content
    from clp.db import connect, log_run

    with connect() as conn:
        if check:
            report = check_content(conn, content_dir)
            for f in report.errors + report.warnings:
                typer.echo(str(f))
            typer.echo(f"{len(report.errors)} lỗi, {len(report.warnings)} cảnh báo")
            raise typer.Exit(0 if report.ok else 1)
        try:
            res = import_content(conn, content_dir, version, out_dir=PIPELINE_DIR / "out")
        except ContentCheckError as e:
            conn.rollback()
            for f in e.report.errors + e.report.warnings:
                typer.echo(str(f))
            typer.echo(f"Dừng, không ghi DB: {len(e.report.errors)} lỗi")
            raise typer.Exit(1) from e
    for w in res.warnings:
        typer.echo(str(w))
    log_run(
        PIPELINE_DIR / "out" / "runs.log",
        "import-content",
        inserted=res.lessons,
        updated=0,
        skipped=len(res.warnings),
        now=datetime.datetime.now().isoformat(timespec="seconds"),
    )
    for stage, cov in res.coverage.items():
        state = "mở" if cov.exam_open else "đóng: " + "; ".join(cov.blockers)
        typer.echo(f"{stage}: bài kiểm tra cuối {state} (out/coverage-{stage}.md)")
    typer.echo(
        f"content_version {res.content_version}: {res.lessons} bài, "
        f"{res.units_published} chủ đề đã phát hành, {res.units_planned} sắp ra mắt, "
        f"{len(res.warnings)} cảnh báo"
    )


@app.command(name="plan-units")
def plan_units_cmd(
    stage: Annotated[str, typer.Argument(help="Lộ trình HSK: hsk1, hsk2 hoặc hsk3.")],
    content_dir: Annotated[Path, typer.Option(help="Thư mục nội dung.")] = (
        PIPELINE_DIR.parents[1] / "content"
    ),
    dry_run: Annotated[
        bool, typer.Option("--dry-run", help="Chỉ in cỡ đầu vào, không gọi Claude.")
    ] = False,
    max_repairs: Annotated[int, typer.Option(help="Số lần gửi lại để sửa lỗi phủ.")] = 2,
    force: Annotated[bool, typer.Option("--force", help="Ghi đè dù đã có file chủ đề.")] = False,
) -> None:
    """02-5: AI chia từ và ngữ pháp HSK thành chủ đề -> content/<lộ trình>/_plan.yaml (gọi Claude Code CLI)."""
    import datetime

    from clp.authoring.config import load_config
    from clp.authoring.llm import ClaudeCliJson
    from clp.authoring.plan_units import (
        PlanError,
        build_prompt,
        load_stage_inputs,
        plan_stage,
        write_plan,
    )
    from clp.content.check import load_content
    from clp.db import connect

    stages = load_content(content_dir).stages or []
    entry = next((s for s in stages if s.id == stage and s.level is not None), None)
    if entry is None or entry.level is None:
        typer.echo(f"Lộ trình {stage!r} không có cấp HSK trong content/stages.yaml", err=True)
        raise typer.Exit(2)
    with connect() as conn:
        inputs = load_stage_inputs(conn, stage, entry.level)
        conn.rollback()
    system, user = build_prompt(inputs)
    typer.echo(
        f"{stage}: {len(inputs.words)} từ, {len(inputs.grammar)} điểm ngữ pháp, "
        f"prompt {len(system) + len(user)} ký tự"
    )
    if dry_run:
        return
    cfg = load_config()
    llm = ClaudeCliJson(cfg.claude_bin)
    try:
        result = plan_stage(
            llm, inputs, author_model=cfg.author_model, effort=cfg.effort, max_repairs=max_repairs
        )
        plan_path, _ = write_plan(
            content_dir,
            result,
            inputs,
            model=cfg.author_model,
            now=datetime.datetime.now().isoformat(timespec="seconds"),
            force=force,
        )
    except PlanError as e:
        typer.echo(str(e), err=True)
        raise typer.Exit(1) from e
    for w in result.warnings:
        typer.echo(f"Cảnh báo: {w}")
    typer.echo(f"Đã ghi {plan_path}: {len(result.units)} chủ đề sau {result.attempts} lượt gọi")


@app.command(name="author-unit")
def author_unit_cmd(
    stage: Annotated[str, typer.Argument(help="Lộ trình HSK: hsk1, hsk2 hoặc hsk3.")],
    unit_id: Annotated[str, typer.Argument(help="id chủ đề trong _plan.yaml, ví dụ hsk1-u01.")],
    content_dir: Annotated[Path, typer.Option(help="Thư mục nội dung.")] = (
        PIPELINE_DIR.parents[1] / "content"
    ),
    dry_run: Annotated[
        bool, typer.Option("--dry-run", help="Chỉ in đầu vào, không gọi Claude.")
    ] = False,
    max_rounds: Annotated[int, typer.Option(help="Số lần sửa tối đa sau lượt soạn đầu.")] = 2,
    strict: Annotated[
        bool, typer.Option("--strict", help="Không ghi nếu còn lỗi rà soát chưa giải quyết.")
    ] = False,
    force: Annotated[bool, typer.Option("--force", help="Soạn lại dù đã có file chủ đề.")] = False,
) -> None:
    """02-6: AI soạn một chủ đề, model khác rà soát, máy kiểm tra (gọi Claude Code CLI)."""
    import datetime

    import yaml

    from clp.authoring.author_unit import (
        AuthoringError,
        author_unit_loop,
        build_author_prompt,
        load_unit_inputs,
    )
    from clp.authoring.config import load_config
    from clp.authoring.llm import ClaudeCliJson
    from clp.content.check import load_content
    from clp.db import connect

    loaded = load_content(content_dir)
    entry = next((s for s in loaded.stages or [] if s.id == stage and s.level is not None), None)
    plan = next((p for st, _f, p in loaded.plan_units if st == stage and p.id == unit_id), None)
    if entry is None or plan is None:
        typer.echo(f"Không thấy {stage}/{unit_id} trong stages.yaml hoặc _plan.yaml", err=True)
        raise typer.Exit(2)
    cfg = load_config()
    with connect() as conn:
        if dry_run:
            ov_path = content_dir / "overrides" / "han_viet.yaml"
            overrides = (
                yaml.safe_load(ov_path.read_text(encoding="utf-8")) if ov_path.exists() else None
            ) or {}
            inputs = load_unit_inputs(conn, loaded, entry, plan, overrides)
            system, user = build_author_prompt(inputs)
            typer.echo(
                f"{unit_id}: {len(inputs.words)} từ, {len(inputs.learned_words)} từ đã học, "
                f"{len(inputs.sentences)} câu Tatoeba ứng viên, {len(inputs.grammar)} điểm ngữ pháp, "
                f"{len(inputs.missing_han_viet)} chữ thiếu Hán Việt; prompt {len(system) + len(user)} ký tự"
            )
            return
        client = ClaudeCliJson(cfg.claude_bin)
        try:
            res = author_unit_loop(
                conn, content_dir, loaded, entry, plan,
                author_llm=client, review_llm=client, cfg=cfg,
                now=datetime.datetime.now().isoformat(timespec="seconds"),
                max_rounds=max_rounds, strict=strict, force=force,
            )  # fmt: skip
        except AuthoringError as e:
            typer.echo(str(e), err=True)
            raise typer.Exit(1) from e
    for w in res.warnings:
        typer.echo(f"Cảnh báo: {w}")
    for i in res.review_unresolved:
        typer.echo(f"Rà soát chưa giải quyết [{i.category}] {i.where}: {i.problem}")
    typer.echo(f"Đã ghi {res.unit_path} sau {res.rounds} lượt soạn")


if __name__ == "__main__":
    app()
