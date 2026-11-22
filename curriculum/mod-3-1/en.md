---
title: Distributed Computing and Apache Spark Internals
duration: 4 weeks
summary: Understand how Spark splits work across machines, read its execution plans, and recognise and fix the problems that matter most (shuffles, bad joins, data skew) using real measurements from a hot-key dataset.
why: Courses say "just call groupBy().count()". In production a 100 GB job sits at 99% for hours because one key holds most of the rows, one task does almost all the work, and the cluster idles while it waits.
---

## @outcomes
- Explain when a distributed engine is justified, and describe Spark's driver, executors, jobs, stages, tasks and partitions
- Distinguish narrow and wide transformations and find the shuffles in a physical plan
- Choose between broadcast, sort-merge and other join strategies, and explain what Catalyst, Tungsten and Adaptive Query Execution each do
- Diagnose data skew from partition sizes and the Spark UI, and fix it with broadcast joins, adaptive skew handling or salting
- Apply the main performance and memory rules for PySpark jobs
- Read a Scala or Java Spark job and its JVM stack trace, and translate the job to PySpark

## @prereq
Modules 2.1 (Parquet, engines, single-machine limits) and 1.3 (joins, execution plans). Java 17 or newer (`java -version`) and `pip install -r labs/mod-3-1/requirements.txt`. The lab runs Spark in local mode on your laptop.

## @part How Spark runs your code

## @lesson When you need a cluster, and what a cluster costs you
Module 2.1 ended with a rule: a single machine goes much further than most teams expect. **Apache Spark** is the engine you reach for when it does not: a distributed engine that splits a dataset into **partitions**, processes them in parallel on many machines, and combines the results.

Reasons to use it: the data (or the computation) does not fit one machine's disk, memory and time budget; you need the throughput of hundreds of cores; or your organisation already runs a Spark platform (Databricks, EMR, Dataproc, Kubernetes) with its governance and tooling. Reasons not to: for a few hundred gigabytes of Parquet, DuckDB or Polars on one machine is often faster and far simpler.

A cluster costs you something real:

- **Coordination overhead.** Starting jobs, scheduling tasks and moving data between machines takes time. A tiny job in Spark is slower than a script.
- **The network.** Data that must move between machines (a **shuffle**) is orders of magnitude slower than data processed in place. Almost all Spark tuning is about moving less data, less often.
- **New failure modes.** Skewed data, memory pressure on one executor, lost machines, and a debugging surface (a UI, many logs) that a single process does not have.
- **Money.** Idle or poorly used clusters are an easy way to spend a budget.

Use Spark when measurement says one machine is not enough, and then learn its internals well enough to use the cluster efficiently. That is this module.

> 🛠 **Try it (10 min, Python).** You do not need Spark to feel coordination overhead. Write `work(n)` that returns `sum(i * i % 7 for i in range(n))`. Time `[work(n) for _ in range(tasks)]` in one process, then the same with `multiprocessing.Pool(4).map(work, [n] * tasks)`. Try two jobs: 4 tasks with `n = 1000`, and 8 tasks with `n = 1_500_000`. Check that both ways give the same answers. (Put the code under `if __name__ == "__main__":` and run it as a file.)
>
> **You should see:** for the tiny job, one process takes about 0.2 ms and the pool about 20 ms, around a hundred times *slower*; for the big job, one process takes about 780 ms and the pool about 235 ms, around three times faster with 4 workers. Starting workers and sending tasks costs a fixed amount, so parallel only wins when each task is big enough to pay for it.

## @lesson Architecture: driver, executors, stages and tasks
A Spark **application** has these parts:

- The **driver** is the process that runs your program. It builds the plan, splits it into pieces and schedules them. Its memory holds the plan and any results you collect to it.
- The **executors** are worker processes (JVMs) on cluster machines. Each has some memory and a number of **cores**; each core runs one task at a time.
- The **cluster manager** allocates machines to the application: Spark's own standalone manager, YARN, Kubernetes, or a managed service. In **local mode** (`master("local[4]")`, as in the lab), the driver and four worker threads share one process: perfect for learning and for tests.

Work is divided in layers, and the vocabulary matters when you read the UI:

| Term | Meaning |
|---|---|
| **Job** | One action (`count()`, `write`, `collect()`) triggers one job |
| **Stage** | A group of tasks that can run without moving data between machines; stages end at a shuffle |
| **Task** | One stage's work on **one partition**; the unit that runs on a core |
| **Partition** | A slice of the data; one partition equals one task |

A DataFrame with 200 partitions and an executor fleet with 50 cores runs 50 tasks at a time, in four "waves". The **number and size of partitions** is therefore a central knob: too few leaves cores idle, too many wastes time on scheduling overhead, and a few giant ones (skew) make everything wait for the stragglers. A healthy partition holds on the order of 100 to 200 MB of data.

Your code runs as follows. You write DataFrame or SQL operations in Python; they are translated into JVM plans; tasks execute on executors in the JVM. **PySpark** is a thin layer: DataFrame operations never run Python on the data, which is why they are fast. Python code *does* run on the executors only when you register a custom Python **UDF** (User-Defined Function — covered in Lesson 8), with a heavy serialization price.

> 🛠 **Try it (15 min, Python).** Model a two-stage job by hand: total `total_idr` per `payment_method` from `data/orders.csv` (keep only rows whose total is all digits, 3,580 of them). **Stage 1:** split the rows into 8 partitions with `rows[i::8]`; each task computes partial sums per payment method for its own partition. **Shuffle:** send each partial sum to one of 4 reduce partitions chosen by `zlib.crc32(key.encode()) % 4`. **Stage 2:** each of the 4 reduce tasks adds up the partial sums it received. Count the tasks in each stage and the records that crossed the shuffle, and compare the result with a pandas `groupby`.
>
> **You should see:** `8` tasks in stage 1, `4` in stage 2, only `32` records shuffled instead of 3,580 (partial sums were computed before the shuffle), and a result equal to pandas: `bank_transfer 303975000`, `card 312380000`, `cod 302230000`, `ewallet 291140000`. The 4 reduce partitions hold `[1, 0, 1, 2]` keys: one reduce task gets nothing to do, a miniature of the partition-size problem above.

## @lesson Lazy evaluation, narrow and wide transformations
Spark operations come in two kinds:

- **Transformations** (`filter`, `select`, `withColumn`, `join`, `groupBy`) describe a new DataFrame and run **nothing**. They build a plan.
- **Actions** (`count`, `collect`, `show`, `write`) trigger execution of the whole plan.

This **laziness** lets Spark see the entire pipeline before running it, so it can optimise: drop unused columns, push filters down to the file scan, reorder joins. It also means an error can surface far from the line that caused it, and that calling two actions on the same DataFrame runs the plan twice unless you cache.

Transformations differ in how data flows:

- **Narrow** (`filter`, `select`, `map`, `withColumn`): each output partition depends on one input partition. No data moves between machines. They are pipelined together within a stage.
- **Wide** (`groupBy`, `join`, `distinct`, `orderBy`, `repartition`): an output partition depends on data from *many* input partitions, so rows must be redistributed by key across the network. This is a **shuffle**, and it marks a **stage boundary**: the stage before writes its output to local disk partitioned by the new key; the next stage fetches those pieces across the network.

You can see all this in the physical plan (`df.explain()`). For a group-by, from the lab:

```text
* HashAggregate (5)                      <- final aggregation, after the shuffle
+- Exchange (4)                          <- the SHUFFLE: hashpartitioning(customer_id, 8)
   +- * HashAggregate (3)                <- partial aggregation BEFORE the shuffle
      +- * Project (2)
         +- * Range (1)
```

Read from the bottom up. Notice that Spark aggregates *before* shuffling (a **map-side combine**) so that it sends partial sums, not raw rows: a cheap optimisation that it does for you. `Exchange` is the node to look for: **count the Exchanges in a plan and you know how many shuffles it will do.** The lab asks you to write exactly that function: narrow-only pipelines have 0, a group-by has 1, a sort-merge join has 2 (one for each side).

Two more rules from this view: (1) an expensive action on an uncached DataFrame is recomputed every time, so `cache()` or `persist()` a DataFrame you reuse (and release it with `unpersist()`); (2) a good plan has **few shuffles** and shuffles **as little data as possible**, which means filtering and selecting columns first.

> 💡 **Practice Pause 1 (Execution Plans & Shuffle Counting):**
> 1. Open `labs/mod-3-1/spark_lab.py` in your text editor. Do not execute this Python file directly in terminal without a test runner.
> 2. Implement `count_exchanges(df)` to count `Exchange` nodes in the formatted physical plan (`df.explain("formatted")`). Remember that `BroadcastExchange` is not a shuffle of the large table and must be excluded.
> 3. Run the tests in terminal:
>    `pytest labs/mod-3-1/test_lab.py -k "test_narrow or test_a_group_by or test_a_sort_merge_join" -v`
> 4. **Success Indicator:** All 3 tests report `PASSED`, confirming that narrow transformations have 0 exchanges, group-by triggers 1 exchange, and sort-merge join requires 2 exchanges.

## @lesson The optimiser: Catalyst, Tungsten and adaptive execution
Whatever API you use (DataFrame, SQL), your query goes through the same engine, in stages:

1. **Catalyst**, the query optimiser. It turns your query into a *logical plan*, applies rule-based rewrites (**predicate pushdown**, **column pruning**, constant folding, join reordering, choosing a join strategy using statistics), and produces a *physical plan*. This is the reason DataFrames beat hand-written **RDD** code (Spark's legacy low-level distributed collection API from before DataFrames, which treated rows as opaque Python/JVM objects): Catalyst can see column types and filters and rewrite what you meant.
2. **Tungsten**, the execution engine. It stores data in a compact binary format (often off the JVM heap), avoids creating Java objects per row, and uses **whole-stage code generation**: the operators of a stage are fused into one generated function, with no virtual call per row. In the plan, the `*` before an operator means it is part of a code-generated stage.
3. **Adaptive Query Execution (AQE)**, on by default in current Spark versions. Statistics before the query runs are often guesses; AQE re-optimises *at runtime*, using the real sizes observed after each shuffle. It can **coalesce** many tiny shuffle partitions into fewer, **switch a sort-merge join to a broadcast join** when one side turns out small, and **split skewed partitions** (below).

Reading a plan is a core skill: use `df.explain("formatted")` and look at (a) the **join type**, (b) the **Exchange** nodes and their partitioning, (c) whether **filters and projections appear inside the scan** (pushdown, as in Module 2.1), and (d) the **partition counts**. The Spark UI's SQL tab shows the same plan with real row counts and times after execution.

> 🛠 **Try it (10 min, Python).** DuckDB has an optimiser with the same pushdown ideas. Save `orders.parquet` as in Module 2.1 and run `duckdb.sql("EXPLAIN SELECT payment_method, count(*) FROM 'orders.parquet' WHERE status = 'delivered' GROUP BY payment_method")`, printing the plan text (`.fetchall()[0][1]`). Then explain `SELECT * FROM 'orders.parquet'`. Find the scan node in both and read its `Projections` and `Filters`.
>
> **You should see:** in the first plan the Parquet scan lists only `payment_method` under `Projections` and `status='delivered'` under `Filters`: the optimiser pushed both into the scan, so other columns are never read and rows are filtered while reading. In the second plan the scan projects all six columns and has no filter. Spark's `explain("formatted")` shows the same ideas as `PushedFilters` and `ReadSchema`.

## @part Joins, skew and tuning

## @lesson Joins and shuffles
A join must bring matching keys together. Spark picks from several strategies:

| Strategy | How it works | When |
|---|---|---|
| **Broadcast hash join** | The small side is sent to every executor; each partition of the big side joins locally. **No shuffle of the big side.** | One side is small (under `spark.sql.autoBroadcastJoinThreshold`, 10 MB by default) |
| **Sort-merge join** | Both sides are shuffled by the join key and sorted; matching partitions are merged | Both sides large (the default for big joins) |
| **Shuffle hash join** | Both sides shuffled; a hash table is built from the smaller side | Medium sizes |
| **Broadcast nested loop / cartesian** | Compares every pair of rows | Joins without an equality condition: dangerous |

The difference is large even on a laptop. On a joined table of 3 million events and 1,001 customers, in the lab's local mode (4 cores), the same aggregation took **2.58 s with a sort-merge join** and **0.85 s with a broadcast join**, three times faster, because the big table was never shuffled. In the plans, the difference is visible:

```text
SortMergeJoin Inner          BroadcastHashJoin Inner BuildRight
:- Exchange   (shuffle)      +- BroadcastExchange   (the small side only)
+- Exchange   (shuffle)
```

So: **if one side is small, broadcast it** (`F.broadcast(small_df)`, or raise the threshold) and check the plan. If both sides are large, the shuffle is unavoidable, so make it cheaper: filter early, select only needed columns, and use the right number of partitions.

**Shuffle partitions.** The number of partitions after a shuffle is `spark.sql.shuffle.partitions`, 200 by default. For small data that is far too many (200 tiny tasks of overhead); for huge data too few (huge partitions that spill). AQE's coalescing handles the first case automatically; set the parameter to match data volume for the second (a good target is about 100 to 200 MB per partition).

**Shuffles are expensive** because each one serialises data, writes it to local disk, sends it across the network and deserialises it again, and because a stage cannot start until the previous one finishes. Techniques to avoid them: broadcast joins, filtering before joining, aggregating before joining, **bucketing** or pre-partitioning tables by the join key (done once, saves shuffles in every later join), and doing less (`distinct` and `orderBy` over everything are rarely needed).

> 💡 **Practice Pause 2 (Broadcast Hash Join Without Shuffle):**
> 1. Open `labs/mod-3-1/spark_lab.py` in your text editor.
> 2. Implement `broadcast_join(large, small, key)` broadcasting the small side to all executors with `F.broadcast(small)`.
> 3. Run the test in terminal:
>    `pytest labs/mod-3-1/test_lab.py -k test_a_broadcast_join_does_not_shuffle_the_big_table -v`
> 4. **Success Indicator:** The test reports `PASSED`, confirming a `BroadcastHashJoin` node appears in the physical plan with 0 exchanges on the large table.

## @lesson Data skew: when one task does all the work
A shuffle sends all rows with the same key to the same partition. If the keys are **unevenly distributed** (**skew**), one partition receives far more data than the others. Stage time is set by the **slowest task**, so the whole stage waits for a straggler while the other cores sit idle. The signature symptom: a stage at "199 of 200 tasks complete" for a long time.

Skew usually comes from a **hot key**. Typical culprits: a default or placeholder value (`customer_id = 0` for guest checkout, `-1`, `''`), `NULL` (all nulls hash to one partition in a group-by), a very popular product, a bot account, a country code that dominates.

The lab builds a dataset where 70% of events belong to customer 0. After hash-partitioning by `customer_id` into 8 partitions, the partition sizes are:

```text
[2,200,366  121,618  121,124  120,272  113,221  112,257  109,813  101,329]    (3,000,000 rows)
largest / median = 18.8          (the same data with uniform keys: 1.08)
```

One partition holds **73%** of the rows. That task must process 18 times more than a typical one. On a real cluster that means one task running for an hour, a very large memory footprint on one executor (spill to disk, or an out-of-memory failure and retry), and a wasted cluster.

**Diagnosing it.** In the Spark UI, open the slow stage and look at the **task summary**: if the *max* task duration or shuffle-read size is many times the *median*, it is skew. A single task with a huge "Shuffle Read Size" and "Spill" confirms it. In code, compute the **skew ratio** (largest partition divided by median) as the lab does; above about 5 deserves attention.

> 💡 **Practice Pause 3 (Diagnosing Data Skew & Partition Sizing):**
> 1. Open `labs/mod-3-1/spark_lab.py` in your text editor.
> 2. Implement `partition_sizes(df, cols, n)` to partition the DataFrame by key columns and return the row count per partition.
> 3. Implement `skew_ratio(sizes)` dividing the maximum partition size by the median partition size.
> 4. Run the tests in terminal:
>    `pytest labs/mod-3-1/test_lab.py -k TestSkew -v`
> 5. **Success Indicator:** All 3 tests in `TestSkew` report `PASSED`, empirically proving that hot-key datasets yield a skew ratio > 10 compared to < 1.5 for uniform datasets.

**Fixes, from simplest to most elaborate:**

1. **Remove or isolate the hot key.** If the hot value is junk (NULL, a placeholder), filter it out before the shuffle. If it is real, process it separately: handle `customer_id = 0` with its own query (no join is needed if the guest has no attributes), then union with the rest.
2. **Broadcast the small side.** If one side is small, no shuffle of the big side happens, so there is no skew problem at all. In the lab, this was also the fastest option (0.85 s).
3. **Let AQE split the skewed partitions.** With `spark.sql.adaptive.skewJoin.enabled`, Spark detects shuffle partitions much larger than the median (by a factor and a minimum size), splits them into smaller sub-partitions, and replicates the matching rows of the other side. The final plan then shows `SortMergeJoin(skew=true)`. In the lab, the same join took **0.93 s** instead of 2.58 s, with identical results. This needs no code change, which makes it the first tool to try on Spark 3 and later.
4. **Salting.** Suppose 1,000,000 `orders` have `customer_id = 0`. Simply hashing `customer_id` sends every one of them to one overloaded task. With `salt = 2`, tag each order randomly with `0` or `1` (`(0, 0)`, `(0, 1)`), and duplicate the small `customers` row for `0` into two rows (`(0, 0)` and `(0, 1)`): now each composite key gets half the orders on different partitions and matches cleanly! In general, add a random **salt** column (0 to N-1) to the large side, so one hot key becomes N keys `(key, salt)`; replicate every row of the small side N times, once per salt value; join on `(key, salt)`. The hot key is now spread across N partitions:

```python
SALT = 8
large_salted = large.withColumn("salt", F.floor(F.rand() * SALT).cast("int"))
small_salted = small.withColumn("salt", F.explode(F.array([F.lit(i) for i in range(SALT)])))
joined = large_salted.join(small_salted, ["key", "salt"]).drop("salt")
```

In the lab, salting brought the skew ratio from 18.8 down to **1.7** and the join to 1.82 s. It costs a larger small table (N copies) and more code, and it cannot be applied blindly: use it when neither a broadcast nor AQE is enough, for example when both sides are large.

On this data, the ranking was broadcast (0.85 s), AQE skew join (0.93 s), salting (1.82 s) and the plain join (2.58 s). The differences are modest on a laptop with 3 million rows and grow dramatically at cluster scale, where a straggler costs hours. (These timings are from one machine in local mode; the *ratios* and the mechanisms are the lesson, not the exact seconds.)

> 💡 **Practice Pause 4 (Skew Mitigation: Salting & Adaptive Query Execution):**
> 1. Open `labs/mod-3-1/spark_lab.py` in your text editor.
> 2. Implement `add_salt(df, factor, seed=4)`, `explode_salt(df, factor)`, and `salted_join(large, small, key, factor)`.
> 3. Implement configuration in `enable_skew_join(spark)` and verification in `uses_skew_join(df)`.
> 4. Run the tests in terminal:
>    `pytest labs/mod-3-1/test_lab.py -k "TestSalting or TestAdaptiveExecution" -v`
> 5. **Success Indicator:** All 5 tests report `PASSED`, verifying salting balances partition ratios to < 3 and AQE successfully triggers `SortMergeJoin(skew=true)` at runtime.

## @lesson Memory, UDFs, files and the rules of thumb
**Executor memory** is split into **execution memory** (shuffles, joins, sorts, aggregations) and **storage memory** (cached data), which share a unified region and can borrow from each other, plus **overhead** for the JVM and PySpark. When execution needs more memory than it has, Spark **spills** to disk (slow but survives); when even that fails, the executor is killed (out of memory). Signs: "Spill (memory/disk)" in the UI, long GC pauses, `OOMKilled` containers (Module 1.1). Remedies: fewer, larger-memory executors for memory-hungry tasks; more partitions (smaller per-task data); fixing skew (the real cause of most OOMs); and not collecting large results to the driver.

**Python UDFs are slow.** A user-defined function written in Python forces every row to be serialised out of the JVM, processed by a Python process, and serialised back. Prefer built-in functions (`F.when`, `F.regexp_replace`, `F.date_trunc`, and hundreds more), which run inside the optimised JVM and can be pushed down. If you truly need Python logic, use a **pandas UDF** (vectorised, using Arrow to move batches) rather than a row-at-a-time UDF.

**Files and layout** (Module 2.1 applies fully): read Parquet or table formats so filters and columns are pushed into the scan; avoid thousands of tiny files (each is a task and a metadata lookup); write with a sensible partitioning and file size; and prefer `coalesce(n)` to reduce output files cheaply (no shuffle) and `repartition(n, col)` only when you really need a reshuffle by key.

**Rules of thumb:**

- Filter and select **early**; let the optimiser prune.
- **Broadcast** small tables; check for it in the plan.
- Keep an eye on **partition counts and sizes**; aim for roughly 100 to 200 MB.
- **Cache** only DataFrames you reuse, and only if they are expensive to recompute.
- Prefer built-in functions to UDFs.
- Never `collect()` a large DataFrame to the driver.
- **Look at the plan and the UI before tuning** anything. Most problems are skew, a missing broadcast, or too many small files.
- Test logic on small data in **local mode** (as the lab does) before running on a cluster.

**Operating a job.** Submit with `spark-submit` (or your platform's job runner), choose resources per job (executors, cores, memory), consider **dynamic allocation** (scale executors with load), and watch cost: a cluster left running, or oversized, is the commonest source of waste. The Spark UI is your instrument panel: *Jobs* and *Stages* for progress and the task summary, *SQL* for the plan with real numbers, *Storage* for cached data, *Executors* for memory, GC and spill.

> 🛠 **Try it (15 min, Python).** See the small-files problem. Repeat the rows of `data/orders.csv` 30 times (about 109,000 rows) with `pd.concat([df] * 30)`. Write them once as `sf/one/all.parquet`, and again cut into 1,000 pieces as `sf/many/p0000.parquet` and so on. Compare the total bytes in each folder, and time `SELECT count(*) FROM read_parquet('<folder>/*.parquet')` in DuckDB for both. Delete `sf/` afterwards.
>
> **You should see:** both folders answer `109020`, but the 1,000 small files take about 7.4 MB against about 0.4 MB for one file (compression and per-file overhead both suffer), and the query over them is tens of times slower (around 60 ms against 1.5 ms here). Every file costs a listing, an open and a footer read, which is why a cluster that writes thousands of tiny files needs compaction.

## @part Spark in production on Databricks

## @lesson Production Spark on Databricks: Unity Catalog, Auto Loader, Photon, Workflows & FinOps {optional}
Everything you just learned about Spark internals—Catalyst, Tungsten, AQE, shuffles, broadcast joins, and data skew—is the engine inside **Databricks**, which appears in **34.8%** of the 1,130 data engineering postings measured in TalentHub (2026-07-23 to 2026-11-20), and in 53.4% of the 517 postings that mention Spark. Here is how a production Databricks platform puts those pieces together on AWS, Azure, or GCP.

### 1. Control Plane vs. Cloud Data Plane & Unity Catalog (`catalog.schema.table`)
Databricks splits its architecture across two boundaries:
- **The Databricks Control Plane** (managed by Databricks): runs the web UI, notebook/git workspaces, the job scheduler (**Workflows**), and the **Unity Catalog** governance metadata service.
- **Your Cloud Account Data Plane** (your AWS VPC, GCP VPC, or Azure VNet): your raw and curated data never leaves your own S3 / ADLS Gen2 / GCS buckets, and Spark/Photon compute nodes spin up inside your private subnets.

**Unity Catalog** enforces a single **3-level SQL namespace (`catalog.schema.table`)** across every workspace:

```sql
-- 1. Three-level namespace: <catalog>.<schema>.<table>
--    Isolate environments by catalog (kopiku_dev, kopiku_staging, kopiku_prod)
USE CATALOG kopiku_prod;
USE SCHEMA analytics;

-- 2. Create a Managed Delta Table with Liquid Clustering & Predictive Optimization
CREATE TABLE kopiku_prod.analytics.fct_orders (
  order_id      STRING,
  customer_id   STRING,
  order_date    DATE,
  status        STRING,
  net_total_idr BIGINT
)
USING DELTA
CLUSTER BY (order_date, status)
TBLPROPERTIES (
  'delta.enableChangeDataFeed' = 'true',
  'delta.enableDeletionVectors' = 'true'
);

-- 3. Grant fine-grained privileges & column/row masking in Unity Catalog
GRANT USE CATALOG ON CATALOG kopiku_prod TO `analytics_engineers`;
GRANT SELECT ON TABLE kopiku_prod.analytics.fct_orders TO `bi_analysts`;
```

- **No hardcoded bucket credentials in notebooks:** Unity Catalog uses **Storage Credentials** (backed by an AWS IAM Role, GCP Service Account, or Azure Managed Identity) and **External Locations** so PySpark code never touches raw S3 access keys.
- **Automatic Column-Level Lineage:** Because every query and PySpark job goes through Unity Catalog, it automatically records upstream-to-downstream column lineage across notebooks, dbt models, and dashboards.

### 2. Medallion Architecture (`Bronze → Silver → Gold`) & Auto Loader (`cloudFiles`)
On Databricks, pipelines follow the **Medallion Architecture** (the same raw → staging → mart layers you built in Modules 1.6 and 2.3):
- **Bronze (Raw Ingestion):** Append-only raw payloads from S3/ADLS/Kafka, preserving exact source fidelity plus metadata (`_metadata.file_path`, `_ingested_at`).
- **Silver (Validated, Deduplicated & Conformed):** Enforces schema contracts, deduplicates retries by primary key, masks/tokenizes PII, and handles SCD2/CDF merges.
- **Gold (Business Aggregates & Semantic Marts):** Star schemas (`dim_*`, `fct_*`) and pre-aggregated metrics served via **Databricks Serverless SQL Warehouses** to BI tools.

**Why Auto Loader (`cloudFiles`) beats raw `spark.read.parquet("s3://...")`:**
When an S3 bucket accumulates 2 million JSON or CSV files over a year, running `spark.read.json("s3://bucket/events/*")` forces Spark to run an expensive S3 `LIST` operation over all 2 million files on every run. Databricks **Auto Loader (`cloudFiles`)** solves this:
1. It uses cloud event notifications (SNS/SQS on AWS, Event Grid on Azure, Pub/Sub on GCP) or incremental directory listing backed by a **RocksDB checkpoint** so it discovers only *newly arrived* files in $O(1)$ time.
2. It evolves schemas automatically and routes unexpected or malformed JSON fields into a **`_rescued_data`** column instead of crashing the nightly job at 3 AM!

```python
# Production Databricks Auto Loader (Bronze Ingestion in PySpark):
bronze_stream = (
    spark.readStream
    .format("cloudFiles")
    .option("cloudFiles.format", "json")
    .option("cloudFiles.schemaLocation", "s3://kopiku-meta/schemas/orders_bronze")
    .option("cloudFiles.inferColumnTypes", "true")
    .option("cloudFiles.schemaEvolutionMode", "addNewColumns")
    .option("rescuedDataColumn", "_rescued_data")
    .load("s3://kopiku-landing/orders/")
    .selectExpr("*", "_metadata.file_path AS _source_file", "current_timestamp() AS _ingested_at")
)

(
    bronze_stream.writeStream
    .format("delta")
    .option("checkpointLocation", "s3://kopiku-meta/checkpoints/orders_bronze")
    .option("mergeSchema", "true")
    # trigger(availableNow=True) processes all new files in micro-batches, then shuts down the cluster ($0 idle cost!)
    .trigger(availableNow=True)
    .toTable("kopiku_prod.bronze.orders_raw")
)
```

> **FinOps Rule for Streaming vs. Batch:** Notice `.trigger(availableNow=True)`! Instead of keeping a 24/7 streaming cluster awake all night waiting for files, `availableNow=True` spins up an ephemeral job cluster every 15 or 60 minutes, processes every new file since the last RocksDB checkpoint with full streaming guarantees, and terminates the cluster immediately.

### 3. Lakeflow Declarative Pipelines (Delta Live Tables) & Quality Expectations
Just as Module 2.5 taught you to quarantine bad records at the ingestion gate, Databricks provides **Lakeflow Declarative Pipelines (Delta Live Tables / DLT)** where you declare data quality rules (**Expectations**) directly on streaming tables and materialized views:

```python
import dlt
from pyspark.sql import functions as F

@dlt.table(
    name="silver_orders",
    comment="Cleaned, deduplicated orders with verified positive revenue",
    cluster_by=["order_date", "status"]
)
@dlt.expect("valid_customer_id", "customer_id IS NOT NULL")          # Warn & log metric in event log, keep row
@dlt.expect_or_drop("positive_amount", "net_total_idr >= 0")         # Drop corrupted negative rows automatically
@dlt.expect_or_fail("primary_key_present", "order_id IS NOT NULL")   # Halt pipeline immediately if PK is missing
def build_silver_orders():
    return (
        dlt.read_stream("orders_raw")
        .filter(F.col("_rescued_data").isNull())
        .withWatermark("order_ts", "2 hours")
        .dropDuplicates(["order_id"])
    )
```

### 4. Databricks Compute & FinOps: Photon, All-Purpose vs. Job Clusters & DABs
On Databricks, your cloud invoice has two parts: **Cloud VM + EBS/S3 cost** (paid to AWS/GCP/Azure) plus **DBUs (Databricks Units)** (paid to Databricks per second of cluster uptime). Three rules prevent most avoidable Databricks costs. DBU rates differ by cloud, region, tier and compute type, so read the rates for your account on the Databricks pricing page; what is stable is their order:

| Compute Type | Relative DBU Rate | When to Use | Classic FinOps Mistake to Avoid |
|---|---|---|---|
| **All-Purpose (Interactive) Cluster** | **Highest** | Ad-hoc exploration and notebook debugging during work hours | **Never run scheduled production pipelines on an All-Purpose cluster.** It is billed at a higher DBU rate than jobs compute and stays awake during idle auto-termination tails. |
| **Jobs Compute (Ephemeral Job Cluster)** | **Lowest** | Scheduled PySpark, dbt, and Auto Loader jobs in Databricks Workflows | Always use ephemeral Job Clusters (or Serverless Jobs) that boot for the run, use Spot/Preemptible workers (with an On-Demand driver), and terminate on completion. |
| **SQL Warehouse (Serverless + Photon)** | **In between** (serverless warehouses can scale down to zero) | BI dashboards (Power BI, Tableau, Looker), dbt SQL models, and analyst queries | Use **Serverless SQL Warehouses** with **Photon** (Databricks' native vectorized C++ execution engine) and a short auto-stop, so BI bursts get capacity quickly and idle time is not billed. |

**Deploying via GitOps (Databricks Asset Bundles / DABs):** Just as Module 3.4 forbade ClickOps in the AWS console, production teams never schedule jobs by clicking in the Databricks UI. Use **Databricks Asset Bundles (`databricks.yml`)** or the **Terraform Databricks Provider** (`databricks_job`, `databricks_catalog`, `databricks_grants`) in Git so `databricks bundle validate` and `databricks bundle deploy -t prod` deploy your Workflows, cluster policies, and Unity Catalog grants from CI/CD.

### 5. Hands-On: Practising on Databricks Free Edition (No Credit Card Required)
You already run real Apache Spark (`pyspark`) and real Delta Lake (`deltalake` / `delta-rs`) locally on your laptop in Modules 2.2 and 3.1. To practise Unity Catalog, SQL Warehouses, Notebooks, and Workflows in the real Databricks UI for **$0**:
1. Open `https://signup.databricks.com` and select **Databricks Free Edition** (Databricks describes it as a no-cost edition for students and hobbyists; it runs on serverless compute with usage limits, and you need no AWS, GCP or Azure account of your own).
2. In the SQL Editor or a Python Notebook, run the 3-level namespace SQL (`CREATE TABLE main.default.kopiku_orders USING DELTA CLUSTER BY (order_date) AS ...`), run `DESCRIBE HISTORY main.default.kopiku_orders`, and test `SELECT * FROM main.default.kopiku_orders VERSION AS OF 0` to see the exact `_delta_log` mechanics from Module 2.2 running inside Unity Catalog!

> 🛠 **Try it (20 min, PySpark from the lab venv, Java 17).** Auto Loader needs Databricks, but its core idea runs in plain Spark: a file stream remembers in a **checkpoint** which files it has already read. Write three small JSON-lines files of 4 orders each into `landing/`. Read the folder with `spark.readStream.schema("order_id LONG, status STRING, total_idr LONG").json("landing")`, write it as Parquet to `bronze/` with `option("checkpointLocation", "chk")` and `.trigger(availableNow=True)`, wait with `awaitTermination()`, and print the sum of `numInputRows` over `query.recentProgress` and the row count of `bronze/`. Add two more files and run again; run a third time with nothing new; then overwrite `orders-0.json` with corrected orders (new `order_id`s) under the same name and run a fourth time.
>
> **You should see:** `12` new rows in run 1, `8` in run 2 (`20` in bronze), `0` in run 3, and `0` again in run 4: the corrected file has a name the checkpoint already knows, so its rows never arrive and nothing reports it. Auto Loader behaves the same way by default, which is why partners must send corrections as new files, and why deleting the checkpoint (which reprocesses everything) is a decision, not a fix. On Databricks you would write `.format("cloudFiles")` and get schema inference and new-column handling on top. Measured with Spark 4.3.0 in local mode.

## @part Reading Spark code in Scala and Java

## @lesson Reading Scala and Java Spark jobs {optional}
Spark itself is written in Scala, and many older or performance-critical pipelines are too. Java or Scala appears in **16.9%** of the 1,130 data engineering postings measured in TalentHub (2026-07-23 to 2026-11-20). Few of those jobs ask you to write Scala on day one. Many will ask you to read an existing job, find the bug in it, or move it to PySpark. The DataFrame API has the same method names in all three languages, so reading is mostly about knowing a short list of differences.

**The same job in Scala and in PySpark.** The course ships it as `labs/mod-3-1/scala/revenue_job.scala`:

```scala
import org.apache.spark.sql.functions._
import spark.implicits._

case class Order(orderId: Long, customerId: Long, status: String, totalIdr: Long)

val orders = Seq(
  Order(1, 10, "paid", 150000), Order(2, 10, "cancelled", 90000),
  Order(3, 11, "paid", 200000), Order(4, 12, "shipped", 120000),
  Order(5, 11, "paid", 50000)
).toDS()

val revenue = orders
  .filter($"status" =!= "cancelled")
  .groupBy($"customerId")
  .agg(sum($"totalIdr").as("revenueIdr"), count(lit(1)).as("orders"))
  .orderBy($"revenueIdr".desc)
```

```python
from pyspark.sql import functions as F

revenue = (orders
  .filter(F.col("status") != "cancelled")
  .groupBy("customerId")
  .agg(F.sum("totalIdr").alias("revenueIdr"), F.count(F.lit(1)).alias("orders"))
  .orderBy(F.col("revenueIdr").desc()))
```

**The differences that matter when you read:**

| Scala or Java | PySpark | Note |
|---|---|---|
| `val x = ...` / `var x = ...` | `x = ...` | `val` cannot be reassigned, `var` can. Most Spark code uses `val`. |
| `case class Order(orderId: Long, ...)` | a schema, or a `Row` | A typed record. `Seq(...).toDS()` turns a list of them into a **Dataset[Order]**. |
| `$"status"` or `col("status")` | `F.col("status")` | `$"..."` needs `import spark.implicits._`. |
| `===` and `=!=` | `==` and `!=` | In Scala, `==` compares the two column *objects* and returns a plain `Boolean`, so `filter($"status" == "cancelled")` does not compile: the error says `filter` `cannot be applied to (Boolean)`. |
| `&&`, `\|\|`, `!` | `&`, `\|`, `~` | Python needs brackets around each condition; Scala does not. |
| `.as("name")` | `.alias("name")` | On a Dataset, `.as[Long]` (square brackets) is different: it converts the type. |
| `.desc` | `.desc()` | Scala allows calling a method with no arguments without brackets. |
| `o => o.totalIdr` | `lambda o: o.totalIdr` | A Scala lambda on a typed Dataset is opaque to the optimiser, just like a Python UDF (Lesson 7). |
| `Dataset[Row]` = `DataFrame` | `DataFrame` | Python has only the untyped version. |

**Java** uses the same API with more words: `Dataset<Row> df = spark.read().parquet(path);`, `col("status").notEqual("cancelled")`, and `functions.sum("totalIdr")`. The method names match; the punctuation changes.

**How a JVM job is built and run.** A Scala project has a `build.sbt` (sbt) or a `pom.xml` (Maven, usual for Java) that lists the Spark version and the Scala version. The two must match: a library built for Scala `2.12` does not load on Spark built for `2.13`, which is why connector names end in `_2.13` (Module 3.3). The build produces a JAR, run with `spark-submit --class com.kopiku.RevenueJob revenue-job.jar 2026-01-15`. The `--class` is the object with the `main` method; the arguments after the JAR go to it. For experiments, `spark-shell` is the Scala REPL with a `spark` session ready, the counterpart of `pyspark`. It comes inside the `pyspark` package you installed for the lab.

**Reading a JVM stack trace.** A Spark error from Scala, Java or PySpark arrives as a Java stack trace, often over 100 lines. Three rules let you read one:
1. Read the **first line** for the exception class and its message. Spark 4 errors carry a class in square brackets, such as `[UNRESOLVED_COLUMN.WITH_SUGGESTION]`, which you can search for in the Spark documentation.
2. Skip the `at org.apache.spark...` lines. They are Spark's own code, and they are almost never where your bug is. Look for the first `at` line that names *your* package or file.
3. If there is a **`Caused by:`** line, the last one is the root cause. The lines above it are only how the error travelled up.

In PySpark the same Java trace is wrapped in a Python one, and the line to read is the one that starts with `pyspark.errors.exceptions...`.

> 🛠 **Try it (20 min, terminal, needs Java 17 and the lab's venv; step 1 of the lab below shows how to install Java).** With the venv active, run the Scala job: `spark-shell --master "local[2]" -i labs/mod-3-1/scala/revenue_job.scala`. It ends by printing the orders worth at least Rp 100,000. Then, without looking at the PySpark code above, write `revenue_job.py` that builds the same five orders and prints the same table and the same line. Finally run `spark-shell --master "local[2]" -i labs/mod-3-1/scala/typo_job.scala`. Find the root cause in the trace, then make the same mistake in your PySpark file and compare the two messages.
>
> **You should see:** both jobs print customer `11` with `250000` from `2` orders, then `10` with `150000` and `12` with `120000`, and the line `big orders: 1,3,4`. `spark-shell` reports `Using Scala version 2.13.18` and finishes in about 15 seconds. The typo job fails with `[UNRESOLVED_COLUMN.WITH_SUGGESTION]` for `total_idr` and suggests `totalIdr` first; PySpark raises the same error class, as `pyspark.errors.exceptions.captured.AnalysisException`. Measured with Spark 4.3.0 and OpenJDK 17.

## @lab Lab: read the plan, find the skew, fix it
Spark in local mode on your laptop. You will write the functions that **inspect** a query (count its shuffles, measure partition skew) and the functions that **fix** it (broadcast, salting, adaptive skew handling), and tests prove each fix gives the same answer as the plain join while changing the plan or the balance in the way the lesson describes.

### @steps
1. Check Java and install. Spark runs on the Java virtual machine, so `java -version` must print version 17 or newer. If it says `command not found` (the usual case on a fresh Ubuntu or WSL2), install it first:

```bash
sudo apt install -y openjdk-17-jre-headless   # Ubuntu, Debian and WSL2
```

On macOS, download the free **Temurin 17** installer (`.pkg`) from adoptium.net, run it, then open a new terminal; or, if you use Homebrew, `brew install --cask temurin@17`. Measured on a fresh Ubuntu 24.04: `java` was missing, the `apt` line installed OpenJDK 17, and the reference solution of this lab then passed its 12 tests in about 17 seconds with PySpark 4.3.


```bash
java -version        # needs 17 or newer
python -m pip install -r labs/mod-3-1/requirements.txt
pytest labs/mod-3-1 -v       # all fail at first (about 20 seconds once implemented)
```

2. Read `labs/mod-3-1/test_lab.py`. It builds a skewed dataset (70% of events belong to customer 0) and a 1,001-row customers table, and disables adaptive execution and automatic broadcasting so that plans are predictable.
3. Open `labs/mod-3-1/spark_lab.py`. `plan_text` is provided: it captures `df.explain("formatted")` as a string. Implement `count_exchanges` (the details section lists nodes like `(5) Exchange`; a `BroadcastExchange` does not count). Then run the tests of `TestPlans`.
4. Implement `partition_sizes` and `skew_ratio`. Look at the numbers for the hot dataset and the uniform one, and explain why one partition is so large.
5. Implement `add_salt`, `explode_salt` and `salted_join`. Check that the result equals the plain join, and that the skew ratio of `(customer_id, salt)` partitions is small.
6. Implement `broadcast_join` and look at its plan.
7. Implement `enable_skew_join` (the configuration values are in the docstring) and `uses_skew_join`. The test runs the join, then checks that the *final* adaptive plan contains `skew=true`.
8. Explore: run the plain, broadcast, salted and AQE versions for a larger `N` (a few million rows) with `time.time()`; print the plans; try changing `spark.sql.shuffle.partitions`. Open the Spark UI (remove `spark.ui.enabled=false`; it is on port 4040) and find the longest task of the plain join.

> 💡 **Practice Pause 5 (Full Verification & Java 17 Check):**
> 1. Ensure Java 17+ is installed and active on your system (`java -version`).
> 2. In terminal, run the complete test suite:
>    `pytest labs/mod-3-1/test_lab.py -v`
> 3. Verify against the reference solution:
>    `LAB_DIR=reference pytest labs/mod-3-1/test_lab.py -v`
> 4. **Success Indicator:** All 12 tests report `PASSED`, confirming full mastery of execution plans, distributed joins, and data skew mitigation in Apache Spark.

### @files
- labs/mod-3-1/spark_lab.py :: Your working file: plan inspection and skew fixes :: starter
- labs/mod-3-1/test_lab.py :: The tests (they build a skewed dataset) :: test
- labs/mod-3-1/requirements.txt :: pyspark and pytest :: config
- labs/mod-3-1/reference/spark_lab.py :: One possible solution (try first!) :: reference

### @deliverables
- All 12 tests pass
- You can show, from your own printed plans, one query with 0 shuffles, one with 1, and one with 2, and say which line of each plan tells you so
- You can explain, in terms of partition sizes, why the plain join is slower than the salted one on this data

### @verify
```bash
pytest labs/mod-3-1 -v
```

Known-good run: `LAB_DIR=reference pytest labs/mod-3-1 -v`. Tests are skipped with a message if Java is not found.

## @chaos The job that sat at 199 of 200 for an hour
### @scenario
A nightly job joins 80 million order events to a customer table and aggregates revenue by tier. It used to take 12 minutes. After the marketing team launched guest checkout, which records `customer_id = 0` for anonymous buyers, runtime climbed to over an hour, and last Friday the job failed outright with an executor out-of-memory error on retry attempt three.

The Spark UI shows the join stage with 199 of 200 tasks complete in four minutes, and one task still running, with a shuffle read of 28 GB while the median task read 140 MB. The cluster is otherwise idle.

### @cause
About 70% of events now carry the guest id 0. A sort-merge join shuffles both sides by `customer_id`, so every event of customer 0 landed in a **single partition**: one task received roughly 200 times the median data, spilled heavily to disk, and eventually exceeded the executor's memory. The other 199 tasks finished and their cores waited. More machines would not have helped, because one key cannot be split by a hash partitioner.

A change in the *data* (a new placeholder value) caused a performance regression in code nobody had touched.

### @fix
1. **Immediate**: enable adaptive skew handling (`spark.sql.adaptive.skewJoin.enabled`), which splits the oversized partition automatically, or broadcast the customer table, which is small.
2. **Structural**: treat the guest key as special. Filter `customer_id = 0` out before the join and aggregate those rows without a join (guests have no customer attributes), then union the results. Salting is the fallback if both sides are large.
3. **Detect it earlier**: log the skew ratio of shuffle partitions or the max/median task time for critical stages, and alert on a change; add a data check on the share of the most common key (Module 2.5).
4. **Prevent it at the source**: agree with the application team that guest orders use `NULL` (and a flag) rather than a magic id, and document the choice in the data contract.

### @pattern
Skew is a property of the data, not the cluster. Measure partition balance, fix the hot key (broadcast, split, adaptive handling, salt), and watch for new placeholder values.

## @quiz
### In a Spark job, what is a stage boundary?
- [ ] The point at which the driver program copies all intermediate results back into its own memory
- [ ] The line where one DataFrame is cached and the next transformation starts reading from disk
- [x] A shuffle, where rows must be redistributed across the whole network by a new grouping key
- [ ] The moment at which a task finishes and a free executor takes the next partition in line

> Narrow transformations are pipelined inside a stage. A wide transformation (groupBy, join) needs data from many partitions, so it requires a shuffle, which ends one stage and begins another.

### Which of these transformations does NOT require a shuffle?
- [ ] `groupBy("customer_id").count()`, since each output group depends on rows from many partitions
- [ ] `orderBy("order_ts")`, because a global sort has to compare rows from different partitions
- [ ] A sort-merge `join` on `customer_id`, because both sides are redistributed by the join key
- [x] `filter("amount > 10")`, because each output partition depends only on one input partition

> Narrow transformations such as filter, select and withColumn work partition by partition. groupBy, orderBy and joins on a key are wide and cause an Exchange.

### A 3-million-row table is joined to a 1,001-row table. Which plan is normally fastest, and why?
- [ ] Sort-merge join, because sorting both inputs guarantees that the matching keys are adjacent
- [ ] A cartesian product, since it compares every row once and cannot produce a skewed partition
- [x] Broadcast hash join: the small table is copied to executors and the big one is not shuffled
- [ ] Shuffle hash join on 200 partitions, because more partitions always make a join finish earlier

> Broadcasting a small side removes the shuffle of the large side. In the lab, the broadcast join took 0.85 s against 2.58 s for the sort-merge join.

### What is the clearest symptom of data skew in the Spark UI?
- [ ] Every task in the stage shows exactly the same duration, and the stage never finishes at all
- [ ] The driver shows a very high amount of memory used, even though there is no data collected
- [x] A few tasks take far longer and read far more data than the median task of the same stage
- [ ] The number of executors drops to zero, and the job stays in a waiting state indefinitely

> Stage time is set by the slowest task. A task whose shuffle read size or duration is many times the median points to a hot key.

### Adaptive query execution's skew join handling works by doing what?
- [ ] Removing the rows of the hot key from the result so that the join can finish without them at all
- [ ] Converting every join in the query into a cartesian product so that the join keys no longer matter at all
- [x] Splitting oversized shuffle partitions into smaller ones, replicating the other side's matching rows
- [ ] Permanently increasing `spark.sql.shuffle.partitions` to 2,000 for every query in the whole session

> AQE measures shuffle partition sizes at runtime. A partition much larger than the median is split into sub-partitions, each joined with a copy of the other side's matching rows, and the final plan shows `skew=true`.

### How does salting reduce skew in a join?
- [ ] It encrypts the join key so that the hot values are no longer recognised by the hash function
- [ ] It adds random rows to the small table so that all keys appear with exactly the same frequency
- [x] A random salt turns one hot key into several keys, and the small side is copied once per salt
- [ ] It sorts the large table by the hot key so that it is processed in a single, ordered task

> The large side gets a random salt (0 to N-1) and the small side is exploded into N copies, so the hot key is spread over N partitions while every row still finds its match.

### Why should you usually avoid a Python UDF in a PySpark job?
- [ ] Python functions cannot read columns of type string or numbers, only whole rows of data at once
- [ ] Spark refuses to run any job that contains user code unless the cluster is in local mode only
- [x] Each row must leave the JVM for Python and return, which is slow and blocks query optimisation
- [ ] UDFs always produce wrong results with null values, which makes them unsafe for use in joins

> Built-in functions run inside the optimised JVM and can be pushed down. A row-at-a-time Python UDF pays serialisation costs and hides logic from Catalyst. Use built-ins, or a vectorised pandas UDF.

### A nightly job's runtime jumps from 12 minutes to over an hour after a product change that put the placeholder id 0 on 70% of rows. What should you try first?
- [ ] Double the number of machines in the cluster, so that the hot key is processed in parallel
- [ ] Replace the join with a loop in the driver, since loops are easier to debug than stages
- [x] Check partition skew, then try a broadcast join or adaptive skew handling before scale-up
- [ ] Set the number of shuffle partitions to one, so that the whole dataset stays on one machine

> One key cannot be split by hash partitioning, so more machines do not help. Confirm skew with partition sizes, and fix it with broadcast, AQE skew handling or salting.

### A Scala job contains `orders.filter($"status" == "paid")`. What happens?
- [x] It does not compile: `==` gives a plain Boolean and `filter` needs a Column
- [ ] It runs and keeps every paid order, exactly as the `===` version would do
- [ ] It runs but returns no rows, because the comparison is always false at runtime
- [ ] It compiles, then fails at runtime with an UNRESOLVED_COLUMN analysis error

> In Scala, `==` compares the two objects themselves and gives a Boolean. Column comparisons use `===` and `=!=`, and the compiler rejects `filter(Boolean)` with "cannot be applied to (Boolean)".

## @resources
- [Apache Spark documentation](https://spark.apache.org/docs/latest/)
- [Spark SQL performance tuning](https://spark.apache.org/docs/latest/sql-performance-tuning.html)
- [PySpark API reference](https://spark.apache.org/docs/latest/api/python/)
- [Spark web UI guide](https://spark.apache.org/docs/latest/web-ui.html)
