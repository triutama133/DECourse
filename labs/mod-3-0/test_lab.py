"""Tests for Lab 3.0.   pip install pytest && pytest labs/mod-3-0/test_lab.py -v"""
import sys
import zlib
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

lab = labtools.load(__file__, "hadoop_lab.py")
MiB = 1024 * 1024
NODES = {"a1": "rack1", "a2": "rack1", "a3": "rack1", "b1": "rack2", "b2": "rack2", "c1": "rack3"}


class TestBlocks:
    def test_a_file_is_cut_into_full_blocks_and_a_remainder(self):
        assert lab.split_into_blocks(300 * MiB) == [128 * MiB, 128 * MiB, 44 * MiB]

    def test_exact_multiple_has_no_short_block(self):
        assert lab.split_into_blocks(256 * MiB) == [128 * MiB, 128 * MiB]

    def test_a_small_file_is_one_short_block(self):
        assert lab.split_into_blocks(1000) == [1000]

    def test_empty_file_has_no_blocks(self):
        assert lab.split_into_blocks(0) == []

    def test_custom_block_size_and_nothing_is_lost(self):
        blocks = lab.split_into_blocks(1000, block_size=300)
        assert blocks == [300, 300, 300, 100] and sum(blocks) == 1000


class TestReplicaPlacement:
    def test_default_policy_writer_other_rack_same_rack_as_second(self):
        assert lab.place_replicas(NODES, writer="a1") == ["a1", "b1", "b2"]

    def test_the_replicas_are_on_distinct_nodes_and_two_racks(self):
        r = lab.place_replicas(NODES, writer="b2")
        assert len(set(r)) == 3 and r[0] == "b2" and NODES[r[1]] != "rack2" and NODES[r[2]] == NODES[r[1]]
        assert len({NODES[n] for n in r}) == 2

    def test_a_block_survives_the_loss_of_a_whole_rack(self):
        r = lab.place_replicas(NODES, writer="a1")
        assert any(NODES[n] != "rack1" for n in r)  # at least one copy outside the writer's rack

    def test_factor_one_and_two(self):
        assert lab.place_replicas(NODES, "a1", factor=1) == ["a1"]
        assert lab.place_replicas(NODES, "a1", factor=2) == ["a1", "b1"]

    def test_factor_above_three_adds_unused_nodes_in_sorted_order(self):
        assert lab.place_replicas(NODES, "a1", factor=5) == ["a1", "b1", "b2", "a2", "a3"]

    def test_a_single_rack_cluster_still_gives_distinct_nodes(self):
        one = {"n1": "r", "n2": "r", "n3": "r", "n4": "r"}
        assert lab.place_replicas(one, "n3") == ["n3", "n1", "n2"]


class TestBlockLoss:
    PLACEMENTS = {"blk1": ["a1", "b1", "b2"], "blk2": ["a2", "b1", "b2"], "blk3": ["a1", "a2", "c1"]}

    def test_nothing_is_lost_while_one_replica_lives(self):
        assert lab.blocks_lost(self.PLACEMENTS, {"a1", "b1"}) == []

    def test_a_block_is_lost_only_when_all_its_replicas_failed(self):
        assert lab.blocks_lost(self.PLACEMENTS, {"a1", "b1", "b2"}) == ["blk1"]

    def test_a_double_failure_can_lose_several_blocks(self):
        assert lab.blocks_lost(self.PLACEMENTS, {"a1", "a2", "c1", "b1", "b2"}) == ["blk1", "blk2", "blk3"]


class TestSmallFilesProblem:
    def test_one_big_file_is_a_few_objects(self):
        # 1 file + 8 blocks of 128 MiB
        assert lab.metadata_objects(1024 * MiB, 1024 * MiB) == 9

    def test_the_same_data_as_tiny_files_is_millions_of_objects(self):
        one_tib = 1024 * 1024 * MiB
        big = lab.metadata_objects(one_tib, 1024 * MiB)
        small = lab.metadata_objects(one_tib, 1 * MiB)
        assert big == 1024 * 9 and small == 1024 * 1024 * 2
        assert small > 200 * big

    def test_a_last_smaller_file_still_counts(self):
        assert lab.metadata_objects(150, 100) == 4  # 2 files, 1 block each

    def test_memory_estimate(self):
        assert lab.namenode_memory_bytes(2_000_000) == 300_000_000
        assert lab.namenode_memory_bytes(10, bytes_per_object=100) == 1000


class TestMapReduceSteps:
    def test_map_phase_collects_every_pair_in_order(self):
        pairs = lab.map_phase(["a b", "c"], lambda line: [(w, 1) for w in line.split()])
        assert pairs == [("a", 1), ("b", 1), ("c", 1)]

    def test_a_record_may_produce_no_pairs(self):
        assert lab.map_phase([1, 2, 3, 4], lambda x: [("even", x)] if x % 2 == 0 else []) == [("even", 2), ("even", 4)]

    def test_partition_is_stable_and_uses_crc32(self):
        assert lab.partition("kopi", 4) == zlib.crc32(b"kopi") % 4
        assert lab.partition("kopi", 4) == lab.partition("kopi", 4)
        assert all(0 <= lab.partition(k, 3) < 3 for k in ["a", "b", 7, ("x", 1)])

    def test_shuffle_sends_each_key_to_exactly_one_reducer(self):
        pairs = [("a", 1), ("b", 2), ("a", 3), ("c", 4), ("b", 5)]
        reducers = lab.shuffle(pairs, 3)
        assert len(reducers) == 3
        seen = [k for groups in reducers for k, _ in groups]
        assert sorted(seen) == ["a", "b", "c"] and len(seen) == 3
        merged = {k: v for groups in reducers for k, v in groups}
        assert merged == {"a": [1, 3], "b": [2, 5], "c": [4]}

    def test_shuffle_sorts_keys_inside_a_reducer(self):
        for groups in lab.shuffle([(k, 1) for k in "zyxwvu"], 2):
            keys = [k for k, _ in groups]
            assert keys == sorted(keys)

    def test_reduce_phase_applies_the_reducer_per_key(self):
        assert lab.reduce_phase([("a", [1, 2]), ("b", [5])], lambda k, v: sum(v)) == [("a", 3), ("b", 5)]


class TestWordCountJob:
    LINES = ["to be or not to be", "to do is to be", "be quick"]

    def test_counts_words(self):
        results, _ = lab.run_job([self.LINES], lab.wordcount_mapper, lab.wordcount_reducer)
        assert dict(results) == {"to": 4, "be": 4, "or": 1, "not": 1, "do": 1, "is": 1, "quick": 1}

    def test_the_result_does_not_depend_on_splits_or_reducer_count(self):
        a, _ = lab.run_job([self.LINES], lab.wordcount_mapper, lab.wordcount_reducer, num_reducers=1)
        b, _ = lab.run_job([[l] for l in self.LINES], lab.wordcount_mapper, lab.wordcount_reducer, num_reducers=5)
        assert a == b

    def test_results_are_sorted_by_key(self):
        results, _ = lab.run_job([self.LINES], lab.wordcount_mapper, lab.wordcount_reducer)
        assert [k for k, _ in results] == sorted(k for k, _ in results)

    def test_case_is_ignored(self):
        results, _ = lab.run_job([["Kopi kopi KOPI"]], lab.wordcount_mapper, lab.wordcount_reducer)
        assert results == [("kopi", 3)]

    def test_a_combiner_gives_the_same_answer_with_less_network_traffic(self):
        plain, s1 = lab.run_job([self.LINES], lab.wordcount_mapper, lab.wordcount_reducer)
        combined, s2 = lab.run_job([self.LINES], lab.wordcount_mapper, lab.wordcount_reducer, combiner=lambda k, v: sum(v))
        assert plain == combined
        assert s1["map_output_pairs"] == s2["map_output_pairs"] == 13
        assert s1["shuffled_pairs"] == 13 and s2["shuffled_pairs"] == 7


class TestReduceSideJoin:
    CUSTOMERS = [{"customer_id": "1", "city": "Jakarta"}, {"customer_id": "2", "city": "Bandung"}, {"customer_id": "3", "city": "Jakarta"}]
    ORDERS = [
        {"order_id": "10", "customer_id": "1", "total_idr": "100000"},
        {"order_id": "11", "customer_id": "2", "total_idr": "50000"},
        {"order_id": "12", "customer_id": "1", "total_idr": "25000"},
        {"order_id": "13", "customer_id": "3", "total_idr": "10000"},
        {"order_id": "14", "customer_id": "99", "total_idr": "7000"},
    ]

    def test_revenue_per_city(self):
        assert lab.revenue_per_city(self.ORDERS, self.CUSTOMERS) == [("(unknown)", 7000), ("Bandung", 50000), ("Jakarta", 135000)]

    def test_does_not_depend_on_the_number_of_reducers(self):
        assert lab.revenue_per_city(self.ORDERS, self.CUSTOMERS, num_reducers=1) == lab.revenue_per_city(self.ORDERS, self.CUSTOMERS, num_reducers=7)

    def test_a_customer_without_orders_adds_nothing(self):
        assert lab.revenue_per_city([], self.CUSTOMERS) == []


class TestFaultTolerance:
    def test_a_failed_task_is_simply_run_again(self):
        calls = []

        def flaky(attempt):
            calls.append(attempt)
            if attempt < 3:
                raise RuntimeError("node lost")
            return "done"

        assert lab.retry_task(flaky) == "done" and calls == [1, 2, 3]

    def test_gives_up_after_max_attempts(self):
        def always(attempt):
            raise RuntimeError("disk full")

        with pytest.raises(RuntimeError, match="task failed after 3 attempts: disk full"):
            lab.retry_task(always, max_attempts=3)

    def test_other_errors_are_not_retried(self):
        def bug(attempt):
            raise KeyError("my bug")

        with pytest.raises(KeyError):
            lab.retry_task(bug)


class TestYarnScheduler:
    def test_first_fit_in_arrival_order(self):
        placed, pending = lab.allocate_containers([("etl", 4000), ("etl", 4000), ("bi", 2000)], {"n1": 8000, "n2": 4000})
        assert placed == [("etl", 4000, "n1"), ("etl", 4000, "n1"), ("bi", 2000, "n2")] and pending == []

    def test_what_does_not_fit_waits(self):
        placed, pending = lab.allocate_containers([("a", 3000), ("b", 3000), ("c", 3000)], {"n1": 4000, "n2": 4000})
        assert placed == [("a", 3000, "n1"), ("b", 3000, "n2")] and pending == [("c", 3000)]

    def test_nodes_are_not_changed(self):
        nodes = {"n1": 1000}
        lab.allocate_containers([("a", 500)], nodes)
        assert nodes == {"n1": 1000}
