"""B4. Nhập thông tin chữ Hán: âm Hán Việt (Unihan), phân tích chữ (Make Me a Hanzi),
dữ liệu nét (hanzi-writer-data), tên bộ thủ tiếng Việt."""

import csv
import hashlib
import json
import tarfile
import zipfile
from pathlib import Path

from clp.db import upsert


def _cp(token: str) -> str:
    return chr(int(token.removeprefix("U+"), 16))


def read_unihan(zip_path: Path) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    """Trả (kVietnamese, kTraditionalVariant): {chữ: [giá trị]}."""
    viet: dict[str, list[str]] = {}
    trad: dict[str, list[str]] = {}
    with zipfile.ZipFile(zip_path) as zf:
        for name, field, target in (
            ("Unihan_Readings.txt", "kVietnamese", viet),
            ("Unihan_Variants.txt", "kTraditionalVariant", trad),
        ):
            for line in zf.read(name).decode("utf-8").splitlines():
                if line.startswith("#") or not line:
                    continue
                code, f, value = line.split("\t", 2)
                if f != field:
                    continue
                ch = _cp(code)
                if field == "kVietnamese":
                    target[ch] = [v.lower() for v in value.split()]
                else:
                    target[ch] = [_cp(v.split("<")[0]) for v in value.split()]
    return viet, trad


def read_mmh(path: Path, wanted: set[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        d = json.loads(line)
        ch = d["character"]
        if ch not in wanted:
            continue
        out[ch] = {
            "decomposition": d.get("decomposition"),
            "radical": d.get("radical"),
            "etymology_hint": (d.get("etymology") or {}).get("hint"),
        }
    return out


def read_strokes(tgz_path: Path, wanted: set[str]) -> dict[str, tuple[int, bytes]]:
    """{chữ: (số nét, nội dung JSON gốc)} cho chữ có trong gói hanzi-writer-data."""
    out: dict[str, tuple[int, bytes]] = {}
    with tarfile.open(tgz_path) as tf:
        for m in tf:
            if not m.isfile() or not m.name.startswith("package/") or not m.name.endswith(".json"):
                continue
            ch = m.name[len("package/") : -len(".json")]
            if ch not in wanted:
                continue
            data = tf.extractfile(m).read()
            out[ch] = (len(json.loads(data)["strokes"]), data)
    return out


class LocalStrokeStore:
    """Ghi nét ra thư mục cục bộ khi chưa cấu hình R2."""

    def __init__(self, directory: Path):
        self.dir = directory

    def put(self, char: str, data: bytes) -> bool:
        path = self.dir / f"{char}.json"
        if path.exists() and path.read_bytes() == data:
            return False
        self.dir.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return True


class R2StrokeStore:
    """Đẩy strokes/{char}.json lên R2 (S3 API); bỏ qua nếu ETag trùng MD5 nội dung."""

    def __init__(self, client, bucket: str, not_found: tuple[type[BaseException], ...] = ()):
        self.client, self.bucket, self.not_found = client, bucket, not_found

    def put(self, char: str, data: bytes) -> bool:
        key = f"strokes/{char}.json"
        try:
            etag = self.client.head_object(Bucket=self.bucket, Key=key)["ETag"].strip('"')
            if etag == hashlib.md5(data).hexdigest():
                return False
        except self.not_found:
            pass
        self.client.put_object(
            Bucket=self.bucket, Key=key, Body=data, ContentType="application/json"
        )
        return True


def make_r2_store(env: dict[str, str]) -> R2StrokeStore | None:
    keys = ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET")
    if not all(env.get(k) for k in keys):
        return None
    import boto3
    from botocore.exceptions import ClientError

    client = boto3.client(
        "s3",
        endpoint_url=f"https://{env['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=env["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=env["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )
    return R2StrokeStore(client, env["R2_BUCKET"], not_found=(ClientError,))


def _han_viet(
    ch: str, viet: dict, trad: dict, override: dict | None
) -> tuple[list[str], str | None]:
    if override:
        return [v.lower() for v in override["han_viet"]], override["source"]
    if viet.get(ch):
        return viet[ch], "unihan"
    # Unihan chỉ có phồn thể: chữ giản thể tra qua kTraditionalVariant
    found: list[str] = []
    for t in trad.get(ch, []):
        for v in viet.get(t, []):
            if v not in found:
                found.append(v)
    return (found, "unihan") if found else ([], None)


def import_hanzi(
    conn,
    *,
    unihan_zip: Path,
    mmh_dictionary: Path,
    strokes_tgz: Path,
    radicals: list[dict],
    overrides: dict,
    store,
    out_dir: Path,
) -> dict:
    rad_rows = [{k: r[k] for k in ("radical", "number", "name_vi", "meaning_vi")} for r in radicals]
    rad_head = {r["radical"]: r["radical"] for r in radicals}
    for r in radicals:
        for v in r.get("variants", []):
            rad_head[v] = r["radical"]
    res: dict = {"radical_vi": upsert(conn, "radical_vi", rad_rows, ["radical"])}

    with conn.cursor() as cur:
        cur.execute("SELECT char, level FROM hsk_char")
        levels = dict(cur.fetchall())
        cur.execute("SELECT simplified FROM hsk_word")
        words = [w for (w,) in cur.fetchall()]
    # Phạm vi: chữ trong danh sách chữ HSK và mọi chữ xuất hiện trong từ HSK.
    wanted = set(levels) | {c for w in words for c in w if "\u4e00" <= c <= "\u9fff"}

    viet, trad = read_unihan(unihan_zip)
    mmh = read_mmh(mmh_dictionary, wanted)
    strokes = read_strokes(strokes_tgz, wanted)

    rows, uploaded = [], 0
    for ch in sorted(wanted):
        hv, source = _han_viet(ch, viet, trad, overrides.get(ch))
        info = mmh.get(ch, {})
        radical = info.get("radical")
        decomposition = info.get("decomposition")
        s = strokes.get(ch)
        if s and store.put(ch, s[1]):
            uploaded += 1
        rows.append(
            {
                "char": ch,
                "han_viet": hv,
                "han_viet_source": source,
                "decomposition": decomposition if decomposition != "？" else None,
                "radical": rad_head.get(radical, radical),
                "etymology_hint": info.get("etymology_hint"),
                "stroke_count": s[0] if s else None,
                "has_stroke_data": s is not None,
            }
        )
    res["hanzi"] = upsert(conn, "hanzi", rows, ["char"])
    res["uploaded"] = uploaded

    out_dir.mkdir(parents=True, exist_ok=True)
    for name, pred in (
        ("hanviet_missing.csv", lambda r: not r["han_viet"]),
        ("strokes_missing.csv", lambda r: not r["has_stroke_data"]),
    ):
        miss = [r for r in rows if r["char"] in levels and levels[r["char"]] <= 3 and pred(r)]
        with (out_dir / name).open("w", encoding="utf-8", newline="") as f:
            w = csv.writer(f)
            w.writerow(["char", "level"])
            for r in miss:
                w.writerow([r["char"], levels[r["char"]]])
        res[name.split("_")[0] + "_missing"] = len(miss)
    return res
