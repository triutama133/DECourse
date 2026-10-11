"""Tests for Lab 3.2 part C (CDC from PostgreSQL).   pytest labs/mod-3-2/test_cdc.py -v

Needs `pip install psycopg[binary] pgserver` (an embedded PostgreSQL; the test enables wal_level=logical) OR set
DATABASE_URL to a PostgreSQL server that runs with wal_level=logical (for example the Docker one from this course).
"""
import os
import random
import sys
import tempfile
import uuid
from pathlib import Path

import pytest

psycopg = pytest.importorskip("psycopg")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import labtools  # noqa: E402
import pgoutput  # noqa: E402

lab = labtools.load(__file__, "cdc.py")
PK = {"public.orders": ["order_id"]}


@pytest.fixture(scope="module")
def server():
    url = os.environ.get("DATABASE_URL")
    if url:
        yield url
        return
    pgserver = pytest.importorskip("pgserver")
    d = tempfile.mkdtemp(prefix="cdc_pg_")
    srv = pgserver.get_server(d)
    with psycopg.connect(srv.get_uri(), autocommit=True) as c:
        for s in ("ALTER SYSTEM SET wal_level='logical'", "ALTER SYSTEM SET max_replication_slots=10", "ALTER SYSTEM SET max_wal_senders=10"):
            c.execute(s)
    srv.cleanup()
    srv = pgserver.get_server(d)
    yield srv.get_uri()
    srv.cleanup()


@pytest.fixture()
def db(server):
    """A fresh orders table, publication and replication slot for each test."""
    suffix = uuid.uuid4().hex[:6]
    conn = psycopg.connect(server, autocommit=True)
    conn.execute("DROP TABLE IF EXISTS orders CASCADE")
    conn.execute("CREATE TABLE orders (order_id int PRIMARY KEY, customer_id int, status text, total_idr int)")
    conn.execute(f"CREATE PUBLICATION pub_{suffix} FOR TABLE orders")
    conn.execute("SELECT pg_create_logical_replication_slot(%s, 'pgoutput')", (f"slot_{suffix}",))
    conn.slot, conn.pub = f"slot_{suffix}", f"pub_{suffix}"
    yield conn
    conn.execute("SELECT pg_drop_replication_slot(%s)", (conn.slot,))
    conn.execute(f"DROP PUBLICATION pub_{suffix}")
    conn.close()


def source_rows(conn):
    cur = conn.execute("SELECT order_id::text, customer_id::text, status, total_idr::text FROM orders ORDER BY order_id")
    cols = ["order_id", "customer_id", "status", "total_idr"]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def changes(conn):
    return pgoutput.read_changes(conn, conn.slot, conn.pub)


def scenario(conn):
    conn.execute("INSERT INTO orders VALUES (1,10,'paid',100000),(2,11,'paid',50000),(3,12,'paid',75000)")
    conn.execute("UPDATE orders SET status='shipped' WHERE order_id=1")
    conn.execute("DELETE FROM orders WHERE order_id=3")
    conn.execute("UPDATE orders SET order_id=20 WHERE order_id=2")        # the PRIMARY KEY changes


class TestToEvents:
    def test_default_replica_identity(self, db):
        scenario(db)
        ev = lab.to_events(changes(db), PK)
        assert [e["op"] for e in ev] == ["c", "c", "c", "u", "d", "u"]
        assert [e["key"] for e in ev] == [{"order_id": "1"}, {"order_id": "2"}, {"order_id": "3"}, {"order_id": "1"}, {"order_id": "3"}, {"order_id": "20"}]
        assert ev[0]["after"] == {"order_id": "1", "customer_id": "10", "status": "paid", "total_idr": "100000"} and ev[0]["before"] is None
        assert ev[3]["after"]["status"] == "shipped" and ev[3]["before"] is None and ev[3]["old_key"] is None
        assert ev[4]["after"] is None and ev[4]["before"] is None, "a delete's old row holds only the key: that is not a before-image"
        assert ev[5]["old_key"] == {"order_id": "2"} and ev[5]["key"] == {"order_id": "20"}

    def test_replica_identity_full_gives_before_images(self, db):
        db.execute("ALTER TABLE orders REPLICA IDENTITY FULL")
        db.execute("INSERT INTO orders VALUES (1,10,'paid',100000)")
        db.execute("UPDATE orders SET total_idr=999 WHERE order_id=1")
        db.execute("DELETE FROM orders WHERE order_id=1")
        ev = lab.to_events(changes(db), PK)
        assert [e["op"] for e in ev] == ["c", "u", "d"]
        assert ev[1]["before"]["total_idr"] == "100000" and ev[1]["after"]["total_idr"] == "999"
        assert ev[1]["key"] == {"order_id": "1"} and ev[1]["old_key"] is None
        assert ev[2]["before"] == {"order_id": "1", "customer_id": "10", "status": "paid", "total_idr": "999"} and ev[2]["after"] is None

    def test_positions_are_ordered_and_unique(self, db):
        scenario(db)
        pos = [e["pos"] for e in lab.to_events(changes(db), PK)]
        assert pos == sorted(pos) and len(set(pos)) == len(pos)


class TestApply:
    def test_the_replica_equals_the_source_table(self, db):
        scenario(db)
        state = lab.apply_events(lab.new_state(), lab.to_events(changes(db), PK))
        assert lab.materialize(state, "public.orders") == source_rows(db)

    def test_replaying_the_same_events_changes_nothing(self, db):
        scenario(db)
        ev = lab.to_events(changes(db), PK)
        once = lab.apply_events(lab.new_state(), ev)
        twice = lab.apply_events(lab.apply_events(lab.new_state(), ev), ev)
        assert lab.materialize(once, "public.orders") == lab.materialize(twice, "public.orders") == source_rows(db)

    def test_events_that_arrive_out_of_order_still_give_the_right_answer(self, db):
        scenario(db)
        ev = lab.to_events(changes(db), PK)
        for seed in range(5):
            shuffled = ev[:]
            random.Random(seed).shuffle(shuffled)
            state = lab.apply_events(lab.new_state(), shuffled)
            assert lab.materialize(state, "public.orders") == source_rows(db), f"order seed {seed}"

    def test_changes_inside_one_transaction_are_applied_in_order(self, db):
        with db.transaction():
            db.execute("INSERT INTO orders VALUES (7,1,'paid',1000)")
            db.execute("UPDATE orders SET total_idr = 2000 WHERE order_id = 7")
            db.execute("INSERT INTO orders VALUES (8,1,'paid',5)")
            db.execute("DELETE FROM orders WHERE order_id = 8")
        ev = lab.to_events(changes(db), PK)
        assert len({e["pos"][0] for e in ev}) == 1, "one transaction, one commit lsn"
        state = lab.apply_events(lab.new_state(), ev)
        assert lab.materialize(state, "public.orders") == [{"order_id": "7", "customer_id": "1", "status": "paid", "total_idr": "2000"}]

    def test_streaming_in_batches_keeps_the_replica_current(self, db):
        state = lab.new_state()
        db.execute("INSERT INTO orders VALUES (1,1,'paid',10),(2,2,'paid',20)")
        lab.apply_events(state, lab.to_events(changes(db), PK))
        db.execute("UPDATE orders SET status='refunded' WHERE order_id=2")
        db.execute("INSERT INTO orders VALUES (3,3,'paid',30)")
        lab.apply_events(state, lab.to_events(changes(db), PK))
        assert lab.materialize(state, "public.orders") == source_rows(db)
