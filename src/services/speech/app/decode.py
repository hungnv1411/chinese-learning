"""Giải mã audio tải lên thành mẫu float 16 kHz mono bằng ffmpeg.

Không ghi đĩa: dữ liệu đi qua pipe. Riêng mp4 (Safari) cần seek nên dùng file tạm trong
`/dev/shm`, xóa trong `finally`.
"""

import os
import subprocess
import tempfile
from array import array

from .config import Config

SAMPLE_RATE = 16000
TIMEOUT_S = 20
_BASE = ["ffmpeg", "-nostdin", "-loglevel", "error", "-vn"]
_OUT = ["-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "f32le", "-"]


class DecodeError(Exception):
    pass


def _needs_seek(data: bytes) -> bool:
    return data[4:8] == b"ftyp"


def _run(args: list[str], stdin: bytes | None) -> bytes:
    try:
        p = subprocess.run(args, input=stdin, capture_output=True, timeout=TIMEOUT_S, check=False)
    except subprocess.TimeoutExpired as e:
        raise DecodeError("ffmpeg timeout") from e
    if p.returncode != 0 or not p.stdout:
        raise DecodeError("cannot decode audio")
    return p.stdout


def decode_audio(data: bytes, config: Config) -> list[float]:
    """Trả mẫu [-1, 1] ở 16 kHz mono. Ném `DecodeError` nếu không giải mã được."""
    if _needs_seek(data):
        fd, path = tempfile.mkstemp(dir="/dev/shm" if os.path.isdir("/dev/shm") else None)
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(data)
            raw = _run([*_BASE, "-i", path, *_OUT], None)
        finally:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass
    else:
        raw = _run([*_BASE, "-i", "pipe:0", *_OUT], data)
    samples = array("f")
    samples.frombytes(raw[: len(raw) - len(raw) % 4])
    return samples.tolist()
