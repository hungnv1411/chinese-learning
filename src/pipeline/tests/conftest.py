"""Fixture Postgres thật cho test tích hợp. Cần TEST_DATABASE_URL (database bất kỳ trên server);
test tự tạo và xóa một database riêng. Không có biến này thì test DB bị bỏ qua."""

import os
import re
import secrets
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import pytest

WEB_DB = Path(__file__).resolve().parents[2] / "apps" / "web" / "db"


def _apply_migrations(conn) -> None:
    conn.execute((WEB_DB / "pre-migrate.sql").read_text(encoding="utf-8"))
    for f in sorted((WEB_DB / "migrations").glob("*.sql")):
        for stmt in re.split(r"--> statement-breakpoint\n?", f.read_text(encoding="utf-8")):
            if stmt.strip():
                conn.execute(stmt)


@pytest.fixture
def db_conn():
    admin_url = os.environ.get("TEST_DATABASE_URL")
    if not admin_url:
        pytest.skip("Không có TEST_DATABASE_URL")
    import psycopg

    name = f"clp_test_{secrets.token_hex(4)}"
    with psycopg.connect(admin_url, autocommit=True) as admin:
        admin.execute(f"CREATE DATABASE {name}")
        try:
            parts = urlsplit(admin_url)
            url = urlunsplit(parts._replace(path=f"/{name}"))
            with psycopg.connect(url) as conn:
                _apply_migrations(conn)
                conn.commit()
                yield conn
        finally:
            admin.execute(f"DROP DATABASE IF EXISTS {name} WITH (FORCE)")
