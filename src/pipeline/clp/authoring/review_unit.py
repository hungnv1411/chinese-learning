"""02-6. `review_unit`: lượt rà soát riêng (model và prompt khác lượt soạn) một chủ đề đã soạn."""

from dataclasses import dataclass, field
from typing import Any

from clp.authoring.llm import JsonModel

REVIEW_MAX_TOKENS = 16000
CATEGORIES = [
    "pinyin",
    "sandhi",
    "english",
    "sentence_natural",
    "learned_words",
    "grammar_explanation",
    "sensitive_content",
]

REVIEW_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["pass", "fail"]},
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "where": {"type": "string"},
                    "category": {"type": "string", "enum": CATEGORIES},
                    "severity": {"type": "string", "enum": ["error", "warning"]},
                    "problem": {"type": "string"},
                    "suggestion": {"type": "string"},
                },
                "required": ["where", "category", "severity", "problem", "suggestion"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["verdict", "issues"],
    "additionalProperties": False,
}


@dataclass(frozen=True)
class ReviewIssue:
    where: str
    category: str
    severity: str
    problem: str
    suggestion: str


@dataclass
class ReviewResult:
    verdict: str
    issues: list[ReviewIssue] = field(default_factory=list)

    @property
    def errors(self) -> list[ReviewIssue]:
        return [i for i in self.issues if i.severity == "error"]


def build_review_prompt(inputs: Any, unit_yaml: str) -> tuple[str, str]:
    system = """Bạn là biên tập viên kiểm duyệt giáo trình tiếng Trung cho người Việt. \
Bạn KHÔNG soạn nội dung; bạn rà soát bản đã soạn và chỉ báo lỗi thật sự, kèm cách sửa ngắn gọn.

Danh sách rà soát:
- pinyin: pinyin của từ và của câu có đúng không, nhất là chữ đa âm (了, 得, 行, 长, 的, 地, 还…) và thanh nhẹ.
- sandhi: ghi chú biến điệu (3+3, 不, 一) đúng chỗ, không thiếu và không bịa.
- english: nghĩa tiếng Anh ngắn gọn, đúng ngữ cảnh bài; bản dịch câu đúng.
- sentence_natural: câu ví dụ có tự nhiên, người bản xứ có nói không.
- learned_words: câu chỉ dùng từ đã học đến bài đó (danh sách "từ đã học" và từ mới của chủ đề trong đề bài).
- grammar_explanation: giải thích ngữ pháp và mẹo tiếng Việt đúng, dễ hiểu, không quá 3–4 câu.
- sensitive_content: không có nội dung nhạy cảm (chính trị, tôn giáo, bạo lực).

Quy tắc đánh giá: severity "error" chỉ cho lỗi sai sự thật hoặc câu không dùng được (pinyin sai, nghĩa sai, câu gượng, dùng từ chưa học, nội dung nhạy cảm); "warning" cho chỗ nên cải thiện. \
Không bịa lỗi để có việc làm; bản đúng thì verdict "pass" và issues rỗng. `where` là id bài hoặc id câu. Chỉ trả JSON đúng schema."""
    words = "\n".join(f"{w.word} | {w.pinyin} | {'; '.join(w.definitions)}" for w in inputs.words)
    learned = ", ".join(inputs.learned_words) or "(chưa có)"
    user = f"""Chủ đề: {inputs.unit.id} — {inputs.unit.title} (HSK {inputs.level}).

Từ mới của chủ đề (từ | pinyin | nghĩa):
{words}

Từ đã học trước chủ đề: {learned}

Bản đã soạn (YAML):
{unit_yaml}"""
    return system, user


def review_unit(
    llm: JsonModel, *, model: str, effort: str, inputs: Any, unit_yaml: str
) -> ReviewResult:
    system, user = build_review_prompt(inputs, unit_yaml)
    raw = llm.generate(
        system=system,
        user=user,
        schema=REVIEW_SCHEMA,
        model=model,
        effort=effort,
        max_tokens=REVIEW_MAX_TOKENS,
    )
    issues = [ReviewIssue(**i) for i in raw.get("issues", [])]
    verdict = raw.get("verdict", "pass")
    # Có lỗi severity=error thì coi là không đạt dù model ghi "pass".
    if any(i.severity == "error" for i in issues):
        verdict = "fail"
    return ReviewResult(verdict, issues)
