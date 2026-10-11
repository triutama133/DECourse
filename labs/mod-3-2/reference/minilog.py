"""Reference solution for Lab 3.2 part A: a miniature Kafka."""
import zlib
from dataclasses import dataclass


@dataclass(frozen=True)
class Record:
    partition: int
    offset: int
    key: object
    value: object


class Topic:
    def __init__(self, partitions):
        self.n = partitions
        self.logs = [[] for _ in range(partitions)]      # each log: list of Record, offsets increase
        self.next_offset = [0] * partitions
        self.committed = {}                              # (group, partition) -> next offset to read
        self._rr = 0

    def partition_for(self, key):
        if key is None:                                  # no key: spread round-robin
            self._rr += 1
            return self._rr % self.n
        return zlib.crc32(str(key).encode()) % self.n    # same key -> same partition, always

    def produce(self, key, value):
        p = self.partition_for(key)
        off = self.next_offset[p]
        self.logs[p].append(Record(p, off, key, value))
        self.next_offset[p] += 1
        return p, off

    def end_offsets(self):
        return list(self.next_offset)

    def lag(self, group):
        return sum(self.next_offset[p] - self.committed.get((group, p), 0) for p in range(self.n))

    def compact(self):
        """Keep only the latest record per key in every partition (offsets of survivors do not change).
        A latest record whose value is None is a tombstone: the key disappears completely."""
        for p in range(self.n):
            latest = {}
            for rec in self.logs[p]:
                latest[rec.key] = rec
            self.logs[p] = [r for r in self.logs[p] if latest[r.key] is r and r.value is not None]


def assign(partitions, members):
    """Range assignment: sort the members, give each a contiguous block, the first (partitions % members) get one extra."""
    members = sorted(members)
    base, extra = divmod(partitions, len(members))
    out, start = {}, 0
    for i, m in enumerate(members):
        size = base + (1 if i < extra else 0)
        out[m] = list(range(start, start + size))
        start += size
    return out


class Consumer:
    def __init__(self, topic, group, partitions=None):
        self.topic, self.group = topic, group
        self.partitions = list(range(topic.n)) if partitions is None else list(partitions)
        self.position = {p: topic.committed.get((group, p), 0) for p in self.partitions}

    def poll(self, max_records=10):
        out = []
        for p in self.partitions:
            for rec in self.topic.logs[p]:
                if rec.offset >= self.position[p] and len(out) < max_records:
                    out.append(rec)
                    self.position[p] = rec.offset + 1
        return out

    def commit(self):
        for p in self.partitions:
            self.topic.committed[(self.group, p)] = self.position[p]
