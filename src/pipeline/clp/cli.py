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


if __name__ == "__main__":
    app()
