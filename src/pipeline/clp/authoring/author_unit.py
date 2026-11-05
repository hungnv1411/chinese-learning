"""02-6. `author_unit`: AI soạn một chủ đề (YAML theo content-format) từ kế hoạch `_plan.yaml`, rà soát bằng
model khác, máy kiểm tra, tối đa 2 vòng sửa. Hán Việt chỉ lấy từ Unihan/overrides; AI chỉ đề xuất âm cho chữ
còn thiếu và script ghi vào overrides/han_viet.yaml với source: ai."""

import hashlib
import json
import re
import shutil
import tempfile
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Annotated, Any

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from clp.authoring.config import AuthoringConfig
from clp.authoring.llm import JsonModel
from clp.authoring.review_unit import ReviewIssue, review_unit
from clp.content.authoring import PlanUnit, StageEntry
from clp.content.check import Loaded, check_content
from clp.content.coverage import LEVEL_CHARS
from clp.content.rules import Finding

AUTHOR_MAX_TOKENS = 64000
MAX_ROUNDS = 2  # số lần sửa tối đa sau lượt soạn đầu
MAX_WORDS_PER_LESSON = 10
MAX_CANDIDATE_SENTENCES = 60
SCRIPT_VERSION = "author_unit/1"

AUTHOR_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "lessons": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "grammar": {"type": "string"},
                    "words": {"type": "array", "items": {"type": "string"}},
                    "sentences": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "zh": {"type": "string"},
                                "en": {"type": "string"},
                                "pinyin": {"type": "string"},
                                "tatoeba_id": {"type": "integer"},
                            },
                            "required": ["zh", "en", "pinyin", "tatoeba_id"],
                            "additionalProperties": False,
                        },
                    },
                    "tips": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {"word": {"type": "string"}, "tip": {"type": "string"}},
                            "required": ["word", "tip"],
                            "additionalProperties": False,
                        },
                    },
                },
                "required": ["title", "grammar", "words", "sentences", "tips"],
                "additionalProperties": False,
            },
        },
        "grammar_points": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "code": {"type": "string"},
                    "title": {"type": "string"},
                    "explanation_vi": {"type": "string"},
                    "pattern": {"type": "string"},
                    "examples": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {"zh": {"type": "string"}, "en": {"type": "string"}},
                            "required": ["zh", "en"],
                            "additionalProperties": False,
                        },
                    },
                },
                "required": ["code", "title", "explanation_vi", "pattern", "examples"],
                "additionalProperties": False,
            },
        },
        "han_viet_proposals": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "char": {"type": "string"},
                    "han_viet": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["char", "han_viet"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["lessons", "grammar_points", "han_viet_proposals"],
    "additionalProperties": False,
}


class AuthoringError(Exception):
    pass


# ---- đầu vào ---------------------------------------------------------------------------------


@dataclass(frozen=True)
class CharInfo:
    char: str
    han_viet: list[str]
    radical: str | None
    decomposition: str | None


@dataclass(frozen=True)
class WordInfo:
    word: str
    pinyin: str
    pos: str | None
    definitions: list[str]
    chars: list[CharInfo]


@dataclass(frozen=True)
class CandidateSentence:
    tatoeba_id: int
    zh: str
    pinyin: str
    en: str


@dataclass(frozen=True)
class GrammarInfo:
    code: str  # hsk30-gNNN
    name: str
    id: str  # hsk1-gNNN (id điểm ngữ pháp tự soạn)
    hsk_code: str  # 一级-语法-NNN


@dataclass(frozen=True)
class UnitInputs:
    stage: str
    level: int
    unit: PlanUnit
    words: list[WordInfo]
    learned_words: list[str]
    grammar: list[GrammarInfo]
    sentences: list[CandidateSentence]
    missing_han_viet: list[str]


def _is_han(c: str) -> bool:
    return "\u4e00" <= c <= "\u9fff"


def load_unit_inputs(
    conn,
    loaded: Loaded,
    stage: StageEntry,
    unit: PlanUnit,
    overrides: dict[str, Any] | None = None,
) -> UnitInputs:
    assert stage.level is not None
    overrides = overrides or {}
    level = stage.level
    with conn.cursor() as cur:
        cur.execute(
            "SELECT w.simplified, w.pinyin, w.pos, d.definitions FROM hsk_word w"
            " LEFT JOIN dict_entry d ON d.id = w.dict_entry_id"
            " WHERE w.level = %s AND w.simplified = ANY(%s) AND NOT w.deprecated ORDER BY w.id",
            (level, unit.words),
        )
        info: dict[str, tuple[list[str], str | None, list[str]]] = {}
        for word, pinyin, pos, defs in cur.fetchall():
            pinyins, _pos, d = info.setdefault(word, ([], pos, []))
            if pinyin not in pinyins:
                pinyins.append(pinyin)
            if not d and defs:
                d.extend(defs[:3])
        chars = sorted({c for w in unit.words for c in w if _is_han(c)})
        cur.execute(
            "SELECT h.char, h.han_viet, h.decomposition, r.name_vi FROM hanzi h"
            " LEFT JOIN radical_vi r ON r.radical = h.radical WHERE h.char = ANY(%s)",
            (chars,),
        )
        hanzi = {c: (hv, dec, rad) for c, hv, dec, rad in cur.fetchall()}
        cur.execute(
            "SELECT code, name_zh FROM hsk_grammar WHERE level = %s ORDER BY code", (level,)
        )
        level_grammar = cur.fetchall()
    codes = [c for c, _n in level_grammar]

    def char_info(c: str) -> CharInfo:
        hv, dec, rad = hanzi.get(c, ([], None, None))
        hv = list(hv) or list(overrides.get(c, {}).get("han_viet", []))
        return CharInfo(c, hv, rad, dec)

    words = [
        WordInfo(
            w, "/".join(info[w][0]), info[w][1], info[w][2], [char_info(c) for c in w if _is_han(c)]
        )
        for w in unit.words
        if w in info
    ]
    missing = [c for c in chars if not char_info(c).han_viet]

    grammar = []
    names = dict(level_grammar)
    for code in unit.grammar:
        index = codes.index(code) + 1
        grammar.append(
            GrammarInfo(
                code,
                names[code],
                f"{stage.id}-g{index:03d}",
                f"{LEVEL_CHARS[level - 1]}级-语法-{index:03d}",
            )
        )

    learned = _learned_words(loaded, stage, unit)
    sentences = _candidate_sentences(conn, level, unit.words, set(learned) | set(unit.words))
    return UnitInputs(stage.id, level, unit, words, learned, grammar, sentences, missing)


def _learned_words(loaded: Loaded, stage: StageEntry, unit: PlanUnit) -> list[str]:
    order = {s: i for i, s in enumerate(loaded.stage_order)}
    here = (order[stage.id], unit.order)
    seen: dict[str, None] = {}
    entries: list[tuple[tuple[int, int], list[str]]] = [
        ((order.get(s, 99), p.order), p.words) for s, _f, p in loaded.plan_units
    ] + [
        (
            (order.get(lu.unit.stage, 99), lu.unit.order),
            [w.word for lesson in lu.unit.lessons for w in lesson.new_words],
        )
        for lu in loaded.units
    ]
    for key, words in sorted(entries, key=lambda e: e[0]):
        if key < here:
            seen.update(dict.fromkeys(words))
    return list(seen)


def _candidate_sentences(
    conn, level: int, unit_words: list[str], allowed: set[str]
) -> list[CandidateSentence]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT s.id, s.source_ref, s.zh, s.pinyin, s.en FROM sentence s"
            " WHERE s.source = 'tatoeba' AND s.max_hsk_level <= %s AND s.id IN ("
            "   SELECT sw.sentence_id FROM sentence_word sw JOIN dict_entry d ON d.id = sw.dict_entry_id"
            "   WHERE d.simplified = ANY(%s)) ORDER BY char_length(s.zh), s.id LIMIT 600",
            (level, unit_words),
        )
        rows = cur.fetchall()
        ids = [r[0] for r in rows]
        cur.execute(
            "SELECT sw.sentence_id, d.simplified FROM sentence_word sw JOIN dict_entry d ON d.id = sw.dict_entry_id"
            " WHERE sw.sentence_id = ANY(%s) AND d.hsk_level IS NOT NULL",
            (ids,),
        )
        used: dict[int, set[str]] = {}
        for sid, simplified in cur.fetchall():
            used.setdefault(sid, set()).add(simplified)
    ok = [r for r in rows if used.get(r[0], set()) <= allowed]
    return [
        CandidateSentence(int(ref), zh, py, en)
        for _id, ref, zh, py, en in ok[:MAX_CANDIDATE_SENTENCES]
    ]


# ---- prompt ----------------------------------------------------------------------------------

SYSTEM = f"""Bạn là biên soạn viên giáo trình tiếng Trung cho người Việt tự học từ con số 0, viết nội dung \
chính xác và gần gũi. Nhiệm vụ: soạn nội dung một chủ đề theo kế hoạch cho sẵn.

Cách chia bài:
- Chia các từ của chủ đề thành các bài, khoảng 6 từ mỗi bài (tối đa {MAX_WORDS_PER_LESSON}), từ liên quan đi cùng nhau. \
Mỗi từ trong danh sách xuất hiện đúng một lần trong đúng một bài; không thêm từ ngoài danh sách; chép từ chính xác từng ký tự.
- Mỗi điểm ngữ pháp của chủ đề gán vào đúng một bài (điền mã vào `grammar`, bài không có thì để chuỗi rỗng).
- Mỗi bài có 1–4 câu ví dụ. Ưu tiên chọn câu Tatoeba có sẵn trong danh sách ứng viên: điền `tatoeba_id` của câu, \
các trường zh/en/pinyin của câu đó sẽ được lấy nguyên văn từ dữ liệu (cứ điền gần đúng). \
Cần câu riêng thì tự soạn, để `tatoeba_id` = 0 và ghi đủ zh, en, pinyin có dấu thanh.
- Câu chỉ được dùng từ mới của chủ đề và các từ đã học; ngắn, tự nhiên, người bản xứ thật sự nói.

Nội dung viết cho người Việt (phần làm nên khác biệt của sản phẩm):
- Mỗi bài có tối đa vài mẹo (`tips`, mỗi mẹo ≤ 300 ký tự, tiếng Việt): mẹo phát âm so với tiếng Việt \
(zh/ch/sh, ü, r, thanh 3 so với dấu hỏi…), mẹo nhớ chữ dựa vào bộ thủ và cấu tạo chữ, và lỗi người Việt hay mắc \
(ví dụ dùng 是 với tính từ: ~~我是忙~~ → 我很忙). Mẹo gắn với một từ của bài.
- Giải thích ngữ pháp (`explanation_vi`) bằng tiếng Việt, đúng, dễ hiểu, không quá 3–4 câu (≤ 800 ký tự), kèm cấu trúc và 2–3 ví dụ.
- Ghi chú biến điệu (3+3, 不, 一) đúng chỗ khi cần.

Quy tắc về Hán Việt (bắt buộc): KHÔNG tự viết âm Hán Việt. Chỉ được nhắc tới âm Hán Việt có trong dữ liệu đề bài, \
và chỉ theo đúng mẫu "<chữ Hán> có âm Hán Việt là <âm>". Chữ thiếu âm Hán Việt trong dữ liệu: đề xuất âm ở \
`han_viet_proposals` (chỉ cho chữ trong danh sách "chữ thiếu"), không nhắc tới trong mẹo hay giải thích.

Không có nội dung nhạy cảm (chính trị, tôn giáo, bạo lực). Chỉ trả JSON đúng schema."""


def build_author_prompt(
    inputs: UnitInputs, previous: Any = None, feedback: list[str] | None = None
) -> tuple[str, str]:
    lines = []
    for w in inputs.words:
        chars = "; ".join(
            f"{c.char}: Hán Việt {', '.join(c.han_viet) or '(thiếu)'}"
            + (f", bộ {c.radical}" if c.radical else "")
            + (f", cấu tạo {c.decomposition}" if c.decomposition else "")
            for c in w.chars
        )
        lines.append(
            f"- {w.word} | {w.pinyin} | {'; '.join(w.definitions)} | {w.pos or ''} | {chars}"
        )
    grammar = "\n".join(f"- {g.code} | {g.name}" for g in inputs.grammar) or "(không có)"
    sentences = (
        "\n".join(
            f"- tatoeba_id {s.tatoeba_id}: {s.zh} | {s.pinyin} | {s.en}" for s in inputs.sentences
        )
        or "(không có câu phù hợp, hãy tự soạn)"
    )
    user = f"""Chủ đề: {inputs.unit.id} — {inputs.unit.title} (HSK {inputs.level}). {inputs.unit.description}

Từ của chủ đề, {len(inputs.words)} từ (từ | pinyin | nghĩa CC-CEDICT | từ loại | chữ):
{chr(10).join(lines)}

Chữ thiếu âm Hán Việt (được đề xuất ở han_viet_proposals): {", ".join(inputs.missing_han_viet) or "(không có)"}

Điểm ngữ pháp của chủ đề (mã | tên):
{grammar}

Từ đã học trước chủ đề: {", ".join(inputs.learned_words) or "(chưa có)"}

Câu Tatoeba ứng viên (đã lọc đúng cấp và chỉ dùng từ đã học hoặc từ của chủ đề):
{sentences}"""
    if feedback:
        user += (
            "\n\nBản bạn soạn lần trước có vấn đề:\n"
            + "\n".join(f"- {f}" for f in feedback)
            + "\n\nBản lần trước:\n"
            + json.dumps(previous, ensure_ascii=False, indent=1)
            + "\n\nHãy trả lại bản đầy đủ đã sửa các vấn đề trên, giữ nguyên phần đã đúng."
        )
    return SYSTEM, user


# ---- kiểm tra đầu ra của AI ------------------------------------------------------------------


class _Sentence(BaseModel):
    model_config = ConfigDict(extra="forbid")
    zh: str
    en: str
    pinyin: str
    tatoeba_id: int


class _Tip(BaseModel):
    model_config = ConfigDict(extra="forbid")
    word: str
    tip: str


class _Lesson(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Annotated[str, Field(min_length=1)]
    grammar: str
    words: list[str]
    sentences: list[_Sentence]
    tips: list[_Tip]


class _Example(BaseModel):
    model_config = ConfigDict(extra="forbid")
    zh: str
    en: str


class _GrammarPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str
    title: Annotated[str, Field(min_length=1)]
    explanation_vi: Annotated[str, Field(min_length=1)]
    pattern: Annotated[str, Field(min_length=1)]
    examples: list[_Example]


class _Proposal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    char: str
    han_viet: list[str]


class AuthorOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lessons: list[_Lesson]
    grammar_points: list[_GrammarPoint]
    han_viet_proposals: list[_Proposal]


def validate_author_output(raw: Any, inputs: UnitInputs) -> list[str]:
    try:
        out = AuthorOutput.model_validate(raw)
    except ValidationError as e:
        return [f"Đầu ra sai cấu trúc: {err['loc']}: {err['msg']}" for err in e.errors()[:5]]
    errors: list[str] = []
    if not out.lessons:
        return ["Chưa có bài nào"]

    wanted = [w.word for w in inputs.words]
    where: dict[str, list[int]] = {}
    for i, lesson in enumerate(out.lessons, 1):
        if not lesson.words:
            errors.append(f"Bài {i} ({lesson.title!r}) không có từ nào")
        if len(lesson.words) > MAX_WORDS_PER_LESSON:
            errors.append(f"Bài {i} có {len(lesson.words)} từ, tối đa {MAX_WORDS_PER_LESSON}")
        if not lesson.sentences:
            errors.append(f"Bài {i} ({lesson.title!r}) không có câu ví dụ nào")
        for w in lesson.words:
            where.setdefault(w, []).append(i)
        for t in lesson.tips:
            if t.word not in lesson.words:
                errors.append(f"Bài {i}: mẹo cho {t.word!r} nhưng đó không phải từ của bài")
    missing = [w for w in wanted if w not in where]
    dup = {w: ix for w, ix in where.items() if len(ix) > 1}
    unknown = [w for w in where if w not in set(wanted)]
    if missing:
        errors.append(f"Thiếu từ chưa gán vào bài nào: {', '.join(missing)}")
    if dup:
        errors.append(
            "Từ bị gán nhiều lần: "
            + "; ".join(f"{w} (bài {', '.join(map(str, ix))})" for w, ix in dup.items())
        )
    if unknown:
        errors.append(f"Từ không có trong danh sách của chủ đề: {', '.join(unknown)}")

    codes = [g.code for g in inputs.grammar]
    used = [lesson.grammar for lesson in out.lessons if lesson.grammar]
    for c in used:
        if c not in codes:
            errors.append(f"Mã ngữ pháp {c!r} không thuộc chủ đề")
    for c in codes:
        if used.count(c) != 1:
            errors.append(f"Điểm ngữ pháp {c} phải được gán vào đúng một bài, hiện {used.count(c)}")
    given = [p.code for p in out.grammar_points]
    for c in codes:
        if given.count(c) != 1:
            errors.append(f"Thiếu hoặc lặp phần giải thích cho điểm ngữ pháp {c}")
    for c in given:
        if c not in codes:
            errors.append(f"Giải thích cho mã ngữ pháp {c!r} không thuộc chủ đề")

    candidates = {s.tatoeba_id for s in inputs.sentences}
    for i, lesson in enumerate(out.lessons, 1):
        for s in lesson.sentences:
            if s.tatoeba_id and s.tatoeba_id not in candidates:
                errors.append(
                    f"Bài {i}: tatoeba_id {s.tatoeba_id} không nằm trong danh sách ứng viên"
                )
            if not s.tatoeba_id and not (s.zh.strip() and s.en.strip() and s.pinyin.strip()):
                errors.append(f"Bài {i}: câu tự soạn thiếu zh/en/pinyin")
    return errors


# ---- ghép YAML -------------------------------------------------------------------------------


def slugify(title: str) -> str:
    s = unicodedata.normalize("NFD", title.replace("đ", "d").replace("Đ", "D"))
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


@dataclass
class Assembled:
    unit_filename: str
    unit_text: str
    grammar_points: list[dict[str, Any]]
    han_viet: dict[str, dict[str, Any]]


def assemble_unit(inputs: UnitInputs, raw: dict[str, Any]) -> Assembled:
    out = AuthorOutput.model_validate(raw)
    unit = inputs.unit
    candidates = {s.tatoeba_id: s for s in inputs.sentences}
    grammar_by_code = {g.code: g for g in inputs.grammar}
    n = 0
    lessons: list[dict[str, Any]] = []
    for i, lesson in enumerate(out.lessons, 1):
        sentences = []
        for s in lesson.sentences:
            n += 1
            item: dict[str, Any] = {"id": f"s-{unit.id}-{n:03d}"}
            if s.tatoeba_id:
                c = candidates[s.tatoeba_id]
                item |= {"zh": c.zh, "en": c.en, "pinyin": c.pinyin, "tatoeba_id": c.tatoeba_id}
            else:
                item |= {"zh": s.zh.strip(), "en": s.en.strip(), "pinyin": s.pinyin.strip()}
            sentences.append(item)
        entry: dict[str, Any] = {"id": f"{unit.id}-l{i:02d}", "title": lesson.title.strip()}
        if lesson.grammar:
            entry["grammar"] = grammar_by_code[lesson.grammar].id
        entry["new_words"] = lesson.words
        entry["sentences"] = sentences
        if lesson.tips:
            entry["tips"] = {t.word: t.tip.strip() for t in lesson.tips}
        lessons.append(entry)
    lessons.append({"id": f"{unit.id}-cp", "type": "checkpoint", "title": "Ôn tập chủ đề"})
    doc = {
        "id": unit.id,
        "stage": inputs.stage,
        "order": unit.order,
        "title": unit.title,
        "description": unit.description,
        "lessons": lessons,
    }
    text = (
        f"# Sinh bằng `clp author-unit` ({SCRIPT_VERSION}); bản rà soát và máy kiểm tra xem _meta/{unit.id}.json.\n"
        + yaml.safe_dump(doc, allow_unicode=True, sort_keys=False, width=100)
    )
    points = []
    for p in out.grammar_points:
        g = grammar_by_code[p.code]
        points.append(
            {
                "id": g.id,
                "hsk_code": g.hsk_code,
                "title": p.title.strip(),
                "explanation_vi": p.explanation_vi.strip(),
                "pattern": p.pattern.strip(),
                "examples": [{"zh": e.zh, "en": e.en} for e in p.examples],
            }
        )
    allowed = set(inputs.missing_han_viet)
    proposals = {
        p.char: {"han_viet": [h.strip().lower() for h in p.han_viet if h.strip()], "source": "ai"}
        for p in out.han_viet_proposals
        if p.char in allowed and p.han_viet
    }
    return Assembled(f"u{unit.order:02d}-{slugify(unit.title)}.yaml", text, points, proposals)


# ---- vòng soạn → máy kiểm tra → rà soát ----------------------------------------------------


@dataclass
class AuthorResult:
    rounds: int
    unit_path: Path
    review_unresolved: list[ReviewIssue] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _merge_grammar(existing_path: Path, points: list[dict[str, Any]]) -> str:
    current: list[dict[str, Any]] = []
    if existing_path.exists():
        current = yaml.safe_load(existing_path.read_text(encoding="utf-8")) or []
    new_ids = {p["id"] for p in points}
    merged = [p for p in current if p["id"] not in new_ids] + points
    return yaml.safe_dump(merged, allow_unicode=True, sort_keys=False, width=100)


def _machine_check(
    conn, content_dir: Path, files: dict[Path, str]
) -> tuple[list[Finding], list[Finding]]:
    """Chạy toàn bộ quy tắc trên bản sao của content/ có thêm file ứng viên; chỉ giữ phát hiện thuộc file ứng viên."""
    with tempfile.TemporaryDirectory() as tmp:
        copy = Path(tmp) / "content"
        shutil.copytree(content_dir, copy, ignore=shutil.ignore_patterns("_meta"))
        for rel, text in files.items():
            (copy / rel).parent.mkdir(parents=True, exist_ok=True)
            (copy / rel).write_text(text, encoding="utf-8")
        report = check_content(conn, copy)
        conn.rollback()
    names = {rel.name for rel in files}
    mine = lambda fs: [f for f in fs if f.file is not None and f.file.name in names]
    return mine(report.errors), mine(report.warnings)


def _fmt(f: Finding) -> str:
    return f"{f.file.name if f.file else ''}:{f.line}: [{f.code}] {f.message}"


def author_unit_loop(
    conn,
    content_dir: Path,
    loaded: Loaded,
    stage: StageEntry,
    unit: PlanUnit,
    *,
    author_llm: JsonModel,
    review_llm: JsonModel,
    cfg: AuthoringConfig,
    now: str,
    max_rounds: int = MAX_ROUNDS,
    strict: bool = False,
    force: bool = False,
) -> AuthorResult:
    if cfg.author_model == cfg.review_model:
        raise AuthoringError(
            "Lượt rà soát phải dùng model khác lượt soạn (CLP_AUTHOR_MODEL ≠ CLP_REVIEW_MODEL)"
        )
    overrides_path = content_dir / "overrides" / "han_viet.yaml"
    overrides = (
        yaml.safe_load(overrides_path.read_text(encoding="utf-8"))
        if overrides_path.exists()
        else None
    ) or {}
    inputs = load_unit_inputs(conn, loaded, stage, unit, overrides)
    conn.rollback()
    unit_rel = Path(stage.id) / f"u{unit.order:02d}-{slugify(unit.title)}.yaml"
    if (content_dir / unit_rel).exists() and not force:
        raise AuthoringError(f"{unit_rel} đã có; dùng --force để soạn lại")

    previous: Any = None
    feedback: list[str] | None = None
    unresolved: list[ReviewIssue] = []
    prompts: list[str] = []
    warnings: list[Finding] = []
    for call in range(1, max_rounds + 2):
        system, user = build_author_prompt(inputs, previous, feedback)
        prompts.append(hashlib.sha256(f"{system}\n{user}".encode()).hexdigest())
        raw = author_llm.generate(
            system=system, user=user, schema=AUTHOR_SCHEMA, model=cfg.author_model,
            effort=cfg.effort, max_tokens=AUTHOR_MAX_TOKENS,
        )  # fmt: skip
        previous = raw
        last = call == max_rounds + 1

        problems = validate_author_output(raw, inputs)
        assembled = None
        if not problems:
            assembled = assemble_unit(inputs, raw)
            grammar_rel = Path("grammar") / f"{stage.id}.yaml"
            grammar_text = _merge_grammar(content_dir / grammar_rel, assembled.grammar_points)
            errors, warnings = _machine_check(
                conn, content_dir, {unit_rel: assembled.unit_text, grammar_rel: grammar_text}
            )
            problems = [_fmt(f) for f in errors]
        if problems:
            if last:
                raise AuthoringError(
                    f"{unit.id}: vẫn còn lỗi sau {max_rounds} lần sửa:\n" + "\n".join(problems)
                )
            feedback = problems
            continue

        assert assembled is not None
        review = review_unit(
            review_llm,
            model=cfg.review_model,
            effort=cfg.effort,
            inputs=inputs,
            unit_yaml=assembled.unit_text,
        )
        if review.errors and not last:
            feedback = [
                f"[{i.category}] {i.where}: {i.problem} → {i.suggestion}" for i in review.errors
            ]
            continue
        unresolved = review.errors
        break

    if unresolved and strict:
        raise AuthoringError(
            f"{unit.id}: còn {len(unresolved)} vấn đề rà soát chưa giải quyết (strict)"
        )

    assert assembled is not None
    _write(content_dir, stage, unit, unit_rel, grammar_rel, assembled, overrides, overrides_path)
    meta_path = content_dir / stage.id / "_meta" / f"{unit.id}.json"
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    meta_path.write_text(
        json.dumps(
            {
                "script": SCRIPT_VERSION,
                "author_model": cfg.author_model,
                "review_model": cfg.review_model,
                "effort": cfg.effort,
                "rounds": call,
                "generated_at": now,
                "prompt_sha256": prompts,
                "review_unresolved": [i.__dict__ for i in unresolved],
                "review_warnings": [i.__dict__ for i in review.issues if i.severity == "warning"],
                "machine_warnings": [_fmt(f) for f in warnings],
                "han_viet_proposed": sorted(assembled.han_viet),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return AuthorResult(call, content_dir / unit_rel, unresolved, [_fmt(f) for f in warnings])


def _write(
    content_dir, stage, unit, unit_rel, grammar_rel, assembled, overrides, overrides_path
) -> None:
    (content_dir / unit_rel).parent.mkdir(parents=True, exist_ok=True)
    (content_dir / unit_rel).write_text(assembled.unit_text, encoding="utf-8")
    grammar_path = content_dir / grammar_rel
    grammar_path.parent.mkdir(parents=True, exist_ok=True)
    grammar_path.write_text(
        _merge_grammar(grammar_path, assembled.grammar_points), encoding="utf-8"
    )
    new = {c: v for c, v in assembled.han_viet.items() if c not in overrides}
    if new:
        overrides_path.parent.mkdir(parents=True, exist_ok=True)
        overrides_path.write_text(
            yaml.safe_dump({**overrides, **new}, allow_unicode=True, sort_keys=False),
            encoding="utf-8",
        )
