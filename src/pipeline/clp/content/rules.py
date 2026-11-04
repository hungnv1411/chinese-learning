"""02-2. Quy tắc kiểm tra nội dung (docs/specs/02-curriculum/content-format.md §4, plan 02 bước 2).
Hình dạng file đã được kiểm tra ở loader; đây là các quy tắc xuyên file và xuyên bài. Mỗi phát hiện
có file:dòng; lỗi (chặn) làm `import_content` dừng, cảnh báo thì không."""

import re
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

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
from clp.content.loader import LoadedGrammar, LoadedUnit

HAN = re.compile(r"[一-鿿]")
MIN_EXERCISES = 6
MIN_SPEAKING = 2
MIN_SPEAKING_PRON = 3
MAX_PRON_CARDS = 4
WRITING_UNIT_ORDER = 8  # chủ đề Phát âm duy nhất có luyện viết
PRON_STAGE = "pron"


@dataclass(frozen=True)
class Context:
    """Dữ liệu ngoài file nội dung mà các quy tắc cần (đọc từ DB và file khác ở `check-content`)."""

    hsk_words: dict[int, set[str]]
    stroke_chars: set[str]
    stage_levels: dict[str, int]
    stage_order: list[str]
    grammar_ids: set[str]
    sound_ids: set[str] | None = None  # None: chưa có pron/sounds.yaml, bỏ qua kiểm tra
    published_lesson_ids: frozenset[str] | set[str] = frozenset()
    tokenize: Callable[[str], list[str]] | None = None  # None: bỏ qua cảnh báo từ chưa học


@dataclass(frozen=True)
class Finding:
    level: str  # "error" | "warning"
    code: str
    message: str
    file: Path | None = None
    line: int | None = None

    def __str__(self) -> str:
        where = f"{self.file}:{self.line}: " if self.file and self.line else f"{self.file or ''}"
        tag = "lỗi" if self.level == "error" else "cảnh báo"
        return f"{where}{' ' if where and not where.endswith(' ') else ''}[{tag}:{self.code}] {self.message}".strip()


def _key(f: Finding) -> tuple[str, int, str]:
    return (str(f.file), f.line or 0, f.code)


@dataclass
class Report:
    findings: list[Finding] = field(default_factory=list)

    @property
    def errors(self) -> list[Finding]:
        return sorted((f for f in self.findings if f.level == "error"), key=_key)

    @property
    def warnings(self) -> list[Finding]:
        return sorted((f for f in self.findings if f.level == "warning"), key=_key)

    @property
    def ok(self) -> bool:
        return not self.errors


def _han_chars(words: Iterable[str]) -> list[str]:
    return [c for w in words for c in w if HAN.match(c)]


def validate_content(units: list[LoadedUnit], grammar: list[LoadedGrammar], ctx: Context) -> Report:
    report = Report()

    def add(level: str, code: str, msg: str, file: Path | None = None, line: int | None = None):
        report.findings.append(Finding(level, code, msg, file, line))

    # --- id duy nhất toàn bộ nội dung (chủ đề, bài, câu, điểm ngữ pháp)
    seen: dict[str, tuple[str, Path, int]] = {}

    def claim(id_: str, kind: str, file: Path, line: int):
        if id_ in seen:
            k, f, ln = seen[id_]
            add(
                "error", "duplicate_id", f"id {id_!r} ({kind}) trùng với {k} ở {f}:{ln}", file, line
            )
        else:
            seen[id_] = (kind, file, line)

    for g in grammar:
        for i, p in enumerate(g.points):
            claim(p.id, "điểm ngữ pháp", g.path, g.line(i, "id"))

    order = {s: i for i, s in enumerate(ctx.stage_order)}
    sorted_units = sorted(
        units, key=lambda u: (order.get(u.unit.stage, 99), u.unit.order, u.unit.id)
    )

    lesson_ids: set[str] = set()
    taught: dict[str, str] = {}  # từ HSK -> id bài đã dạy
    learned_words: set[str] = set()
    learned_chars: set[str] = set()

    for lu in sorted_units:
        u = lu.unit
        claim(u.id, "chủ đề", lu.path, lu.line("id"))
        known_stage = u.stage == PRON_STAGE or u.stage in ctx.stage_levels
        if not known_stage:
            add(
                "error",
                "unknown_stage",
                f"lộ trình {u.stage!r} không có trong danh sách",
                lu.path,
                lu.line("stage"),
            )
        for li, lesson in enumerate(u.lessons):
            lesson_ids.add(lesson.id)
            claim(lesson.id, "bài", lu.path, lu.line("lessons", li, "id"))
            for si, s in enumerate(lesson.sentences):
                claim(s.id, "câu", lu.path, lu.line("lessons", li, "sentences", si, "id"))
            if known_stage:
                _check_lesson(lu, li, lesson, ctx, add, taught, learned_words, learned_chars)

    for pid in sorted(ctx.published_lesson_ids):
        if pid not in lesson_ids:
            add(
                "error",
                "published_lesson_missing",
                f"Bài đã phát hành {pid!r} không còn trong nội dung (bị xóa hoặc đổi id)",
            )
    return report


def _check_lesson(
    lu: LoadedUnit,
    li: int,
    lesson: LessonFile,
    ctx: Context,
    add: Callable[..., None],
    taught: dict[str, str],
    learned_words: set[str],
    learned_chars: set[str],
) -> None:
    u = lu.unit
    at = lambda *loc: lu.line("lessons", li, *loc)
    is_pron = u.stage == PRON_STAGE
    level = ctx.stage_levels.get(u.stage)
    err = lambda code, msg, *loc: add("error", code, msg, lu.path, at(*loc))
    warn = lambda code, msg, *loc: add("warning", code, msg, lu.path, at(*loc))

    if lesson.grammar and lesson.grammar not in ctx.grammar_ids:
        err(
            "unknown_grammar",
            f"Bài {lesson.id}: ngữ pháp {lesson.grammar!r} không tồn tại",
            "grammar",
        )

    # --- từ mới
    lesson_words = [w.word for w in lesson.new_words]
    if level is not None:
        for j, w in enumerate(lesson.new_words):
            if w.extra:
                continue
            if w.word not in ctx.hsk_words.get(level, set()):
                err(
                    "word_not_in_hsk",
                    f"Từ {w.word!r} không có trong danh sách HSK {level}; nếu cố ý thì thêm `extra: true`",
                    "new_words",
                    j,
                )
            if w.word in taught:
                err(
                    "word_taught_twice",
                    f"Từ {w.word!r} đã là từ mới ở bài {taught[w.word]}",
                    "new_words",
                    j,
                )
            else:
                taught[w.word] = lesson.id

    new_chars = [c for c in dict.fromkeys(_han_chars(lesson_words)) if c not in learned_chars]
    learned_words.update(lesson_words)
    learned_chars.update(_han_chars(lesson_words))
    chars_needing_writing = [c for c in new_chars if c in ctx.stroke_chars]

    if lesson.type == "checkpoint":
        if lesson.steps is not None:
            err(
                "checkpoint_has_steps",
                f"Bài ôn tập {lesson.id} không khai báo steps (máy tự sinh lúc chạy)",
                "steps",
            )
        return

    if lesson.steps is None:
        if is_pron:
            err("pron_steps_required", f"Bài Phát âm {lesson.id} phải khai báo steps", "id")
        elif not lesson.new_words or not lesson.sentences:
            err(
                "default_layout_incomplete",
                f"Bài {lesson.id} dùng bố cục mặc định nên cần ít nhất một từ mới và một câu",
                "id",
            )
        _sentence_warnings(lu, li, lesson, ctx, add, learned_words)
        return

    steps = lesson.steps
    sentence_ids = {s.id for s in lesson.sentences}

    exercise_count = 0
    speaking_count = 0
    cards = 0
    has_intro = has_writing = has_grammar_step = False

    for k, step in enumerate(steps):
        if isinstance(step, IntroStepFile):
            has_intro = True
            for m, w in enumerate(step.intro):
                if w not in lesson_words:
                    err(
                        "intro_not_new",
                        f"intro có {w!r} nhưng đó không phải từ mới của bài {lesson.id}",
                        "steps",
                        k,
                        "intro",
                        m,
                    )
        elif isinstance(step, WritingStepFile):
            has_writing = True
            if step.writing != "auto" and not is_pron:
                for m, c in enumerate(step.writing):
                    if c not in learned_chars:
                        err(
                            "unknown_word_ref",
                            f"Chữ {c!r} trong writing chưa học đến bài này",
                            "steps",
                            k,
                            "writing",
                            m,
                        )
            if is_pron and u.order != WRITING_UNIT_ORDER:
                err(
                    "writing_outside_unit_8",
                    f"Bài Phát âm {lesson.id}: luyện viết chỉ có ở chủ đề {WRITING_UNIT_ORDER}",
                    "steps",
                    k,
                )
        elif isinstance(step, GrammarStepFile):
            has_grammar_step = True
            if step.grammar != "auto" and step.grammar not in ctx.grammar_ids:
                err(
                    "unknown_grammar",
                    f"Ngữ pháp {step.grammar!r} không tồn tại",
                    "steps",
                    k,
                    "grammar",
                )
        elif isinstance(step, ExercisesStepFile):
            for m, item in enumerate(step.exercises):
                exercise_count += item.count or 1 if item.type == "auto" else 1
                if item.sentence is not None and item.sentence not in sentence_ids:
                    err(
                        "unknown_sentence",
                        f"Câu {item.sentence!r} không có trong sentences của bài {lesson.id}",
                        "steps",
                        k,
                        "exercises",
                        m,
                    )
                if (
                    item.target
                    and not is_pron
                    and item.target not in learned_words
                    and item.target not in learned_chars
                ):
                    err(
                        "unknown_word_ref",
                        f"{item.target!r} chưa được học đến bài {lesson.id}",
                        "steps",
                        k,
                        "exercises",
                        m,
                    )
                if is_pron and item.type == "write_char" and u.order != WRITING_UNIT_ORDER:
                    err(
                        "writing_outside_unit_8",
                        f"Bài Phát âm {lesson.id}: write_char chỉ có ở chủ đề {WRITING_UNIT_ORDER}",
                        "steps",
                        k,
                        "exercises",
                        m,
                    )
        elif isinstance(step, SpeakingStepFile):
            speaking_count += len(step.speaking)
            for m, item in enumerate(step.speaking):
                if item.mode == "sentence" and item.ref not in sentence_ids:
                    err(
                        "unknown_sentence",
                        f"Câu {item.ref!r} không có trong sentences của bài {lesson.id}",
                        "steps",
                        k,
                        "speaking",
                        m,
                    )
                if item.mode == "word" and not is_pron and item.ref not in learned_words:
                    err(
                        "unknown_word_ref",
                        f"Từ {item.ref!r} chưa được học đến bài {lesson.id}",
                        "steps",
                        k,
                        "speaking",
                        m,
                    )
        elif isinstance(step, SoundIntroStepFile):
            cards += len(step.sound_intro)
            if ctx.sound_ids is not None:
                for m, sid in enumerate(step.sound_intro):
                    if sid not in ctx.sound_ids:
                        err(
                            "unknown_sound",
                            f"Âm {sid!r} không có trong pron/sounds.yaml",
                            "steps",
                            k,
                            "sound_intro",
                            m,
                        )
        elif isinstance(step, ToneContourIntroStepFile):
            cards += len(step.tone_contour_intro)

    if exercise_count < MIN_EXERCISES:
        err(
            "too_few_exercises",
            f"Bài {lesson.id} có {exercise_count} bài tập, cần ít nhất {MIN_EXERCISES} (tính cả auto)",
            "steps",
        )
    if is_pron:
        if cards == 0:
            err(
                "missing_pron_cards",
                f"Bài Phát âm {lesson.id} cần 1–{MAX_PRON_CARDS} thẻ sound_intro/tone_contour_intro",
                "steps",
            )
        elif cards > MAX_PRON_CARDS:
            err(
                "too_many_pron_cards",
                f"Bài Phát âm {lesson.id} có {cards} thẻ giới thiệu, tối đa {MAX_PRON_CARDS}",
                "steps",
            )
        if speaking_count < MIN_SPEAKING_PRON:
            err(
                "too_few_speaking",
                f"Bài Phát âm {lesson.id} có {speaking_count} mục nói, cần ít nhất {MIN_SPEAKING_PRON}",
                "steps",
            )
        if u.order == WRITING_UNIT_ORDER and not has_writing:
            err(
                "missing_writing",
                f"Bài {lesson.id} ở chủ đề {WRITING_UNIT_ORDER} cần bước writing",
                "steps",
            )
        return

    if speaking_count < MIN_SPEAKING:
        err(
            "too_few_speaking",
            f"Bài {lesson.id} có {speaking_count} mục nói, cần ít nhất {MIN_SPEAKING}",
            "steps",
        )
    if lesson.new_words and not has_intro:
        err("missing_intro", f"Bài {lesson.id} có từ mới nhưng thiếu bước intro", "steps")
    if chars_needing_writing and not has_writing:
        err(
            "missing_writing",
            f"Bài {lesson.id} có chữ mới {''.join(chars_needing_writing)} nhưng thiếu bước writing",
            "steps",
        )
    if has_intro:
        introduced = {w for s in steps if isinstance(s, IntroStepFile) for w in s.intro}
        for j, w in enumerate(lesson.new_words):
            if w.word not in introduced:
                warn(
                    "word_not_introduced",
                    f"Từ mới {w.word!r} của bài {lesson.id} chưa có trong intro",
                    "new_words",
                    j,
                )
    if lesson.grammar and not has_grammar_step:
        warn(
            "grammar_step_missing",
            f"Bài {lesson.id} có grammar {lesson.grammar} nhưng steps không có bước grammar",
            "grammar",
        )
    _sentence_warnings(lu, li, lesson, ctx, add, learned_words)


def _sentence_warnings(
    lu: LoadedUnit,
    li: int,
    lesson: LessonFile,
    ctx: Context,
    add: Callable[..., None],
    learned_words: set[str],
) -> None:
    if ctx.tokenize is None or lu.unit.stage == PRON_STAGE:
        return
    for si, s in enumerate(lesson.sentences):
        tokens = [t for t in ctx.tokenize(s.zh) if HAN.search(t)]
        unlearned = [t for t in dict.fromkeys(tokens) if t not in learned_words]
        if unlearned:
            add(
                "warning",
                "sentence_unlearned_word",
                f"Câu {s.id} (bài {lesson.id}) dùng từ chưa học: {', '.join(unlearned)}",
                lu.path,
                lu.line("lessons", li, "sentences", si, "zh"),
            )


__all__: list[Any] = ["Context", "Finding", "Report", "validate_content"]
