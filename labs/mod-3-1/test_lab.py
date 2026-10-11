"""Tests for Lab 3.1.   pip install -r labs/mod-3-1/requirements.txt && pytest labs/mod-3-1 -v   (needs Java 17+)"""
import os
import shutil
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

if not (shutil.which("java") or os.environ.get("JAVA_HOME")):
    pytest.skip("Java 17+ is required for Spark (java -version)", allow_module_level=True)

from pyspark.sql import SparkSession, functions as F  # noqa: E402

lab = labtools.load(__file__, "spark_lab.py")
N = 600_000
PARTS = 8


@pytest.fixture(scope="module")
def spark():
    s = (SparkSession.builder.master("local[4]").appName("lab31").config("spark.ui.enabled", "false")
         .config("spark.sql.shuffle.partitions", str(PARTS)).config("spark.sql.adaptive.enabled", "false")
         .config("spark.sql.autoBroadcastJoinThreshold", "-1").config("spark.driver.memory", "2g").getOrCreate())
    s.sparkContext.setLogLevel("ERROR")
    yield s
    s.stop()


@pytest.fixture(scope="module")
def hot(spark):
    return (spark.range(N).withColumn("customer_id", F.when(F.rand(seed=1) < 0.7, F.lit(0)).otherwise((F.rand(seed=2) * 1000).cast("int") + 1))
            .withColumn("amount", (F.rand(seed=3) * 100).cast("int")))


@pytest.fixture(scope="module")
def uniform(spark):
    return spark.range(N).withColumn("customer_id", (F.rand(seed=2) * 1000).cast("int") + 1)


@pytest.fixture(scope="module")
def customers(spark):
    return spark.range(0, 1001).withColumnRenamed("id", "customer_id").withColumn("tier", F.when(F.col("customer_id") % 3 == 0, "Gold").otherwise("Bronze"))


def totals(df):
    return sorted((r["tier"], r["amount_sum"], r["n"]) for r in df.groupBy("tier").agg(F.sum("amount").alias("amount_sum"), F.count("*").alias("n")).collect())


class TestPlans:
    def test_narrow_transformations_cause_no_shuffle(self, hot):
        assert lab.count_exchanges(hot.filter("amount > 10").select("customer_id", "amount").withColumn("x", F.col("amount") * 2)) == 0

    def test_a_group_by_needs_one_shuffle(self, hot):
        assert lab.count_exchanges(hot.groupBy("customer_id").count()) == 1

    def test_a_sort_merge_join_shuffles_both_sides(self, hot, customers):
        df = hot.join(customers, "customer_id")
        assert "SortMergeJoin" in lab.plan_text(df)
        assert lab.count_exchanges(df) == 2

    def test_a_broadcast_join_does_not_shuffle_the_big_table(self, hot, customers):
        df = lab.broadcast_join(hot, customers, "customer_id")
        assert "BroadcastHashJoin" in lab.plan_text(df)
        assert lab.count_exchanges(df) == 0


class TestSkew:
    def test_partition_sizes_account_for_every_row(self, uniform):
        sizes = lab.partition_sizes(uniform, ["customer_id"], PARTS)
        assert len(sizes) == PARTS and sum(sizes) == N

    def test_a_hot_key_makes_one_partition_huge(self, hot, uniform):
        assert lab.skew_ratio(lab.partition_sizes(hot, ["customer_id"], PARTS)) > 10
        assert lab.skew_ratio(lab.partition_sizes(uniform, ["customer_id"], PARTS)) < 1.5

    def test_skew_ratio_definition(self):
        assert lab.skew_ratio([10, 10, 10, 10]) == 1.0
        assert lab.skew_ratio([100, 10, 10, 10, 10]) == 10.0


class TestSalting:
    def test_salt_is_in_range_and_balanced(self, hot):
        salted = lab.add_salt(hot, 8)
        assert salted.agg(F.min("salt"), F.max("salt")).first()[0:2] == (0, 7)
        counts = [r["count"] for r in salted.groupBy("salt").count().collect()]
        assert len(counts) == 8 and max(counts) / min(counts) < 1.2

    def test_exploding_the_small_side_multiplies_it(self, customers):
        e = lab.explode_salt(customers, 8)
        assert e.count() == customers.count() * 8 and e.select("salt").distinct().count() == 8

    def test_salting_spreads_the_hot_key_over_partitions(self, hot):
        salted = lab.add_salt(hot, 8)
        assert lab.skew_ratio(lab.partition_sizes(salted, ["customer_id", "salt"], PARTS)) < 3

    def test_a_salted_join_gives_exactly_the_same_answer(self, hot, customers):
        plain = hot.join(customers, "customer_id")
        salted = lab.salted_join(hot, customers, "customer_id", 8)
        assert "salt" not in salted.columns
        assert totals(salted) == totals(plain)


class TestAdaptiveExecution:
    def test_aqe_splits_the_skewed_partition(self, spark, hot, customers):
        lab.enable_skew_join(spark)
        try:
            df = hot.join(customers, "customer_id").groupBy("tier").agg(F.sum("amount").alias("amount_sum"), F.count("*").alias("n"))
            result = sorted((r["tier"], r["amount_sum"], r["n"]) for r in df.collect())
            assert lab.uses_skew_join(df)
        finally:
            spark.conf.set("spark.sql.adaptive.enabled", "false")
        assert result == totals(hot.join(customers, "customer_id"))
