"""02-7. Kiểm tra đối chiếu tự động nội dung đã soạn (authoring-workflow §4): pinyin từ, pinyin câu,
âm Hán Việt, câu Tatoeba, độ dài. Chạy cùng quy tắc ở 02-2 trong `check-content` / `import-content`."""

import re
import unicodedata
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field

from clp.content.loader import LoadedGrammar, LoadedUnit
from clp.content.rules import Finding
from clp.pinyin import numbered_to_marked, parse_numbered

MAX_TIP = 300
MAX_GRAMMAR_EXPLANATION = 800
HAN = re.compile(r"[一-鿿]")
SYLLABLE = re.compile(r"^[a-zü]+[1-5]$")
TONE_MARKS = {"̄": 1, "́": 2, "̌": 3, "̀": 4}


@dataclass(frozen=True)
class CrossData:
    """Dữ liệu nguồn dùng để đối chiếu (đọc từ DB ở `load_cross_data`)."""

    word_pinyin: dict[tuple[int, str], set[str]] = field(
        default_factory=dict
    )  # (cấp, từ) -> pinyin mục đã ghép
    any_pinyin: dict[str, set[str]] = field(
        default_factory=dict
    )  # từ -> mọi cách đọc trong CC-CEDICT
    tatoeba: dict[str, tuple[str, str]] = field(default_factory=dict)  # id -> (zh, en)
    han_viet: dict[str, set[str]] = field(
        default_factory=dict
    )  # chữ -> các âm trong Unihan/overrides
    stage_levels: dict[str, int] = field(default_factory=dict)


def load_cross_data(
    conn,
    stage_levels: dict[str, int],
    words: Iterable[str] | None = None,
    tatoeba_ids: Iterable[str] | None = None,
) -> CrossData:
    """`words` / `tatoeba_ids` giới hạn phần cần đọc (None: đọc hết)."""
    word_list = None if words is None else sorted(set(words))
    id_list = None if tatoeba_ids is None else sorted(set(tatoeba_ids))
    data = CrossData(stage_levels=dict(stage_levels))
    with conn.cursor() as cur:
        cur.execute(
            "SELECT w.level, w.simplified, d.pinyin_numbered FROM hsk_word w"
            " JOIN dict_entry d ON d.id = w.dict_entry_id WHERE NOT w.deprecated"
        )
        for level, word, numbered in cur.fetchall():
            data.word_pinyin.setdefault((level, word), set()).add(numbered)
        cur.execute(
            "SELECT simplified, pinyin_numbered FROM dict_entry WHERE %s::text[] IS NULL OR simplified = ANY(%s)",
            (word_list, word_list),
        )
        for word, numbered in cur.fetchall():
            data.any_pinyin.setdefault(word, set()).add(numbered)
        cur.execute(
            "SELECT source_ref, zh, en FROM sentence WHERE source = 'tatoeba'"
            " AND (%s::text[] IS NULL OR source_ref = ANY(%s))",
            (id_list, id_list),
        )
        data.tatoeba.update({ref: (zh, en) for ref, zh, en in cur.fetchall()})
        cur.execute("SELECT char, han_viet FROM hanzi WHERE han_viet <> '{}'")
        data.han_viet.update({ch: set(hv) for ch, hv in cur.fetchall()})
    return data


def _norm(pinyin: str) -> str:
    """Về dạng có dấu viết liền, thường: 'hao3 chi1' / 'hǎo chī' / 'hǎochī' -> 'hǎochī'."""
    s = re.sub(r"[\s'’-]", "", unicodedata.normalize("NFC", pinyin).lower())
    return numbered_to_marked(s, join=True) if re.search(r"[1-5]", s) else s


# ---- pinyin của câu -------------------------------------------------------------------------


def expected_pinyin(zh: str) -> list[tuple[str, str]]:
    """[(chữ Hán, pinyin số thanh)] theo pypinyin (có từ điển cụm từ); bỏ dấu câu, số, chữ Latin."""
    from pypinyin import Style, pinyin

    out: list[tuple[str, str]] = []
    i = 0
    for item in pinyin(zh, style=Style.TONE3, neutral_tone_with_five=True, v_to_u=False):
        text = item[0]
        if i < len(zh) and HAN.match(zh[i]) and SYLLABLE.match(text):
            out.append((zh[i], text))
            i += 1
        else:
            i += len(text) or 1
    return out


def _authored_units(pinyin: str) -> list[tuple[str, int | None]]:
    out: list[tuple[str, int | None]] = []
    for ch in unicodedata.normalize("NFD", pinyin.lower()):
        if ch in TONE_MARKS:
            if out:
                out[-1] = (out[-1][0], TONE_MARKS[ch])
        elif ch == "̈" or not ch.isalpha():
            continue  # ü giữ chữ u; khoảng trắng, dấu câu, số bị bỏ
        else:
            out.append((ch, None))
    return out


def _align(
    authored: str, expected: list[tuple[str, str]], alts: dict[int, list[str]]
) -> tuple[list[tuple[int, int, int]], set[int]] | None:
    """Ghép theo chữ cái; chữ đa âm được thử thêm các cách đọc khác. Trả (khác thanh, vị trí dùng cách đọc khác)."""
    units = _authored_units(authored)
    pos = 0
    diffs: list[tuple[int, int, int]] = []
    alt_used: set[int] = set()
    for i, (_char, numbered) in enumerate(expected):
        for candidate in [numbered, *[a for a in alts.get(i, []) if a != numbered]]:
            base, tone = parse_numbered(candidate)
            letters = ["u" if c == "ü" else c for c in base]
            chunk = units[pos : pos + len(letters)]
            if [c for c, _ in chunk] == letters:
                break
        else:
            return None
        if candidate != numbered:
            alt_used.add(i)
        pos += len(letters)
        actual = next((t for _c, t in chunk if t), 5)
        if actual != tone:
            diffs.append((i, tone, actual))
    return (diffs, alt_used) if pos == len(units) else None


def align_pinyin(
    authored: str, expected: list[tuple[str, str]]
) -> list[tuple[int, int, int]] | None:
    """Ghép pinyin tự ghi với pinyin kỳ vọng. Trả [(vị trí, thanh kỳ vọng, thanh đã ghi)] cho các âm tiết
    khác thanh; None nếu chữ cái không khớp (sai âm hoặc thừa/thiếu âm tiết)."""
    res = _align(authored, expected, {})
    return None if res is None else res[0]


def _alternatives(expected: list[tuple[str, str]]) -> dict[int, list[str]]:
    from pypinyin import Style, pinyin

    alts: dict[int, list[str]] = {}
    for i, (char, _n) in enumerate(expected):
        readings = pinyin(
            char, style=Style.TONE3, heteronym=True, neutral_tone_with_five=True, v_to_u=False
        )[0]
        if len(set(readings)) > 1:
            alts[i] = sorted(set(readings))
    return alts


def _tolerated(i: int, exp: int, act: int, expected: list[tuple[str, str]]) -> bool:
    """Khác biệt do biến điệu hoặc thanh nhẹ không tính là lỗi."""
    char = expected[i][0]
    nxt = parse_numbered(expected[i + 1][1])[1] if i + 1 < len(expected) else None
    return (
        act == 5  # tác giả ghi thanh nhẹ mà pypinyin không biết
        or exp == 5
        or (exp == 3 and act == 2 and nxt == 3)  # 3+3 -> 2+3
        or (char == "不" and exp == 4 and act == 2 and nxt == 4)
        or (char == "一" and exp == 1 and act in (2, 4))
    )


def _is_polyphone(char: str) -> bool:
    from pypinyin import Style, pinyin

    return len({p for p in pinyin(char, style=Style.TONE3, heteronym=True)[0]}) > 1


# ---- Hán Việt ------------------------------------------------------------------------------

CLAIM = re.compile(
    r"(?P<han>[一-鿿]{1,8})[^一-鿿]{0,40}?Hán Việt\s*(?:là|:)?\s*"
    r"(?P<hv>[^\W\d_]+(?:\s+[^\W\d_]+){0,7})",
    re.IGNORECASE,
)


def find_han_viet_claims(text: str) -> list[tuple[str, list[str]]]:
    """Các câu khẳng định kiểu `好吃 có âm Hán Việt là hảo khật` -> [('好吃', ['hảo', 'khật'])]."""
    claims = []
    for m in CLAIM.finditer(text):
        han = m.group("han")
        claims.append((han, m.group("hv").split()[: len(han)]))
    return claims


def _hv(s: str) -> str:
    return unicodedata.normalize("NFC", s).lower()


# ---- chạy kiểm tra --------------------------------------------------------------------------


def crosscheck(
    units: list[LoadedUnit], grammar: list[LoadedGrammar], data: CrossData
) -> list[Finding]:
    out: list[Finding] = []

    def add(level: str, code: str, msg: str, lu: LoadedUnit | LoadedGrammar, *loc) -> None:
        out.append(Finding(level, code, msg, lu.path, lu.line(*loc)))

    def check_han_viet(text: str, owner: LoadedUnit | LoadedGrammar, *loc) -> None:
        for han, claimed in find_han_viet_claims(text):
            for ch, syl in zip(han, claimed + [""] * (len(han) - len(claimed)), strict=True):
                allowed = {_hv(a) for a in data.han_viet.get(ch, set())}
                if not allowed:
                    add(
                        "error",
                        "han_viet_unverifiable",
                        f"Âm Hán Việt của {ch!r} không có trong Unihan/overrides; thêm vào overrides/han_viet.yaml (source: ai) trước khi nhắc tới",
                        owner,
                        *loc,
                    )
                elif _hv(syl) not in allowed:
                    add(
                        "error",
                        "han_viet_mismatch",
                        f"Âm Hán Việt của {ch!r} ghi {syl!r}, nguồn có: {', '.join(sorted(allowed))}",
                        owner,
                        *loc,
                    )

    for lu in units:
        level = data.stage_levels.get(lu.unit.stage)
        for li, lesson in enumerate(lu.unit.lessons):
            for wi, w in enumerate(lesson.new_words):
                if not w.pinyin:
                    continue
                candidates = (
                    data.word_pinyin.get((level, w.word))
                    if level is not None and not w.extra
                    else None
                ) or data.any_pinyin.get(w.word)
                where = ("lessons", li, "new_words", wi)
                if not candidates:
                    add(
                        "error",
                        "word_pinyin_unverifiable",
                        f"Từ {w.word!r}: không có mục CC-CEDICT để đối chiếu pinyin {w.pinyin!r}",
                        lu,
                        *where,
                    )
                elif _norm(w.pinyin) not in {_norm(c) for c in candidates}:
                    add(
                        "error",
                        "word_pinyin_mismatch",
                        f"Từ {w.word!r}: pinyin {w.pinyin!r} khác pinyin CC-CEDICT đã ghép ({', '.join(sorted(candidates))})",
                        lu,
                        *where,
                    )

            for si, s in enumerate(lesson.sentences):
                expected = expected_pinyin(s.zh)
                alts = _alternatives(expected)
                res = _align(s.pinyin, expected, alts)
                if res is None:
                    # chữ cái không khớp kể cả khi thử các cách đọc khác: sai thật (đa âm không giải thích được)
                    problem, polyphone = True, False
                else:
                    diffs, alt_used = res
                    real = [d for d in diffs if not _tolerated(d[0], d[1], d[2], expected)]
                    problem = bool(real) or bool(alt_used)
                    polyphone = bool(alt_used) or any(i in alts for i, _e, _a in real)
                if problem:
                    exp_text = " ".join(numbered_to_marked(n) for _c, n in expected)
                    add(
                        "warning",
                        "sentence_pinyin_polyphone" if polyphone else "sentence_pinyin_mismatch",
                        f"Câu {s.id}: pinyin ghi {s.pinyin!r}, pypinyin cho {exp_text!r}"
                        + (" (có chữ đa âm, cần rà soát riêng câu này)" if polyphone else ""),
                        lu,
                        "lessons",
                        li,
                        "sentences",
                        si,
                        "pinyin",
                    )
                if s.tatoeba_id is not None:
                    src = data.tatoeba.get(str(s.tatoeba_id))
                    where = ("lessons", li, "sentences", si, "tatoeba_id")
                    if src is None:
                        add(
                            "error",
                            "tatoeba_not_found",
                            f"Câu {s.id}: Tatoeba #{s.tatoeba_id} không có trong dữ liệu đã nhập",
                            lu,
                            *where,
                        )
                    elif (s.zh, s.en) != src:
                        add(
                            "error",
                            "tatoeba_text_mismatch",
                            f"Câu {s.id}: zh/en khác nguyên văn Tatoeba #{s.tatoeba_id} ({src[0]!r} / {src[1]!r})",
                            lu,
                            *where,
                        )

            for key, tip in lesson.tips.items():
                if len(tip) > MAX_TIP:
                    add(
                        "warning",
                        "tip_too_long",
                        f"Mẹo {key!r} dài {len(tip)} ký tự, tối đa {MAX_TIP}",
                        lu,
                        "lessons",
                        li,
                        "tips",
                        key,
                    )
                check_han_viet(tip, lu, "lessons", li, "tips", key)

    for g in grammar:
        for gi, p in enumerate(g.points):
            if len(p.explanation_vi) > MAX_GRAMMAR_EXPLANATION:
                add(
                    "warning",
                    "grammar_too_long",
                    f"Giải thích ngữ pháp {p.id} dài {len(p.explanation_vi)} ký tự, tối đa {MAX_GRAMMAR_EXPLANATION}",
                    g,
                    gi,
                    "explanation_vi",
                )
            check_han_viet(p.explanation_vi, g, gi, "explanation_vi")
    return out


__all__: list[str | Callable] = [
    "CrossData",
    "align_pinyin",
    "crosscheck",
    "find_han_viet_claims",
    "load_cross_data",
]
