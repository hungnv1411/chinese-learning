"""B5. Nhập câu ví dụ Tatoeba (cmn ↔ eng) vào sentence và sentence_word."""

import bz2
import re
import tarfile
from pathlib import Path

from clp.db import upsert
from clp.pinyin import numbered_to_marked

MIN_HAN, MAX_HAN = 4, 25
NON_HSK_LEVEL = 7  # từ không có trong HSK
HAN = re.compile(r"[一-鿿]")
LATIN = re.compile(r"[A-Za-z]")
_converter = None


def han_count(zh: str) -> int:
    return len(HAN.findall(zh))


def keep_sentence(zh: str) -> bool:
    """4–25 chữ Hán, không có chữ Latin (dấu câu và số vẫn được phép)."""
    return MIN_HAN <= han_count(zh) <= MAX_HAN and not LATIN.search(zh)


def to_simplified(text: str) -> str:
    global _converter
    if _converter is None:
        from opencc import OpenCC

        _converter = OpenCC("t2s")
    return _converter.convert(text)


def read_sentences(path: Path) -> dict[int, str]:
    out: dict[int, str] = {}
    with bz2.open(path, "rt", encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 3:
                out[int(parts[0])] = parts[2]
    return out


def read_links(path: Path):
    """Phát từng cặp (id, id) từ links.tar.bz2 (links.csv)."""
    with tarfile.open(path, "r:bz2") as tf:
        member = next(m for m in tf if m.isfile() and m.name.endswith("links.csv"))
        for raw in tf.extractfile(member):
            a, _, b = raw.decode().strip().partition("\t")
            if b:
                yield int(a), int(b)


def pick_pairs(cmn: dict[int, str], eng: dict[int, str], links) -> list[tuple[int, str]]:
    """Với mỗi câu cmn lấy bản dịch tiếng Anh ngắn nhất (hòa thì id nhỏ nhất)."""
    best: dict[int, tuple[int, int, str]] = {}
    for a, b in links:
        for c, e in ((a, b), (b, a)):
            if c in cmn and e in eng:
                cand = (len(eng[e]), e, eng[e])
                if c not in best or cand < best[c]:
                    best[c] = cand
    return [(c, best[c][2]) for c in sorted(best)]


def sentence_pinyin(zh: str) -> str:
    """Pinyin có dấu, mỗi âm tiết một khoảng trắng; bỏ dấu câu. Máy sinh nên có thể sai chữ đa âm."""
    from pypinyin import Style, pinyin

    syllables = [
        numbered_to_marked(s[0])
        for s in pinyin(zh, style=Style.TONE3, neutral_tone_with_five=True, v_to_u=False)
        if HAN.search(s[0]) is None and s[0][:1].isalpha()
    ]
    return " ".join(syllables)


def make_tokenizer(hsk_words: list[str]):
    import jieba

    tk = jieba.Tokenizer()
    for w in hsk_words:
        tk.add_word(w)
    return tk


def analyze(zh: str, tokenizer, hsk_level: dict[str, int]) -> tuple[int, list[str]]:
    """Trả (max_hsk_level, danh sách từ). Dấu câu, số bị bỏ; từ ngoài HSK tính là 7."""
    tokens = [t for t in tokenizer.lcut(zh) if HAN.search(t)]
    level = max((hsk_level.get(t, NON_HSK_LEVEL) for t in tokens), default=NON_HSK_LEVEL)
    return level, tokens


def _best_entry(cands: list[tuple]) -> int:
    # (id, hsk_level, is_variant, n_defs): ưu tiên có cấp HSK thấp, không phải họ/biến thể, nhiều nghĩa
    return min(cands, key=lambda c: (c[1] is None, c[1] or 0, c[2], -c[3], c[0]))[0]


def import_tatoeba(conn, cmn_path: Path, eng_path: Path, links_path: Path) -> dict:
    with conn.cursor() as cur:
        cur.execute("SELECT simplified, min(level) FROM hsk_word WHERE NOT deprecated GROUP BY 1")
        hsk_level = dict(cur.fetchall())
    tokenizer = make_tokenizer(list(hsk_level))

    cmn_raw = read_sentences(cmn_path)
    cmn: dict[int, str] = {}
    seen_zh: set[str] = set()
    for cid in sorted(cmn_raw):
        zh = to_simplified(cmn_raw[cid])
        if keep_sentence(zh) and zh not in seen_zh:
            seen_zh.add(zh)
            cmn[cid] = zh
    links = list(read_links(links_path))
    wanted_eng = {b for a, b in links if a in cmn} | {a for a, b in links if b in cmn}
    eng = {i: t for i, t in read_sentences(eng_path).items() if i in wanted_eng}
    pairs = pick_pairs(cmn, eng, links)

    analyzed = {}
    all_tokens: set[str] = set()
    for cid, _ in pairs:
        analyzed[cid] = analyze(cmn[cid], tokenizer, hsk_level)
        all_tokens.update(analyzed[cid][1])

    entry_of: dict[str, int] = {}
    with conn.cursor() as cur:
        cur.execute(
            "SELECT simplified, id, hsk_level, is_variant_or_surname,"
            " coalesce(array_length(definitions, 1), 0)"
            " FROM dict_entry WHERE simplified = ANY(%s)",
            (sorted(all_tokens),),
        )
        grouped: dict[str, list[tuple]] = {}
        for simp, *rest in cur.fetchall():
            grouped.setdefault(simp, []).append(tuple(rest))
    for simp, cands in grouped.items():
        entry_of[simp] = _best_entry(cands)

    rows = [
        {
            "zh": cmn[cid],
            "pinyin": sentence_pinyin(cmn[cid]),
            "en": en,
            "source": "tatoeba",
            "source_ref": str(cid),
            "max_hsk_level": analyzed[cid][0],
        }
        for cid, en in pairs
    ]
    res = {"sentences": upsert(conn, "sentence", rows, ["source", "source_ref"])}

    with conn.cursor() as cur:
        cur.execute("SELECT source_ref, id FROM sentence WHERE source = 'tatoeba'")
        sid = {int(ref): i for ref, i in cur.fetchall()}
        cur.execute(
            "DELETE FROM sentence_word WHERE sentence_id = ANY(%s)", ([sid[c] for c, _ in pairs],)
        )
    links_rows = [
        {"sentence_id": sid[cid], "dict_entry_id": entry_of[t]}
        for cid, _ in pairs
        for t in dict.fromkeys(analyzed[cid][1])
        if t in entry_of
    ]
    upsert(conn, "sentence_word", links_rows, ["sentence_id", "dict_entry_id"])
    res["dropped"] = len(cmn_raw) - len(pairs)
    res["links"] = len(links_rows)
    return res
