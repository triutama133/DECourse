"""Tests for Lab 2.6.   pip install pytest && pytest labs/mod-2-6/test_lab.py -v"""
import datetime as dt
import random
import sys
import zlib
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

lab = labtools.load(__file__, "warehouse_lab.py")
MiB = 1024 * 1024


def make_rows(n=20000, seed=7):
    rng = random.Random(seed)
    days = [(dt.date(2026, 1, 1) + dt.timedelta(days=i)).isoformat() for i in range(365)]
    return [{"order_date": rng.choice(days), "customer_id": rng.randint(1, 5000), "status": rng.choice(["paid", "shipped", "cancelled"]),
             "total": rng.randint(10000, 500000), "note": "x" * 20} for _ in range(n)]


ROWS = make_rows()


class TestMicroPartitions:
    def test_partitions_hold_at_most_target_rows_and_lose_nothing(self):
        parts = lab.build_micro_partitions(ROWS, 1000)
        assert len(parts) == 20 and all(len(p["rows"]) <= 1000 for p in parts)
        assert sum(len(p["rows"]) for p in parts) == len(ROWS)

    def test_last_partition_takes_the_remainder(self):
        parts = lab.build_micro_partitions(ROWS[:2500], 1000)
        assert [len(p["rows"]) for p in parts] == [1000, 1000, 500]

    def test_zone_maps_are_the_true_min_and_max_of_every_column(self):
        for p in lab.build_micro_partitions(ROWS, 700):
            for col in ROWS[0]:
                values = [r[col] for r in p["rows"]]
                assert p["min"][col] == min(values) and p["max"][col] == max(values)

    def test_without_a_cluster_key_the_order_is_kept(self):
        parts = lab.build_micro_partitions(ROWS[:100], 40)
        assert [r for p in parts for r in p["rows"]] == ROWS[:100]

    def test_with_a_cluster_key_the_rows_are_sorted_by_it(self):
        parts = lab.build_micro_partitions(ROWS, 1000, cluster_key="order_date")
        flat = [r["order_date"] for p in parts for r in p["rows"]]
        assert flat == sorted(flat)

    def test_the_input_list_is_not_modified(self):
        copy = list(ROWS[:500])
        lab.build_micro_partitions(copy, 100, cluster_key="total")
        assert copy == ROWS[:500]


class TestPrune:
    PARTS = [
        {"rows": [], "min": {"d": 1}, "max": {"d": 10}},
        {"rows": [], "min": {"d": 11}, "max": {"d": 20}},
        {"rows": [], "min": {"d": 21}, "max": {"d": 30}},
    ]

    def test_keeps_only_overlapping_partitions(self):
        assert lab.prune(self.PARTS, "d", 12, 15) == [1]
        assert lab.prune(self.PARTS, "d", 10, 11) == [0, 1]

    def test_a_range_outside_everything_prunes_everything(self):
        assert lab.prune(self.PARTS, "d", 100, 200) == []

    def test_bounds_are_inclusive(self):
        assert lab.prune(self.PARTS, "d", 20, 20) == [1] and lab.prune(self.PARTS, "d", 21, 21) == [2]


class TestScan:
    def brute(self, lo, hi, cols):
        return [{c: r[c] for c in cols} for r in ROWS if lo <= r["order_date"] <= hi]

    @pytest.mark.parametrize("clustered", [False, True])
    def test_the_answer_is_correct_whatever_the_layout(self, clustered):
        parts = lab.build_micro_partitions(ROWS, 500, cluster_key="order_date" if clustered else None)
        rows, _ = lab.scan(parts, "order_date", "2026-03-01", "2026-03-07", ["customer_id", "total"])
        expected = self.brute("2026-03-01", "2026-03-07", ["customer_id", "total"])
        assert sorted(map(str, rows)) == sorted(map(str, expected))

    def test_only_requested_columns_come_back(self):
        parts = lab.build_micro_partitions(ROWS, 500)
        rows, _ = lab.scan(parts, "order_date", "2026-03-01", "2026-03-02", ["status"])
        assert rows and all(set(r) == {"status"} for r in rows)

    def test_clustering_makes_a_filter_scan_a_few_partitions_instead_of_all(self):
        random_parts = lab.build_micro_partitions(ROWS, 200)
        clustered = lab.build_micro_partitions(ROWS, 200, cluster_key="order_date")
        _, s1 = lab.scan(random_parts, "order_date", "2026-03-01", "2026-03-07", ["total"])
        _, s2 = lab.scan(clustered, "order_date", "2026-03-01", "2026-03-07", ["total"])
        assert s1["partitions_total"] == s2["partitions_total"] == 100
        assert s1["partitions_scanned"] > 90 and s2["partitions_scanned"] <= 4

    def test_fewer_partitions_means_fewer_bytes_billed(self):
        random_parts = lab.build_micro_partitions(ROWS, 200)
        clustered = lab.build_micro_partitions(ROWS, 200, cluster_key="order_date")
        _, s1 = lab.scan(random_parts, "order_date", "2026-03-01", "2026-03-07", ["total"])
        _, s2 = lab.scan(clustered, "order_date", "2026-03-01", "2026-03-07", ["total"])
        assert s2["bytes_billed"] * 20 < s1["bytes_billed"]

    def test_selecting_fewer_columns_bills_fewer_bytes(self):
        parts = lab.build_micro_partitions(ROWS, 200, cluster_key="order_date")
        _, one = lab.scan(parts, "order_date", "2026-03-01", "2026-03-07", ["total"])
        _, five = lab.scan(parts, "order_date", "2026-03-01", "2026-03-07", ["order_date", "customer_id", "status", "total", "note"])
        assert one["rows_read"] == five["rows_read"] and five["bytes_billed"] > 5 * one["bytes_billed"]

    def test_bytes_billed_is_exact_for_a_tiny_example(self):
        rows = [{"d": 1, "name": "ab"}, {"d": 2, "name": "cde"}, {"d": 9, "name": "zzzz"}]
        parts = lab.build_micro_partitions(rows, 2, cluster_key="d")
        _, st = lab.scan(parts, "d", 1, 2, ["name"])
        assert st == {"partitions_total": 2, "partitions_scanned": 1, "rows_read": 2, "bytes_billed": 5}

    def test_query_cost(self):
        assert lab.query_cost(10 * 10**12) == pytest.approx(50.0)
        assert lab.query_cost(10**12, price_per_tb=6.25) == pytest.approx(6.25)


class TestClusteringQuality:
    def test_random_order_overlaps_almost_everything(self):
        parts = lab.build_micro_partitions(ROWS, 200)
        assert lab.average_overlap(parts, "order_date") > 90

    def test_clustered_data_barely_overlaps(self):
        parts = lab.build_micro_partitions(ROWS, 200, cluster_key="order_date")
        assert lab.average_overlap(parts, "order_date") < 4

    def test_a_single_partition_overlaps_only_itself(self):
        assert lab.average_overlap(lab.build_micro_partitions(ROWS[:50], 100), "total") == 1.0


class TestDistribution:
    def test_key_distribution_keeps_equal_keys_together(self):
        placed = lab.distribute(ROWS[:3000], "customer_id", 4, "key")
        home = {}
        for node, rows in placed.items():
            for r in rows:
                assert home.setdefault(r["customer_id"], node) == node
        assert home[ROWS[0]["customer_id"]] == zlib.crc32(str(ROWS[0]["customer_id"]).encode()) % 4

    def test_even_distribution_is_balanced(self):
        placed = lab.distribute(ROWS[:1001], "customer_id", 4, "even")
        assert sorted(len(v) for v in placed.values()) == [250, 250, 250, 251]

    def test_all_distribution_copies_everything_everywhere(self):
        placed = lab.distribute(ROWS[:10], "customer_id", 3, "all")
        assert all(len(v) == 10 for v in placed.values())

    def test_no_row_is_lost_with_key_or_even(self):
        for style in ("key", "even"):
            placed = lab.distribute(ROWS[:777], "customer_id", 5, style)
            assert sum(len(v) for v in placed.values()) == 777 and set(placed) == set(range(5))

    def test_unknown_style_is_an_error(self):
        with pytest.raises(ValueError, match="unknown distribution style: random"):
            lab.distribute(ROWS[:5], "customer_id", 2, "random")


class TestJoinMovement:
    def test_co_located_join_moves_nothing(self):
        assert lab.join_rows_moved(1000, 500, "customer_id", ("key", "customer_id"), ("key", "customer_id")) == 0

    def test_a_replicated_small_table_moves_nothing(self):
        assert lab.join_rows_moved(1_000_000, 50, "customer_id", ("even", None), ("all", None)) == 0
        assert lab.join_rows_moved(50, 1_000_000, "customer_id", ("all", None), ("even", None)) == 0

    def test_only_one_side_on_the_join_key_moves_the_other_side(self):
        assert lab.join_rows_moved(1000, 500, "customer_id", ("key", "customer_id"), ("even", None)) == 500
        assert lab.join_rows_moved(1000, 500, "customer_id", ("even", None), ("key", "customer_id")) == 1000

    def test_distributed_by_a_different_key_does_not_help(self):
        assert lab.join_rows_moved(1000, 500, "customer_id", ("key", "order_id"), ("key", "order_id")) == 1500

    def test_nothing_aligned_moves_both_sides(self):
        assert lab.join_rows_moved(1000, 500, "customer_id", ("even", None), ("even", None)) == 1500


class TestLoadPlanning:
    def test_a_small_load_is_one_file(self):
        assert lab.plan_load_files(80 * MiB, slices=16) == [80 * MiB]
        assert lab.plan_load_files(250 * MiB, slices=16) == [250 * MiB]

    def test_a_big_load_uses_a_multiple_of_the_slices(self):
        files = lab.plan_load_files(10 * 1024 * MiB, slices=16)
        assert len(files) == 48 and len(files) % 16 == 0 and sum(files) == 10 * 1024 * MiB
        assert max(files) <= 250 * MiB and max(files) - min(files) <= 1

    def test_uneven_totals_spread_the_remainder(self):
        files = lab.plan_load_files(1_000_000_007, slices=4, max_bytes=100_000_000)
        assert sum(files) == 1_000_000_007 and len(files) == 12 and max(files) - min(files) == 1

    def test_one_slice_needs_no_rounding(self):
        assert len(lab.plan_load_files(600 * MiB, slices=1)) == 3


class TestResultCache:
    def test_second_identical_query_is_a_cache_hit(self):
        calls = []
        cache = lab.ResultCache()
        compute = lambda: calls.append(1) or [("paid", 3)]  # noqa: E731
        assert cache.run("SELECT status, count(*) FROM orders GROUP BY 1", {"orders": 1}, compute) == ([("paid", 3)], False)
        assert cache.run("SELECT status, count(*) FROM orders GROUP BY 1", {"orders": 1}, compute) == ([("paid", 3)], True)
        assert len(calls) == 1

    def test_whitespace_and_case_do_not_matter(self):
        cache = lab.ResultCache()
        cache.run("SELECT  1\n FROM t", {"t": 1}, lambda: "r")
        assert cache.run("select 1 from   T", {"t": 1}, lambda: "other")[1] is True

    def test_a_changed_table_invalidates_the_result(self):
        cache = lab.ResultCache()
        cache.run("SELECT 1 FROM t", {"t": 1}, lambda: "old")
        assert cache.run("SELECT 1 FROM t", {"t": 2}, lambda: "new") == ("new", False)

    def test_different_queries_are_cached_separately(self):
        cache = lab.ResultCache()
        cache.run("SELECT 1", {}, lambda: "a")
        assert cache.run("SELECT 2", {}, lambda: "b") == ("b", False)


class TestQueueing:
    JOBS = [("a", 10), ("b", 10), ("c", 10), ("d", 10), ("e", 10)]

    def test_two_slots(self):
        r = lab.simulate_queue(self.JOBS, 2)
        assert r["a"] == (0, 10) and r["b"] == (0, 10) and r["c"] == (10, 20) and r["d"] == (10, 20) and r["e"] == (20, 30)

    def test_one_slot_runs_one_after_another(self):
        r = lab.simulate_queue(self.JOBS, 1)
        assert r["e"] == (40, 50)

    def test_more_slots_than_jobs_means_no_waiting(self):
        r = lab.simulate_queue(self.JOBS, 8)
        assert all(start == 0 for start, _ in r.values())

    def test_a_long_job_does_not_block_the_other_slot(self):
        r = lab.simulate_queue([("long", 100), ("s1", 5), ("s2", 5), ("s3", 5)], 2)
        assert r["s1"] == (0, 5) and r["s2"] == (5, 10) and r["s3"] == (10, 15)
