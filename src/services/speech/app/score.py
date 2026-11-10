"""Tính điểm (speech-service §4). Ngưỡng đạt do web quyết định, không nằm ở đây."""

from dataclasses import dataclass


@dataclass
class SyllableResult:
    content_ok: bool
    tone_ok: bool | None  # None = không chấm thanh (thanh nhẹ, thiếu khung có giọng)


def syllable_score(s: SyllableResult) -> int:
    content = 1 if s.content_ok else 0
    if s.tone_ok is None:
        return 100 * content
    tone = 1 if (s.tone_ok and s.content_ok) else 0
    return 50 * content + 50 * tone


def _round(x: float) -> int:
    return int(x + 0.5)


def score_sentence(syllables: list[SyllableResult], mode: str) -> int:
    if not syllables:
        return 0
    if mode == "syllable":
        return 100 if syllables[0].tone_ok is not False else 0
    return _round(sum(syllable_score(s) for s in syllables) / len(syllables))
