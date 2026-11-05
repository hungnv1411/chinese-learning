"""02-5. `plan_units`: AI chia từ và ngữ pháp HSK của một cấp thành chủ đề -> content/<lộ trình>/_plan.yaml.
Máy kiểm tra phủ đủ 100% và không gán trùng; lệch thì gửi lại model kèm danh sách lỗi (tối đa 2 lần)."""

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Annotated, Any

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from clp.authoring.llm import JsonModel
from clp.content.authoring import PlanUnit

UNIT_WORDS_RANGE = (8, 60)  # gợi ý; ngoài khoảng chỉ cảnh báo
WORDS_PER_LESSON = 6
MAX_REPAIRS = 2
PLAN_MAX_TOKENS = 64000

PLAN_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "units": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "words": {"type": "array", "items": {"type": "string"}},
                    "grammar": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["title", "description", "words", "grammar"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["units"],
    "additionalProperties": False,
}

# curriculum-structure §3: gợi ý chủ đề cho HSK 1
HSK1_TOPIC_HINTS = (
    "số đếm, đại từ, chào hỏi, gia đình, quốc tịch và ngôn ngữ, thời gian và ngày tháng, ăn uống, "
    "mua sắm và tiền, nơi chốn và phương hướng, trường học và công việc, sở thích, thời tiết, "
    "đi lại, sức khỏe, hẹn gặp"
)


class PlanError(Exception):
    def __init__(self, message: str, errors: list[str] | None = None):
        self.errors = errors or []
        super().__init__(message + ("\n" + "\n".join(self.errors) if self.errors else ""))


@dataclass(frozen=True)
class WordItem:
    word: str
    pinyin: str  # nhiều cách đọc nối bằng "/"
    gloss: str


@dataclass(frozen=True)
class GrammarItem:
    code: str
    name: str


@dataclass(frozen=True)
class StageInputs:
    stage: str
    level: int
    words: list[WordItem]
    grammar: list[GrammarItem]


class _UnitOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Annotated[str, Field(min_length=1)]
    description: str
    words: list[str]
    grammar: list[str]


class _PlanOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    units: list[_UnitOut]


@dataclass
class PlanResult:
    units: list[PlanUnit]
    attempts: int
    warnings: list[str] = field(default_factory=list)
    prompt_sha256: str = ""


def load_stage_inputs(conn, stage: str, level: int) -> StageInputs:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT w.simplified, w.pinyin, d.definitions[1] FROM hsk_word w"
            " LEFT JOIN dict_entry d ON d.id = w.dict_entry_id"
            " WHERE w.level = %s AND NOT w.deprecated ORDER BY w.id",
            (level,),
        )
        grouped: dict[str, tuple[list[str], str]] = {}
        for word, pinyin, definition in cur.fetchall():
            pinyins, gloss = grouped.setdefault(word, ([], ""))
            if pinyin not in pinyins:
                pinyins.append(pinyin)
            if not gloss and definition:
                gloss = definition.split(";")[0].split("(")[0].strip()[:40]
            grouped[word] = (pinyins, gloss)
        cur.execute(
            "SELECT code, name_zh FROM hsk_grammar WHERE level = %s ORDER BY code", (level,)
        )
        grammar = [GrammarItem(c, n) for c, n in cur.fetchall()]
    words = [WordItem(w, "/".join(p), g) for w, (p, g) in grouped.items()]
    return StageInputs(stage=stage, level=level, words=words, grammar=grammar)


def build_prompt(inputs: StageInputs) -> tuple[str, str]:
    hints = (
        f"\nGợi ý chủ đề cho HSK 1 (không bắt buộc, sắp theo nhu cầu giao tiếp): {HSK1_TOPIC_HINTS}."
        if inputs.level == 1
        else ""
    )
    system = f"""Bạn là người thiết kế giáo trình tiếng Trung cho người Việt tự học từ con số 0. \
Nhiệm vụ: chia toàn bộ từ vựng và điểm ngữ pháp của một cấp HSK 2021 thành các chủ đề học.

Quy tắc:
- Mỗi từ trong danh sách phải được gán vào đúng một chủ đề: không bỏ sót, không gán hai lần, không thêm từ ngoài danh sách. Chép từ đúng từng ký tự như trong danh sách.
- Mỗi điểm ngữ pháp (theo mã) cũng gán vào đúng một chủ đề, nơi các từ của chủ đề dùng được điểm ngữ pháp đó.
- Sắp chủ đề theo nhu cầu giao tiếp, từ dễ và cơ bản đến khó hơn; không theo thứ tự trong danh sách HSK. Từ cùng nhóm nghĩa hoặc cùng tình huống đi cùng nhau.
- Mỗi chủ đề có khoảng {UNIT_WORDS_RANGE[0] * 3}–{UNIT_WORDS_RANGE[0] * 5} từ (mỗi bài khoảng {WORDS_PER_LESSON} từ mới, mỗi chủ đề 4–6 bài); không bao giờ để chủ đề không có từ nào.
- Tên chủ đề ngắn, tiếng Việt; mô tả một câu tiếng Việt nói người học sẽ làm được gì.{hints}
- Chỉ trả về JSON đúng schema."""
    words = "\n".join(f"{w.word} | {w.pinyin} | {w.gloss}" for w in inputs.words)
    grammar = "\n".join(f"{g.code} | {g.name}" for g in inputs.grammar)
    user = f"""Cấp: HSK {inputs.level} ({inputs.stage}).

Danh sách {len(inputs.words)} từ (từ | pinyin | nghĩa tiếng Anh):
{words}

Danh sách {len(inputs.grammar)} điểm ngữ pháp (mã | tên):
{grammar}

Hãy chia thành các chủ đề theo quy tắc."""
    return system, user


def validate_plan(raw: Any, inputs: StageInputs) -> tuple[list[str], list[str]]:
    """Trả (lỗi chặn, cảnh báo). Kiểm tra phủ đủ 100% và không gán trùng, cả từ lẫn ngữ pháp."""
    try:
        plan = _PlanOut.model_validate(raw)
    except ValidationError as e:
        return [f"Đầu ra sai cấu trúc: {err['loc']}: {err['msg']}" for err in e.errors()[:5]], []
    errors: list[str] = []
    warnings: list[str] = []
    if not plan.units:
        return ["Kế hoạch không có chủ đề nào"], []

    titles: dict[str, int] = {}
    for i, u in enumerate(plan.units, 1):
        if not u.words:
            errors.append(f"Chủ đề {i} ({u.title!r}) không có từ nào")
        elif not UNIT_WORDS_RANGE[0] <= len(u.words) <= UNIT_WORDS_RANGE[1]:
            warnings.append(
                f"Chủ đề {i} ({u.title!r}) có {len(u.words)} từ, ngoài khoảng gợi ý "
                f"{UNIT_WORDS_RANGE[0]}–{UNIT_WORDS_RANGE[1]}"
            )
        if u.title in titles:
            errors.append(f"Hai chủ đề trùng tên {u.title!r} (thứ {titles[u.title]} và {i})")
        titles.setdefault(u.title, i)

    def check(kind: str, expected: list[str], given: list[list[str]], label: str) -> None:
        known = set(expected)
        where: dict[str, list[int]] = {}
        for i, items in enumerate(given, 1):
            for item in items:
                where.setdefault(item, []).append(i)
        missing = [x for x in expected if x not in where]
        dup = {x: ix for x, ix in where.items() if len(ix) > 1}
        unknown = [x for x in where if x not in known]
        if missing:
            errors.append(
                f"Thiếu {len(missing)} {kind} chưa gán vào chủ đề nào: {', '.join(missing[:60])}"
            )
        if dup:
            shown = "; ".join(
                f"{x} (chủ đề {', '.join(map(str, ix))})" for x, ix in list(dup.items())[:30]
            )
            errors.append(f"{len(dup)} {kind} bị gán nhiều lần: {shown}")
        if unknown:
            errors.append(
                f"{len(unknown)} {kind} không có trong danh sách {label}: {', '.join(unknown[:30])}"
            )

    check(
        "từ", [w.word for w in inputs.words], [u.words for u in plan.units], f"HSK {inputs.level}"
    )
    check(
        "điểm ngữ pháp",
        [g.code for g in inputs.grammar],
        [u.grammar for u in plan.units],
        f"ngữ pháp HSK {inputs.level}",
    )
    return errors, warnings


def _repair_prompt(user: str, previous: Any, errors: list[str]) -> str:
    return (
        f"{user}\n\nKế hoạch bạn trả lần trước có lỗi:\n"
        + "\n".join(f"- {e}" for e in errors)
        + "\n\nKế hoạch lần trước:\n"
        + json.dumps(previous, ensure_ascii=False, indent=1)
        + "\n\nHãy trả lại kế hoạch đầy đủ đã sửa hết các lỗi trên (giữ phần đúng, chỉ chuyển/bổ sung/bỏ các mục lỗi)."
    )


def plan_stage(
    llm: JsonModel,
    inputs: StageInputs,
    *,
    author_model: str,
    effort: str = "high",
    max_repairs: int = MAX_REPAIRS,
    max_tokens: int = PLAN_MAX_TOKENS,
) -> PlanResult:
    system, user = build_prompt(inputs)
    digest = hashlib.sha256(f"{system}\n{user}".encode()).hexdigest()
    prompt = user
    errors: list[str] = []
    for attempt in range(1, max_repairs + 2):
        raw = llm.generate(
            system=system,
            user=prompt,
            schema=PLAN_SCHEMA,
            model=author_model,
            effort=effort,
            max_tokens=max_tokens,
        )
        errors, warnings = validate_plan(raw, inputs)
        if not errors:
            units = [
                PlanUnit(
                    id=f"{inputs.stage}-u{i:02d}",
                    order=i,
                    title=u["title"].strip(),
                    description=u["description"].strip(),
                    words=u["words"],
                    grammar=u["grammar"],
                )
                for i, u in enumerate(raw["units"], 1)
            ]
            return PlanResult(units, attempt, warnings, digest)
        prompt = _repair_prompt(user, raw, errors)
    raise PlanError(f"Kế hoạch {inputs.stage} vẫn lệch sau {max_repairs} lần sửa", errors)


def write_plan(
    content_dir: Path,
    result: PlanResult,
    inputs: StageInputs,
    *,
    model: str,
    now: str,
    force: bool = False,
) -> tuple[Path, Path]:
    """Ghi `_plan.yaml` và `_meta/_plan.json`. Không ghi đè khi chủ đề đã được soạn (có file u*.yaml)."""
    stage_dir = content_dir / inputs.stage
    existing = sorted(stage_dir.glob("u*.yaml"))
    if existing and not force:
        raise PlanError(
            f"{inputs.stage} đã có file chủ đề ({existing[0].name}…); chia lại sẽ làm lệch bài đã soạn. "
            "Dùng --force nếu thật sự muốn."
        )
    stage_dir.mkdir(parents=True, exist_ok=True)
    (stage_dir / "_meta").mkdir(exist_ok=True)
    plan_path = stage_dir / "_plan.yaml"
    body = yaml.safe_dump(
        {
            "units": [
                {
                    "id": u.id,
                    "order": u.order,
                    "title": u.title,
                    "description": u.description,
                    "words": u.words,
                    "grammar": u.grammar,
                }
                for u in result.units
            ]
        },
        allow_unicode=True,
        sort_keys=False,
        width=100,
        default_flow_style=None,
    )
    plan_path.write_text(
        "# Sinh bằng `clp plan-units` (02-5). Có thể chỉnh tay có chủ ý trước khi soạn từng chủ đề;\n"
        "# chạy `clp check-content` sau khi sửa.\n" + body,
        encoding="utf-8",
    )
    meta_path = stage_dir / "_meta" / "_plan.json"
    meta_path.write_text(
        json.dumps(
            {
                "script": "plan_units/1",
                "model": model,
                "attempts": result.attempts,
                "generated_at": now,
                "prompt_sha256": result.prompt_sha256,
                "words": len(inputs.words),
                "grammar": len(inputs.grammar),
                "units": len(result.units),
                "warnings": result.warnings,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return plan_path, meta_path
