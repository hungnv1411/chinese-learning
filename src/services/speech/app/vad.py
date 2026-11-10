"""Phát hiện tiếng nói theo năng lượng: cắt lặng hai đầu, kiểm tra độ dài và SNR.

Đây là VAD đơn giản, không phải Silero (xem 08-speaking/decisions.md): đủ để chọn đoạn có
tiếng và loại file im lặng / nhiễu; phân đoạn âm tiết dùng Parselmouth ở các bước sau.
"""

import math
from dataclasses import dataclass, field

from .config import Config

SAMPLE_RATE = 16000
FRAME = SAMPLE_RATE // 50  # 20 ms
ABS_FLOOR_DB = -45.0  # dưới mức này coi là im lặng, bất kể tương đối
PAD_S = 0.05
EPS = 1e-10


@dataclass
class VadResult:
    status: str  # ok | no_speech | too_noisy | too_short | too_long
    samples: list[float] = field(default_factory=list)
    start: float = 0.0
    end: float = 0.0
    snr_db: float | None = None


def _frame_db(samples: list[float]) -> list[float]:
    out = []
    for i in range(0, len(samples) - FRAME + 1, FRAME):
        frame = samples[i : i + FRAME]
        rms = math.sqrt(sum(s * s for s in frame) / FRAME)
        out.append(20 * math.log10(rms + EPS))
    return out


def _percentile(sorted_vals: list[float], q: float) -> float:
    return sorted_vals[min(len(sorted_vals) - 1, int(q * len(sorted_vals)))]


def analyze(samples: list[float], config: Config) -> VadResult:
    duration = len(samples) / SAMPLE_RATE
    if duration < config.min_duration_s:
        return VadResult("too_short")
    if duration > config.max_duration_s:
        return VadResult("too_long")

    db = _frame_db(samples)
    if not db or max(db) < ABS_FLOOR_DB:
        return VadResult("no_speech")

    ordered = sorted(db)
    floor, level = _percentile(ordered, 0.1), _percentile(ordered, 0.9)
    snr = level - floor
    if snr < config.min_snr_db:
        return VadResult("too_noisy", snr_db=snr)

    threshold = max(ABS_FLOOR_DB, floor + snr / 2)
    voiced = [i for i, v in enumerate(db) if v > threshold]
    if not voiced:
        return VadResult("no_speech", snr_db=snr)
    start = max(0.0, voiced[0] * FRAME / SAMPLE_RATE - PAD_S)
    end = min(duration, (voiced[-1] + 1) * FRAME / SAMPLE_RATE + PAD_S)
    trimmed = samples[int(start * SAMPLE_RATE) : int(end * SAMPLE_RATE)]
    return VadResult("ok", trimmed, start, end, snr)
