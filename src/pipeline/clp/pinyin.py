"""Bản Python của packages/core/src/pinyin.ts. Hai bản đọc cùng packages/core/fixtures/pinyin.json."""

import re

_MARKS = {
    "a": "āáǎà",
    "e": "ēéěè",
    "i": "īíǐì",
    "o": "ōóǒò",
    "u": "ūúǔù",
    "ü": "ǖǘǚǜ",
}

_MARKED_TO_PLAIN: dict[str, str] = {}
for _plain, _marked in _MARKS.items():
    for _ch in _marked:
        _MARKED_TO_PLAIN[_ch] = _plain
        _MARKED_TO_PLAIN[_ch.upper()] = _plain.upper()


def _normalize_u(s: str) -> str:
    return s.replace("u:", "ü").replace("U:", "Ü").replace("v", "ü").replace("V", "Ü")


def parse_numbered(s: str) -> tuple[str, int]:
    """'hao3' -> ('hao', 3). Không có số thanh thì là thanh nhẹ (5). 'u:' và 'v' thành 'ü'."""
    m = re.fullmatch(r"(.*?)([1-5])?", s.strip(), re.DOTALL)
    base = _normalize_u(m.group(1) if m else "")
    tone = int(m.group(2)) if m and m.group(2) else 5
    return base, tone


def split_syllables(numbered: str) -> list[str]:
    """'hao3chi1' -> ['hao3', 'chi1']."""
    out: list[str] = []
    for chunk in numbered.split():
        out.extend(re.findall(r"[^1-5]*[1-5]|[^1-5]+", chunk))
    return out


def _mark_syllable(base: str, tone: int) -> str:
    if tone == 5:
        return base
    lower = base.lower()
    idx = -1
    for i, ch in enumerate(lower):
        if ch in "ae":
            idx = i
            break
    if idx < 0 and "ou" in lower:
        idx = lower.index("o")
    if idx < 0:
        for i in range(len(lower) - 1, -1, -1):
            if lower[i] in "iouü":
                idx = i
                break
    if idx < 0:
        return base
    ch = lower[idx]
    marked = _MARKS[ch][tone - 1]
    if base[idx] != ch:
        marked = marked.upper()
    return base[:idx] + marked + base[idx + 1 :]


def numbered_to_marked(s: str, join: bool = False) -> str:
    """'hao3 chi1' -> 'hǎo chī'; join=True -> 'hǎochī'."""
    parts = []
    for syl in split_syllables(s):
        base, tone = parse_numbered(syl)
        parts.append(_mark_syllable(base, tone))
    return ("" if join else " ").join(parts)


def to_plain(s: str) -> str:
    """Bỏ dấu, số thanh, khoảng trắng; ü -> u. 'hǎo chī' -> 'haochi'."""
    import unicodedata

    out = []
    for ch in _normalize_u(unicodedata.normalize("NFC", s)):
        if ch.isspace() or ch in "12345":
            continue
        p = _MARKED_TO_PLAIN.get(ch, ch)
        out.append("u" if p == "ü" else "U" if p == "Ü" else p)
    return "".join(out).lower()
