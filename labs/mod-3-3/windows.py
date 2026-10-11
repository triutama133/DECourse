"""Lab 3.3 part A: event-time windows and watermarks, in plain Python.   pytest labs/mod-3-3/test_windows.py -v

You will model how Structured Streaming decides WHEN a window may be emitted and WHICH late events are dropped.
Times are integers (epoch seconds); an event is a tuple (key, event_time, value).
"""
import math

NEG_INF = -math.inf


def window_starts(ts, size, slide):
    """Start times (sorted) of every window [start, start + size) that CONTAINS ts, for windows that begin at multiples of
    `slide`. slide == size is a tumbling window (exactly one start); slide < size is a sliding window (size // slide starts).
    Example: window_starts(125, 300, 300) == [0];   window_starts(125, 300, 60) == [-120, -60, 0, 60]"""
    raise NotImplementedError("TODO: window_starts")


class WindowedAggregator:
    """Counts and sums per (key, window), with a watermark. One add_batch() call equals one micro-batch.

    Rules (they are exactly how Spark behaves; the tests also compare with real Spark in part B):
      * `watermark` is computed from PREVIOUS batches: it starts at -inf; after a batch it becomes
        max(watermark, newest event time in that batch - delay). The batch's own events do not move it until the NEXT batch.
      * `evicted_up_to` is the watermark that was used for the previous eviction (starts at -inf). A window whose end is
        <= evicted_up_to has already been emitted and removed.
      * an event is added to every one of its windows that has NOT been evicted. An event whose windows have ALL been
        evicted is dropped (self.dropped += 1). Note: an event older than the watermark is NOT dropped as long as its window
        is still open.
      * at the END of a batch, every window whose end <= self.watermark (the watermark as it was at the START of the
        batch) is emitted and removed. Then evicted_up_to = that watermark, then the watermark advances from this batch.
    """

    def __init__(self, size, slide=None, delay=0):
        """TODO: size (window length), slide (default: size, i.e. tumbling), delay (watermark delay), the watermark,
        evicted_up_to, a dict `state` mapping (key, start) -> [count, total], and the counter `dropped`."""
        raise NotImplementedError("TODO: WindowedAggregator.__init__")

    def add_batch(self, events):
        """Process one micro-batch (a list of (key, ts, value)) and return the windows emitted at its end as a sorted list of
        (key, start, end, count, total)."""
        raise NotImplementedError("TODO: add_batch")

    def advance(self):
        """An EMPTY batch. Spark runs one after the last data of a run so the watermark can close windows."""
        raise NotImplementedError("TODO: advance")
