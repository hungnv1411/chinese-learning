"""10-1. Sinh content/pron/syllables.yaml: âm tiết tiếng phổ thông, thanh mẫu/vận mẫu,
chữ ví dụ cho từng thanh (từ CC-CEDICT + HSK) và cờ audio."""

from clp.pinyin import parse_numbered

# Danh sách âm tiết chuẩn (không thanh), ghi tay theo bảng pinyin. Dạng viết chuẩn: ju, lü, yu.
_STANDARD_BY_GROUP = """
a ai an ang ao e ei en eng er o ou
yi ya yao ye you yan yin yang ying yong wu wa wo wai wei wan wen wang weng yu yue yuan yun
ba bai ban bang bao bei ben beng bi bian biao bie bin bing bo bu
pa pai pan pang pao pei pen peng pi pian piao pie pin ping po pou pu
ma mai man mang mao me mei men meng mi mian miao mie min ming miu mo mou mu
fa fan fang fei fen feng fo fou fu
da dai dan dang dao de dei den deng di dia dian diao die ding diu dong dou du duan dui dun duo
ta tai tan tang tao te teng ti tian tiao tie ting tong tou tu tuan tui tun tuo
na nai nan nang nao ne nei nen neng ni nian niang niao nie nin ning niu nong nou nu nuan nuo nü nüe
la lai lan lang lao le lei leng li lia lian liang liao lie lin ling liu lo long lou lu luan lun luo lü lüe
ga gai gan gang gao ge gei gen geng gong gou gu gua guai guan guang gui gun guo
ka kai kan kang kao ke kei ken keng kong kou ku kua kuai kuan kuang kui kun kuo
ha hai han hang hao he hei hen heng hong hou hu hua huai huan huang hui hun huo
ji jia jian jiang jiao jie jin jing jiong jiu ju juan jue jun
qi qia qian qiang qiao qie qin qing qiong qiu qu quan que qun
xi xia xian xiang xiao xie xin xing xiong xiu xu xuan xue xun
zha zhai zhan zhang zhao zhe zhei zhen zheng zhi zhong zhou zhu zhua zhuai zhuan zhuang zhui zhun zhuo
cha chai chan chang chao che chen cheng chi chong chou chu chua chuai chuan chuang chui chun chuo
sha shai shan shang shao she shei shen sheng shi shou shu shua shuai shuan shuang shui shun shuo
ran rang rao re ren reng ri rong rou ru ruan rui run ruo
za zai zan zang zao ze zei zen zeng zi zong zou zu zuan zui zun zuo
ca cai can cang cao ce cen ceng ci cong cou cu cuan cui cun cuo
sa sai san sang sao se sen seng si song sou su suan sui sun suo
"""
STANDARD: list[str] = _STANDARD_BY_GROUP.split()

INITIALS = ["zh", "ch", "sh", "b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h",
            "j", "q", "x", "r", "z", "c", "s"]  # fmt: skip
# Âm tiết không thanh mẫu viết bằng y/w: vận mẫu thật nằm sau
ZERO_INITIAL_FINAL = {
    "yi": "i", "ya": "ia", "yao": "iao", "ye": "ie", "you": "iu", "yan": "ian", "yin": "in",
    "yang": "iang", "ying": "ing", "yong": "iong", "wu": "u", "wa": "ua", "wo": "uo",
    "wai": "uai", "wei": "ui", "wan": "uan", "wen": "un", "wang": "uang", "weng": "ueng",
    "yu": "ü", "yue": "üe", "yuan": "üan", "yun": "ün",
}  # fmt: skip
VOICE = "xiaoxiao"


def split_syllable(syl: str) -> tuple[str, str]:
    """'ju' -> ('j', 'ü'); 'yu' -> ('', 'ü'); 'zhi' -> ('zh', 'i')."""
    if syl in ZERO_INITIAL_FINAL:
        return "", ZERO_INITIAL_FINAL[syl]
    for ini in INITIALS:
        if syl.startswith(ini):
            final = syl[len(ini) :]
            if ini in ("j", "q", "x") and final.startswith("u"):
                final = "ü" + final[1:]
            return ini, final
    return "", syl


def compare_with_cedict(cedict_syllables: set[str]) -> dict[str, list[str]]:
    std = set(STANDARD)
    return {
        "only_in_cedict": sorted(cedict_syllables - std),
        "only_in_standard": sorted(std - cedict_syllables),
    }


SKIP_GLOSS = ("surname ", "variant of", "old variant of", "see ", "abbr. ", "cl:")


def _gloss(definitions: list[str], base: str) -> str:
    """Nghĩa ngắn đầu tiên có ích: bỏ nghĩa trùng chính âm tiết, họ, biến thể, tham chiếu."""
    for d in definitions:
        low = d.lower().strip()
        if low == base or low.startswith(SKIP_GLOSS):
            continue
        short = d.split(";")[0].split(",")[0].split("(")[0].strip()[:40]
        return short or d.strip()[:40]
    return definitions[0][:40] if definitions else ""


def collect_chars(conn) -> dict[tuple[str, int], dict]:
    """Chữ ví dụ tốt nhất cho (âm tiết, thanh): chỉ chữ đơn có cấp HSK; ưu tiên cấp thấp, rồi
    không phải họ/biến thể, rồi nhiều nghĩa."""
    std = set(STANDARD)
    best: dict[tuple[str, int], tuple] = {}
    with conn.cursor() as cur:
        cur.execute(
            "SELECT simplified, pinyin_numbered, definitions, hsk_level, is_variant_or_surname"
            " FROM dict_entry WHERE char_length(simplified) = 1 AND hsk_level IS NOT NULL"
            " AND pinyin_numbered !~ ' '"
        )
        for ch, num, defs, level, variant in cur.fetchall():
            base, tone = parse_numbered(num.lower())
            if base not in std or tone == 5:
                continue
            rank = (variant, level, -len(defs), ch)
            if (base, tone) not in best or rank < best[(base, tone)][0]:
                best[(base, tone)] = (rank, ch, _gloss(defs, base), level)
    return {k: {"char": ch, "gloss": g, "hsk_level": lv} for k, (_, ch, g, lv) in best.items()}


def build_entries(chars: dict[tuple[str, int], dict], audio_keys: set[str]) -> list[dict]:
    entries = []
    for syl in STANDARD:
        initial, final = split_syllable(syl)
        tones = []
        for tone in (1, 2, 3, 4):
            t: dict = {"tone": tone}
            if (syl, tone) in chars:
                t.update(chars[(syl, tone)])
            t["audio"] = f"syl/{VOICE}/{syl}{tone}.mp3" in audio_keys
            tones.append(t)
        entries.append({"syllable": syl, "initial": initial, "final": final, "tones": tones})
    return entries


def render_yaml(entries: list[dict]) -> str:
    lines = [
        "# Sinh bằng `clp syllables` (10-1). Đừng sửa tay: sửa danh sách chuẩn trong clp/syllables.py.",
        "# Mỗi thanh có chữ ví dụ HSK (nếu có) và `audio` = đã có file syl/xiaoxiao/{âm tiết}{thanh}.mp3.",
    ]
    for e in entries:
        lines.append(
            f'- syllable: "{e["syllable"]}"\n  initial: "{e["initial"]}"\n  final: "{e["final"]}"\n  tones:'
        )
        for t in e["tones"]:
            parts = [f"tone: {t['tone']}"]
            if "char" in t:
                gloss = t["gloss"].replace('"', "'")
                parts += [
                    f'char: "{t["char"]}"',
                    f'gloss: "{gloss}"',
                    f"hsk_level: {t['hsk_level']}",
                ]
            parts.append(f"audio: {'true' if t['audio'] else 'false'}")
            lines.append("    - {" + ", ".join(parts) + "}")
    return "\n".join(lines) + "\n"
