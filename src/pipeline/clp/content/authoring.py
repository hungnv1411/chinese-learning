"""Định dạng soạn nội dung (YAML) theo docs/specs/02-curriculum/content-format.md.
Model chỉ kiểm tra hình dạng; quy tắc nội dung (từ HSK, câu, tham chiếu…) ở 02-2."""

from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from clp.content.models import EXERCISE_TYPES, Tone

NonEmpty = Annotated[str, Field(min_length=1)]


class _Model(BaseModel):
    # extra=forbid: gõ nhầm tên trường là lỗi (có số dòng), không bị bỏ qua im lặng
    model_config = ConfigDict(extra="forbid")


class NewWordFile(_Model):
    word: NonEmpty
    extra: bool = False


def _word_shorthand(v: Any) -> Any:
    return {"word": v} if isinstance(v, str) else v


class SentenceFile(_Model):
    id: NonEmpty
    zh: NonEmpty
    en: NonEmpty
    pinyin: NonEmpty
    tatoeba_id: int | None = None


class ExerciseItem(_Model):
    type: str
    target: NonEmpty | None = None
    sentence: NonEmpty | None = None
    count: Annotated[int, Field(ge=1)] | None = None

    @field_validator("type")
    @classmethod
    def _known_type(cls, v: str) -> str:
        if v != "auto" and v not in EXERCISE_TYPES:
            raise ValueError(f"loại bài tập không hợp lệ: {v!r}")
        return v

    @model_validator(mode="after")
    def _auto_needs_count(self) -> "ExerciseItem":
        if self.type == "auto" and self.count is None:
            raise ValueError("bài tập auto cần count")
        if self.type != "auto" and self.count is not None:
            raise ValueError("count chỉ dùng với type: auto")
        return self


class SpeakingItem(_Model):
    word: NonEmpty | None = None
    sentence: NonEmpty | None = None
    syllable: NonEmpty | None = None
    answer: NonEmpty | None = None

    @model_validator(mode="after")
    def _exactly_one(self) -> "SpeakingItem":
        given = [k for k in ("word", "sentence", "syllable", "answer") if getattr(self, k)]
        if len(given) != 1:
            raise ValueError("mỗi mục nói cần đúng một trong: word, sentence, syllable, answer")
        return self

    @property
    def mode(self) -> str:
        return next(k for k in ("word", "sentence", "syllable", "answer") if getattr(self, k))

    @property
    def ref(self) -> str:
        return getattr(self, self.mode)


class IntroStepFile(_Model):
    kind: Literal["intro"]
    intro: list[NonEmpty]


class WritingStepFile(_Model):
    kind: Literal["writing"]
    writing: Literal["auto"] | list[NonEmpty]


class GrammarStepFile(_Model):
    kind: Literal["grammar"]
    grammar: NonEmpty


class ExercisesStepFile(_Model):
    kind: Literal["exercises"]
    exercises: Annotated[list[ExerciseItem], Field(min_length=1)]


class SpeakingStepFile(_Model):
    kind: Literal["speaking"]
    speaking: Annotated[list[SpeakingItem], Field(min_length=1)]


class SoundIntroStepFile(_Model):
    kind: Literal["sound_intro"]
    sound_intro: list[NonEmpty]


class ToneContourIntroStepFile(_Model):
    kind: Literal["tone_contour_intro"]
    tone_contour_intro: list[Tone]


STEP_KEYS = (
    "intro",
    "writing",
    "grammar",
    "exercises",
    "speaking",
    "sound_intro",
    "tone_contour_intro",
)


def _tag_step(v: Any) -> Any:
    """`{intro: [...]}` → `{kind: 'intro', intro: [...]}`; mỗi bước đúng một khóa đã biết."""
    if not isinstance(v, dict):
        # pydantic chỉ chuyển ValueError thành lỗi xác thực có vị trí
        raise ValueError("mỗi bước phải là một mục dạng `tên_bước: nội dung`")  # noqa: TRY004
    if len(v) != 1:
        raise ValueError(f"mỗi bước cần đúng một khóa, có {len(v)}: {', '.join(map(str, v))}")
    (key,) = v
    if key not in STEP_KEYS:
        raise ValueError(f"bước không biết: {key!r} (hợp lệ: {', '.join(STEP_KEYS)})")
    return {"kind": key, **v}


StepFile = Annotated[
    Annotated[
        IntroStepFile
        | WritingStepFile
        | GrammarStepFile
        | ExercisesStepFile
        | SpeakingStepFile
        | SoundIntroStepFile
        | ToneContourIntroStepFile,
        Field(discriminator="kind"),
    ],
    BeforeValidator(_tag_step),
]


class LessonFile(_Model):
    id: NonEmpty
    type: Literal["normal", "checkpoint"] = "normal"
    title: NonEmpty
    grammar: NonEmpty | None = None
    new_words: list[Annotated[NewWordFile, BeforeValidator(_word_shorthand)]] = []
    sentences: list[SentenceFile] = []
    # None = dùng bố cục mặc định (curriculum-structure §4); [] không hợp lệ ở bài thường (02-2)
    steps: list[StepFile] | None = None
    tips: dict[str, str] = {}


class UnitFile(_Model):
    id: NonEmpty
    stage: NonEmpty
    order: Annotated[int, Field(ge=1)]
    title: NonEmpty
    description: str = ""
    illustration: str | None = None
    lessons: Annotated[list[LessonFile], Field(min_length=1)]


class GrammarExample(_Model):
    zh: NonEmpty
    en: NonEmpty


class GrammarPointFile(_Model):
    id: NonEmpty
    hsk_code: NonEmpty
    title: NonEmpty
    explanation_vi: NonEmpty
    pattern: NonEmpty
    examples: list[GrammarExample]
