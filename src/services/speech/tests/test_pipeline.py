"""Chạy cả pipeline với tín hiệu tổng hợp và bộ nhận dạng giả (không cần model Whisper)."""

import io
import wave

import numpy as np
import pytest

from app.config import load_config
from app.pipeline import score_audio
from tests.synth import SR, silence, tone_syllable

cfg = load_config()


def to_wav(sig: np.ndarray) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(sig, -1, 1) * 32767).astype("<i2").tobytes())
    return buf.getvalue()


def utterance(tones, gap=0.1, base=150.0, lead=0.3):
    """Trả (wav, mốc từng âm tiết) — mốc tính từ đầu file."""
    parts, marks, t = [silence(lead)], [], lead
    for tone in tones:
        syl = tone_syllable(tone, base)
        marks.append((t, t + len(syl) / SR))
        parts += [syl, silence(gap)]
        t += len(syl) / SR + gap
    return to_wav(np.concatenate(parts + [silence(0.2)])), marks


def fake_recognizer(text, marks, vad_offset):
    """Trả mốc từng chữ, trừ độ lệch do VAD cắt lặng đầu."""
    chars = [c for c in text if "一" <= c <= "鿿"]
    words = [(c, a - vad_offset, b - vad_offset) for c, (a, b) in zip(chars, marks, strict=True)]
    return lambda sig: (text, words)


def run(tones, pinyin, hanzi, text, mode="sentence", **kw):
    wav, marks = utterance(tones, **kw)
    # VAD cắt tới ~0.05 s trước tiếng đầu tiên
    rec = fake_recognizer(text, marks, vad_offset=marks[0][0] - 0.05) if text else None
    return score_audio(wav, hanzi, pinyin, mode, cfg, rec)


def test_correct_sentence_scores_100_with_sandhi():
    # 你好: viết 3+3, đọc 2+3 → audio 2,3
    r = run([2, 3], "ni3 hao3", "你好", "你好")
    assert r["status"] == "ok"
    assert [s["expected_tone_spoken"] for s in r["syllables"]] == [2, 3]
    assert [s["tone_ok"] for s in r["syllables"]] == [True, True]
    assert r["score"] == 100


def test_written_tone3_pair_read_as_two_three_not_three_three():
    r = run([3, 3], "ni3 hao3", "你好", "你好")  # đọc 3,3 là sai thanh ở âm đầu
    assert r["syllables"][0]["tone_ok"] is False
    assert r["score"] < 100


def test_wrong_tone_one_of_four_gives_88():
    r = run([1, 2, 3, 1], "ma1 ma2 ma3 ma4", "妈麻马骂", "妈麻马骂")
    assert [s["tone_ok"] for s in r["syllables"]] == [True, True, True, False]
    assert r["score"] == 88


def test_wrong_content_scores_lower_and_flags_syllable():
    r = run([1, 2, 3, 4], "ma1 ma2 ma3 ma4", "妈麻马骂", "妈爸马骂")
    assert [s["content_ok"] for s in r["syllables"]] == [True, False, True, True]
    assert r["score"] == 75


def test_homophone_characters_still_correct():
    r = run([1, 4], "ma1 ma4", "妈骂", "吗骂")  # 吗 đọc ma (nhẹ) → ma, đồng âm
    assert [s["content_ok"] for s in r["syllables"]] == [True, True]


def test_missing_syllable_has_no_timing_and_wrong_content():
    wav, marks = utterance([1, 2, 3])
    rec = fake_recognizer("爸你", [marks[0], marks[2]], marks[0][0] - 0.05)
    r = score_audio(wav, "爸麻你", "ba1 ma2 ni3", "sentence", cfg, rec)
    s = r["syllables"]
    assert [x["content_ok"] for x in s] == [True, False, True]
    assert s[1]["start"] is None and s[1]["tone_detected"] is None
    assert [x["tone_ok"] for x in s] == [True, None, True]


def test_neutral_tone_not_graded():
    r = run([4, 1], "ba4 ba5", "爸吧", "爸吧")
    assert r["syllables"][1]["expected_tone_spoken"] == 5
    assert r["syllables"][1]["tone_ok"] is None
    assert r["score"] == 100


def test_syllable_mode_scores_tone_only():
    wav, _ = utterance([4])
    ok = score_audio(wav, "", "ma4", "syllable", cfg, None)
    assert ok["status"] == "ok" and ok["score"] == 100
    assert ok["syllables"][0]["heard_syllable"] == "ma"
    bad = score_audio(wav, "", "ma2", "syllable", cfg, None)
    assert bad["score"] == 0 and bad["syllables"][0]["tone_ok"] is False


def test_different_voice_pitch_same_result():
    for base in (120.0, 250.0):
        r = run([2, 3], "ni3 hao3", "你好", "你好", base=base)
        assert r["score"] == 100, base


def test_whisper_timings_unusable_falls_back_to_voiced_segments():
    wav, _ = utterance([1, 2, 3, 4])
    rec = lambda sig: ("妈麻马骂", [])
    r = score_audio(wav, "妈麻马骂", "ma1 ma2 ma3 ma4", "sentence", cfg, rec)
    assert r["score"] == 100


def test_unvoiced_noise_reports_vad_status_without_calling_recognizer():
    rng = np.random.default_rng(0)
    r = score_audio(to_wav(rng.uniform(-0.4, 0.4, SR)), "你", "ni3", "word", cfg, None)
    assert r["status"] == "too_noisy" and r["score"] is None


def test_missing_recognizer_for_word_mode_raises():
    wav, _ = utterance([1])
    with pytest.raises(RuntimeError):
        score_audio(wav, "妈", "ma1", "word", cfg, None)
