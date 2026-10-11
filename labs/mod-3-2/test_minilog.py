"""Tests for Lab 3.2 part A (a miniature Kafka).   pytest labs/mod-3-2/test_minilog.py -v"""
import sys
from collections import Counter
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

m = labtools.load(__file__, "minilog.py")


def filled(n=4, keys=range(20), per_key=3):
    t = m.Topic(n)
    for i in range(per_key):
        for k in keys:
            t.produce(f"cust-{k}", f"event-{k}-{i}")
    return t


class TestProducing:
    def test_offsets_are_sequential_per_partition(self):
        t = m.Topic(3)
        seen = {}
        for i in range(30):
            p, off = t.produce(f"k{i}", i)
            assert off == seen.get(p, 0)
            seen[p] = off + 1
        assert t.end_offsets() == [seen.get(p, 0) for p in range(3)]

    def test_the_same_key_always_goes_to_the_same_partition(self):
        t = m.Topic(8)
        assert len({t.partition_for("cust-42") for _ in range(10)}) == 1
        assert m.Topic(8).partition_for("cust-42") == t.partition_for("cust-42"), "must not depend on per-process hashing"

    def test_order_is_kept_within_a_key(self):
        t = filled()
        for p in range(4):
            by_key = {}
            for rec in t.logs[p]:
                by_key.setdefault(rec.key, []).append(rec.value)
            for key, values in by_key.items():
                assert values == [f"event-{key.split('-')[1]}-{i}" for i in range(3)]

    def test_keys_spread_over_partitions(self):
        t = m.Topic(4)
        for k in range(2000):
            t.produce(f"cust-{k}", k)
        assert min(t.end_offsets()) > 300

    def test_records_without_a_key_are_spread_evenly(self):
        t = m.Topic(4)
        for i in range(40):
            t.produce(None, i)
        assert t.end_offsets() == [10, 10, 10, 10]


class TestConsuming:
    def test_a_consumer_reads_everything_once_and_commit_moves_the_group(self):
        t = filled()
        c = m.Consumer(t, "g")
        got = []
        while True:
            batch = c.poll(7)
            if not batch:
                break
            got += batch
        assert len(got) == 60 and len({(r.partition, r.offset) for r in got}) == 60
        assert t.lag("g") == 60, "nothing is committed yet"
        c.commit()
        assert t.lag("g") == 0

    def test_poll_respects_max_records_and_does_not_repeat(self):
        t = filled()
        c = m.Consumer(t, "g")
        a, b = c.poll(5), c.poll(5)
        assert len(a) == 5 and len(b) == 5 and not ({(r.partition, r.offset) for r in a} & {(r.partition, r.offset) for r in b})

    def test_a_crash_before_commit_means_the_work_is_seen_again(self):
        t = filled()
        c1 = m.Consumer(t, "g")
        processed = [(r.partition, r.offset) for r in c1.poll(20)]
        c1.commit()
        processed += [(r.partition, r.offset) for r in c1.poll(20)]  # processed, but the crash happens before commit
        c2 = m.Consumer(t, "g")                                       # a new instance resumes from the COMMITTED offsets
        while True:
            batch = c2.poll(20)
            if not batch:
                break
            processed += [(r.partition, r.offset) for r in batch]
        counts = Counter(processed)
        assert set(counts) == {(p, o) for p in range(4) for o in range(t.end_offsets()[p])}, "at-least-once: nothing is lost"
        assert sum(1 for c in counts.values() if c == 2) > 0, "and some records are delivered twice"

    def test_idempotent_processing_gives_exactly_once_effect(self):
        t = filled()
        totals, seen = Counter(), set()
        c1 = m.Consumer(t, "g")
        for r in c1.poll(25):
            if (r.partition, r.offset) not in seen:
                seen.add((r.partition, r.offset)); totals[r.key] += 1
        c2 = m.Consumer(t, "g")                                       # crash before any commit: everything is replayed
        while True:
            batch = c2.poll(10)
            if not batch:
                break
            for r in batch:
                if (r.partition, r.offset) not in seen:
                    seen.add((r.partition, r.offset)); totals[r.key] += 1
        assert set(totals.values()) == {3}

    def test_groups_are_independent(self):
        t = filled()
        a = m.Consumer(t, "billing"); a.poll(100); a.commit()
        assert t.lag("billing") == 0 and t.lag("analytics") == 60


class TestGroupsAndAssignment:
    def test_range_assignment(self):
        assert m.assign(6, ["a", "b"]) == {"a": [0, 1, 2], "b": [3, 4, 5]}
        assert m.assign(6, ["d", "c", "b", "a"]) == {"a": [0, 1], "b": [2, 3], "c": [4], "d": [5]}
        assert m.assign(2, ["a", "b", "c"]) == {"a": [0], "b": [1], "c": []}

    def test_two_members_split_the_work_without_overlap(self):
        t = filled(n=6, keys=range(40))
        plan = m.assign(6, ["w1", "w2"])
        seen = []
        for member, parts in plan.items():
            c = m.Consumer(t, "g", partitions=parts)
            while True:
                batch = c.poll(50)
                if not batch:
                    break
                seen += [(r.partition, r.offset) for r in batch]
        assert len(seen) == len(set(seen)) == 120

    def test_a_rebalance_after_a_member_leaves_covers_every_partition(self):
        before, after = m.assign(6, ["a", "b", "c"]), m.assign(6, ["a", "b"])
        assert sorted(sum(before.values(), [])) == sorted(sum(after.values(), [])) == list(range(6))


class TestCompaction:
    def test_keeps_the_latest_value_per_key_and_offsets_do_not_change(self):
        t = m.Topic(1)
        for k, v in [("a", 1), ("b", 1), ("a", 2), ("c", 1), ("a", 3), ("b", 2)]:
            t.produce(k, v)
        t.compact()
        assert [(r.offset, r.key, r.value) for r in t.logs[0]] == [(3, "c", 1), (4, "a", 3), (5, "b", 2)]
        assert t.end_offsets() == [6]

    def test_a_tombstone_removes_the_key(self):
        t = m.Topic(1)
        for k, v in [("a", 1), ("b", 1), ("a", None)]:
            t.produce(k, v)
        t.compact()
        assert [r.key for r in t.logs[0]] == ["b"]
