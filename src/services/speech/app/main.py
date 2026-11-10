import asyncio
import json
import logging
import time
from collections.abc import Awaitable, Callable
from typing import Annotated, Any, Literal

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse

from .config import Config, load_config
from .decode import DecodeError, decode_audio
from .queue import QueueFull, ScoreQueue
from .vad import analyze

log = logging.getLogger("speech")

Scorer = Callable[[bytes, str, str, str], Awaitable[dict[str, Any]]]


def error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status)


class BadAudio(Exception):
    pass


def make_default_scorer(cfg: Config) -> Scorer:
    async def scorer(data: bytes, hanzi: str, pinyin: str, mode: str) -> dict[str, Any]:
        t0 = time.perf_counter()
        try:
            samples = await asyncio.to_thread(decode_audio, data, cfg)
        except DecodeError as e:
            raise BadAudio from e
        vad = await asyncio.to_thread(analyze, samples, cfg)
        if vad.status != "ok":
            return {
                "status": vad.status,
                "score": None,
                "syllables": [],
                "transcript": "",
                "timing_ms": round((time.perf_counter() - t0) * 1000),
            }
        raise NotImplementedError("recognition and scoring arrive in steps 08a-4…08a-7")

    return scorer


def create_app(config: Config | None = None, scorer: Scorer | None = None) -> FastAPI:
    cfg = config or load_config()
    run_scorer = scorer or make_default_scorer(cfg)
    queue = ScoreQueue(cfg.workers, cfg.queue_max)
    app = FastAPI(title="speech")
    app.state.model_loaded = False  # 08a-4 nạp faster-whisper một lần lúc khởi động

    @app.get("/healthz")
    def healthz() -> dict[str, bool]:
        return {"ok": True, "model_loaded": app.state.model_loaded}

    @app.post("/score")
    async def score(
        audio: Annotated[UploadFile, File()],
        mode: Annotated[Literal["syllable", "word", "sentence"], Form()],
        expected_pinyin: Annotated[str, Form()],
        expected_hanzi: Annotated[str, Form()] = "",
    ):
        data = await audio.read(cfg.max_upload_bytes + 1)
        if len(data) > cfg.max_upload_bytes:
            return error(413, "PAYLOAD_TOO_LARGE", "Audio quá lớn")
        start = time.perf_counter()
        try:
            async with queue.slot():
                result = await run_scorer(data, expected_hanzi, expected_pinyin, mode)
        except BadAudio:
            return error(422, "BAD_AUDIO", "Không đọc được file audio")
        except QueueFull:
            return error(503, "BUSY", "Máy chấm đang bận")
        except Exception:
            log.exception("score failed")
            return error(500, "INTERNAL", "Lỗi khi chấm")
        # Chỉ ghi thời gian, mode, status, điểm: không transcript, không định danh.
        log.info(
            json.dumps(
                {
                    "timing_ms": round((time.perf_counter() - start) * 1000),
                    "mode": mode,
                    "status": result.get("status"),
                    "score": result.get("score"),
                }
            )
        )
        return result

    return app


app = create_app()
