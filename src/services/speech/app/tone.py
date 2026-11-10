"""Đoán thanh từ đường cong cao độ (semitone so với trung vị cả câu)."""

from dataclasses import dataclass

import numpy as np

from .config import Config

# Mẫu chuẩn 5 mức (55 / 35 / 214 / 51), 1 mức ≈ 1 semitone, tâm ở mức 3.
_TEMPLATES = {
    1: np.array([5, 5, 5, 5, 5], dtype=float) - 3,
    2: np.array([3, 3.5, 4, 4.5, 5], dtype=float) - 3,
    3: np.array([2, 1, 1, 2.5, 4], dtype=float) - 3,
    4: np.array([5, 4, 3, 2, 1], dtype=float) - 3,
}
MARGIN_SCALE = 1.0  # vượt ngưỡng bao nhiêu thì tự tin hoàn toàn (tỉ lệ so với ngưỡng)
FALLBACK_CONFIDENCE = 0.3


@dataclass
class ToneResult:
    tone: int
    confidence: float
    contour: list[float]


def _confidence(margin: float, threshold: float) -> float:
    ratio = margin / max(abs(threshold), 0.5)
    return float(min(1.0, 0.5 + 0.5 * min(1.0, max(0.0, ratio / MARGIN_SCALE))))


def _contour(st: np.ndarray) -> np.ndarray | None:
    """80% giữa → bắc cầu khoảng hở → làm mượt → 5 điểm."""
    n = len(st)
    lo, hi = round(n * 0.1), round(n * 0.9)
    mid = st[lo:hi]
    idx = np.where(~np.isnan(mid))[0]
    if idx.size == 0:
        return None
    mid = mid[idx[0] : idx[-1] + 1].copy()
    nans = np.isnan(mid)
    if nans.any():
        x = np.arange(len(mid))
        mid[nans] = np.interp(x[nans], x[~nans], mid[~nans])
    if len(mid) >= 3:
        padded = np.pad(mid, 1, mode="edge")
        mid = np.convolve(padded, np.ones(3) / 3, mode="valid")
    return np.interp(np.linspace(0, len(mid) - 1, 5), np.arange(len(mid)), mid)


def classify_tone(frames: np.ndarray, config: Config, mode: str) -> ToneResult | None:
    """`frames`: semitone từng khung 10 ms của một âm tiết (nan = không có giọng).

    Trả None nếu không đủ khung có giọng (không chấm thanh).
    """
    t = config.tone
    if int(np.sum(~np.isnan(frames))) < t.min_voiced_frames:
        return None
    c = _contour(frames)
    if c is None:
        return None
    drop = float(c[0] - c[-1])
    rise = -drop
    mean = float(np.mean(c))
    dip = float(min(c[0], c[-1]) - np.min(c[1:4]))

    if mode == "syllable":
        # Không có trung vị cả câu: thanh 1 xét theo độ phẳng, bỏ điều kiện độ cao.
        mean_ok_flat = True
        mean_for_t3 = None
    else:
        mean_ok_flat = mean >= t.t1_mean_min_st
        mean_for_t3 = mean

    rounded = [round(float(x), 2) for x in c]
    if drop >= t.t4_drop_st:
        return ToneResult(4, _confidence(drop - t.t4_drop_st, t.t4_drop_st), rounded)
    if rise >= t.t2_rise_st and int(np.argmin(c)) <= 2:
        return ToneResult(2, _confidence(rise - t.t2_rise_st, t.t2_rise_st), rounded)
    if mean_for_t3 is not None and mean_for_t3 <= t.t3_mean_max_st:
        return ToneResult(3, _confidence(t.t3_mean_max_st - mean_for_t3, t.t3_mean_max_st), rounded)
    if dip >= t.t3_dip_st:
        return ToneResult(3, _confidence(dip - t.t3_dip_st, t.t3_dip_st), rounded)
    if abs(drop) < t.t1_flat_max_st and mean_ok_flat:
        return ToneResult(1, _confidence(t.t1_flat_max_st - abs(drop), t.t1_flat_max_st), rounded)

    # Không khớp luật nào: so dạng đường cong (bỏ độ cao trung bình) với 4 mẫu chuẩn.
    shape = c - mean
    best = min(
        _TEMPLATES,
        key=lambda k: float(np.sum((shape - (_TEMPLATES[k] - _TEMPLATES[k].mean())) ** 2)),
    )
    return ToneResult(best, FALLBACK_CONFIDENCE, rounded)
