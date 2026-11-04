"""Đọc file nội dung YAML và báo lỗi theo `file:dòng` (ruamel.yaml giữ số dòng)."""

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pydantic import TypeAdapter, ValidationError
from ruamel.yaml import YAML
from ruamel.yaml.error import YAMLError

from clp.content.authoring import GrammarPointFile, UnitFile

MESSAGES = {
    "missing": "thiếu trường bắt buộc",
    "extra_forbidden": "trường không có trong định dạng (gõ nhầm tên?)",
    "string_too_short": "không được để trống",
}


@dataclass(frozen=True)
class Issue:
    file: Path
    line: int
    path: str
    message: str

    def __str__(self) -> str:
        where = f"{self.path}: " if self.path else ""
        return f"{self.file}:{self.line}: {where}{self.message}"


class ContentError(Exception):
    def __init__(self, issues: list[Issue]):
        self.issues = issues
        super().__init__("\n".join(str(i) for i in issues))


def _line_of(root: Any, loc: tuple[Any, ...]) -> int:
    """Số dòng (từ 1) của phần tử sâu nhất tìm được theo `loc`. Phần tử không có trong YAML
    (ví dụ nhãn `kind` thêm vào bước) bị bỏ qua; khóa vắng mặt thì dùng dòng của mục chứa nó."""
    node, line = root, 0
    for part in loc:
        lc = getattr(node, "lc", None)
        if lc is None:
            break
        if isinstance(part, int) and hasattr(node, "__len__") and not hasattr(node, "keys"):
            if part < len(node):
                line = lc.data[part][0]
                node = node[part]
        elif isinstance(part, str) and hasattr(node, "keys") and part in node:
            line = lc.data[part][0]
            node = node[part]
        # còn lại: bỏ qua
    if line == 0 and getattr(root, "lc", None) is not None:
        return root.lc.line + 1
    return line + 1


def _message(err: dict[str, Any]) -> str:
    kind = err["type"]
    if kind in MESSAGES:
        return MESSAGES[kind]
    msg = err["msg"]
    return msg.removeprefix("Value error, ")


def _loc_str(loc: tuple[Any, ...]) -> str:
    return ".".join(str(p) for p in loc if p != "kind")


def _read(path: Path) -> Any:
    yaml = YAML(typ="rt")  # round-trip: giữ số dòng; khóa trùng là lỗi
    try:
        return yaml.load(path.read_text(encoding="utf-8"))
    except YAMLError as e:
        mark = getattr(e, "problem_mark", None) or getattr(e, "context_mark", None)
        line = (mark.line + 1) if mark else 1
        text = str(getattr(e, "problem", None) or e).splitlines()[0]
        raise ContentError([Issue(path, line, "", _yaml_message(e, text))]) from e


def _yaml_message(e: YAMLError, fallback: str) -> str:
    # ruamel ghi khóa trùng trong `problem`, ví dụ: found duplicate key "id" with value "b"
    return f"YAML không hợp lệ: {fallback}"


def _validate[T](path: Path, adapter: TypeAdapter[T], data: Any, root_kind: str) -> T:
    if root_kind == "mapping" and not hasattr(data, "keys"):
        raise ContentError([Issue(path, 1, "", "file phải là một mục dạng khóa: giá trị")])
    if root_kind == "list" and (
        isinstance(data, str) or not hasattr(data, "__len__") or hasattr(data, "keys")
    ):
        raise ContentError([Issue(path, 1, "", "file phải là một danh sách")])
    try:
        return adapter.validate_python(data)
    except ValidationError as e:
        issues = [
            Issue(
                path, _line_of(data, tuple(err["loc"])), _loc_str(tuple(err["loc"])), _message(err)
            )
            for err in e.errors()
        ]
        issues.sort(key=lambda i: (i.line, i.path))
        raise ContentError(issues) from e


@dataclass(frozen=True)
class LoadedUnit:
    """File chủ đề đã kiểm tra hình dạng, kèm cây YAML để tra số dòng cho các quy tắc nội dung."""

    path: Path
    unit: UnitFile
    root: Any

    def line(self, *loc: Any) -> int:
        return _line_of(self.root, loc)


@dataclass(frozen=True)
class LoadedGrammar:
    path: Path
    points: list[GrammarPointFile]
    root: Any

    def line(self, *loc: Any) -> int:
        return _line_of(self.root, loc)


def load_unit(path: Path) -> LoadedUnit:
    root = _read(path)
    return LoadedUnit(path, _validate(path, TypeAdapter(UnitFile), root, "mapping"), root)


def load_grammar(path: Path) -> LoadedGrammar:
    root = _read(path)
    points = _validate(path, TypeAdapter(list[GrammarPointFile]), root, "list")
    return LoadedGrammar(path, points, root)


def load_unit_file(path: Path) -> UnitFile:
    return load_unit(path).unit


def load_grammar_file(path: Path) -> list[GrammarPointFile]:
    return load_grammar(path).points


LineOf = Callable[..., int]


__all__ = [
    "ContentError",
    "Issue",
    "LoadedGrammar",
    "LoadedUnit",
    "load_grammar",
    "load_grammar_file",
    "load_unit",
    "load_unit_file",
]
