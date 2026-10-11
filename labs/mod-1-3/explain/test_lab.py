"""Tests for Lab 1.3 part B (PostgreSQL indexes and EXPLAIN).

    pip install -r labs/mod-1-3/explain/requirements.txt
    pytest labs/mod-1-3/explain -v

By default the tests start a throw-away embedded PostgreSQL (pgserver). To use your own server instead
(for example the Docker Postgres), set DATABASE_URL to an EMPTY scratch database; the test table is recreated.
"""
import os
import re
import sys
from pathlib import Path

import psycopg
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared"))
import labtools  # noqa: E402

LAB = labtools.lab_dir(__file__)

SETUP = """
DROP TABLE IF EXISTS events;
CREATE TABLE events (
  event_id    bigserial PRIMARY KEY,
  customer_id int  NOT NULL,
  event_type  text NOT NULL,
  event_time  timestamptz NOT NULL,
  status      text NOT NULL DEFAULT 'done'
);
SELECT setseed(0.42);
INSERT INTO events (customer_id, event_type, event_time, status)
SELECT (random() * 9999)::int + 1,
       (ARRAY['page_view','add_to_cart','checkout','purchase'])[1 + (random() * 3)::int],
       timestamptz '2026-01-01' + (g * interval '6 seconds'),
       CASE WHEN random() < 0.002 THEN 'pending' ELSE 'done' END
FROM generate_series(1, 500000) g;
"""

BASELINE = {  # the meaning of Q1 to Q4, written without any tricks
    "Q1": "SELECT * FROM events WHERE customer_id = 4242",
    "Q2": "SELECT count(*) FROM events WHERE event_time >= '2026-01-10' AND event_time < '2026-01-11'",
    "Q3": "SELECT * FROM events WHERE customer_id = 4242 ORDER BY event_time DESC LIMIT 10",
    "Q4": "SELECT count(*) FROM events WHERE date(event_time) = '2026-01-10'",
}


def statements(text):
    body = "\n".join(l for l in text.splitlines() if not l.strip().startswith("--"))
    return [s.strip() for s in body.split(";") if s.strip()]


def parse_queries(text):
    parts = re.split(r"^-- (Q\d)\b.*$", text, flags=re.M)
    return {parts[i]: "\n".join(l for l in parts[i + 1].splitlines() if not l.strip().startswith("--")).strip().rstrip(";")
            for i in range(1, len(parts), 2)}


def walk(node, acc):
    acc.append(node)
    for child in node.get("Plans", []):
        walk(child, acc)
    return acc


@pytest.fixture(scope="module")
def db(tmp_path_factory):
    url = os.environ.get("DATABASE_URL")
    server = None
    if not url:
        import pgserver
        server = pgserver.get_server(tmp_path_factory.mktemp("pg"))
        url = server.get_uri()
    conn = psycopg.connect(url, autocommit=True)
    conn.execute("SET TIME ZONE 'UTC'")
    for stmt in statements(SETUP):
        conn.execute(stmt)
    for stmt in statements((LAB / "indexes.sql").read_text()):
        conn.execute(stmt)
    conn.execute("ANALYZE events")
    yield conn
    conn.close()
    if server:
        server.cleanup()


@pytest.fixture(scope="module")
def queries():
    q = parse_queries((LAB / "queries.sql").read_text())
    assert set(q) == {"Q1", "Q2", "Q3", "Q4"}, "keep the four '-- Qn' markers"
    return q


@pytest.fixture(scope="module")
def plans(db, queries):
    out = {}
    for name, sql in queries.items():
        out[name] = walk(db.execute("EXPLAIN (FORMAT JSON) " + sql).fetchone()[0][0]["Plan"], [])
    return out


@pytest.mark.parametrize("name", ["Q1", "Q2", "Q3", "Q4"])
def test_no_sequential_scan_on_events(plans, name):
    seq = [n for n in plans[name] if n["Node Type"] == "Seq Scan" and n.get("Relation Name") == "events"]
    assert not seq, f"{name} still reads the whole table; add an index it can use (or rewrite the query)"


def test_latest_events_query_needs_no_sort(plans):
    assert "Sort" not in {n["Node Type"] for n in plans["Q3"]}, \
        "Q3 sorts rows after reading them: make the index order match WHERE and ORDER BY (equality column first, then the sort column)"


@pytest.mark.parametrize("name", ["Q1", "Q2", "Q3", "Q4"])
def test_queries_still_mean_the_same_thing(db, queries, name):
    mine = sorted(db.execute(queries[name]).fetchall())
    expected = sorted(db.execute(BASELINE[name]).fetchall())
    assert mine == expected


def test_not_over_indexed_and_no_dead_indexes(db, plans):
    created = {r[0] for r in db.execute(
        "SELECT indexname FROM pg_indexes WHERE tablename = 'events' AND indexname <> 'events_pkey'").fetchall()}
    assert 1 <= len(created) <= 3, f"you created {len(created)} indexes; use between 1 and 3"
    used = {n["Index Name"] for p in plans.values() for n in p if n.get("Index Name")}
    dead = created - used
    assert not dead, f"indexes that no query uses (they only slow writes down): {sorted(dead)}"
