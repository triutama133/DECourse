"""Reference solution for Lab 3.3 part A: event-time windows with a watermark, the way Spark Structured Streaming does it."""
import math

NEG_INF = -math.inf


def window_starts(ts, size, slide):
    """Start times (epoch seconds) of every window [start, start+size) that contains ts. slide == size means tumbling."""
    last = (ts // slide) * slide
    starts = []
    s = last
    while s > ts - size:
        starts.append(s)
        s -= slide
    return sorted(starts)


class WindowedAggregator:
    """Counts and sums per (key, window) with a watermark. One add_batch() call = one micro-batch."""

    def __init__(self, size, slide=None, delay=0):
        self.size, self.slide, self.delay = size, slide or size, delay
        self.watermark = NEG_INF        # computed from PREVIOUS batches
        self.evicted_up_to = NEG_INF    # the watermark used by the previous eviction: windows ending before this are gone
        self.state = {}                 # (key, start) -> [count, total]
        self.dropped = 0

    def add_batch(self, events):
        """events: list of (key, ts, value). Returns the windows emitted at the END of this batch as a sorted list of
        (key, start, end, count, total)."""
        for key, ts, value in events:
            kept = False
            for start in window_starts(ts, self.size, self.slide):
                if start + self.size > self.evicted_up_to:       # this window has not been evicted yet
                    cell = self.state.setdefault((key, start), [0, 0])
                    cell[0] += 1
                    cell[1] += value
                    kept = True
            if not kept:
                self.dropped += 1                                 # every window of this event is already gone: too late
        emitted = sorted((k, s, s + self.size, c, t) for (k, s), (c, t) in self.state.items() if s + self.size <= self.watermark)
        for k, s, _, _, _ in emitted:
            del self.state[(k, s)]
        self.evicted_up_to = self.watermark
        if events:
            self.watermark = max(self.watermark, max(ts for _, ts, _ in events) - self.delay)
        return emitted

    def advance(self):
        """An empty batch (Spark runs one after the last data of a run, so that the watermark can close windows)."""
        return self.add_batch([])
