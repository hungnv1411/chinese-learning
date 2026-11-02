"""Kết nối Postgres và upsert theo lô. Mọi lệnh pipeline idempotent qua `upsert`."""

import os
from pathlib import Path

BATCH = 1000


def connect(url: str | None = None):
    import psycopg

    return psycopg.connect(url or os.environ["DATABASE_URL"])


def build_upsert_sql(table: str, columns: list[str], key_cols: list[str]) -> str:
    cols = ", ".join(columns)
    marks = ", ".join(["%s"] * len(columns))
    updates = [c for c in columns if c not in key_cols]
    action = (
        "DO UPDATE SET " + ", ".join(f"{c} = EXCLUDED.{c}" for c in updates)
        if updates
        else "DO NOTHING"
    )
    return (
        f"INSERT INTO {table} ({cols}) VALUES ({marks}) "
        f"ON CONFLICT ({', '.join(key_cols)}) {action} "
        "RETURNING (xmax = 0) AS inserted"
    )


def upsert(conn, table: str, rows: list[dict], key_cols: list[str]) -> dict[str, int]:
    """Upsert theo khóa tự nhiên; trả số dòng thêm và sửa."""
    if not rows:
        return {"inserted": 0, "updated": 0}
    columns = list(rows[0].keys())
    sql = build_upsert_sql(table, columns, key_cols)
    inserted = updated = 0
    with conn.cursor() as cur:
        for row in rows:
            cur.execute(sql, [row[c] for c in columns])
            for (is_new,) in cur.fetchall():
                if is_new:
                    inserted += 1
                else:
                    updated += 1
    conn.commit()
    return {"inserted": inserted, "updated": updated}


def log_run(
    path: Path, command: str, *, inserted: int, updated: int, skipped: int, now: str
) -> None:
    """Ghi một dòng tóm tắt vào runs.log. `now` truyền vào để test được."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(f"{now}\t{command}\tinserted={inserted}\tupdated={updated}\tskipped={skipped}\n")
