"""Lab 3.0: HDFS, MapReduce and YARN in miniature (pure Python, no Hadoop needed).

Implement the functions below, in order, and run the tests after each one:
    pytest labs/mod-3-0/test_lab.py -v
Everything is deterministic: no randomness, no real cluster. The lessons explain what each function models.
"""
import zlib  # noqa: F401  (partition() needs it)
from collections import defaultdict  # noqa: F401

MiB = 1024 * 1024
BLOCK_SIZE = 128 * MiB  # the HDFS default block size


# ------------------------------------------------------------------ HDFS (lesson 2)

def split_into_blocks(file_size, block_size=BLOCK_SIZE):
    """Cut a file of `file_size` bytes into HDFS blocks. Return the list of block sizes in bytes.   (lesson 2)

    split_into_blocks(300 * MiB)  ->  [128 MiB, 128 MiB, 44 MiB]       split_into_blocks(0) -> []
    Every block is `block_size` except possibly the last, which is the remainder (a short last block takes only the space it needs).
    """
    raise NotImplementedError("TODO: implement split_into_blocks")



def place_replicas(nodes, writer, factor=3):
    """Choose the nodes that store the replicas of one block.   (lesson 2: rack awareness)

    `nodes` is a dict {node_name: rack_name}; `writer` is the node that writes the block. Default HDFS policy for factor 3:
      1st replica: the writer node itself
      2nd replica: a node on a DIFFERENT rack (take the first such node in sorted name order)
      3rd replica: a different node on the SAME rack as the 2nd replica (first in sorted order)
    For factor 1 or 2 stop earlier. For factor > 3 add further nodes not yet used, in sorted order.
    If a rule cannot be met (for example there is only one rack), use the first unused node in sorted order instead.
    Return the list of node names in that order.
    """
    raise NotImplementedError("TODO: implement place_replicas")



def blocks_lost(placements, failed_nodes):
    """Return the sorted ids of blocks that have NO surviving replica.   (lesson 2: why replication)

    `placements` is {block_id: [nodes holding a replica]}; `failed_nodes` is an iterable of failed node names.
    """
    raise NotImplementedError("TODO: implement blocks_lost")



def metadata_objects(total_bytes, file_size, block_size=BLOCK_SIZE):
    """How many objects must the NameNode keep in memory when `total_bytes` of data is stored as files of `file_size` bytes?   (lesson 2: the small-files problem)

    Count one object per file plus one per block of each file. Use ceiling division for the number of files
    (a last, smaller file still counts), and split_into_blocks for the blocks of one file.
    """
    raise NotImplementedError("TODO: implement metadata_objects")



def namenode_memory_bytes(objects, bytes_per_object=150):
    """Memory needed for `objects` metadata objects, at roughly `bytes_per_object` bytes each (a commonly quoted rule of thumb is 150).
    """
    raise NotImplementedError("TODO: implement namenode_memory_bytes")



# ------------------------------------------------------------------ MapReduce (lesson 3)

def map_phase(records, mapper):
    """Apply `mapper` to every record and collect ALL the (key, value) pairs it yields, in order.   (lesson 3)

    `mapper(record)` returns a list of (key, value) pairs; one record may give zero, one or many pairs.
    """
    raise NotImplementedError("TODO: implement map_phase")



def partition(key, num_reducers):
    """Which reducer gets this key?  zlib.crc32(str(key).encode("utf-8")) % num_reducers.   (lesson 3)

    It must be the same answer every time and on every machine: that is why Python's built-in hash() (which changes between runs) is not used.
    """
    raise NotImplementedError("TODO: implement partition")



def shuffle(pairs, num_reducers):
    """Group the map output by key and send every key to its reducer.   (lesson 3: the shuffle)

    Return a list with one entry per reducer. Each entry is the list of (key, [values...]) for the keys partitioned to that reducer,
    sorted by key; the values of one key stay in the order the pairs arrived.
    """
    raise NotImplementedError("TODO: implement shuffle")



def reduce_phase(groups, reducer):
    """For one reducer's groups [(key, [values])], return [(key, reducer(key, values))] in the same order.   (lesson 3)
    """
    raise NotImplementedError("TODO: implement reduce_phase")



def run_job(splits, mapper, reducer, num_reducers=2, combiner=None):
    """Run a whole MapReduce job.   (lesson 3)

    `splits` is a list of lists of records (one list per mapper task). For each split run map_phase.
    If `combiner` is given, first combine on the mapper side: for each key in that split's output call combiner(key, values) and keep ONE
    pair (key, combined_value) (this reduces what is sent over the network).
    Then shuffle all pairs to `num_reducers` reducers, reduce, and return (results, stats):
      results = list of (key, reduced_value) for all reducers, sorted by key
      stats   = {"map_output_pairs": pairs produced by the mappers BEFORE combining, "shuffled_pairs": pairs sent to the shuffle}
    """
    raise NotImplementedError("TODO: implement run_job")



def wordcount_mapper(line):
    """The classic: one line of text -> [(word, 1), ...], words lower-cased and split on whitespace.
    """
    raise NotImplementedError("TODO: implement wordcount_mapper")



def wordcount_reducer(word, counts):
    """The classic: (word, [1, 1, 1]) -> the total count.
    """
    raise NotImplementedError("TODO: implement wordcount_reducer")



def revenue_per_city(orders, customers, num_reducers=2):
    """Revenue per city with a REDUCE-SIDE JOIN, using run_job.   (lesson 3: joins in MapReduce)

    `orders` are dicts with customer_id and total_idr (text); `customers` are dicts with customer_id and city.
    Idea: the mapper emits both kinds of record under the SAME key (customer_id), tagged so the reducer can tell them apart;
    the reducer then sees one customer's city and all of that customer's orders together.
    Return a sorted list of (city, total_idr_as_int); orders whose customer is unknown count under "(unknown)".
    A city appears only if at least one of its customers has an order.
    """
    raise NotImplementedError("TODO: implement revenue_per_city")



def retry_task(task, max_attempts=4):
    """Run `task(attempt)` (attempt starts at 1) and return its result. If it raises RuntimeError, run it again, up to `max_attempts` times.
    If every attempt fails raise RuntimeError(f"task failed after {max_attempts} attempts: {last_error}").   (lesson 3: fault tolerance)
    This only works because a task is deterministic: running it again gives the same output.
    """
    raise NotImplementedError("TODO: implement retry_task")



# ------------------------------------------------------------------ YARN (lesson 4)

def allocate_containers(requests, nodes):
    """A toy YARN scheduler: first fit, first come first served.   (lesson 4)

    `requests` is [(app, memory_mb)] in arrival order, `nodes` is {node_name: free_mb}. Give each request to the first node (sorted by name)
    that still has enough free memory and subtract it. Return (placed, pending): placed = [(app, mb, node)], pending = requests that did not fit.
    """
    raise NotImplementedError("TODO: implement allocate_containers")
