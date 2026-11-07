"""Gọi Claude qua Claude Code CLI (`claude -p`) để lấy đầu ra JSON theo schema. Tách khỏi nghiệp vụ để test bằng model giả."""

import json
import os
import subprocess
import tempfile
from collections.abc import Callable
from pathlib import Path
from typing import Any, Protocol


class LlmRefusal(RuntimeError):
    """Model từ chối yêu cầu (stop_reason = refusal)."""


class LlmTruncated(RuntimeError):
    """Đầu ra bị cắt vì hết max_tokens; tăng max_tokens hoặc chia nhỏ yêu cầu."""


class JsonModel(Protocol):
    def generate(
        self,
        *,
        system: str,
        user: str,
        schema: dict[str, Any],
        model: str,
        effort: str,
        max_tokens: int,
    ) -> Any: ...


class ClaudeCliJson:
    """Một lượt `claude -p` (Claude Code CLI), trả về JSON đã parse theo `schema`.

    Dùng đăng nhập sẵn có của Claude Code (gói đăng ký), không cần `ANTHROPIC_API_KEY`: biến này bị
    bỏ khỏi môi trường con để CLI không chuyển sang tính tiền theo API. Chạy ở thư mục tạm trống,
    không công cụ (`--tools ""`), không nạp cài đặt/hook/CLAUDE.md của người dùng hay dự án
    (`--setting-sources ""`), không lưu phiên. Prompt đi qua stdin và file, tránh giới hạn độ dài
    đối số dòng lệnh.
    """

    def __init__(
        self,
        claude_bin: str = "claude",
        runner: Callable[..., Any] = subprocess.run,
        timeout_s: int = 3600,
    ):
        self.claude_bin = claude_bin
        self.runner = runner
        self.timeout_s = timeout_s

    def generate(
        self,
        *,
        system: str,
        user: str,
        schema: dict[str, Any],
        model: str,
        effort: str,
        max_tokens: int,
    ) -> Any:
        env = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}
        env["CLAUDE_CODE_MAX_OUTPUT_TOKENS"] = str(max_tokens)
        with tempfile.TemporaryDirectory(prefix="clp-claude-") as tmp:
            system_file = Path(tmp) / "system.txt"
            system_file.write_text(system, encoding="utf-8")
            cmd = [
                self.claude_bin, "-p",
                "--output-format", "json",
                "--json-schema", json.dumps(schema, ensure_ascii=False),
                "--system-prompt-file", str(system_file),
                "--model", model,
                "--effort", effort,
                "--tools", "",
                "--setting-sources", "",
                "--no-session-persistence",
                "--disable-slash-commands",
                "--strict-mcp-config",
            ]  # fmt: skip
            try:
                proc = self.runner(
                    cmd, input=user, capture_output=True, text=True, encoding="utf-8",
                    cwd=tmp, env=env, timeout=self.timeout_s,
                )  # fmt: skip
            except FileNotFoundError as e:
                raise RuntimeError(
                    f"Không chạy được {self.claude_bin!r}: cài Claude Code CLI và đăng nhập, "
                    "hoặc đặt CLP_CLAUDE_BIN trỏ tới file chạy."
                ) from e
        try:
            out = json.loads(proc.stdout)
        except json.JSONDecodeError:
            out = None
        if proc.returncode != 0 or not isinstance(out, dict):
            detail = (out or {}).get("result") if isinstance(out, dict) else None
            raise RuntimeError(
                f"claude -p lỗi (mã {proc.returncode}): {detail or proc.stderr.strip() or proc.stdout[:300]}"
            )
        if out.get("stop_reason") == "refusal":
            raise LlmRefusal("Model từ chối yêu cầu")
        if out.get("stop_reason") == "max_tokens":
            raise LlmTruncated(f"Đầu ra bị cắt ở max_tokens={max_tokens}")
        if out.get("is_error"):
            raise RuntimeError(f"claude -p lỗi: {out.get('result')}")
        if out.get("structured_output") is not None:
            return out["structured_output"]
        try:
            return json.loads(out.get("result") or "")
        except json.JSONDecodeError as e:
            raise ValueError(f"Đầu ra của model không phải JSON hợp lệ: {e}") from e
