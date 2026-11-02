"""`uv run clp <lệnh>`. Các lệnh được thêm dần theo từng bước của plan 01."""

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


if __name__ == "__main__":
    app()
