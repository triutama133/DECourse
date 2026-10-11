"""Lab 2.6: how a cloud data warehouse saves work, in plain Python (no cloud account needed).

Implement the pieces in order and run the tests after each:    pytest labs/mod-2-6/test_lab.py -v
A "row" is a dict such as {"order_date": "2026-03-01", "customer_id": 7, "status": "paid", "total": 150000}.
Deterministic: no randomness inside your code. The lessons explain what each piece models.
"""
import zlib  # noqa: F401  (distribute needs it)

MiB = 1024 * 1024


def value_bytes(value):
    """(Provided.) Rough stored size of one value: numbers 8 bytes, text its UTF-8 length, missing (None) 0."""
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return 8
    return len(str(value).encode("utf-8"))


def build_micro_partitions(rows, target_rows, cluster_key=None):
    """Cut rows into micro-partitions of at most `target_rows` rows, each with "zone map" statistics.   (lesson 2)

    If `cluster_key` is given, first sort the rows by that column (this is what clustering does). Keep the order otherwise.
    Return a list of dicts: {"rows": [...], "min": {column: smallest value in this partition}, "max": {column: largest value}} for EVERY column.
    """
    raise NotImplementedError("TODO: implement build_micro_partitions")

def prune(partitions, column, low, high):
    """Return the indexes of the partitions that MIGHT contain rows with low <= column <= high, judging only by their min/max statistics.   (lesson 2)

    A partition can be skipped when its max is below `low` or its min is above `high`. Partitions are never opened here.
    """
    raise NotImplementedError("TODO: implement prune")

def scan(partitions, column, low, high, columns):
    """Run: SELECT <columns> WHERE low <= column <= high.   (lessons 2 and 4)

    Open only the partitions that prune() keeps. Return (rows, stats):
      rows  = the matching rows, each as a dict containing ONLY the requested `columns`, in partition order
      stats = {"partitions_total", "partitions_scanned", "rows_read" (all rows of scanned partitions),
               "bytes_billed" (sum of value_bytes over the requested `columns` only, for every row of the scanned partitions)}
    Columnar storage means unrequested columns cost nothing.
    """
    raise NotImplementedError("TODO: implement scan")

def query_cost(bytes_billed, price_per_tb=5.0):
    """Dollar cost of a scan-priced engine: bytes_billed / 1e12 * price_per_tb.   (lesson 4; the default price is only an example, check current prices)
    """
    raise NotImplementedError("TODO: implement query_cost")

def average_overlap(partitions, column):
    """A clustering quality measure: for every partition count the partitions (including itself) whose [min, max] range of `column` overlaps its own range, then average.   (lesson 2)

    1.0 would mean no partition overlaps any other (perfectly clustered); a value near len(partitions) means every partition overlaps all the others (random order).
    """
    raise NotImplementedError("TODO: implement average_overlap")

def distribute(rows, key, nodes, style):
    """Place rows on `nodes` compute nodes (numbered 0..nodes-1) and return {node: [rows]}.   (lesson 3: distribution styles)

    style "key":  node = zlib.crc32(str(row[key]).encode("utf-8")) % nodes     (same key value, same node)
    style "even": row number i goes to node i % nodes (round robin)
    style "all":  every node gets a full copy of every row
    Any other style: raise ValueError(f"unknown distribution style: {style}")
    """
    raise NotImplementedError("TODO: implement distribute")

def join_rows_moved(left_rows, right_rows, join_key, left_dist, right_dist):
    """How many rows must cross the network for an equi-join on `join_key`?   (lesson 3)

    `left_dist` and `right_dist` are (style, key) tuples, e.g. ("key", "customer_id") or ("all", None).
      - if either side is "all" (a full copy everywhere): 0
      - both sides distributed by "key" on the join key: 0 (co-located join)
      - only the left side is distributed by the join key: the right side must be redistributed: right_rows
      - only the right side is: left_rows
      - otherwise both must be reshuffled: left_rows + right_rows
    """
    raise NotImplementedError("TODO: implement join_rows_moved")

def plan_load_files(total_bytes, slices, min_bytes=100 * MiB, max_bytes=250 * MiB):
    """Plan the file sizes for a bulk load. Return a list of file sizes in bytes that add up to total_bytes.   (lesson 5)

    - total_bytes <= max_bytes: one file [total_bytes].
    - otherwise: the smallest number of files n with total_bytes / n <= max_bytes, then rounded UP to a multiple of `slices`
      (so every parallel loader gets the same number of files). Sizes differ by at most 1 byte: the first (total_bytes % n) files get one extra byte.
    """
    raise NotImplementedError("TODO: implement plan_load_files")


class ResultCache:
    """A warehouse result cache (lesson 5): identical query + unchanged data = no recomputation.

    run(sql, table_versions, compute): `table_versions` is a dict {table: version} (a version changes when the table changes).
    The cache key is the SQL with whitespace collapsed and lower-cased, plus the table versions.
    If the key was seen before return (cached_result, True) without calling compute(); otherwise call compute() once,
    remember the result, and return (result, False).
    """

    def __init__(self):
        raise NotImplementedError("TODO: implement ResultCache")

    def run(self, sql, table_versions, compute):
        raise NotImplementedError("TODO: implement ResultCache.run")

def simulate_queue(jobs, slots):
    """FIFO scheduling of jobs on `slots` parallel slots; all jobs arrive at time 0.   (lesson 6)

    `jobs` is [(name, duration_seconds)]. Each job starts on the slot that becomes free first (the lowest slot number if tied).
    Return {name: (start, finish)} as floats.
    """
    raise NotImplementedError("TODO: implement simulate_queue")
