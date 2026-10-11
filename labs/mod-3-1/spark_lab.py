"""Lab 3.1: reading Spark plans, finding skew, fixing it.   Tests: pytest labs/mod-3-1 -v

Needs Java 17+ (check: java -version) and `pip install -r labs/mod-3-1/requirements.txt`.
Implement every TODO. The tests build a SKEWED dataset: 70% of the events belong to customer_id 0 (the "guest" id).
"""
import contextlib
import io
import re
import statistics

from pyspark.sql import functions as F


def plan_text(df):
    """The formatted physical plan as text. (Provided.)"""
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        df.explain(mode="formatted")
    return buf.getvalue()


def count_exchanges(df):
    """How many SHUFFLES does the plan contain? A shuffle is an 'Exchange' node (hashpartitioning, ...).
    A BroadcastExchange is NOT a shuffle of the big table. Hint: in plan_text(df), the details section lists nodes as
    '(5) Exchange'. Return an int."""
    raise NotImplementedError("TODO: count_exchanges")


def partition_sizes(df, cols, n):
    """Hash-partition df by the columns `cols` into n partitions (what a shuffle join does) and return a list with the
    number of ROWS in each partition. Hint: df.repartition(n, *cols).rdd.glom().map(len).collect()"""
    raise NotImplementedError("TODO: partition_sizes")


def skew_ratio(sizes):
    """Largest partition divided by the MEDIAN partition (1.0 = perfectly balanced; above ~5 is a problem)."""
    raise NotImplementedError("TODO: skew_ratio")


def add_salt(df, factor, seed=4):
    """Add an integer column 'salt' with a random value in [0, factor) to every row (use F.rand(seed=seed))."""
    raise NotImplementedError("TODO: add_salt")


def explode_salt(df, factor):
    """Replicate every row `factor` times, adding the column 'salt' = 0 .. factor-1 (use F.explode over an array)."""
    raise NotImplementedError("TODO: explode_salt")


def salted_join(large, small, key, factor):
    """Join large and small on `key` WITHOUT hot-key partitions: salt the large side, explode the small side, join on
    [key, 'salt'], and drop 'salt' from the result. The result must equal the ordinary join."""
    raise NotImplementedError("TODO: salted_join")


def broadcast_join(large, small, key):
    """Join with the small side broadcast to every executor (no shuffle of the large side)."""
    raise NotImplementedError("TODO: broadcast_join")


def enable_skew_join(spark):
    """Turn on Adaptive Query Execution's skew handling. Set these configs:
         spark.sql.adaptive.enabled = true
         spark.sql.adaptive.skewJoin.enabled = true
         spark.sql.adaptive.skewJoin.skewedPartitionThresholdInBytes = 256KB    (small, because the test data is small)
         spark.sql.adaptive.advisoryPartitionSizeInBytes = 512KB
         spark.sql.adaptive.skewJoin.skewedPartitionFactor = 3"""
    raise NotImplementedError("TODO: enable_skew_join")


def uses_skew_join(df):
    """True if, AFTER the query has run (an action was called), the final adaptive plan contains a skew-optimised join.
    Hint: df._jdf.queryExecution().executedPlan().toString() contains 'skew=true' when AQE split a skewed partition."""
    raise NotImplementedError("TODO: uses_skew_join")
