"""Gióng hàng pinyin không thanh (Levenshtein theo âm tiết) và nới lỏng cặp hay nghe nhầm."""

from dataclasses import dataclass

_INITIALS = [
    "zh",
    "ch",
    "sh",
    "b",
    "p",
    "m",
    "f",
    "d",
    "t",
    "n",
    "l",
    "g",
    "k",
    "h",
    "j",
    "q",
    "x",
    "r",
    "z",
    "c",
    "s",
    "y",
    "w",
]  # 2 chữ cái xếp trước để khớp dài nhất


def split_syllable(s: str) -> tuple[str, str]:
    for ini in _INITIALS:
        if s.startswith(ini) and len(s) > len(ini):
            return ini, s[len(ini) :]
    return "", s


def is_near_miss(expected: str, heard: str, pairs: list[list[str]]) -> bool:
    """Khác nhau đúng một cặp thanh mẫu hoặc vận mẫu trong danh sách cấu hình."""
    if expected == heard:
        return False
    ei, ef = split_syllable(expected)
    hi, hf = split_syllable(heard)
    for a, b in pairs:
        pair = {a, b}
        if ef == hf and {ei, hi} == pair:
            return True
        if ei == hi and {ef, hf} == pair:
            return True
    return False


@dataclass
class AlignedSyllable:
    expected: str
    heard: str | None
    heard_index: int | None
    content_ok: bool
    near_miss: bool = False


def align(expected: list[str], heard: list[str], pairs: list[list[str]]) -> list[AlignedSyllable]:
    n, m = len(expected), len(heard)

    def sub(i: int, j: int) -> float:
        if expected[i] == heard[j]:
            return 0.0
        return 0.3 if is_near_miss(expected[i], heard[j], pairs) else 1.0

    cost = [[0.0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        cost[i][0] = float(i)
    for j in range(1, m + 1):
        cost[0][j] = float(j)
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost[i][j] = min(
                cost[i - 1][j - 1] + sub(i - 1, j - 1),
                cost[i - 1][j] + 1.0,
                cost[i][j - 1] + 1.0,
            )

    out: list[AlignedSyllable | None] = [None] * n
    i, j = n, m
    while i > 0:
        if j > 0 and cost[i][j] == cost[i - 1][j - 1] + sub(i - 1, j - 1):
            e, h = expected[i - 1], heard[j - 1]
            if e == h:
                out[i - 1] = AlignedSyllable(e, h, j - 1, True)
            elif is_near_miss(e, h, pairs):
                out[i - 1] = AlignedSyllable(e, h, j - 1, True, True)
            else:
                out[i - 1] = AlignedSyllable(e, h, j - 1, False)
            i, j = i - 1, j - 1
        elif cost[i][j] == cost[i - 1][j] + 1.0:
            out[i - 1] = AlignedSyllable(expected[i - 1], None, None, False)
            i -= 1
        else:
            j -= 1
    return [a for a in out if a is not None]
