"""Reference solution for Lab 1.7: the core ideas of key-value, document, wide-column and distributed stores (pure Python)."""
import zlib
from bisect import bisect, insort
from collections import OrderedDict


# ------------------------------------------------------------ key-value store (Redis-like)
class KeyValueStore:
    def __init__(self, clock, max_items=None):
        self.clock = clock          # a function returning "now" in seconds (injected so tests are deterministic)
        self.max_items = max_items
        self._data = OrderedDict()  # key -> (value, expires_at or None); order = least to most recently used

    def _alive(self, key):
        value, expires = self._data[key]
        if expires is not None and self.clock() >= expires:
            del self._data[key]
            return False
        return True

    def set(self, key, value, ttl=None):
        expires = None if ttl is None else self.clock() + ttl
        self._data[key] = (value, expires)
        self._data.move_to_end(key)
        if self.max_items is not None:
            for k in list(self._data):
                self._alive(k) if k in self._data else None
            while len(self._data) > self.max_items:
                self._data.popitem(last=False)

    def get(self, key):
        if key not in self._data or not self._alive(key):
            return None
        self._data.move_to_end(key)
        return self._data[key][0]

    def delete(self, key):
        return self._data.pop(key, None) is not None

    def ttl(self, key):
        if key not in self._data or not self._alive(key):
            return None
        expires = self._data[key][1]
        return None if expires is None else expires - self.clock()

    def keys(self):
        return sorted(k for k in list(self._data) if self._alive(k))


# ------------------------------------------------------------ document store (MongoDB-like)
def _get_path(doc, path):
    cur = doc
    for part in path.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return None, False
        cur = cur[part]
    return cur, True


_OPS = {
    "$gt": lambda a, b: a > b, "$gte": lambda a, b: a >= b, "$lt": lambda a, b: a < b,
    "$lte": lambda a, b: a <= b, "$ne": lambda a, b: a != b, "$in": lambda a, b: a in b,
}


def _matches(doc, query):
    for path, cond in query.items():
        value, found = _get_path(doc, path)
        if isinstance(cond, dict) and cond and all(k.startswith("$") for k in cond):
            for op, operand in cond.items():
                if op == "$ne":
                    if found and value == operand:
                        return False
                elif not found or value is None or not _OPS[op](value, operand):
                    return False
        elif not found or value != cond:
            return False
    return True


class DocumentStore:
    def __init__(self):
        self.docs = {}
        self._next = 1
        self.indexes = {}           # field -> {value: set of ids}
        self.last_scanned = 0

    def insert(self, doc):
        doc = dict(doc)
        if "_id" not in doc:
            doc["_id"] = str(self._next)
            self._next += 1
        self.docs[doc["_id"]] = doc
        for field, idx in self.indexes.items():
            value, found = _get_path(doc, field)
            if found:
                idx.setdefault(value, set()).add(doc["_id"])
        return doc["_id"]

    def create_index(self, field):
        idx = {}
        for _id, doc in self.docs.items():
            value, found = _get_path(doc, field)
            if found:
                idx.setdefault(value, set()).add(_id)
        self.indexes[field] = idx

    def find(self, query=None):
        query = query or {}
        candidates = None
        for field, cond in query.items():
            if field in self.indexes and not (isinstance(cond, dict) and cond and all(k.startswith("$") for k in cond)):
                candidates = self.indexes[field].get(cond, set())
                break
        ids = sorted(candidates) if candidates is not None else sorted(self.docs)
        self.last_scanned = len(ids)
        return [self.docs[i] for i in ids if _matches(self.docs[i], query)]


# ------------------------------------------------------------ consistent hashing (Cassandra / Dynamo-like)
class HashRing:
    def __init__(self, nodes, vnodes=100):
        self.vnodes = vnodes
        self._ring = []   # sorted list of (position, node)
        for n in nodes:
            self.add_node(n)

    @staticmethod
    def _pos(text):
        return zlib.crc32(text.encode("utf-8"))

    def add_node(self, node):
        for i in range(self.vnodes):
            insort(self._ring, (self._pos(f"{node}#{i}"), node))

    def remove_node(self, node):
        self._ring = [(p, n) for p, n in self._ring if n != node]

    def node_for(self, key):
        if not self._ring:
            raise ValueError("the ring has no nodes")
        i = bisect(self._ring, (self._pos(str(key)), chr(0x10FFFF)))
        return self._ring[i % len(self._ring)][1]


# ------------------------------------------------------------ quorum replication
class Unavailable(Exception):
    pass


def quorum_overlaps(n, r, w):
    return r + w > n


class ReplicaSet:
    def __init__(self, n):
        self.replicas = [(0, None) for _ in range(n)]   # (version, value) per replica
        self.version = 0

    def write(self, value, w, down=()):
        up = [i for i in range(len(self.replicas)) if i not in set(down)]
        if len(up) < w:
            raise Unavailable(f"only {len(up)} replicas up, {w} needed")
        self.version += 1
        for i in up[:w]:                       # the write reaches the FIRST w live replicas
            self.replicas[i] = (self.version, value)

    def read(self, r, down=()):
        up = [i for i in range(len(self.replicas)) if i not in set(down)]
        if len(up) < r:
            raise Unavailable(f"only {len(up)} replicas up, {r} needed")
        contacted = up[::-1][:r]               # the read asks the LAST r live replicas
        return max((self.replicas[i] for i in contacted), key=lambda vv: vv[0])[1]


# ------------------------------------------------------------ wide-column table (Cassandra-like)
class WideColumnTable:
    def __init__(self, partition_key, clustering_key):
        self.partition_key = partition_key
        self.clustering_key = clustering_key
        self.partitions = {}                   # partition value -> sorted list of (clustering value, row)
        self.last_scanned = 0

    def insert(self, row):
        part = row[self.partition_key]
        rows = self.partitions.setdefault(part, [])
        ck = row[self.clustering_key]
        for i, (c, _) in enumerate(rows):
            if c == ck:
                rows[i] = (ck, dict(row))      # same primary key: overwrite (an upsert)
                return
        insort(rows, (ck, dict(row)), key=lambda pair: pair[0])

    def query(self, partition_value, start=None, end=None, descending=False):
        if partition_value is None:
            raise ValueError("query needs the partition key")
        rows = self.partitions.get(partition_value, [])
        self.last_scanned = len(rows)
        out = [r for c, r in rows if (start is None or c >= start) and (end is None or c <= end)]
        return out[::-1] if descending else out

    def partition_count(self):
        return len(self.partitions)
