"""Lab 3.2 part A: a miniature Kafka, to learn the semantics.   Tests: pytest labs/mod-3-2/test_minilog.py -v

No servers, no installs. Implement the Topic, assign and Consumer below.
"""
import zlib
from dataclasses import dataclass


@dataclass(frozen=True)
class Record:
    partition: int
    offset: int
    key: object
    value: object


class Topic:
    """A topic with N partitions. Each partition is an append-only log of Records with increasing offsets from 0."""

    def __init__(self, partitions):
        """TODO: remember the partition count; create one empty log per partition; track the next offset per partition;
        keep a dict `committed` mapping (group, partition) -> next offset that group should read."""
        raise NotImplementedError("TODO: Topic.__init__")

    def partition_for(self, key):
        """The partition a key goes to. The SAME key must always give the SAME partition, even across runs:
        use zlib.crc32(str(key).encode()) % number_of_partitions (Python's hash() is randomised per process!).
        A key of None has no ordering needs: spread those round-robin."""
        raise NotImplementedError("TODO: Topic.partition_for")

    def produce(self, key, value):
        """Append Record(partition, offset, key, value) to the key's partition and return (partition, offset)."""
        raise NotImplementedError("TODO: Topic.produce")

    def end_offsets(self):
        """List: for each partition, the offset the NEXT record will get."""
        raise NotImplementedError("TODO: Topic.end_offsets")

    def lag(self, group):
        """Total records the group has not yet committed past: sum over partitions of end_offset - committed_offset
        (a group that never committed has committed offset 0)."""
        raise NotImplementedError("TODO: Topic.lag")

    def compact(self):
        """Log compaction: in every partition keep only the LATEST record of each key (survivors keep their original
        offsets, so offsets can have gaps). If the latest record of a key has value None (a TOMBSTONE), the key disappears."""
        raise NotImplementedError("TODO: Topic.compact")


def assign(partitions, members):
    """Range assignment for a consumer group. Sort the member names; each member gets a contiguous block of partition
    numbers; when partitions do not divide evenly the FIRST members get one extra.
    assign(6, ['a','b']) == {'a': [0,1,2], 'b': [3,4,5]}      assign(6, ['d','c','b','a']) == {'a': [0,1], 'b': [2,3], 'c': [4], 'd': [5]}"""
    raise NotImplementedError("TODO: assign")


class Consumer:
    """Reads from the partitions it is assigned (default: all) as a member of a consumer group."""

    def __init__(self, topic, group, partitions=None):
        """TODO: remember topic, group and partitions; the starting position of each partition is the group's COMMITTED
        offset (0 if none). A brand new consumer in a group therefore RESUMES where the group stopped."""
        raise NotImplementedError("TODO: Consumer.__init__")

    def poll(self, max_records=10):
        """Return up to max_records Records, in offset order within each partition, starting at the current position of
        each assigned partition, and advance the positions past what you return. Does NOT commit."""
        raise NotImplementedError("TODO: Consumer.poll")

    def commit(self):
        """Store the current positions as the group's committed offsets on the topic."""
        raise NotImplementedError("TODO: Consumer.commit")
