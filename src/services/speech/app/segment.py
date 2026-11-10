"""Chia thời gian theo âm tiết."""

Segment = tuple[float, float]


def split_evenly(start: float, end: float, n: int) -> list[Segment]:
    if n <= 0:
        return []
    step = (end - start) / n
    return [(start + i * step, start + (i + 1) * step) for i in range(n)]


def _is_han(ch: str) -> bool:
    return "一" <= ch <= "鿿" or "㐀" <= ch <= "䶿"


def char_segments(words: list[tuple[str, float, float]]) -> list[Segment]:
    """Mốc từ của Whisper → mốc từng chữ Hán; token nhiều chữ chia đều theo số chữ."""
    out: list[Segment] = []
    for text, start, end in words:
        n = sum(1 for ch in text if _is_han(ch))
        out.extend(split_evenly(start, end, n))
    return out


def split_by_voiced(
    voiced: list[Segment], n: int, speech_start: float, speech_end: float
) -> list[Segment]:
    """Dùng các đoạn có giọng nếu số đoạn bằng số âm tiết, không thì chia đều khoảng có tiếng."""
    if len(voiced) == n:
        return list(voiced)
    return split_evenly(speech_start, speech_end, n)
