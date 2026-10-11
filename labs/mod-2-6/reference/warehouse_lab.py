"""Reference solution for Lab 2.6: how a cloud data warehouse saves work (pure Python)."""
import zlib

MiB = 1024 * 1024


def value_bytes(value):
    """Rough stored size of one value: numbers 8 bytes, text its UTF-8 length, missing 0."""
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return 8
    return len(str(value).encode("utf-8"))


# ------------------------------------------------------------------ micro-partitions and pruning
def build_micro_partitions(rows, target_rows, cluster_key=None):
    ordered = sorted(rows, key=lambda r: r[cluster_key]) if cluster_key else list(rows)
    partitions = []
    for start in range(0, len(ordered), target_rows):
        chunk = ordered[start:start + target_rows]
        columns = chunk[0].keys()
        partitions.append({
            "rows": chunk,
            "min": {c: min(r[c] for r in chunk) for c in columns},
            "max": {c: max(r[c] for r in chunk) for c in columns},
        })
    return partitions


def prune(partitions, column, low, high):
    return [i for i, p in enumerate(partitions) if p["max"][column] >= low and p["min"][column] <= high]


def scan(partitions, column, low, high, columns):
    keep = prune(partitions, column, low, high)
    out, rows_read, bytes_read = [], 0, 0
    for i in keep:
        for row in partitions[i]["rows"]:
            rows_read += 1
            bytes_read += sum(value_bytes(row[c]) for c in columns)
            if low <= row[column] <= high:
                out.append({c: row[c] for c in columns})
    return out, {"partitions_total": len(partitions), "partitions_scanned": len(keep), "rows_read": rows_read, "bytes_billed": bytes_read}


def query_cost(bytes_billed, price_per_tb=5.0):
    return bytes_billed / 1e12 * price_per_tb


def average_overlap(partitions, column):
    total = 0
    for p in partitions:
        total += sum(1 for q in partitions if q["max"][column] >= p["min"][column] and q["min"][column] <= p["max"][column])
    return total / len(partitions)


# ------------------------------------------------------------------ distribution and joins (MPP)
def distribute(rows, key, nodes, style):
    placed = {n: [] for n in range(nodes)}
    for i, row in enumerate(rows):
        if style == "key":
            placed[zlib.crc32(str(row[key]).encode("utf-8")) % nodes].append(row)
        elif style == "even":
            placed[i % nodes].append(row)
        elif style == "all":
            for n in placed:
                placed[n].append(row)
        else:
            raise ValueError(f"unknown distribution style: {style}")
    return placed


def join_rows_moved(left_rows, right_rows, join_key, left_dist, right_dist):
    """left_dist/right_dist are (style, key). Rows that must cross the network for an equi-join on join_key."""
    (ls, lk), (rs, rk) = left_dist, right_dist
    if rs == "all" or ls == "all":
        return 0
    left_ok = ls == "key" and lk == join_key
    right_ok = rs == "key" and rk == join_key
    if left_ok and right_ok:
        return 0
    if left_ok:
        return right_rows
    if right_ok:
        return left_rows
    return left_rows + right_rows


# ------------------------------------------------------------------ loading
def plan_load_files(total_bytes, slices, min_bytes=100 * MiB, max_bytes=250 * MiB):
    if total_bytes <= max_bytes:
        return [total_bytes]
    n = -(-total_bytes // max_bytes)
    n = -(-n // slices) * slices
    base, extra = divmod(total_bytes, n)
    return [base + (1 if i < extra else 0) for i in range(n)]


# ------------------------------------------------------------------ result cache and queueing
class ResultCache:
    def __init__(self):
        self._cache = {}

    @staticmethod
    def _key(sql, table_versions):
        return (" ".join(sql.split()).lower(), tuple(sorted(table_versions.items())))

    def run(self, sql, table_versions, compute):
        key = self._key(sql, table_versions)
        if key in self._cache:
            return self._cache[key], True
        result = compute()
        self._cache[key] = result
        return result, False


def simulate_queue(jobs, slots):
    """jobs [(name, duration_s)] all arriving at time 0, FIFO. Return {name: (start, finish)}."""
    free = [0.0] * slots
    out = {}
    for name, duration in jobs:
        i = min(range(slots), key=lambda s: (free[s], s))
        start = free[i]
        free[i] = start + duration
        out[name] = (start, free[i])
    return out
