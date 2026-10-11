"""Lab 1.7: the core ideas behind key-value, document, wide-column and distributed databases, in plain Python.

Five small pieces; work in order and run the tests after each:    pytest labs/mod-1-7/test_lab.py -v
Everything is deterministic (the clock is passed in, nothing is random). The lessons explain what each piece models.
"""
import zlib  # noqa: F401  (HashRing needs it)
from bisect import bisect, insort  # noqa: F401
from collections import OrderedDict  # noqa: F401


# ------------------------------------------------------------ 1. key-value store (Redis-like; lesson 2)
class KeyValueStore:
    """A key-value store with expiry (TTL) and a size limit with LRU eviction.

    `clock` is a function that returns the current time in seconds (tests pass a fake clock, so no sleeping).
    - set(key, value, ttl=None): store the value; if ttl is given the key expires ttl seconds from now (expired when clock() >= expires_at).
      Setting a key makes it the most recently used.
    - get(key): the value, or None if the key is missing or expired (an expired key is removed). A successful get makes the key most recently used.
    - delete(key): remove it; return True if it existed.
    - ttl(key): seconds left (a number), None if the key is missing/expired OR has no expiry.
    - keys(): sorted list of live (not expired) keys.
    - max_items: when more than max_items LIVE keys exist after a set(), drop the LEAST recently used until the limit holds (expired keys go first).
    Hint: collections.OrderedDict with move_to_end() and popitem(last=False) keeps recency order for free.
    """

    def __init__(self, clock, max_items=None):
        raise NotImplementedError("TODO: implement KeyValueStore")

    def set(self, key, value, ttl=None):
        raise NotImplementedError("TODO: implement KeyValueStore.set")

    def get(self, key):
        raise NotImplementedError("TODO: implement KeyValueStore.get")

    def delete(self, key):
        raise NotImplementedError("TODO: implement KeyValueStore.delete")

    def ttl(self, key):
        raise NotImplementedError("TODO: implement KeyValueStore.ttl")

    def keys(self):
        raise NotImplementedError("TODO: implement KeyValueStore.keys")


# ------------------------------------------------------------ 2. document store (MongoDB-like; lesson 3)
class DocumentStore:
    """Store dicts ("documents") and find them with a query dict.

    - insert(doc): store a COPY of the dict. If it has no "_id", give it the next id as text: "1", "2", ... Return the _id.
    - find(query=None): documents (in _id order, sorted as text) that match EVERY condition of `query`; no query = all.
      A condition is either a plain value (equality) or a dict of operators: $gt $gte $lt $lte $ne $in, e.g. {"age": {"$gte": 18, "$lt": 65}}.
      Field names may be paths into nested dicts: "address.city". A document that lacks the field never matches an equality or $gt/$gte/$lt/$lte/$in
      condition; for $ne it DOES match (a missing field is "not equal").
    - create_index(field): build a lookup {value: set of ids} for an equality field. After that, find() with a plain equality on that field must look
      only at the documents in the index entry, not at all documents.
    - last_scanned: after every find(), the number of documents that find() had to look at (for a full scan: all of them).
    New inserts must keep existing indexes up to date.
    """

    def __init__(self):
        raise NotImplementedError("TODO: implement DocumentStore")

    def insert(self, doc):
        raise NotImplementedError("TODO: implement DocumentStore.insert")

    def create_index(self, field):
        raise NotImplementedError("TODO: implement DocumentStore.create_index")

    def find(self, query=None):
        raise NotImplementedError("TODO: implement DocumentStore.find")


# ------------------------------------------------------------ 3. consistent hashing (Cassandra / Dynamo-like; lesson 5)
class HashRing:
    """Decide which node stores a key, so that adding or removing a node moves only a small share of the keys.

    Each node is placed on a ring at `vnodes` positions: position = zlib.crc32(f"{node}#{i}".encode()) for i in range(vnodes).
    A key lives on the first node position at or after zlib.crc32(str(key).encode()), wrapping around to the start of the ring.
    - node_for(key): the node name; raise ValueError("the ring has no nodes") if empty.
    - add_node(node), remove_node(node).
    Hint: keep a sorted list of (position, node); bisect finds the first position >= the key's position.
    """

    def __init__(self, nodes, vnodes=100):
        raise NotImplementedError("TODO: implement HashRing")

    def add_node(self, node):
        raise NotImplementedError("TODO: implement HashRing.add_node")

    def remove_node(self, node):
        raise NotImplementedError("TODO: implement HashRing.remove_node")

    def node_for(self, key):
        raise NotImplementedError("TODO: implement HashRing.node_for")


# ------------------------------------------------------------ 4. quorum replication (lesson 5)
class Unavailable(Exception):
    """Raised when too few replicas are up to satisfy a read or a write."""


def quorum_overlaps(n, r, w):
    """True when every read quorum must overlap every write quorum (so a read sees the latest write): r + w > n."""
    raise NotImplementedError("TODO: implement quorum_overlaps")


class ReplicaSet:
    """n replicas of one value; each replica holds (version, value). Used to see when a read can be stale.

    - write(value, w, down=()): replicas whose index is in `down` are unreachable. Raise Unavailable if fewer than w replicas are up.
      Otherwise increase the version number by 1 and store (version, value) on the FIRST w live replicas (lowest indexes).
    - read(r, down=()): raise Unavailable if fewer than r replicas are up. Otherwise contact the LAST r live replicas (highest indexes) and
      return the value with the highest version among them.
    Initially every replica holds (0, None).
    """

    def __init__(self, n):
        raise NotImplementedError("TODO: implement ReplicaSet")

    def write(self, value, w, down=()):
        raise NotImplementedError("TODO: implement ReplicaSet.write")

    def read(self, r, down=()):
        raise NotImplementedError("TODO: implement ReplicaSet.read")


# ------------------------------------------------------------ 5. wide-column table (Cassandra-like; lesson 4)
class WideColumnTable:
    """A table whose primary key is (partition_key, clustering_key): rows with the same partition value live together, sorted by the clustering value.

    - insert(row): row is a dict. Same (partition, clustering) pair again: replace the old row (an upsert). Store a copy.
    - query(partition_value, start=None, end=None, descending=False): the rows of that partition ordered by clustering value ascending
      (descending=True reverses it), limited to start <= clustering <= end when given (either bound may be None).
      Raise ValueError("query needs the partition key") when partition_value is None: you cannot query without the partition key.
    - last_scanned: after every query, the number of rows in that ONE partition (a query never touches other partitions).
    - partition_count(): number of distinct partitions.
    """

    def __init__(self, partition_key, clustering_key):
        raise NotImplementedError("TODO: implement WideColumnTable")

    def insert(self, row):
        raise NotImplementedError("TODO: implement WideColumnTable.insert")

    def query(self, partition_value, start=None, end=None, descending=False):
        raise NotImplementedError("TODO: implement WideColumnTable.query")

    def partition_count(self):
        raise NotImplementedError("TODO: implement WideColumnTable.partition_count")
