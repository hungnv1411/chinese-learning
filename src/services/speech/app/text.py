"""Chuẩn hóa transcript: giản thể, bỏ dấu câu, pinyin không thanh."""

import re

from opencc import OpenCC
from pypinyin import Style, lazy_pinyin

_T2S = OpenCC("t2s")
_HAN = re.compile(r"[㐀-䶿一-鿿]")


def han_chars(text: str) -> list[str]:
    return _HAN.findall(text)


def plain_base(pinyin_numbered: str) -> str:
    """`shen2` → `shen`; ü / u: → v để so với pypinyin."""
    base = re.sub(r"[1-5]$", "", pinyin_numbered.strip().lower())
    return base.replace("ü", "v").replace("u:", "v")


def heard_pinyin(transcript: str) -> list[str]:
    chars = "".join(han_chars(_T2S.convert(transcript)))
    return [p.replace("ü", "v") for p in lazy_pinyin(chars, style=Style.NORMAL)] if chars else []
