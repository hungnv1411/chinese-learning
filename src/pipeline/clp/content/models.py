"""Hợp đồng `lesson.content` (JSON lưu ở DB) phía Python. Phải khớp packages/core/src/content.ts;
test `test_content_contract.py` xuất fixture để Vitest parse bằng zod."""

import hashlib
import json
from pathlib import Path
from typing import Annotated, Any, ClassVar, Literal

from pydantic import BaseModel, ConfigDict, Field, model_serializer, model_validator
from pydantic.alias_generators import to_camel

_CORE_FIXTURE = (
    Path(__file__).resolve().parents[3] / "packages" / "core" / "fixtures" / "exercise-types.json"
)
EXERCISE_TYPES: tuple[str, ...] = tuple(json.loads(_CORE_FIXTURE.read_text(encoding="utf-8")))
ExerciseType = Literal[EXERCISE_TYPES]  # type: ignore[valid-type]
Tone = Literal[1, 2, 3, 4, 5]
NonEmpty = Annotated[str, Field(min_length=1)]


class _Model(BaseModel):
    """Khóa camelCase khi xuất; trường tùy chọn vắng mặt thì bỏ khỏi JSON (trừ KEEP_NULL)."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")
    KEEP_NULL: ClassVar[frozenset[str]] = frozenset()

    @model_serializer(mode="wrap")
    def _drop_absent(self, handler: Any) -> dict[str, Any]:
        data = handler(self)
        return {k: v for k, v in data.items() if v is not None or k in self.KEEP_NULL}


class IntroStep(_Model):
    kind: Literal["intro"]
    word: NonEmpty


class SoundIntroStep(_Model):
    kind: Literal["sound_intro"]
    sound: NonEmpty


class ToneContourIntroStep(_Model):
    kind: Literal["tone_contour_intro"]
    tone: Tone


class WritingStep(_Model):
    kind: Literal["writing"]
    char: NonEmpty


class GrammarStep(_Model):
    kind: Literal["grammar"]
    grammar_id: NonEmpty


class ExerciseStep(_Model):
    kind: Literal["exercise"]
    type: ExerciseType
    target: NonEmpty | None = None
    sentence: NonEmpty | None = None


class ExerciseAutoStep(_Model):
    kind: Literal["exercise_auto"]
    count: Annotated[int, Field(ge=1)]


class SpeakingStep(_Model):
    kind: Literal["speaking"]
    mode: Literal["syllable", "word", "sentence", "answer"]
    ref: NonEmpty


StepSpec = Annotated[
    IntroStep
    | SoundIntroStep
    | ToneContourIntroStep
    | WritingStep
    | GrammarStep
    | ExerciseStep
    | ExerciseAutoStep
    | SpeakingStep,
    Field(discriminator="kind"),
]


class NewWord(_Model):
    KEEP_NULL = frozenset({"hskWordId"})
    word: NonEmpty
    hsk_word_id: int | None
    extra: bool


class Sentence(_Model):
    id: NonEmpty
    zh: NonEmpty
    en: NonEmpty
    pinyin: NonEmpty
    tatoeba_id: int | None = None


class LessonContent(_Model):
    content_version: Annotated[str, Field(pattern=r"^[0-9a-f]{12}$")]
    type: Literal["normal", "checkpoint"]
    new_words: list[NewWord]
    new_chars: list[NonEmpty]
    sentences: list[Sentence]
    tips: dict[str, str]
    steps: list[StepSpec]

    @model_validator(mode="after")
    def _steps_match_type(self) -> "LessonContent":
        if self.type == "checkpoint" and self.steps:
            raise ValueError("Bài checkpoint phải có steps rỗng.")
        if self.type == "normal" and not self.steps:
            raise ValueError("Bài thường phải có ít nhất một bước.")
        return self


def content_version(normalized: dict[str, Any]) -> str:
    """sha256 rút gọn (12 ký tự hex) của JSON chuẩn hóa của bài, không tính chính `contentVersion`.
    Nhận dict đã chuẩn hóa (đúng đầu ra của model); khóa được sắp để không phụ thuộc thứ tự."""
    body = {k: v for k, v in normalized.items() if k != "contentVersion"}
    canonical = json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:12]
