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


if __name__ == "__main__":
    app()
