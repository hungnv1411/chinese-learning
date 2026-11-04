"""02-3 (phần thuần): chuẩn hóa YAML soạn thành JSON `lesson.content` (hợp đồng ở models.py).
Không đọc DB: các tra cứu (id từ HSK, chữ có dữ liệu nét) được truyền vào qua NormContext."""

from dataclasses import dataclass, field

from clp.content.authoring import (
    ExercisesStepFile,
    GrammarStepFile,
    IntroStepFile,
    LessonFile,
    SoundIntroStepFile,
    SpeakingStepFile,
    ToneContourIntroStepFile,
    WritingStepFile,
)
from clp.content.loader import LoadedUnit
from clp.content.models import (
    ExerciseAutoStep,
    ExerciseStep,
    GrammarStep,
    IntroStep,
    LessonContent,
    NewWord,
    Sentence,
    SoundIntroStep,
    SpeakingStep,
    ToneContourIntroStep,
    WritingStep,
    content_version,
)
from clp.content.rules import HAN, Finding

DEFAULT_AUTO_EXERCISES = 8  # curriculum-structure §4: bài tập tự sinh mặc định


@dataclass(frozen=True)
class NormContext:
    stage_levels: dict[str, int]
    stage_order: list[str]
    hsk_word_ids: dict[tuple[int, str], list[int]]  # (cấp, từ) -> id các hàng hsk_word
    stroke_chars: set[str]


@dataclass(frozen=True)
class NormalizedLesson:
    lesson_id: str
    unit_id: str
    order: int  # vị trí trong chủ đề, từ 1
    title: str
    kind: str
    content: LessonContent
    word_ids: list[int]  # -> lesson_word
    chars: list[str]  # -> lesson_char (chữ xuất hiện lần đầu trong bài)


@dataclass
class Normalized:
    lessons: list[NormalizedLesson] = field(default_factory=list)
    warnings: list[Finding] = field(default_factory=list)


def _han(words: list[str]) -> list[str]:
    return list(dict.fromkeys(c for w in words for c in w if HAN.match(c)))


def _convert_steps(lesson: LessonFile, writing_chars: list[str]) -> list:
    out: list = []
    for step in lesson.steps or []:
        if isinstance(step, IntroStepFile):
            out += [IntroStep(kind="intro", word=w) for w in step.intro]
        elif isinstance(step, WritingStepFile):
            chars = writing_chars if step.writing == "auto" else step.writing
            out += [WritingStep(kind="writing", char=c) for c in chars]
        elif isinstance(step, GrammarStepFile):
            gid = lesson.grammar if step.grammar == "auto" else step.grammar
            out.append(GrammarStep(kind="grammar", grammar_id=gid))
        elif isinstance(step, ExercisesStepFile):
            for item in step.exercises:
                if item.type == "auto":
                    out.append(ExerciseAutoStep(kind="exercise_auto", count=item.count))
                else:
                    out.append(
                        ExerciseStep(
                            kind="exercise",
                            type=item.type,
                            target=item.target,
                            sentence=item.sentence,
                        )
                    )
        elif isinstance(step, SpeakingStepFile):
            out += [SpeakingStep(kind="speaking", mode=i.mode, ref=i.ref) for i in step.speaking]
        elif isinstance(step, SoundIntroStepFile):
            out += [SoundIntroStep(kind="sound_intro", sound=s) for s in step.sound_intro]
        elif isinstance(step, ToneContourIntroStepFile):
            out += [
                ToneContourIntroStep(kind="tone_contour_intro", tone=t)
                for t in step.tone_contour_intro
            ]
    return out


def _default_steps(lesson: LessonFile, writing_chars: list[str]) -> list:
    """Bố cục mặc định (curriculum-structure §4): intro mỗi từ mới → writing mỗi chữ mới →
    grammar (nếu có) → bài tập tự sinh → nói 1 từ mới đầu tiên và 1 câu đầu tiên."""
    steps: list = [IntroStep(kind="intro", word=w.word) for w in lesson.new_words]
    steps += [WritingStep(kind="writing", char=c) for c in writing_chars]
    if lesson.grammar:
        steps.append(GrammarStep(kind="grammar", grammar_id=lesson.grammar))
    steps.append(ExerciseAutoStep(kind="exercise_auto", count=DEFAULT_AUTO_EXERCISES))
    steps.append(SpeakingStep(kind="speaking", mode="word", ref=lesson.new_words[0].word))
    steps.append(SpeakingStep(kind="speaking", mode="sentence", ref=lesson.sentences[0].id))
    return steps


def normalize_content(units: list[LoadedUnit], ctx: NormContext) -> Normalized:
    """Chuẩn hóa mọi bài theo thứ tự toàn cục (lộ trình → chủ đề → bài). Nội dung đã qua `validate_content`."""
    order = {s: i for i, s in enumerate(ctx.stage_order)}
    result = Normalized()
    seen_chars: set[str] = set()
    for lu in sorted(units, key=lambda x: (order.get(x.unit.stage, 99), x.unit.order, x.unit.id)):
        level = ctx.stage_levels.get(lu.unit.stage)
        for li, lesson in enumerate(lu.unit.lessons):
            checkpoint = lesson.type == "checkpoint"
            words = [] if checkpoint else lesson.new_words
            word_ids: list[int] = []
            new_words: list[NewWord] = []
            for w in words:
                ids = [] if w.extra or level is None else ctx.hsk_word_ids.get((level, w.word), [])
                word_ids += ids
                new_words.append(
                    NewWord(word=w.word, hsk_word_id=ids[0] if ids else None, extra=w.extra)
                )
            new_chars = [c for c in _han([w.word for w in words]) if c not in seen_chars]
            seen_chars.update(new_chars)
            writing_chars = [c for c in new_chars if c in ctx.stroke_chars]
            for c in new_chars:
                if c not in ctx.stroke_chars:
                    result.warnings.append(
                        Finding(
                            "warning",
                            "writing_skipped_no_strokes",
                            f"Chữ {c!r} (bài {lesson.id}) không có dữ liệu nét nên bị bỏ khỏi luyện viết",
                            lu.path,
                            lu.line("lessons", li, "id"),
                        )
                    )
            if checkpoint:
                steps: list = []
            elif lesson.steps is None:
                steps = _default_steps(lesson, writing_chars)
            else:
                steps = _convert_steps(lesson, writing_chars)
            body = LessonContent.model_construct(
                content_version="000000000000",
                type=lesson.type,
                new_words=new_words,
                new_chars=new_chars,
                sentences=[
                    Sentence(id=s.id, zh=s.zh, en=s.en, pinyin=s.pinyin, tatoeba_id=s.tatoeba_id)
                    for s in lesson.sentences
                ],
                tips=dict(lesson.tips),
                steps=steps,
            )
            version = content_version(body.model_dump(mode="json", by_alias=True))
            content = LessonContent.model_validate(
                {**body.model_dump(mode="json", by_alias=True), "contentVersion": version}
            )
            result.lessons.append(
                NormalizedLesson(
                    lesson_id=lesson.id,
                    unit_id=lu.unit.id,
                    order=li + 1,
                    title=lesson.title,
                    kind=lesson.type,
                    content=content,
                    word_ids=word_ids,
                    chars=new_chars,
                )
            )
    return result
