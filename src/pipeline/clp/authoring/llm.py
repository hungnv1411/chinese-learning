"""Gọi Claude để lấy đầu ra JSON theo schema (structured outputs). Tách khỏi nghiệp vụ để test bằng model giả."""

import json
from typing import Any, Protocol

FALLBACK_BETA = "server-side-fallback-2026-07-01"


class LlmRefusal(RuntimeError):
    """Bộ phân loại an toàn từ chối yêu cầu (stop_reason = refusal)."""


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


class AnthropicJson:
    """Một lượt gọi Messages API, streaming (đầu ra dài), trả về JSON đã parse.

    Claude Opus 5.5: không gửi `thinking: disabled`, `temperature`/`top_p`/`top_k` hay `tool_choice`
    ép buộc (đều bị từ chối); độ sâu suy luận điều khiển bằng `effort`. `fallbacks="default"` để
    bộ phân loại an toàn từ chối thì server tự chuyển sang model dự phòng trong cùng lời gọi.
    """

    def __init__(self, client: Any, fallbacks: bool = True):
        self.client = client
        self.fallbacks = fallbacks

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
        kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": user}],
            "output_config": {
                "effort": effort,
                "format": {"type": "json_schema", "schema": schema},
            },
        }
        if self.fallbacks:
            kwargs["betas"] = [FALLBACK_BETA]
            kwargs["fallbacks"] = "default"
        with self.client.beta.messages.stream(**kwargs) as stream:
            message = stream.get_final_message()
        if message.stop_reason == "refusal":
            details = getattr(message, "stop_details", None)
            category = getattr(details, "category", None)
            raise LlmRefusal(f"Model từ chối yêu cầu (category: {category})")
        if message.stop_reason == "max_tokens":
            raise LlmTruncated(f"Đầu ra bị cắt ở max_tokens={max_tokens}")
        text = next((b.text for b in message.content if b.type == "text"), "")
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            raise ValueError(f"Đầu ra của model không phải JSON hợp lệ: {e}") from e
