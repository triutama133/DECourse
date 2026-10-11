"""Tests for Lab 1.7.   pip install pytest && pytest labs/mod-1-7/test_lab.py -v"""
import sys
from collections import Counter
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

lab = labtools.load(__file__, "nosql_lab.py")


class Clock:
    def __init__(self):
        self.t = 0.0

    def __call__(self):
        return self.t


class TestKeyValueStore:
    def test_set_and_get(self):
        kv = lab.KeyValueStore(Clock())
        kv.set("session:1", {"user": 7})
        assert kv.get("session:1") == {"user": 7} and kv.get("missing") is None

    def test_a_key_expires_after_its_ttl(self):
        clock = Clock()
        kv = lab.KeyValueStore(clock)
        kv.set("otp", "123456", ttl=30)
        clock.t = 29.9
        assert kv.get("otp") == "123456"
        clock.t = 30
        assert kv.get("otp") is None and kv.keys() == []

    def test_ttl_reports_the_time_left(self):
        clock = Clock()
        kv = lab.KeyValueStore(clock)
        kv.set("a", 1, ttl=10)
        kv.set("b", 2)
        clock.t = 4
        assert kv.ttl("a") == pytest.approx(6) and kv.ttl("b") is None and kv.ttl("zzz") is None

    def test_overwriting_resets_the_expiry(self):
        clock = Clock()
        kv = lab.KeyValueStore(clock)
        kv.set("a", 1, ttl=10)
        clock.t = 8
        kv.set("a", 2, ttl=10)
        clock.t = 15
        assert kv.get("a") == 2

    def test_delete(self):
        kv = lab.KeyValueStore(Clock())
        kv.set("a", 1)
        assert kv.delete("a") is True and kv.delete("a") is False and kv.get("a") is None

    def test_least_recently_used_key_is_evicted(self):
        kv = lab.KeyValueStore(Clock(), max_items=2)
        kv.set("a", 1)
        kv.set("b", 2)
        kv.get("a")            # a is now more recent than b
        kv.set("c", 3)
        assert kv.keys() == ["a", "c"]

    def test_expired_keys_go_before_live_ones(self):
        clock = Clock()
        kv = lab.KeyValueStore(clock, max_items=2)
        kv.set("old", 1, ttl=5)
        kv.set("keep", 2)
        clock.t = 6
        kv.set("new", 3)
        assert kv.keys() == ["keep", "new"]


class TestDocumentStore:
    @pytest.fixture()
    def db(self):
        d = lab.DocumentStore()
        for doc in [
            {"name": "Sari", "age": 31, "address": {"city": "Jakarta"}, "tags": ["vip"]},
            {"name": "Budi", "age": 17, "address": {"city": "Bandung"}},
            {"name": "Citra", "age": 45, "address": {"city": "Jakarta"}},
            {"name": "Dewi", "age": 70},
        ]:
            d.insert(doc)
        return d

    def test_insert_assigns_ids_and_copies(self):
        d = lab.DocumentStore()
        original = {"x": 1}
        assert d.insert(original) == "1" and d.insert({"x": 2}) == "2" and "_id" not in original
        assert d.insert({"_id": "custom", "x": 3}) == "custom"

    def test_find_all_and_equality(self, db):
        assert len(db.find()) == 4
        assert [x["name"] for x in db.find({"name": "Budi"})] == ["Budi"]

    def test_nested_paths(self, db):
        assert [x["name"] for x in db.find({"address.city": "Jakarta"})] == ["Sari", "Citra"]

    def test_comparison_operators(self, db):
        assert [x["name"] for x in db.find({"age": {"$gte": 18, "$lt": 65}})] == ["Sari", "Citra"]
        assert [x["name"] for x in db.find({"age": {"$gt": 45}})] == ["Dewi"]
        assert [x["name"] for x in db.find({"age": {"$in": [17, 70]}})] == ["Budi", "Dewi"]

    def test_a_missing_field_never_matches_equality_but_matches_ne(self, db):
        assert "Dewi" not in [x["name"] for x in db.find({"address.city": "Jakarta"})]
        assert "Dewi" in [x["name"] for x in db.find({"address.city": {"$ne": "Jakarta"}})]
        assert "Dewi" not in [x["name"] for x in db.find({"address.city": {"$gt": "A"}})]

    def test_all_conditions_must_hold(self, db):
        assert [x["name"] for x in db.find({"address.city": "Jakarta", "age": {"$gt": 40}})] == ["Citra"]

    def test_without_an_index_every_document_is_scanned(self, db):
        db.find({"name": "Budi"})
        assert db.last_scanned == 4

    def test_an_index_means_only_matching_documents_are_scanned(self, db):
        db.create_index("name")
        assert [x["name"] for x in db.find({"name": "Budi"})] == ["Budi"]
        assert db.last_scanned == 1

    def test_the_index_is_kept_up_to_date_by_new_inserts(self, db):
        db.create_index("address.city")
        db.insert({"name": "Eko", "address": {"city": "Jakarta"}})
        assert [x["name"] for x in db.find({"address.city": "Jakarta"})] == ["Sari", "Citra", "Eko"] and db.last_scanned == 3


class TestHashRing:
    KEYS = [f"user:{i}" for i in range(3000)]

    def test_a_key_always_goes_to_the_same_node(self):
        ring = lab.HashRing(["a", "b", "c"])
        assert all(ring.node_for(k) == ring.node_for(k) for k in self.KEYS[:100])

    def test_load_is_spread_roughly_evenly(self):
        ring = lab.HashRing(["a", "b", "c"], vnodes=200)
        counts = Counter(ring.node_for(k) for k in self.KEYS)
        assert set(counts) == {"a", "b", "c"} and min(counts.values()) > 0.2 * len(self.KEYS)

    def test_removing_a_node_moves_only_that_nodes_keys(self):
        ring = lab.HashRing(["a", "b", "c", "d"])
        before = {k: ring.node_for(k) for k in self.KEYS}
        ring.remove_node("c")
        after = {k: ring.node_for(k) for k in self.KEYS}
        moved = [k for k in self.KEYS if before[k] != after[k]]
        assert all(before[k] == "c" for k in moved) and all(after[k] != "c" for k in self.KEYS)

    def test_adding_a_node_moves_about_one_nth_of_the_keys(self):
        ring = lab.HashRing(["a", "b", "c", "d"], vnodes=200)
        before = {k: ring.node_for(k) for k in self.KEYS}
        ring.add_node("e")
        moved = sum(1 for k in self.KEYS if before[k] != ring.node_for(k))
        assert 0.10 * len(self.KEYS) < moved < 0.32 * len(self.KEYS)       # about 1/5; a modulo hash would move about 4/5

    def test_every_moved_key_moved_to_the_new_node(self):
        ring = lab.HashRing(["a", "b", "c"])
        before = {k: ring.node_for(k) for k in self.KEYS}
        ring.add_node("z")
        assert all(ring.node_for(k) == "z" for k in self.KEYS if ring.node_for(k) != before[k])

    def test_an_empty_ring_is_an_error(self):
        with pytest.raises(ValueError, match="no nodes"):
            lab.HashRing([]).node_for("x")


class TestQuorum:
    def test_overlap_rule(self):
        assert lab.quorum_overlaps(3, 2, 2) and lab.quorum_overlaps(5, 3, 3) and lab.quorum_overlaps(3, 1, 3)
        assert not lab.quorum_overlaps(3, 1, 1) and not lab.quorum_overlaps(3, 1, 2) and not lab.quorum_overlaps(4, 2, 2)

    def test_with_r_plus_w_not_above_n_a_read_can_be_stale(self):
        rs = lab.ReplicaSet(3)
        rs.write("v1", w=1)
        assert rs.read(r=1) is None            # the read asked a replica the write never reached

    def test_with_overlapping_quorums_a_read_sees_the_latest_write(self):
        rs = lab.ReplicaSet(3)
        rs.write("v1", w=2)
        rs.write("v2", w=2)
        assert rs.read(r=2) == "v2"

    def test_write_to_all_and_read_one_is_also_safe(self):
        rs = lab.ReplicaSet(3)
        rs.write("v1", w=3)
        assert rs.read(r=1) == "v1"

    def test_a_write_fails_when_too_few_replicas_are_up(self):
        rs = lab.ReplicaSet(3)
        with pytest.raises(lab.Unavailable):
            rs.write("x", w=2, down={0, 1})

    def test_a_read_fails_when_too_few_replicas_are_up(self):
        rs = lab.ReplicaSet(3)
        rs.write("x", w=3)
        with pytest.raises(lab.Unavailable):
            rs.read(r=2, down={1, 2})

    def test_a_write_skips_replicas_that_are_down(self):
        rs = lab.ReplicaSet(3)
        rs.write("v1", w=2, down={0})
        assert rs.replicas == [(0, None), (1, "v1"), (1, "v1")]


class TestWideColumnTable:
    @pytest.fixture()
    def table(self):
        t = lab.WideColumnTable("customer_id", "order_ts")
        for cid, ts in [(7, "2026-01-03"), (7, "2026-01-01"), (7, "2026-01-02"), (3, "2026-01-05"), (3, "2026-01-04")]:
            t.insert({"customer_id": cid, "order_ts": ts, "total": 1})
        return t

    def test_rows_of_a_partition_come_back_sorted_by_clustering_key(self, table):
        assert [r["order_ts"] for r in table.query(7)] == ["2026-01-01", "2026-01-02", "2026-01-03"]

    def test_descending(self, table):
        assert [r["order_ts"] for r in table.query(7, descending=True)] == ["2026-01-03", "2026-01-02", "2026-01-01"]

    def test_a_range_of_the_clustering_key(self, table):
        assert [r["order_ts"] for r in table.query(7, start="2026-01-02")] == ["2026-01-02", "2026-01-03"]
        assert [r["order_ts"] for r in table.query(7, start="2026-01-01", end="2026-01-02")] == ["2026-01-01", "2026-01-02"]

    def test_a_query_touches_only_one_partition(self, table):
        table.query(3)
        assert table.last_scanned == 2 and table.partition_count() == 2

    def test_the_same_primary_key_is_an_upsert(self, table):
        table.insert({"customer_id": 7, "order_ts": "2026-01-02", "total": 99})
        rows = table.query(7)
        assert len(rows) == 3 and rows[1]["total"] == 99

    def test_you_cannot_query_without_the_partition_key(self, table):
        with pytest.raises(ValueError, match="partition key"):
            table.query(None)

    def test_an_unknown_partition_is_just_empty(self, table):
        assert table.query(999) == []
