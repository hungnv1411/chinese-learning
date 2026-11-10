import math
import random

from app.config import load_config
from app.vad import analyze

SR = 16000
cfg = load_config()


def tone(seconds, freq=200.0, amp=0.5):
    return [amp * math.sin(2 * math.pi * freq * i / SR) for i in range(int(seconds * SR))]


def noise(seconds, amp, seed=1):
    rng = random.Random(seed)
    return [rng.uniform(-amp, amp) for _ in range(int(seconds * SR))]


def test_too_short():
    r = analyze(tone(0.2), cfg)
    assert r.status == "too_short"


def test_too_long():
    r = analyze(tone(15.5), cfg)
    assert r.status == "too_long"


def test_silence_is_no_speech():
    assert analyze([0.0] * SR, cfg).status == "no_speech"


def test_very_quiet_hiss_is_no_speech():
    assert analyze(noise(1.0, 0.0005), cfg).status == "no_speech"


def test_white_noise_is_too_noisy():
    r = analyze(noise(1.5, 0.4), cfg)
    assert r.status in ("too_noisy", "no_speech")
    assert r.status == "too_noisy"


def test_clean_speechlike_signal_is_ok_and_trimmed():
    sig = [0.0] * SR + tone(1.0) + [0.0] * SR
    r = analyze(sig, cfg)
    assert r.status == "ok"
    assert 0.9 < r.start < 1.15
    assert 1.9 < r.end < 2.2
    assert 0.9 < len(r.samples) / SR < 1.4


def test_tone_in_mild_noise_is_ok():
    sig = (
        noise(0.5, 0.01)
        + [a + b for a, b in zip(tone(1.0), noise(1.0, 0.01, 2))]
        + noise(0.5, 0.01, 3)
    )
    assert analyze(sig, cfg).status == "ok"
