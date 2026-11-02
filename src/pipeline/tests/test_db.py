from clp.db import build_upsert_sql, log_run, upsert


class FakeCursor:
    """Mỗi tham số của executemany(returning=True) là một result set một dòng."""

    def __init__(self, rows):
        self.rows = rows
        self.pos = 0
        self.calls = []

    def executemany(self, sql, params, returning=False):
        self.calls.append((sql, list(params)))
        self.pos = 0
        self.n = len(self.calls[-1][1])

    def fetchall(self):
        return [self.rows.pop(0)] if self.rows else []

    def nextset(self):
        self.pos += 1
        return self.pos < self.n

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class FakeConn:
    def __init__(self, rows=()):
        self.cur = FakeCursor(list(rows))

    def cursor(self):
        return self.cur

    def commit(self):
        pass


def test_build_upsert_sql_updates_non_key_columns():
    sql = build_upsert_sql("hanzi", ["char", "meaning"], ["char"])
    assert "INSERT INTO hanzi (char, meaning) VALUES (%s, %s)" in sql
    assert "ON CONFLICT (char) DO UPDATE SET meaning = EXCLUDED.meaning" in sql
    assert "RETURNING (xmax = 0) AS inserted" in sql


def test_build_upsert_sql_all_columns_are_keys_does_nothing():
    sql = build_upsert_sql("t", ["a", "b"], ["a", "b"])
    assert "DO NOTHING" in sql


def test_upsert_counts_inserted_and_updated():
    conn = FakeConn(rows=[(True,), (True,), (False,)])
    res = upsert(conn, "hanzi", [{"char": "a", "m": 1}] * 3, ["char"])
    assert res == {"inserted": 2, "updated": 1}


def test_upsert_empty_rows():
    assert upsert(FakeConn(), "hanzi", [], ["char"]) == {"inserted": 0, "updated": 0}


def test_log_run_appends_one_line(tmp_path):
    p = tmp_path / "runs.log"
    log_run(p, "import_cedict", inserted=5, updated=2, skipped=1, now="2026-01-01T00:00:00")
    log_run(p, "import_hsk", inserted=1, updated=0, skipped=0, now="2026-01-01T00:00:01")
    lines = p.read_text().splitlines()
    assert lines[0] == "2026-01-01T00:00:00\timport_cedict\tinserted=5\tupdated=2\tskipped=1"
    assert len(lines) == 2
