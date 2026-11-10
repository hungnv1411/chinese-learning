"""Nhận dạng giọng nói bằng faster-whisper. Model nạp một lần lúc khởi động."""

from collections.abc import Callable

import numpy as np
from faster_whisper import WhisperModel

from .config import Config

WordTiming = tuple[str, float, float]  # (chữ, bắt đầu, kết thúc) tính bằng giây
Recognizer = Callable[[np.ndarray], tuple[str, list[WordTiming]]]


def load_recognizer(config: Config) -> Recognizer:
    model = WhisperModel(config.model, device="cpu", compute_type=config.compute_type)

    def recognize(samples: np.ndarray) -> tuple[str, list[WordTiming]]:
        # Không truyền initial_prompt: không để model “đoán giúp” theo nội dung mong đợi.
        segments, _ = model.transcribe(
            samples.astype(np.float32),
            language="zh",
            word_timestamps=True,
            beam_size=1,
            condition_on_previous_text=False,
        )
        text, words = [], []
        for seg in segments:
            text.append(seg.text)
            for w in seg.words or []:
                words.append((w.word, float(w.start), float(w.end)))
        return "".join(text), words

    return recognize
