import asyncio
import io
import json
import logging

import httpx
import pytest

from app.config import Config, load_config
from app.main import create_app
from app.queue import QueueFull, ScoreQueue


def make_config(**over) -> Config:
    cfg = load_config()
    return cfg.model_copy(update=over)


def form(mode="word"):
    return {"expected_hanzi": "你好", "expected_pinyin": "ni3 hao3", "mode": mode}


def audio(size=100):
    return {"audio": ("a.webm", io.BytesIO(b"x" * size), "audio/webm")}


async def ok_scorer(data, expected_hanzi, expected_pinyin, mode):
    return {"status": "ok", "score": 80, "syllables": [], "transcript": "你好", "timing_ms": 1}


def client(app):
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t")


def test_config_loads_thresholds_from_yaml():
    cfg = load_config()
    assert cfg.min_duration_s == 0.3
    assert cfg.max_duration_s == 15
    assert cfg.queue_max == 20
    assert cfg.tone.t4_drop_st == 3.0
    assert cfg.near_miss_pairs[0] == ["zh", "z"]


def test_concurrency_auto_is_half_cpu_at_least_one(monkeypatch):
    monkeypatch.setattr("os.cpu_count", lambda: 1)
    assert load_config().workers == 1
    monkeypatch.setattr("os.cpu_count", lambda: 8)
    assert load_config().workers == 4


def test_whisper_model_from_env(monkeypatch):
    monkeypatch.setenv("WHISPER_MODEL", "small")
    assert load_config().model == "small"


async def test_healthz_reports_model_state():
    async with client(create_app(make_config(), scorer=ok_scorer)) as c:
        r = await c.get("/healthz")
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert r.json()["model_loaded"] is False


async def test_score_returns_scorer_result():
    async with client(create_app(make_config(), scorer=ok_scorer)) as c:
        r = await c.post("/score", data=form(), files=audio())
    assert r.status_code == 200
    assert r.json()["score"] == 80


async def test_upload_over_limit_is_413():
    cfg = make_config(max_upload_bytes=1000)
    async with client(create_app(cfg, scorer=ok_scorer)) as c:
        r = await c.post("/score", data=form(), files=audio(1001))
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


async def test_invalid_mode_is_422():
    async with client(create_app(make_config(), scorer=ok_scorer)) as c:
        r = await c.post("/score", data=form("bogus"), files=audio())
    assert r.status_code == 422


async def test_syllable_mode_allows_empty_hanzi():
    async with client(create_app(make_config(), scorer=ok_scorer)) as c:
        r = await c.post(
            "/score",
            data={"expected_pinyin": "ma1", "mode": "syllable"},
            files=audio(),
        )
    assert r.status_code == 200


async def test_21st_request_gets_503_when_processing_is_blocked():
    gate = asyncio.Event()

    async def blocked(*a):
        await gate.wait()
        return await ok_scorer(*a)

    cfg = make_config(workers=2, queue_max=20)
    app = create_app(cfg, scorer=blocked)
    async with client(app) as c:
        tasks = [
            asyncio.create_task(c.post("/score", data=form(), files=audio())) for _ in range(20)
        ]
        await asyncio.sleep(0.2)
        r21 = await c.post("/score", data=form(), files=audio())
        assert r21.status_code == 503
        assert r21.json()["error"]["code"] == "BUSY"
        gate.set()
        results = await asyncio.gather(*tasks)
    assert all(r.status_code == 200 for r in results)


async def test_slot_is_released_after_scorer_error():
    async def boom(*a):
        raise RuntimeError("x")

    cfg = make_config(workers=1, queue_max=1)
    app = create_app(cfg, scorer=boom)
    async with client(app) as c:
        r1 = await c.post("/score", data=form(), files=audio())
        r2 = await c.post("/score", data=form(), files=audio())
    assert r1.status_code == 500 and r2.status_code == 500  # không phải 503


async def test_log_has_no_transcript_or_identity(caplog):
    caplog.set_level(logging.INFO, logger="speech")
    async with client(create_app(make_config(), scorer=ok_scorer)) as c:
        await c.post(
            "/score", data=form(), files=audio(), headers={"authorization": "Bearer secret"}
        )
    lines = [r.getMessage() for r in caplog.records if r.name == "speech"]
    assert lines
    rec = json.loads(lines[-1])
    assert set(rec) == {"timing_ms", "mode", "status", "score"}
    assert "你好" not in "".join(lines) and "secret" not in "".join(lines)


async def test_queue_counts_running_plus_waiting():
    q = ScoreQueue(workers=1, queue_max=2)
    gate = asyncio.Event()

    async def hold():
        async with q.slot():
            await gate.wait()

    t1, t2 = asyncio.create_task(hold()), asyncio.create_task(hold())
    await asyncio.sleep(0.05)
    with pytest.raises(QueueFull):
        async with q.slot():
            pass
    gate.set()
    await asyncio.gather(t1, t2)
    async with q.slot():
        pass
