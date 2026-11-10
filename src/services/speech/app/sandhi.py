"""Biến điệu: bản Python của `applyToneSandhi` (packages/core/src/sandhi.ts).

Hai bản đọc cùng fixture `packages/core/fixtures/tone-sandhi.json`. Sửa thuật toán ở một
bên thì phải sửa bên kia.
"""

import re

_TONE = re.compile(r"([1-5])$")


def _written_tone(pinyin: str) -> int:
    m = _TONE.search(pinyin.strip())
    return int(m.group(1)) if m else 5


def apply_tone_sandhi(
    syllables: list[tuple[str, str | None]],
    word_lengths: list[int] | None = None,
    ordinal_indexes: list[int] | None = None,
) -> list[int]:
    """Thanh đọc thật của từng âm tiết.

    `syllables` là danh sách `(pinyin_số_thanh, hanzi hoặc None)`. Thanh 3 liên tiếp trong từ
    (trái → phải theo thanh viết), thanh 3 cuối từ trước từ sau vẫn đọc thanh 3 (xử lý phải →
    trái), 不 và 一.
    """
    n = len(syllables)
    written = [_written_tone(p) for p, _ in syllables]
    out = list(written)
    lengths = word_lengths if word_lengths is not None else [n]
    ordinals = set(ordinal_indexes or [])

    starts: list[int] = []
    pos = 0
    for length in lengths:
        starts.append(pos)
        pos += length

    for w in range(len(lengths) - 1, -1, -1):
        start = starts[w]
        end = start + lengths[w]
        for i in range(start, end - 1):
            if written[i] == 3 and written[i + 1] == 3:
                out[i] = 2
        prev_last = start - 1
        if w > 0 and written[prev_last] == 3 and out[start] == 3:
            out[prev_last] = 2

    for i, (_, hanzi) in enumerate(syllables):
        nxt = written[i + 1] if i + 1 < n else None
        if hanzi == "不" and nxt == 4:
            out[i] = 2
        if hanzi == "一":
            if i in ordinals or nxt is None:
                out[i] = 1
            elif nxt == 4:
                out[i] = 2
            elif nxt == 5:
                out[i] = 1
            else:
                out[i] = 4
    return out
