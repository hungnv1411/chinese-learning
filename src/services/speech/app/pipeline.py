"""Ghép các bước: giải mã → VAD → nhận dạng → gióng hàng → cao độ → thanh → điểm."""

import time
from typing import Any

import numpy as np

from .align import align
from .asr import Recognizer
from .config import Config
from .decode import decode_audio
from .pitch import analyze_pitch, voiced_intervals
from .sandhi import apply_tone_sandhi
from .score import SyllableResult, score_sentence
from .segment import char_segments, split_by_voiced
from .text import han_chars, heard_pinyin, plain_base
from .tone import classify_tone
from .vad import SAMPLE_RATE, analyze


def _empty(status: str, t0: float) -> dict[str, Any]:
    return {
        "status": status,
        "score": None,
        "syllables": [],
        "transcript": "",
        "timing_ms": round((time.perf_counter() - t0) * 1000),
    }


def score_audio(
    data: bytes,
    expected_hanzi: str,
    expected_pinyin: str,
    mode: str,
    config: Config,
    recognize: Recognizer | None,
) -> dict[str, Any]:
    """Chạy đồng bộ (gọi trong thread). `decode_audio` ném `DecodeError` nếu file hỏng."""
    t0 = time.perf_counter()
    samples = decode_audio(data, config)
    vad = analyze(samples, config)
    if vad.status != "ok":
        return _empty(vad.status, t0)

    pinyin = expected_pinyin.split()
    n = len(pinyin)
    sig = np.asarray(vad.samples, dtype=np.float32)
    duration = len(sig) / SAMPLE_RATE

    chars = han_chars(expected_hanzi)
    spoken = apply_tone_sandhi(
        [(p, chars[i] if len(chars) == n else None) for i, p in enumerate(pinyin)]
    )
    expected_base = [plain_base(p) for p in pinyin]

    track = analyze_pitch(sig)
    transcript = ""
    heard_idx: list[int | None]
    heard: list[str | None]
    content: list[bool]
    near: list[bool]
    segs: list[tuple[float, float] | None]

    if mode == "syllable":
        heard_idx = list(range(n))
        heard = list(expected_base)
        content, near = [True] * n, [False] * n
        voiced = voiced_intervals(track)
        segs = list(split_by_voiced(voiced, n, 0.0, duration))
    else:
        if recognize is None:
            raise RuntimeError("recognizer not loaded")
        transcript, words = recognize(sig)
        heard_syl = heard_pinyin(transcript)
        aligned = align(expected_base, heard_syl, config.near_miss_pairs)
        content = [a.content_ok for a in aligned]
        near = [a.near_miss for a in aligned]
        heard = [a.heard for a in aligned]
        heard_idx = [a.heard_index for a in aligned]
        char_segs = char_segments(words)
        if len(char_segs) == len(heard_syl):
            segs = [char_segs[j] if j is not None else None for j in heard_idx]
        else:  # mốc của Whisper không dùng được: chia theo đoạn có giọng
            fallback = split_by_voiced(voiced_intervals(track), n, 0.0, duration)
            segs = [fallback[i] if heard_idx[i] is not None else None for i in range(n)]

    results: list[SyllableResult] = []
    out_syllables: list[dict[str, Any]] = []
    for i in range(n):
        seg = segs[i]
        tone_res = classify_tone(track.slice(*seg), config, mode) if seg else None
        graded = spoken[i] != 5
        tone_ok: bool | None = None
        if graded and tone_res is not None:
            tone_ok = (
                tone_res.tone == spoken[i]
                or tone_res.confidence < config.tone.confidence_accept_below
            )
        results.append(SyllableResult(content[i], tone_ok))
        out_syllables.append(
            {
                "expected": pinyin[i],
                "expected_tone_spoken": spoken[i],
                "heard_syllable": heard[i],
                "content_ok": content[i],
                "near_miss": near[i],
                "tone_detected": tone_res.tone if tone_res else None,
                "tone_ok": tone_ok,
                "tone_confidence": round(tone_res.confidence, 2) if tone_res else None,
                "contour": tone_res.contour if tone_res else None,
                "start": round(vad.start + seg[0], 3) if seg else None,
                "end": round(vad.start + seg[1], 3) if seg else None,
            }
        )

    if mode == "syllable" and (not out_syllables or out_syllables[0]["tone_detected"] is None):
        return _empty("no_speech", t0)  # không có giọng rõ ràng để chấm thanh

    return {
        "status": "ok",
        "score": score_sentence(results, mode),
        "syllables": out_syllables,
        "transcript": transcript,
        "timing_ms": round((time.perf_counter() - t0) * 1000),
    }
