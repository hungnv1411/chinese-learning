"""Tạo tín hiệu tổng hợp có cao độ theo đường cong, không cần TTS."""

import numpy as np

SR = 16000


def voiced(f0_hz: np.ndarray, sr: int = SR) -> np.ndarray:
    """f0_hz: cao độ từng mẫu (Hz). Tổng 10 họa âm giảm dần, biên độ ~0.4."""
    phase = 2 * np.pi * np.cumsum(f0_hz) / sr
    sig = sum(np.sin(k * phase) / k for k in range(1, 11))
    sig = sig / np.max(np.abs(sig)) * 0.4
    return sig.astype(np.float32)


def syllable(
    base_hz: float, st_start: float, st_end: float, dur: float = 0.25, mid: float | None = None
):
    """Đường cong tuyến tính theo semitone từ st_start đến st_end (tùy chọn điểm giữa `mid`)."""
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    if mid is None:
        st = st_start + (st_end - st_start) * t
    else:
        st = np.interp(t, [0, 0.5, 1], [st_start, mid, st_end])
    return voiced(base_hz * 2 ** (st / 12))


def silence(dur: float) -> np.ndarray:
    return np.zeros(int(dur * SR), dtype=np.float32)


TONES = {  # (đầu, cuối, giữa) theo semitone so với giọng nền
    1: (1.0, 1.0, None),
    2: (-2.0, 2.5, None),
    3: (-1.0, 0.0, -4.0),
    4: (3.5, -3.5, None),
}


def tone_syllable(tone: int, base_hz: float = 150.0, dur: float = 0.25):
    a, b, m = TONES[tone]
    return syllable(base_hz, a, b, dur, m)
