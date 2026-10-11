"""Tests for Lab 3.3 part A (watermarks in plain Python).   pytest labs/mod-3-3/test_windows.py -v"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

m = labtools.load(__file__, "windows.py")
T0 = 1767607200          # 2026-01-05 10:00:00 UTC
MIN = 60


def at(minutes, seconds=0):
    return T0 + minutes * MIN + seconds


class TestWindowStarts:
    def test_tumbling(self):
        assert m.window_starts(at(2), 300, 300) == [T0]
        assert m.window_starts(at(5), 300, 300) == [at(5)], "a window start is inclusive"
        assert m.window_starts(at(4, 59), 300, 300) == [T0]

    def test_sliding_windows_overlap(self):
        starts = m.window_starts(at(7), 300, 60)
        assert starts == [at(3, 0) + 60, at(4), at(5), at(6), at(7)] or len(starts) == 5
        assert len(starts) == 5 and all(s <= at(7) < s + 300 for s in starts) and starts == sorted(starts)

    def test_every_event_is_in_size_over_slide_windows(self):
        for ts in range(T0, T0 + 3000, 37):
            assert len(m.window_starts(ts, 300, 60)) == 5
            assert len(m.window_starts(ts, 300, 300)) == 1


class TestWatermark:
    def agg(self):
        return m.WindowedAggregator(size=300, delay=120)

    def test_nothing_is_emitted_until_the_watermark_passes_a_window_end(self):
        a = self.agg()
        assert a.add_batch([("a", at(1), 10), ("a", at(2), 20), ("b", at(3), 5)]) == []
        assert a.watermark == at(1)                       # newest 10:03 minus 2 minutes
        assert a.add_batch([("a", at(6), 30), ("b", at(7), 7), ("a", at(4), 99)]) == []
        assert a.watermark == at(5)

    def test_a_window_is_emitted_at_the_end_of_the_batch_after_the_watermark_reached_its_end(self):
        a = self.agg()
        a.add_batch([("a", at(1), 10), ("a", at(2), 20), ("b", at(3), 5)])
        a.add_batch([("a", at(6), 30), ("b", at(7), 7), ("a", at(4), 99)])
        # the watermark is now 10:05. The next batch still counts events for [10:00,10:05), then emits it.
        out = a.add_batch([("a", at(11), 1), ("a", at(3), 1000), ("b", at(6), 50)])
        assert out == [("a", T0, T0 + 300, 4, 1129), ("b", T0, T0 + 300, 1, 5)]
        assert a.dropped == 0, "the 10:03 event was behind the watermark but its window was still open"

    def test_an_event_for_an_already_emitted_window_is_dropped(self):
        a = self.agg()
        a.add_batch([("a", at(1), 10), ("b", at(3), 5)])
        a.add_batch([("a", at(7), 7)])
        a.add_batch([("a", at(11), 1)])                   # emits [10:00,10:05)
        out = a.add_batch([("a", at(4), 500)])            # far too late
        assert a.dropped == 1 and out == []
        assert all(k[1] != T0 for k in a.state), "a dropped event must not recreate the window"

    def test_advance_closes_windows_without_new_data(self):
        a = self.agg()
        a.add_batch([("a", at(1), 1)])
        a.add_batch([("a", at(16), 2)])                   # watermark -> 10:14
        a.add_batch([("a", at(30), 3)])                   # emits [10:00,10:05) with the watermark from the previous batch
        out = a.advance()                                 # watermark 10:28: closes everything up to 10:25
        assert [(r[0], r[1] - T0, r[3]) for r in out] == [("a", 15 * MIN, 1)]

    def test_the_watermark_never_moves_backwards(self):
        a = self.agg()
        a.add_batch([("a", at(20), 1)])
        w = a.watermark
        a.add_batch([("a", at(1), 1)])                    # an old event in a later batch
        assert a.watermark == w

    def test_sliding_windows_emit_each_event_several_times(self):
        a = m.WindowedAggregator(size=300, slide=60, delay=0)
        a.add_batch([("a", at(10), 1)])
        a.add_batch([("a", at(30), 1)])
        out = a.add_batch([("a", at(60), 1)])
        assert len([r for r in out if r[3] == 1 and r[1] <= at(10) < r[2]]) == 5

    def test_a_full_scenario_matches_what_spark_does(self):
        """The exact scenario (and answers) observed from a real Structured Streaming job. Part B re-checks it with Spark."""
        a = self.agg()
        batches = [
            [("a", at(1), 10), ("a", at(2), 20), ("b", at(3), 5)],
            [("a", at(6), 30), ("b", at(7), 7), ("a", at(4), 99)],
            [("a", at(11), 1), ("a", at(3), 1000), ("b", at(6), 50)],
        ]
        emitted = []
        for b in batches:
            emitted += a.add_batch(b)
        emitted += a.advance()
        for b in ([("a", at(16), 2)], [("a", at(30), 3)]):
            emitted += a.add_batch(b)
        emitted += a.advance()
        assert sorted(emitted) == sorted([
            ("a", T0, T0 + 300, 4, 1129), ("b", T0, T0 + 300, 1, 5),
            ("a", at(5), at(10), 1, 30), ("b", at(5), at(10), 2, 57),
            ("a", at(10), at(15), 1, 1), ("a", at(15), at(20), 1, 2),
        ])
