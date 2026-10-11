"""Reference solution for Lab 3.0: HDFS, MapReduce and YARN in miniature (pure Python)."""
import zlib
from collections import defaultdict

MiB = 1024 * 1024
BLOCK_SIZE = 128 * MiB  # the HDFS default block size


# ------------------------------------------------------------------ HDFS
def split_into_blocks(file_size, block_size=BLOCK_SIZE):
    blocks = []
    remaining = file_size
    while remaining > 0:
        blocks.append(min(block_size, remaining))
        remaining -= blocks[-1]
    return blocks


def place_replicas(nodes, writer, factor=3):
    """nodes: {node_name: rack_name}. Default HDFS policy: 1st on the writer, 2nd on another rack, 3rd on the 2nd's rack."""
    names = sorted(nodes)
    chosen = [writer]
    other_rack = [n for n in names if nodes[n] != nodes[writer]]
    if factor >= 2:
        second = other_rack[0] if other_rack else next(n for n in names if n not in chosen)
        chosen.append(second)
    if factor >= 3:
        same_as_second = [n for n in names if nodes[n] == nodes[chosen[1]] and n not in chosen]
        third = same_as_second[0] if same_as_second else next(n for n in names if n not in chosen)
        chosen.append(third)
    for n in names:
        if len(chosen) >= factor:
            break
        if n not in chosen:
            chosen.append(n)
    return chosen[:factor]


def blocks_lost(placements, failed_nodes):
    failed = set(failed_nodes)
    return sorted(b for b, replicas in placements.items() if all(r in failed for r in replicas))


def metadata_objects(total_bytes, file_size, block_size=BLOCK_SIZE):
    files = -(-total_bytes // file_size)  # ceiling division
    blocks_per_file = len(split_into_blocks(file_size, block_size))
    return files + files * blocks_per_file


def namenode_memory_bytes(objects, bytes_per_object=150):
    return objects * bytes_per_object


# ------------------------------------------------------------------ MapReduce
def map_phase(records, mapper):
    pairs = []
    for record in records:
        pairs.extend(mapper(record))
    return pairs


def partition(key, num_reducers):
    return zlib.crc32(str(key).encode("utf-8")) % num_reducers


def shuffle(pairs, num_reducers):
    buckets = [defaultdict(list) for _ in range(num_reducers)]
    for key, value in pairs:
        buckets[partition(key, num_reducers)][key].append(value)
    return [sorted(b.items(), key=lambda kv: kv[0]) for b in buckets]


def reduce_phase(groups, reducer):
    return [(key, reducer(key, values)) for key, values in groups]


def run_job(splits, mapper, reducer, num_reducers=2, combiner=None):
    shuffled = []
    map_output = 0
    for split in splits:
        pairs = map_phase(split, mapper)
        map_output += len(pairs)
        if combiner:
            local = defaultdict(list)
            for key, value in pairs:
                local[key].append(value)
            pairs = [(key, combiner(key, values)) for key, values in local.items()]
        shuffled.extend(pairs)
    reducers = shuffle(shuffled, num_reducers)
    results = []
    for groups in reducers:
        results.extend(reduce_phase(groups, reducer))
    results.sort(key=lambda kv: kv[0])
    return results, {"map_output_pairs": map_output, "shuffled_pairs": len(shuffled)}


def wordcount_mapper(line):
    return [(word, 1) for word in line.lower().split()]


def wordcount_reducer(word, counts):
    return sum(counts)


def revenue_per_city(orders, customers, num_reducers=2):
    """Reduce-side join: orders ('order_id','customer_id','total_idr') with customers ('customer_id','city')."""
    def mapper(record):
        tag, row = record
        if tag == "customer":
            return [(row["customer_id"], ("city", row["city"]))]
        return [(row["customer_id"], ("total", int(row["total_idr"])))]

    def reducer(customer_id, values):
        cities = [v for tag, v in values if tag == "city"]
        totals = [v for tag, v in values if tag == "total"]
        return (cities[0] if cities else "(unknown)", sum(totals), len(totals))

    tagged = [("customer", c) for c in customers] + [("order", o) for o in orders]
    joined, _ = run_job([tagged], mapper, reducer, num_reducers)
    totals = defaultdict(int)
    for _, (city, total, n_orders) in joined:
        if n_orders:
            totals[city] += total
    return sorted(totals.items())


def retry_task(task, max_attempts=4):
    last = None
    for attempt in range(1, max_attempts + 1):
        try:
            return task(attempt)
        except RuntimeError as error:
            last = error
    raise RuntimeError(f"task failed after {max_attempts} attempts: {last}")


# ------------------------------------------------------------------ YARN
def allocate_containers(requests, nodes):
    """First-fit FIFO: requests [(app, memory_mb)] in arrival order; nodes {name: free_mb}. -> (placements, pending)."""
    free = dict(nodes)
    placed, pending = [], []
    for app, mb in requests:
        for name in sorted(free):
            if free[name] >= mb:
                free[name] -= mb
                placed.append((app, mb, name))
                break
        else:
            pending.append((app, mb))
    return placed, pending
