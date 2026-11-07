"""Cấu hình lượt soạn/rà soát bằng AI (plan 02 §4: model đặt trong cấu hình)."""

import os
from collections.abc import Mapping
from dataclasses import dataclass

EFFORTS = ("low", "medium", "high", "xhigh", "max")


@dataclass(frozen=True)
class AuthoringConfig:
    author_model: str = "claude-opus-5-5"  # lượt soạn
    review_model: str = "claude-sonnet-5-5"  # lượt rà soát: model và prompt khác lượt soạn
    effort: str = "high"
    claude_bin: str = "claude"  # Claude Code CLI dùng cho `claude -p`


def load_config(env: Mapping[str, str] | None = None) -> AuthoringConfig:
    env = os.environ if env is None else env
    default = AuthoringConfig()
    effort = env.get("CLP_AUTHOR_EFFORT", default.effort)
    if effort not in EFFORTS:
        raise ValueError(f"CLP_AUTHOR_EFFORT (effort) phải là một trong {', '.join(EFFORTS)}")
    return AuthoringConfig(
        author_model=env.get("CLP_AUTHOR_MODEL", default.author_model),
        review_model=env.get("CLP_REVIEW_MODEL", default.review_model),
        effort=effort,
        claude_bin=env.get("CLP_CLAUDE_BIN", default.claude_bin),
    )
