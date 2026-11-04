import io
import json
import tarfile
import zipfile

from clp.hanzi import (
    LocalStrokeStore,
    R2StrokeStore,
    import_hanzi,
    read_mmh,
    read_strokes,
    read_unihan,
)

READINGS = (
    "# comment\n"
    "U+597D\tkVietnamese\thảo hiếu\n"
    "U+8AAA\tkVietnamese\tthuyết\n"
    "U+597D\tkMandarin\thǎo\n"
)
VARIANTS = "U+8BF4\tkTraditionalVariant\tU+8AAA U+8AAC\nU+9AD8\tkZVariant\tU+9AD9\n"
MMH = (
    '{"character":"好","decomposition":"⿰女子","etymology":{"type":"ideographic",'
    '"hint":"A woman 女 with a son 子"},"radical":"女"}\n'
    '{"character":"说","decomposition":"⿰讠兑","etymology":{"type":"pictophonetic","hint":"speech"},'
    '"radical":"讠"}\n'
    '{"character":"一","decomposition":"？","radical":"一"}\n'
)


def make_files(tmp_path, stroke_chars=("好", "说")):
    z = tmp_path / "Unihan.zip"
    with zipfile.ZipFile(z, "w") as zf:
        zf.writestr("Unihan_Readings.txt", READINGS)
        zf.writestr("Unihan_Variants.txt", VARIANTS)
    m = tmp_path / "dictionary.txt"
    m.write_text(MMH, encoding="utf-8")
    t = tmp_path / "hwd.tgz"
    with tarfile.open(t, "w:gz") as tf:
        for ch in stroke_chars:
            data = json.dumps({"strokes": ["a", "b", "c"], "medians": []}).encode()
            info = tarfile.TarInfo(f"package/{ch}.json")
            info.size = len(data)
            tf.addfile(info, io.BytesIO(data))
    return z, m, t


def test_read_unihan_and_variants(tmp_path):
    z, _, _ = make_files(tmp_path)
    viet, trad = read_unihan(z)
    assert viet == {"好": ["hảo", "hiếu"], "說": ["thuyết"]}
    assert trad == {"说": ["說", "\u8aac"]}


def test_read_mmh_filters_wanted(tmp_path):
    _, m, _ = make_files(tmp_path)
    d = read_mmh(m, {"好", "说"})
    assert set(d) == {"好", "说"}
    assert d["好"] == {
        "decomposition": "⿰女子",
        "radical": "女",
        "etymology_hint": "A woman 女 with a son 子",
    }


def test_read_strokes(tmp_path):
    _, _, t = make_files(tmp_path)
    s = read_strokes(t, {"好", "说", "一"})
    assert set(s) == {"好", "说"}
    assert s["好"][0] == 3 and json.loads(s["好"][1])["strokes"] == ["a", "b", "c"]


class FakeS3:
    def __init__(self):
        self.objects = {}
        self.puts = 0

    def head_object(self, Bucket, Key):
        if Key not in self.objects:
            raise KeyError(Key)
        import hashlib

        return {"ETag": f'"{hashlib.md5(self.objects[Key]).hexdigest()}"'}

    def put_object(self, Bucket, Key, Body, ContentType):
        self.puts += 1
        self.objects[Key] = Body


def test_r2_store_uploads_once_when_unchanged():
    s3 = FakeS3()
    store = R2StrokeStore(s3, "bucket", not_found=(KeyError,))
    assert store.put("好", b"{}") is True
    assert store.put("好", b"{}") is False
    assert s3.puts == 1 and "strokes/好.json" in s3.objects
    assert store.put("好", b"{ }") is True


def test_local_store(tmp_path):
    store = LocalStrokeStore(tmp_path / "strokes")
    assert store.put("好", b"{}") is True
    assert store.put("好", b"{}") is False
    assert (tmp_path / "strokes" / "好.json").read_bytes() == b"{}"


RADICALS = [
    {"number": 38, "radical": "女", "name_vi": "nữ", "meaning_vi": "phụ nữ", "variants": []},
    {
        "number": 149,
        "radical": "言",
        "name_vi": "ngôn",
        "meaning_vi": "lời nói",
        "variants": ["讠"],
    },
]


def seed(conn):
    conn.execute("INSERT INTO hsk_char (level, char) VALUES (1,'好'),(2,'说'),(3,'龘'),(7,'一')")
    conn.execute("INSERT INTO hsk_word (level, simplified, pinyin) VALUES (1,'好吃','hǎochī')")
    conn.commit()


def run(conn, tmp_path, store, overrides=None):
    z, m, t = make_files(tmp_path)
    return import_hanzi(
        conn,
        unihan_zip=z,
        mmh_dictionary=m,
        strokes_tgz=t,
        radicals=RADICALS,
        overrides=overrides or {},
        store=store,
        out_dir=tmp_path / "out",
    )


def row(conn, ch):
    return conn.execute(
        "SELECT han_viet, han_viet_source, decomposition, radical, etymology_hint,"
        " stroke_count, has_stroke_data FROM hanzi WHERE char = %s",
        (ch,),
    ).fetchone()


def test_import_hanzi_end_to_end(db_conn, tmp_path):
    seed(db_conn)
    store = LocalStrokeStore(tmp_path / "strokes")
    res = run(db_conn, tmp_path, store)
    assert res["hanzi"]["inserted"] == 5  # 好 说 龘 一 + chữ trong 好吃 (吃)
    assert row(db_conn, "好") == (
        ["hảo", "hiếu"],
        "unihan",
        "⿰女子",
        "女",
        "A woman 女 with a son 子",
        3,
        True,
    )
    # 说 là giản thể: lấy âm qua kTraditionalVariant; bộ 讠 đưa về bộ gốc 言
    r = row(db_conn, "说")
    assert r[0] == ["thuyết"] and r[1] == "unihan" and r[3] == "言"
    # chữ không có trong hanzi-writer-data
    assert row(db_conn, "龘")[5:] == (None, False)
    assert db_conn.execute("SELECT count(*) FROM radical_vi").fetchone()[0] == 2
    missing = (tmp_path / "out" / "hanviet_missing.csv").read_text(encoding="utf-8").splitlines()
    assert missing[0] == "char,level" and "龘,3" in missing and "一,7" not in missing
    sm = (tmp_path / "out" / "strokes_missing.csv").read_text(encoding="utf-8").splitlines()
    assert "龘,3" in sm


def test_override_sets_source_and_is_idempotent(db_conn, tmp_path):
    seed(db_conn)
    store = LocalStrokeStore(tmp_path / "strokes")
    ov = {"龘": {"han_viet": ["đạp"], "source": "ai"}}
    run(db_conn, tmp_path, store, ov)
    assert row(db_conn, "龘")[:2] == (["đạp"], "ai")
    before = db_conn.execute("SELECT count(*) FROM hanzi").fetchone()[0]
    res = run(db_conn, tmp_path, store, ov)
    assert res["hanzi"]["inserted"] == 0
    assert db_conn.execute("SELECT count(*) FROM hanzi").fetchone()[0] == before
    assert res["uploaded"] == 0  # lần 2 không tải lại nét
