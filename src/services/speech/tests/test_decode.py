import io
import math
import os
import shutil
import struct
import subprocess
import wave

import pytest

from app.config import load_config
from app.decode import DecodeError, decode_audio

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")

SR = 16000


def tone(seconds, freq=200.0, amp=0.5, sr=SR):
    n = int(seconds * sr)
    return [amp * math.sin(2 * math.pi * freq * i / sr) for i in range(n)]


def wav_bytes(samples, sr=SR):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s)) * 32767)) for s in samples))
    return buf.getvalue()


def ffmpeg_encode(wav: bytes, fmt: str, tmp_path) -> bytes:
    src = tmp_path / "in.wav"
    src.write_bytes(wav)
    out = tmp_path / f"out.{fmt}"
    codec = {"webm": ["-c:a", "libopus"], "mp4": ["-c:a", "aac"]}[fmt]
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), *codec, str(out)], check=True
    )
    return out.read_bytes()


def shm_files():
    return set(os.listdir("/dev/shm")) if os.path.isdir("/dev/shm") else set()


def test_wav_decodes_to_16k_mono_floats():
    pcm = decode_audio(wav_bytes(tone(1.0)), load_config())
    assert abs(len(pcm) - SR) < 200
    assert max(pcm) <= 1.0


def test_resamples_other_rate():
    pcm = decode_audio(wav_bytes(tone(1.0, sr=44100), sr=44100), load_config())
    assert abs(len(pcm) - SR) < 400


def test_webm_opus_decodes(tmp_path):
    data = ffmpeg_encode(wav_bytes(tone(1.0)), "webm", tmp_path)
    assert abs(len(decode_audio(data, load_config())) - SR) < 1600


def test_mp4_aac_decodes_and_leaves_no_temp_file(tmp_path):
    data = ffmpeg_encode(wav_bytes(tone(1.0)), "mp4", tmp_path)
    before = shm_files()
    assert abs(len(decode_audio(data, load_config())) - SR) < 1600
    assert shm_files() == before


def test_garbage_raises_decode_error():
    with pytest.raises(DecodeError):
        decode_audio(b"not audio at all" * 10, load_config())


def test_temp_file_removed_even_on_failure():
    before = shm_files()
    with pytest.raises(DecodeError):
        decode_audio(b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 50, load_config())
    assert shm_files() == before
