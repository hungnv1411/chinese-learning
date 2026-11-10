"""Dò cao độ bằng Parselmouth, 2 lượt, đổi sang semitone so với trung vị cả câu."""

from dataclasses import dataclass

import numpy as np
import parselmouth

SAMPLE_RATE = 16000
TIME_STEP = 0.01
FIRST_PASS = (75.0, 600.0)
SECOND_PASS = (0.6, 1.8)  # nhân với trung vị lượt 1


@dataclass
class PitchTrack:
    times: np.ndarray  # giây, tính từ đầu mẫu
    hz: np.ndarray  # 0 = không có giọng
    median_hz: float
    semitones: np.ndarray  # nan = không có giọng

    def slice(self, start: float, end: float) -> np.ndarray:
        mask = (self.times >= start) & (self.times <= end)
        return self.semitones[mask]


def _pitch(sound: parselmouth.Sound, floor: float, ceiling: float):
    p = sound.to_pitch(time_step=TIME_STEP, pitch_floor=floor, pitch_ceiling=ceiling)
    return np.asarray(p.xs()), np.asarray(p.selected_array["frequency"], dtype=float)


def analyze_pitch(samples, sr: int = SAMPLE_RATE) -> PitchTrack:
    sound = parselmouth.Sound(np.asarray(samples, dtype=np.float64), sampling_frequency=sr)
    times, hz = _pitch(sound, *FIRST_PASS)
    voiced = hz[hz > 0]
    if voiced.size == 0:
        return PitchTrack(times, hz, 0.0, np.full_like(hz, np.nan))
    median = float(np.median(voiced))
    times, hz = _pitch(sound, SECOND_PASS[0] * median, SECOND_PASS[1] * median)
    voiced = hz[hz > 0]
    if voiced.size == 0:
        return PitchTrack(times, hz, 0.0, np.full_like(hz, np.nan))
    median = float(np.median(voiced))
    st = np.full_like(hz, np.nan)
    st[hz > 0] = 12 * np.log2(hz[hz > 0] / median)
    return PitchTrack(times, hz, median, st)


def voiced_intervals(
    track: PitchTrack, min_len: float = 0.06, max_gap: float = 0.05
) -> list[tuple[float, float]]:
    """Các đoạn có giọng liên tiếp (nối khoảng hở ngắn, bỏ đoạn quá ngắn)."""
    out: list[list[float]] = []
    for t, v in zip(track.times, track.hz, strict=True):
        if v <= 0:
            continue
        if out and t - out[-1][1] <= max_gap + TIME_STEP:
            out[-1][1] = float(t)
        else:
            out.append([float(t), float(t)])
    return [(a, b) for a, b in out if b - a >= min_len]
