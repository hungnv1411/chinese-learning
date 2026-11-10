"""Nạp `config/scoring.yaml`. Mọi ngưỡng chấm nằm ở file đó."""

import os
from pathlib import Path

import yaml
from pydantic import BaseModel

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "scoring.yaml"


class ToneThresholds(BaseModel):
    t4_drop_st: float
    t2_rise_st: float
    t3_mean_max_st: float
    t3_dip_st: float
    t1_flat_max_st: float
    t1_mean_min_st: float
    confidence_accept_below: float
    min_voiced_frames: int


class Config(BaseModel):
    model: str
    compute_type: str
    min_duration_s: float
    max_duration_s: float
    max_upload_bytes: int
    min_snr_db: float
    near_miss_pairs: list[list[str]]
    tone: ToneThresholds
    queue_max: int
    workers: int


def load_config(path: Path = CONFIG_PATH) -> Config:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    concurrency = raw.pop("concurrency", "auto")
    workers = (
        max(1, (os.cpu_count() or 1) // 2) if concurrency == "auto" else max(1, int(concurrency))
    )
    raw["model"] = os.environ.get("WHISPER_MODEL") or raw["model"]
    return Config(**raw, workers=workers)
