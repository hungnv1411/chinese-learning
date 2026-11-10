import numpy as np
import pytest

from app.config import load_config
from app.pitch import analyze_pitch, voiced_intervals
from app.tone import classify_tone
from tests.synth import SR, silence, tone_syllable

cfg = load_config()
NAN = np.nan


def frames(st):
    return np.array(st, dtype=float)


# ---- phân loại trên đường cong semitone cho sẵn -------------------------------------------
def test_flat_is_tone1():
    r = classify_tone(frames([0.5] * 20), cfg, "sentence")
    assert r.tone == 1 and r.confidence >= 0.5
    assert len(r.contour) == 5


def test_rising_is_tone2():
    assert classify_tone(frames(np.linspace(-2, 2.5, 20)), cfg, "sentence").tone == 2


def test_dip_is_tone3():
    st = np.interp(np.linspace(0, 1, 20), [0, 0.5, 1], [-1, -4, 0])
    assert classify_tone(frames(st), cfg, "sentence").tone == 3


def test_low_flat_half_third_is_tone3():
    assert classify_tone(frames([-3.0] * 20), cfg, "sentence").tone == 3


def test_falling_5st_is_tone4():
    assert classify_tone(frames(np.linspace(3, -2, 20)), cfg, "sentence").tone == 4


def test_too_few_voiced_frames_is_none():
    st = [NAN] * 10 + [0.0] * 3 + [NAN] * 10
    assert classify_tone(frames(st), cfg, "sentence") is None


def test_unmatched_shape_gets_low_confidence_nearest_template():
    # rơi ~2,7 st sau khi cắt 80% giữa: không đủ thanh 4 (3 st), quá dốc cho thanh 1 (2 st), không thấp cho thanh 3
    r = classify_tone(frames(np.linspace(3.4, 0.0, 20)), cfg, "sentence")
    assert r.tone == 4  # mẫu gần nhất
    assert r.confidence < 0.5


def test_syllable_mode_flat_high_or_low_is_tone1():
    assert classify_tone(frames([-3.0] * 20), cfg, "syllable").tone == 1


def test_gaps_in_voicing_are_bridged():
    st = list(np.linspace(3, -2, 20))
    st[8:10] = [NAN, NAN]
    assert classify_tone(frames(st), cfg, "sentence").tone == 4


# ---- dò cao độ + đoán thanh trên tín hiệu tổng hợp ----------------------------------------
def classify_signal(sig, mode="sentence"):
    track = analyze_pitch(sig)
    dur = len(sig) / SR
    return classify_tone(track.slice(0.0, dur), cfg, mode)


@pytest.mark.parametrize("tone", [1, 2, 3, 4])
@pytest.mark.parametrize("base", [120.0, 250.0])
def test_synthetic_tones_detected_regardless_of_voice_pitch(tone, base):
    sig = np.concatenate([silence(0.05), tone_syllable(tone, base), silence(0.05)])
    r = classify_signal(sig)
    assert r is not None and r.tone == tone


def test_median_hz_reflects_voice():
    low = analyze_pitch(tone_syllable(1, 120.0))
    high = analyze_pitch(tone_syllable(1, 250.0))
    assert 105 < low.median_hz < 135
    assert 220 < high.median_hz < 280


def test_silence_has_no_voiced_frames():
    track = analyze_pitch(silence(0.5))
    assert voiced_intervals(track) == []


def test_voiced_intervals_found_for_two_syllables_with_gap():
    sig = np.concatenate([tone_syllable(1), silence(0.2), tone_syllable(1)])
    ivs = voiced_intervals(analyze_pitch(sig))
    assert len(ivs) == 2
    assert ivs[0][1] < ivs[1][0]


def test_sentence_level_median_makes_tone1_after_low_voice_work():
    # hai âm tiết thanh 1 cùng một giọng → cả hai là thanh 1
    sig = np.concatenate([tone_syllable(1, 150), silence(0.15), tone_syllable(1, 150)])
    track = analyze_pitch(sig)
    for s, e in [(0.0, 0.25), (0.40, 0.65)]:
        assert classify_tone(track.slice(s, e), cfg, "sentence").tone == 1
