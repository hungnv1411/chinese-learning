import asyncio
import json
import logging
import time
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Annotated, Any, Literal

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse

from .asr import Recognizer, load_recognizer
from .config import Config, load_config
from .decode import DecodeError
from .pipeline import score_audio
from .queue import QueueFull, ScoreQueue

log = logging.getLogger("speech")

Scorer = Callable[[bytes, str, str, str], Awaitable[dict[str, Any]]]


def error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status)


class BadAudio(Exception):
    pass


def make_default_scorer(cfg: Config, get_recognizer: Callable[[], Recognizer | None]) -> Scorer:
    async def scorer(data: bytes, hanzi: str, pinyin: str, mode: str) -> dict[str, Any]:
        try:
            return await asyncio.to_thread(
                score_audio, data, hanzi, pinyin, mode, cfg, get_recognizer()
            )
        except DecodeError as e:
            raise BadAudio from e

    return scorer


def create_app(
    config: Config | None = None,
    scorer: Scorer | None = None,
    recognizer: Recognizer | None = None,
    load_model: bool = False,
) -> FastAPI:
    """`load_model=True`: nạp faster-whisper một lần lúc khởi động (dùng khi chạy thật)."""
    cfg = config or load_config()
    state: dict[str, Recognizer | None] = {"recognizer": recognizer}
    run_scorer = scorer or make_default_scorer(cfg, lambda: state["recognizer"])
    queue = ScoreQueue(cfg.workers, cfg.queue_max)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if load_model and state["recognizer"] is None:
            state["recognizer"] = await asyncio.to_thread(load_recognizer, cfg)
        yield

    app = FastAPI(title="speech", lifespan=lifespan)

    @app.get("/healthz")
    def healthz() -> dict[str, bool]:
        return {"ok": True, "model_loaded": state["recognizer"] is not None}

    @app.post("/score")
    async def score(
        audio: Annotated[UploadFile, File()],
        mode: Annotated[Literal["syllable", "word", "sentence"], Form()],
        expected_pinyin: Annotated[str, Form()],
        expected_hanzi: Annotated[str, Form()] = "",
    ):
        if not expected_pinyin.split():
            return error(422, "BAD_REQUEST", "expected_pinyin trống")
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


app = create_app(load_model=True)
