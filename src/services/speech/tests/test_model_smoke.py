"""Smoke test với model Whisper thật. Cần mạng lần đầu (tải model); bỏ qua nếu không đặt RUN_MODEL_TESTS=1."""

import os

import numpy as np
import pytest

from app.asr import load_recognizer
from app.config import load_config
from tests.synth import tone_syllable

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_MODEL_TESTS") != "1", reason="set RUN_MODEL_TESTS=1 to load Whisper"
)


def test_real_model_loads_and_transcribes_without_error():
    recognize = load_recognizer(load_config())
    text, words = recognize(np.concatenate([tone_syllable(1), tone_syllable(4)]))
    assert isinstance(text, str) and isinstance(words, list)
