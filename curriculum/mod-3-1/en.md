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

## @prereq
Modules 2.1 (Parquet, engines, single-machine limits) and 1.3 (joins, execution plans). Java 17 or newer (`java -version`) and `pip install -r labs/mod-3-1/requirements.txt`. The lab runs Spark in local mode on your laptop.

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

Your code runs as follows. You write DataFrame or SQL operations in Python; they are translated into JVM plans; tasks execute on executors in the JVM. **PySpark** is a thin layer: DataFrame operations never run Python on the data, which is why they are fast. Python code *does* run on the executors when you use a Python **UDF**, covered below, with a heavy price.

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

1. **Catalyst**, the query optimiser. It turns your query into a *logical plan*, applies rule-based rewrites (**predicate pushdown**, **column pruning**, constant folding, join reordering, choosing a join strategy using statistics), and produces a *physical plan*. This is the reason DataFrames beat hand-written RDD code: the engine can see and rewrite what you meant.
2. **Tungsten**, the execution engine. It stores data in a compact binary format (often off the JVM heap), avoids creating Java objects per row, and uses **whole-stage code generation**: the operators of a stage are fused into one generated function, with no virtual call per row. In the plan, the `*` before an operator means it is part of a code-generated stage.
3. **Adaptive Query Execution (AQE)**, on by default in current Spark versions. Statistics before the query runs are often guesses; AQE re-optimises *at runtime*, using the real sizes observed after each shuffle. It can **coalesce** many tiny shuffle partitions into fewer, **switch a sort-merge join to a broadcast join** when one side turns out small, and **split skewed partitions** (below).

Reading a plan is a core skill: use `df.explain("formatted")` and look at (a) the **join type**, (b) the **Exchange** nodes and their partitioning, (c) whether **filters and projections appear inside the scan** (pushdown, as in Module 2.1), and (d) the **partition counts**. The Spark UI's SQL tab shows the same plan with real row counts and times after execution.

> 🛠 **Try it (10 min, Python).** DuckDB has an optimiser with the same pushdown ideas. Save `orders.parquet` as in Module 2.1 and run `duckdb.sql("EXPLAIN SELECT payment_method, count(*) FROM 'orders.parquet' WHERE status = 'delivered' GROUP BY payment_method")`, printing the plan text (`.fetchall()[0][1]`). Then explain `SELECT * FROM 'orders.parquet'`. Find the scan node in both and read its `Projections` and `Filters`.
>
> **You should see:** in the first plan the Parquet scan lists only `payment_method` under `Projections` and `status='delivered'` under `Filters`: the optimiser pushed both into the scan, so other columns are never read and rows are filtered while reading. In the second plan the scan projects all six columns and has no filter. Spark's `explain("formatted")` shows the same ideas as `PushedFilters` and `ReadSchema`.

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
4. **Salting.** Add a random **salt** column (0 to N-1) to the large side, so one hot key becomes N keys `(key, salt)`; replicate every row of the small side N times, once per salt value; join on `(key, salt)`. The hot key is now spread across N partitions:

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

## @lab Lab: read the plan, find the skew, fix it
Spark in local mode on your laptop. You will write the functions that **inspect** a query (count its shuffles, measure partition skew) and the functions that **fix** it (broadcast, salting, adaptive skew handling), and tests prove each fix gives the same answer as the plain join while changing the plan or the balance in the way the lesson describes.

### @steps
1. Check Java and install:

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

## @resources
- [Apache Spark documentation](https://spark.apache.org/docs/latest/)
- [Spark SQL performance tuning](https://spark.apache.org/docs/latest/sql-performance-tuning.html)
- [PySpark API reference](https://spark.apache.org/docs/latest/api/python/)
- [Spark web UI guide](https://spark.apache.org/docs/latest/web-ui.html)
