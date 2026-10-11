"""Reference solution for Lab 3.1."""
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
    """Number of shuffles (Exchange nodes) in the plan; a BroadcastExchange is not a shuffle."""
    return len(re.findall(r"^\(\d+\) Exchange", plan_text(df), flags=re.M))


def partition_sizes(df, cols, n):
    """Rows per partition after hash-partitioning df by `cols` into n partitions."""
    return df.repartition(n, *cols).rdd.glom().map(len).collect()


def skew_ratio(sizes):
    return max(sizes) / statistics.median(sizes)


def add_salt(df, factor, seed=4):
    return df.withColumn("salt", F.floor(F.rand(seed=seed) * factor).cast("int"))


def explode_salt(df, factor):
    return df.withColumn("salt", F.explode(F.array([F.lit(i) for i in range(factor)])))


def salted_join(large, small, key, factor):
    joined = add_salt(large, factor).join(explode_salt(small, factor), [key, "salt"])
    return joined.drop("salt")


def broadcast_join(large, small, key):
    return large.join(F.broadcast(small), key)


def enable_skew_join(spark):
    spark.conf.set("spark.sql.adaptive.enabled", "true")
    spark.conf.set("spark.sql.adaptive.skewJoin.enabled", "true")
    spark.conf.set("spark.sql.adaptive.skewJoin.skewedPartitionThresholdInBytes", "256KB")
    spark.conf.set("spark.sql.adaptive.advisoryPartitionSizeInBytes", "512KB")
    spark.conf.set("spark.sql.adaptive.skewJoin.skewedPartitionFactor", "3")


def uses_skew_join(df):
    """True if, AFTER the query has run, the final adaptive plan contains a skew-optimised join."""
    return "skew=true" in df._jdf.queryExecution().executedPlan().toString()
