---
title: Cloud Data Warehouses: How Snowflake, BigQuery and Redshift Work
duration: 2 weeks
summary: Understand what happens inside a cloud data warehouse: columnar storage cut into micro-partitions with statistics, parallel compute, distribution and joins, scan-based and time-based pricing, bulk loading, caching and concurrency. You model each mechanism in plain Python and measure how layout changes the work a query does.
why: Every job post says Snowflake, BigQuery or Redshift, and every bootcamp shows one in a click-through demo. Without the mechanism you cannot explain why one query costs ten times another, how to lay out a table, or how to load data correctly.
---

## @outcomes
- Explain what a cloud data warehouse is, and how it differs from an operational database and from a lakehouse
- Explain micro-partitions, zone maps, partition pruning and clustering, and measure how layout changes the amount of data a query reads
- Explain MPP parallelism, distribution styles and why a co-located join moves no data
- Estimate and reduce the cost of a query under scan-based and time-based pricing
- Load data in bulk with well-sized files, and explain result caching, concurrency and queueing
- Compare Snowflake, BigQuery and Redshift accurately, and choose between a warehouse and a lakehouse

## @prereq
Modules 1.4 (dimensional modeling) and 2.1 (columnar storage and Parquet) help (Module 3.4 covers cloud billing and FinOps later). The lab is plain Python and needs no cloud account.

## @part How a warehouse works

## @lesson What a cloud data warehouse is
An operational database (Module 0.2) is built to read and write a few rows very quickly for many users. A **data warehouse** is built for the opposite job: **scan huge amounts of data and aggregate it** for a few analysts and dashboards. The same SQL, a different engine.

Two ideas make that fast, and you already know both. **Columnar storage** (Module 2.1) keeps each column together, so a query that needs three of fifty columns reads only those, and similar values compress well. **Massively parallel processing (MPP)** splits one query across many machines, each working on its own slice of the data, and merges the partial results.

Cloud warehouses add a third idea: **separate storage from compute**. Data lives on cheap, durable cloud object storage; compute is a set of machines you start, size and stop independently. You can have ten teams querying the same data with ten separate compute clusters that never slow one another down, and you pay for compute only while it runs. The three names you will meet most:

| | Snowflake | BigQuery | Redshift |
|---|---|---|---|
| Compute | **Virtual warehouses** you size and suspend | **Serverless**: Google allocates "slots" per query | A **cluster** (RA3 nodes) or Redshift Serverless |
| Storage | Cloud object storage, managed as micro-partitions | Google's columnar storage (Capacitor), managed | Managed storage (RA3) or local disks |
| Main cost lever | Seconds of warehouse time (credits) | Bytes scanned (on-demand) or reserved slots | Node hours, or serverless compute time |
| Layout tools | Clustering keys | Partitioning and clustering | Sort keys and distribution keys |

(Product details change; check the current documentation before relying on a detail.)

A **lakehouse** (Module 2.2) keeps data in open files such as Parquet on object storage, with a table format (Iceberg, Delta) providing transactions, and lets several engines query it, including DuckDB, Spark and, increasingly, the warehouses themselves (external or Iceberg tables). A warehouse keeps data in its own managed format. The difference is who controls the data format and the engine; the mechanisms in this module apply to both.

Where it fits: raw data lands in object storage (Modules 2.2, 3.4), a tool such as dbt (Module 2.3) builds modelled tables inside the warehouse, and analysts and BI tools query those. Everything you learned about grain, dimensions and facts (Module 1.4) is how those tables should be shaped.

> 🛠 **Try it (10 min, Python).** Reuse the `orders.parquet` from Module 2.1 (or create it again with `df.to_parquet`). From its metadata, take each column's `total_compressed_size` and work out the share of the bytes that `SELECT status, SUM(total_idr) ... GROUP BY status` needs. Pretend the real table is 2 TB at $5 per TB, and print the cost of one run of that query against `SELECT *`, and the cost per day if a dashboard tile runs it 96 times.
>
> **You should see:** a share of `9.1%`, so `0.181 TB` scanned: about `$0.91` per run and `$87` per day, against `$10` per run and `$960` per day for `SELECT *`. A warehouse's "dry run" works out this estimate from metadata before running anything. (BigQuery bills the uncompressed size of the columns rather than the compressed bytes you used here, but the idea is the same.)

:::ask What does 'separate storage from compute' let you do in a cloud warehouse?
@options
store the data without paying anything for it
* stop or resize compute without moving the data
run queries without any compute at all
@why
The data stays on cheap object storage while the compute is a set of machines you start, size and stop independently. You can add a big warehouse for a heavy job and switch it off afterwards.
:::

## @lesson How data is stored: micro-partitions, zone maps and pruning
A warehouse does not store a table as one big file. It cuts it into many **micro-partitions** (Snowflake's name; BigQuery and Redshift have equivalents), each holding a slice of the rows in columnar form, typically tens to hundreds of megabytes. For every partition and every column it records cheap **statistics**: the smallest and the largest value, a **zone map**. These live in metadata, so reading them costs almost nothing.

Now run `WHERE order_date BETWEEN '2026-03-01' AND '2026-03-07'`. For each partition the engine checks its statistics: if the partition's largest date is before March 1, or its smallest is after March 7, **no row in it can match**, so it is skipped without being opened. This is **partition pruning**, and it is the single biggest reason a warehouse query can touch 3% of a table instead of all of it. The lab implements it: `build_micro_partitions`, `prune`, and `scan`.

**It only works if similar values are stored together.** The lab's generator (`make_rows` in the test file, called here with 100,000 rows) makes orders across 365 days in random order. Cut into 100 partitions of 1,000 rows, every partition holds orders from almost every day, so its min is early in the year and its max late: **all 100 partitions match** the one-week filter. Sort the same rows by `order_date` first and cut them again: **3 partitions** match. Same data, same query, same 1,874 result rows, **a thirtieth of the work**. The lab's `average_overlap` measures it: 100.0 partitions overlapping each other in the random layout, 3.0 in the clustered one.

That sorting is what **clustering** means. In Snowflake you define a **clustering key** and the service keeps the table roughly sorted as data arrives. In BigQuery you **partition** a table by a date or integer column (a partition is a unit that can be skipped completely) and **cluster** it by up to four more columns that are sorted within each partition. In Redshift a **sort key** orders rows on disk so that zone maps work. The principle is shared: **pick the columns you filter by most often, and keep data ordered by them**.

Rules of thumb that follow: cluster on columns that appear in `WHERE` and `JOIN` (dates first for event data); a column with extremely high cardinality (a unique id) clusters poorly for range filters; and too many tiny partitions (a classic small-files problem, quantified in Module 3.0) add overhead. Clustering costs maintenance, so it pays off on **large** tables that are filtered repeatedly.

:::advanced Production DDL for BigQuery, Snowflake and Redshift
**Production DDL side-by-side: declaring partitions and clustering keys in real warehouses.** In your job, you declare these physical layouts in DDL (or inside your `dbt_project.yml` / model `config(...)` block). Compare how the exact same `fct_orders` table is laid out across the three major cloud warehouses:

```sql
-- 1. Google BigQuery: Partition by date (1 column) + Cluster by up to 4 columns
--    require_partition_filter = TRUE rejects any query that forgets WHERE order_date ...
CREATE TABLE analytics.fct_orders (
  order_id      STRING,
  customer_id   STRING,
  order_date    DATE,
  status        STRING,
  net_total_idr INT64
)
PARTITION BY order_date
CLUSTER BY status, customer_id
OPTIONS (
  require_partition_filter = TRUE,
  partition_expiration_days = 1095
);

-- 2. Snowflake: All tables are automatically micro-partitioned (50 to 500 MB of uncompressed data each, stored compressed);
--    add a CLUSTER BY key on multi-TB tables so background re-clustering keeps zone maps tight
CREATE TABLE analytics.fct_orders (
  order_id      VARCHAR,
  customer_id   VARCHAR,
  order_date    DATE,
  status        VARCHAR,
  net_total_idr NUMBER(18, 0)
)
CLUSTER BY (order_date, status);

-- 3. Amazon Redshift: SORTKEY orders rows on disk so zone maps prune ranges
--    (Lesson 3 adds distribution styles so joins stay co-located across nodes)
CREATE TABLE analytics.fct_orders (
  order_id      VARCHAR(64)   ENCODE zstd,
  customer_id   VARCHAR(64)   ENCODE zstd,
  order_date    DATE          ENCODE az64,
  status        VARCHAR(32)   ENCODE bytedict,
  net_total_idr BIGINT        ENCODE az64
)
COMPOUND SORTKEY (order_date, status);
```
:::

The second saving comes from **columns**. In the lab, selecting only `total` from the clustered table bills **24,000 bytes**, against **158,041** for all five columns, because a columnar store reads only the columns you name. Against the random layout the same one-column query bills 800,000 bytes: 33 times more. `SELECT *` throws the columnar advantage away.

:::ask A table has 3 micro-partitions. The zone maps for `order_date` say: P1 is Jan 1 to Jan 10, P2 is Jan 11 to Jan 20, P3 is Jan 21 to Jan 31. You query `WHERE order_date = '2026-01-15'`. How many partitions are scanned?
@options
all three partitions, to be safe
none of them: the filter matches nothing
* one: only P2 can hold Jan 15
@why
A zone map is the min/max of each column in each partition. The engine compares the filter with it and skips partitions that cannot match. The less your data's ranges overlap (good clustering), the more it can prune, and scan-priced warehouses charge less.
:::

> 💡 **Practice Pause 1 (Micro-Partitions, Zone Maps & Partition Pruning):**
> 1. In your text editor (VS Code / Cursor), open `labs/mod-2-6/warehouse_lab.py` (do not run `.py` files directly in bash).
> 2. Implement `build_micro_partitions(rows, target_rows, cluster_key=None)` to split rows and compute min/max statistics for every column.
> 3. Implement `prune(partitions, column, low, high)` to skip non-matching partitions using zone maps, and `scan(...)` to project only requested columns.
> 4. Test in terminal:
>    `pytest labs/mod-2-6/test_lab.py -k "(TestMicroPartitions or TestPrune or TestScan) and not test_query_cost" -v`
> 5. **Success Indicator:** 16 tests report `PASSED`, confirming that queries touch only relevant partitions and read only requested columnar bytes.

## @lesson Compute: parallel work, distribution and joins
**MPP.** A warehouse spreads a table over many compute nodes (Redshift calls the per-node worker units **slices**), and every node scans its own part in parallel; the results are combined on a coordinator (Redshift's leader node). More nodes mean more parallelism, until something must be moved between them.

:::talk Neighbours at the table
@teacher Two huge tables, `orders` and `customers`, are spread over 10 machines. You join them on `customer_id`. If an order sits on machine 3 but its customer sits on machine 7, the database must move rows over the network before it can match them.
@ask Which setup moves the fewest rows?
@choice Spread both tables randomly, so the load is balanced | Random placement means most matches are on different machines, and almost everything must travel. Try again.
@choice * Distribute both tables by `customer_id`, so matching rows already sit on the same machine | Yes. This is a co-located join: the order and its customer are neighbours, so nothing crosses the network. Network movement is usually what makes a big join slow.
@choice Put every table on one single machine | That avoids the network but gives up the parallel power of the other nine. Try again.
@teacher Choose the distribution key from the column you join on most. For small dimension tables, a copy on every machine solves it.
:::

**Joins are where data moves.** To join orders and customers on `customer_id`, matching rows must meet on the same node. If they sit on different nodes, one or both tables must be sent over the network (a **shuffle**: exchanging rows by key across the cluster, which Modules 3.0 and 3.1 inspect inside MapReduce and Spark). Redshift lets you choose a **distribution style** (`DISTSTYLE KEY DISTKEY (customer_id)` in DDL) per table:

- **KEY**: rows with the same value of a chosen column go to the same node (like the lab's `distribute(..., style="key")`).
- **EVEN**: rows are dealt out round-robin; balanced, but joins need data movement.
- **ALL**: every node holds a full copy; ideal for small dimension tables.
- **AUTO**: the service decides and may change it as the table grows.

The lab's `join_rows_moved` captures the rules: if both tables are distributed by the join key the join is **co-located and moves no rows**; if one side is a small replicated table (ALL), also no rows; if only one side is on the join key, the other is redistributed; if neither is, both are reshuffled. This is why a big fact table is distributed on its most common join key and small dimensions are replicated. Snowflake and BigQuery make these choices automatically, so you tune less, but the same cost exists inside the engine, and you see it as time spent in a "repartition" or "shuffle" step of the query profile.

**Skew** also appears here: if one key value (a customer with half of all orders) lands on one node, that node does half the work while others wait. Look for unbalanced steps in the query profile.

**Sizing compute.** In Snowflake a **virtual warehouse** comes in sizes (X-Small, Small, Medium, ...); each size up doubles the machines and the credits per hour. A bigger warehouse often finishes a heavy query faster for roughly the same total cost, but gives no benefit to a query that is already small; auto-suspend (Module 3.4) keeps idle time cheap. BigQuery allocates **slots** (units of compute) per query automatically, or you reserve a fixed number. Redshift provisioned clusters are sized in nodes; Redshift Serverless scales on demand.

:::advanced Reading a warehouse query profile
**How to read a Cloud Warehouse Query Profile (The 4 Production Bottlenecks).** When a warehouse query takes 8 minutes or costs $50, do not guess: open the **Query Profile** (Snowflake *Query Profile*, BigQuery *Execution Details*, Redshift `SVL_QUERY_SUMMARY` / `EXPLAIN`). Every senior data engineer checks four numbers immediately:

| Query Profile Symptom | What You See in the Execution Graph | Root Cause | Production Fix |
|---|---|---|---|
| **1. Broken Partition Pruning** | `Partitions scanned: 4,820 / 4,850` (99.4%) | Filtering on a non-clustered column, or wrapping the partition key in a function (`WHERE DATE(event_ts) = ...` or unpruned `MERGE`) | Rewrite predicate to bare partition column (`event_ts >= ... AND event_ts < ...`) or cluster table on the filter key |
| **2. Disk Spilling (Local / Remote S3 Spill)** | `Bytes spilled to local storage: 48 GB` / `Bytes spilled to remote storage: 190 GB` | A huge `GROUP BY`, `COUNT(DISTINCT)`, or `ROW_NUMBER() OVER (...)` exceeded worker RAM and spilled intermediate state to SSD and S3! | Pre-filter columns/rows before the window/join, split into two stages, or temporarily scale up warehouse size (e.g. `Small -> Large`) for that heavy transform |
| **3. Network Broadcast / Shuffle Explosion** | `Repartition / Broadcast: 78% of execution time`, billions of rows sent over network | Joining two huge tables on non-colocated keys, or an accidental many-to-many join fan-out (Module 1.4) | Verify join key uniqueness (`1:N`), co-locate `DISTKEY` / cluster keys, or pre-aggregate before joining |
| **4. Skewed Worker Straggler** | `Max worker time: 420s · Median worker time: 6s` | 90% of rows have `customer_id IS NULL` or `'GUEST'`, hashing to a single MPP worker node | Filter out `NULL` keys before joining (union them back later) or salt skewed keys (Module 3.1) |
:::

> 💡 **Practice Pause 2 (Clustering Overlap & MPP Distribution):**
> 1. Open `labs/mod-2-6/warehouse_lab.py` in your text editor.
> 2. Implement `average_overlap(partitions, column)` to quantify clustering layout quality.
> 3. Implement `distribute(rows, key, nodes, style)` (styles `key`, `even`, `all`) and `join_rows_moved(...)` to model network data movement during MPP joins.
> 4. Test in terminal:
>    `pytest labs/mod-2-6/test_lab.py -k "TestClusteringQuality or TestDistribution or TestJoinMovement" -v`
> 5. **Success Indicator:** 13 tests report `PASSED`, verifying zero network movement for co-located joins and replicated dimension tables.

:::ask You join `orders` and `customers` on `customer_id` in an MPP warehouse. Which distribution avoids moving data across the network?
@options
distribute both tables EVEN, round-robin
keep orders on one node and customers on another
* distribute both tables by KEY on customer_id
@why
KEY distribution sends rows with the same customer_id to the same node, so the matching rows already meet there. EVEN balances the load but forces data to be shuffled for the join.
:::

## @part Cost, loading and governance

## @lesson Cost: scan-based and time-based pricing
:::talk What does SELECT * cost?
@teacher A warehouse bills by the data a query scans: $5 per TB. Your table is 2 TB, and two of its columns, `status` and `total_idr`, make up about 9% of the bytes. A dashboard tile runs one query 96 times a day.
@ask Compare `SELECT status, SUM(total_idr) ... GROUP BY status` with `SELECT *` over the whole table. How different is the daily cost?
@choice About the same, because both read the same table | The table is the same, but a columnar warehouse reads only the columns you name. Try again.
@choice * About $87 a day for the two columns, against $960 a day for `SELECT *`: more than ten times more | Yes. Two columns scan about 0.18 TB (about $0.91 per run), and `SELECT *` scans all 2 TB ($10 per run). 96 runs a day turns that into $87 against $960.
@choice The two-column query costs more, because it has to compute a sum | Computing is cheap here. The bill follows the bytes scanned. Try again.
@teacher Name only the columns you need. A warehouse "dry run" can tell you the bytes before you pay.
:::

Warehouses charge in two basic ways, and you must know which one you are on (Module 3.4 models full cloud budgets and FinOps guardrails later).

**Scan-based** (BigQuery on-demand): you pay per **byte processed** by each query, a few dollars per terabyte (check current prices). The lab's `query_cost(bytes_billed, price_per_tb)` is that formula. Everything in lesson 2 is therefore money: partition pruning and column selection cut the bytes directly. A query can be **estimated before it runs** (BigQuery's dry run reports the bytes), and a hard limit can be set on a query's maximum bytes billed so a mistake fails instead of billing.

**Time-based** (Snowflake, Redshift, BigQuery with reserved capacity): you pay for compute **while it is on**, regardless of how much it scans. Here the saving from pruning is *time*: a faster query holds the warehouse less and lets it suspend sooner.

An illustration with the lab's example price of $5 per TB. A dashboard tile refreshes every 15 minutes (96 times a day) and, on an unclustered table, scans 2 TB each time: 96 × 2 × $5 = **$960 a day**. If clustering and column selection reduce the scan to 3% (as in the lab's measurement), the same tile costs **$28.80 a day**. The query text did not change; the layout did.

**Caches** reduce cost. A **result cache** returns the stored answer when the same query is run again and the underlying tables have not changed (BigQuery and Snowflake both do this for a limited time, and cached results are not billed for scanning). The lab's `ResultCache` shows the logic: the key is the normalised SQL plus the version of every table, so a change to any table invalidates the result. Warehouses also cache data on compute nodes, so a repeated query is faster the second time. **Materialised views** and pre-aggregated tables (built with dbt, Module 2.3) store the results of heavy aggregations so dashboards read small tables instead of scanning facts.

Storage has costs too. **Time travel** (query or restore data as of an earlier moment) keeps old data for a retention window, which you pay to store: Snowflake's default is one day (up to 90 on some editions); BigQuery's is seven days. Long retention on large, frequently rewritten tables adds up.

> 💡 **Practice Pause 3 (Scan-Based Cost Modeling):**
> 1. Open `labs/mod-2-6/warehouse_lab.py` in your text editor.
> 2. Implement `query_cost(bytes_billed, price_per_tb=5.0)` using the formula `(bytes_billed / 1e12) * price_per_tb`.
> 3. Run the test in terminal:
>    `pytest labs/mod-2-6/test_lab.py -k test_query_cost -v`
> 4. **Success Indicator:** The test reports `PASSED`, confirming exact scan cost calculations in dollars per terabyte.

:::drill python What does one query cost?
BigQuery on-demand bills by the bytes a query processes. Write `query_cost(bytes_billed, price_per_tb)`: return the cost in dollars. One terabyte is `1_000_000_000_000` bytes here.
@starter
# write your function below this line

@check
defines("query_cost") ## Define query_cost(bytes_billed, price_per_tb).
query_cost(1_000_000_000_000, 5) == 5 ## One terabyte at $5 per TB costs $5.
query_cost(500_000_000_000, 6) == 3 ## Half a terabyte at $6 per TB costs $3.
query_cost(0, 5) == 0 ## A query that reads nothing costs nothing.
query_cost(2_000_000_000, 5) == 0.01 ## 2 GB is 0.002 TB, so 0.002 × $5 = $0.01.
@hint
Convert `bytes_billed` to terabytes by dividing by `10^12` (`1_000_000_000_000`), then multiply by `price_per_tb`.
@solution
def query_cost(bytes_billed, price_per_tb):
    return bytes_billed / 1_000_000_000_000 * price_per_tb
:::

## @lesson Loading data: bulk, not row by row
A warehouse is built for **bulk loads**, not for inserting one row at a time as an application does. The standard path is: land files in object storage, then tell the warehouse to load them: Snowflake `COPY INTO` from a **stage** (and Snowpipe for continuous loading), BigQuery **load jobs** from Cloud Storage, Redshift `COPY` from S3. They read files in parallel, validate, convert and write micro-partitions.

:::talk A million tiny files
@teacher You must load 1 GB of data into the warehouse. Option A is one million files of 1 KB each. Option B is fifty files of about 20 MB each. The data is identical.
@ask Which option loads faster, and why?
@choice Option A, because small files are easier to read | Each file has a fixed cost to list, open and track. A million files pay it a million times. Try again.
@choice * Option B: each file costs a fixed overhead, and fifty big files can also be loaded in parallel across the warehouse's workers | Yes. Warehouses guide you to files of roughly 100 to 250 MB, and a file count that matches the parallel workers, so that overhead is small and every worker has the same amount of work.
@choice They load equally fast, because the data is the same | The bytes are the same, but a load is also paid per file. Try again.
@teacher Bulk loading is about big files. If your source writes tiny ones, compact them before the load.
:::

**File sizing matters.** Snowflake's guidance is files of roughly **100 to 250 MB compressed**, because very small files add per-file overhead (the small-files problem again) and one huge file cannot be read in parallel. Redshift's guidance is a number of files that is a **multiple of the number of slices**, so that every slice loads the same amount of work. The lab's `plan_load_files` combines both: for a 10 GiB load on a cluster with 16 slices it plans **48 files** of about 213 MiB each (a multiple of 16, and under 250 MiB).

Other practices:

- Prefer a columnar, compressed format such as **Parquet** for loads; use CSV only when you must, and then watch quoting, encoding and the dirty values of Module 0.2.
- **Load into a staging table first**, validate, then **MERGE** into the final table, so that a retried load never creates duplicates (idempotence, Module 1.2; dbt incremental models, Module 2.3).
- For small, frequent updates prefer micro-batches (every minute) to row-level streaming inserts, which are more expensive and, in some systems, limited.
- **External tables** let a warehouse query files in object storage without loading them (Redshift Spectrum, BigQuery external tables, Snowflake external and Iceberg tables): flexible, but usually slower than loaded data because there are no warehouse statistics and no clustering.
- **Unloading** (`COPY INTO` a bucket, `UNLOAD`, `EXPORT DATA`) writes query results back to object storage for other systems.

Record **where every load came from and when**: file names, load ids, row counts and rejected rows. Reconciling counts between source and warehouse (Module 2.5) is the cheapest data quality check there is.

**Private networks and on-premises sources.** When a cloud data factory or warehouse ingestion service needs to copy tables from a database inside a company's or bank's private network, never expose that database to the public internet. Instead, install a **self-hosted integration runtime** (a private-network connector agent) inside that network next to the database so it connects outbound securely to the cloud service.

:::advanced Production bulk loads and an idempotent MERGE
**Production Bulk-Load & Idempotent `MERGE` SQL (Snowflake, BigQuery, Redshift).** Notice how all three warehouses load Parquet files from object storage in parallel, and how the `MERGE` statement **must** include a partition-pruning filter on the target table (`t.order_date >= ...`) so it does not scan the entire historical fact table:

```sql
-- STEP 1: Bulk-load Parquet from cloud object storage into a staging table
-- Snowflake (via External Stage pointing to s3://kopiku-raw/orders/)
COPY INTO analytics.stg_orders
FROM @analytics.s3_orders_stage/dt=2026-10-19/
FILE_FORMAT = (TYPE = PARQUET)
MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE
ON_ERROR = 'ABORT_STATEMENT';

-- BigQuery (native LOAD DATA from GCS Parquet)
LOAD DATA OVERWRITE analytics.stg_orders
FROM FILES (
  format = 'PARQUET',
  uris = ['gs://kopiku-raw/orders/dt=2026-10-19/*.parquet']
);

-- Redshift (parallel COPY from S3 using an attached AWS Identity and Access Management / IAM Role — zero hardcoded keys!)
TRUNCATE TABLE analytics.stg_orders;
COPY analytics.stg_orders
FROM 's3://kopiku-raw/orders/dt=2026-10-19/'
IAM_ROLE 'arn:aws:iam::123456789012:role/RedshiftS3ReadRole'
FORMAT AS PARQUET;

-- STEP 2: Idempotent MERGE from staging into the partitioned target fact table.
-- The extra date condition lets the warehouse skip old partitions of fct_orders, but the cutoff must
-- come from THIS batch: the oldest order_date it contains (late updates of old orders included).
-- BigQuery:  DECLARE cutoff DATE DEFAULT (SELECT MIN(order_date) FROM analytics.stg_orders);
-- Snowflake: SET cutoff = (SELECT MIN(order_date) FROM analytics.stg_orders);   -- then write $cutoff
MERGE INTO analytics.fct_orders AS t
USING (
  SELECT * FROM analytics.stg_orders
  QUALIFY ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY updated_at DESC) = 1
) AS s
ON t.order_id = s.order_id
   AND t.order_date >= cutoff               -- never a fixed "last 2 days": see below
WHEN MATCHED AND s.updated_at > t.updated_at THEN
  UPDATE SET status = s.status, net_total_idr = s.net_total_idr, updated_at = s.updated_at
WHEN NOT MATCHED THEN
  INSERT (order_id, customer_id, order_date, status, net_total_idr, updated_at)
  VALUES (s.order_id, s.customer_id, s.order_date, s.status, s.net_total_idr, s.updated_at);
```

**Why the cutoff must come from the batch.** A fixed window such as "the last two days" looks safe and makes the `MERGE` cheap, but it breaks the moment an old order changes: a refund for an order from three weeks ago matches no row inside the window, so `WHEN NOT MATCHED` inserts it as a *second* row and the order is counted twice. Reproduced in DuckDB 2.0.1: with a fixed cutoff, the late refund of an old order became a duplicate (`paid 100` and `refunded 0` for the same `order_id`); with the cutoff taken from the oldest `order_date` in the batch, the order was updated in place, a retry of the same batch changed nothing, and every order kept exactly one row.
:::

> 💡 **Practice Pause 4 (Planning Parallel Bulk Load Files):**
> 1. Open `labs/mod-2-6/warehouse_lab.py` in your text editor.
> 2. Implement `plan_load_files(total_bytes, slices, min_bytes=100 * MiB, max_bytes=250 * MiB)` to split files so each is `<= max_bytes` and the count is a multiple of `slices` (`min_bytes` is informational only, do not enforce it as a hard floor).
> 3. Run the tests in terminal:
>    `pytest labs/mod-2-6/test_lab.py -k TestLoadPlanning -v`
> 4. **Success Indicator:** All 4 tests in `TestLoadPlanning` report `PASSED`, confirming balanced file sizing without small-file overhead.

:::ask You must load 10 million rows into a warehouse each night. Which path is the right one?
@options
* write files to storage and bulk load them
run 10 million single-row INSERT statements
open one connection per row from the application
@why
Warehouses are built for bulk loads of reasonably sized files (about 100 to 250 MB compressed for Snowflake). Row-by-row inserts pay a large per-statement overhead and are slow and costly.
:::

## @lesson Concurrency, governance, and choosing
:::talk Five queries, two slots
@teacher A warehouse can run two queries at the same time (two slots). At 09:00 five dashboards each send a query that takes 10 seconds on its own. All five arrive together.
@ask When does the last of the five finish?
@choice After 10 seconds, because the warehouse is parallel | Parallel inside one query does not create more slots. Only two queries run at a time. Try again.
@choice After 50 seconds, because the queries run one after another | Two run side by side, so it is faster than one after another. Try again.
@choice * After 30 seconds: two finish at 10, two more at 20, and the fifth at 30 | Yes. Three waves: 2 + 2 + 1. The people whose queries wait feel a slow dashboard, although every query is fast.
@teacher The standard cures: separate workloads onto their own compute so a heavy job cannot block a dashboard, scale out for bursts, and shorten the heavy queries.
:::

**Concurrency.** A warehouse has finite compute. When more queries arrive than it can run at once, the extra ones **queue**. The lab's `simulate_queue` shows it: five 10-second jobs on two slots finish at 10, 10, 20, 20 and 30 seconds, so the last user waits 20 seconds before the job even starts. The cures are the same everywhere: isolate workloads on separate compute (a warehouse for ETL, one for dashboards, one for analysts), use multi-cluster or auto-scaling features for bursts, and make heavy queries shorter with the layout tools above. Isolation also makes the bill attributable to a team (Module 3.4).

**Governance.** Data engineers set up access, not just tables. The common pieces: **roles** with privileges granted to roles rather than to people (Snowflake's role hierarchy, BigQuery IAM, Redshift groups and roles); **column masking** and **row access policies** so that analysts see masked emails or only their region's rows; **encryption** at rest and in transit (the warehouse handles it; you manage the keys policy); and **audit logs** of who queried what. Personal data needs extra care (Modules 2.5 and 3.5, deletion requests).

Two features you will hear about: **zero-copy cloning** (Snowflake) creates a copy of a table or database as metadata, which costs storage only for changes, ideal for test environments; and **secure data sharing** lets another account query your data without copying it.

:::advanced Production governance SQL
**Production Governance SQL: Dynamic Data Masking, Row-Level Security & Zero-Copy Clones.** Instead of maintaining separate "masked" and "unmasked" copies of a table, modern cloud warehouses enforce column masking and multi-tenant row filtering directly in the catalog policy:

```sql
-- 1. Dynamic Column Masking (Snowflake syntax; BigQuery does the same with policy tags on columns):
--    Analysts see '***@domain.com'; only the PII_COMPLIANCE_ROLE sees raw emails
CREATE OR REPLACE MASKING POLICY governance.email_mask AS (val STRING) RETURNS STRING ->
  CASE
    WHEN CURRENT_ROLE() IN ('PII_COMPLIANCE_ROLE', 'ACCOUNTADMIN') THEN val
    ELSE REGEXP_REPLACE(val, '^[^@]+', '***')
  END;

ALTER TABLE analytics.dim_customer
  MODIFY COLUMN email SET MASKING POLICY governance.email_mask;

-- 2. Multi-Tenant Row Access Policy (Enforces Embedded Analytics Isolation):
CREATE OR REPLACE ROW ACCESS POLICY governance.tenant_isolation
  AS (row_tenant_id VARCHAR) RETURNS BOOLEAN ->
  CURRENT_ROLE() = 'PLATFORM_ADMIN'
  OR EXISTS (
    SELECT 1 FROM governance.role_tenant_map m
    WHERE m.role_name = CURRENT_ROLE() AND m.tenant_id = row_tenant_id
  );

ALTER TABLE analytics.fct_orders
  ADD ROW ACCESS POLICY governance.tenant_isolation ON (tenant_id);

-- 3. Zero-Copy Cloning for Safe CI/CD Testing (a metadata-only copy: you pay storage only for data that changes afterwards):
CREATE DATABASE analytics_pr_482 CLONE analytics_prod;
-- Run dbt build --target pr_482 against real production scale, then:
DROP DATABASE analytics_pr_482;
```
:::

**Choosing.** There is no universal winner. A fair summary:

| | Strong points | Watch out for |
|---|---|---|
| **Snowflake** | Easy to run, strong isolation with virtual warehouses, cross-cloud, sharing | Cost control needs discipline (idle warehouses, size) |
| **BigQuery** | No servers, strong on very large scans, tight Google Cloud integration | Scan-based cost surprises; partition and cluster properly |
| **Redshift** | Deep AWS integration, predictable cost on steady load | More tuning (distribution and sort keys), cluster sizing |
| **Lakehouse** (Spark, Trino, DuckDB on Iceberg/Delta) | Open formats, no lock-in, one copy of data for many engines | More to operate yourself, fewer built-in governance tools |

In practice the choice is often made by the company's cloud provider and existing contracts. What transfers between all of them is what you learned here: **layout** (pruning), **bytes and time** (cost), **movement** (distribution and shuffles), **bulk loading**, and **isolation**.

**How warehouses and lakehouses converged (Native vs. External Parquet vs. Managed Iceberg Tables).** In Chapters 3 and 6 of *Fundamentals of Data Engineering*, Reis & Housley predicted the convergence of data warehouses and data lakes. Today, you do not have to choose an all-or-nothing vendor lock-in. Every major cloud warehouse supports three table storage modes:

| Table Mode | Where Files Live | Who Owns Metadata & Compaction | Performance & Interoperability Trade-off |
|---|---|---|---|
| **1. Native Warehouse Table** (Snowflake Internal, BigQuery Native, Redshift Managed) | Inside the warehouse vendor's proprietary bucket | The warehouse engine automatically | Fastest out-of-the-box pruning & clustering, but other engines (Spark/DuckDB) cannot read the files directly without export/connector cost |
| **2. Unmanaged External Table** (Raw Parquet/CSV on S3/GCS/ADLS) | Your own cloud object storage bucket | Nobody (directory listing on S3) | No ACID transactions, slow metadata listing on millions of files, no automatic compaction |
| **3. Open Lakehouse Table** (Snowflake Iceberg / Polaris, BigQuery BigLake Iceberg, Redshift Iceberg) | Your own S3/GCS/ADLS bucket in open **Apache Iceberg** format | Open Iceberg catalog (REST / Glue / Polaris / Unity) | **Reversible two-way door:** Spark, DuckDB, Trino and Flink can read the same Parquet files in place, with no copies; how close it comes to native speed depends on the engine and on table maintenance (compaction), so measure it on your own queries |

Questions you can now answer: "Why is this query expensive?" (it scans many partitions or columns; look at partitions scanned and bytes billed). "How do I make it cheaper?" (filter on the clustering or partition column, select only needed columns, pre-aggregate). "What is the difference between Snowflake and BigQuery pricing?" (compute time versus bytes scanned). "Why file sizes of 100 to 250 MB?" (parallelism without per-file overhead).

> 💡 **Practice Pause 5 (Result Caching & Concurrency Queueing):**
> 1. Open `labs/mod-2-6/warehouse_lab.py` in your text editor.
> 2. Implement class `ResultCache`: normalize whitespace and SQL casing, track table versions, and invalidate cache entries when underlying tables change.
> 3. Implement `simulate_queue(jobs, slots)` where `jobs` is a list of `(name, duration_seconds)` tuples, returning `{name: (start, finish)}` to model queries competing for execution slots.
> 4. Run the tests in terminal:
>    `pytest labs/mod-2-6/test_lab.py -k "TestResultCache or TestQueueing" -v`
> 5. **Success Indicator:** 8 tests report `PASSED`, validating cache invalidation and concurrency queue behavior.

:::drill python The queue at the warehouse
A warehouse can run `slots` queries at once; the rest wait. Write `finish_time(durations, slots)`: all jobs arrive at time 0 in the given order. Each job starts as soon as a slot is free. Return the time when the **last** job finishes.
@starter
# write your function below this line

@check
defines("finish_time") ## Define finish_time(durations, slots).
finish_time([10, 10, 10, 10, 10], 2) == 30 ## Five 10-second jobs on two slots: 10 + 10 + 10 seconds.
finish_time([10, 10], 2) == 10 ## Two jobs, two slots: both run at once.
finish_time([5, 5, 5], 1) == 15 ## One slot: they run one after another.
finish_time([], 3) == 0 ## No jobs finish at time 0.
@hint
Keep a list `free_at` of `slots` zeros. For each duration, take the slot that frees earliest (`min`), add the duration to it. The answer is the largest value.
@solution
def finish_time(durations, slots):
    free_at = [0] * slots
    for d in durations:
        i = free_at.index(min(free_at))
        free_at[i] += d
    return max(free_at)
:::

## @part Serving, and a real warehouse

## @lesson Serving and replacing: semantic layers, reverse ETL, federation, data mesh and the strangler fig
> **In short:** Serving data is more than dashboards. A **semantic layer** defines each business metric once, so every tool gets the same number. **Reverse ETL** sends results from the warehouse back into operational tools, so it must be safe to retry. **Federation** queries several systems without copying them first. **Data mesh** hands data ownership to domain teams. And when you inherit an old pipeline, the **strangler fig** pattern replaces it piece by piece, comparing old and new until they agree.

These ideas come from chapters 3, 8 and 9 of *Fundamentals of Data Engineering*. Be realistic about how often you will meet each one: in the TalentHub job database, 37% of the 1,130 data engineering postings mention BI tools or dashboards, 18% mention migrations or legacy systems, 5% name a semantic or metrics layer, and under 1% name reverse ETL. Learn the ideas because they explain problems you will meet anyway, not because every job asks for them by name.

1. **Semantic (metrics) layer.** Why do finance and marketing bring two different "net revenue" numbers to the same meeting? Because each dashboard or spreadsheet writes its own formula: one subtracts discounts and tax, another forgets to leave out refunded orders. A semantic layer (dbt MetricFlow, Cube, LookML) defines the metric once, in version-controlled code, and every tool asks it for the number.
2. **Reverse ETL.** Normal pipelines copy data *out of* operational tools into the warehouse. Reverse ETL copies modeled results, such as a customer's lifetime value or a "VIP" flag, *back into* tools like a CRM. Those tools act on what you send: they email customers and change their offers. So every record you send carries a deterministic **idempotency key** built from what it says, so that a retry updates instead of acting twice. And you decide carefully what not to send: a customer whose value is zero or negative should not trigger an automated campaign.
3. **The strangler fig.** You will often inherit an old pipeline (a 3,000-line stored procedure, a cron script nobody understands) instead of starting fresh. A big rewrite all at once is risky. The strangler fig pattern (named by Martin Fowler) replaces it piece by piece. Build the new version of one metric. Run old and new side by side. Report every date where they differ and by how much. Switch consumers over only when the differences are explained. Each difference is either a bug in the new code or an old bug you have just found.
4. **Federation, data mesh and fast serving.**
   - *Federation:* engines such as Trino and DuckDB can join a PostgreSQL table, Parquet files on S3 and a warehouse table in one query without copying them first. That is ideal for exploring; joins you run every day still belong in materialised tables.
   - *Data mesh:* for large companies where one central data team has become the bottleneck. Its four principles: domain teams own their data, data is treated as a product, a platform team provides self-service tools, and governance rules are shared and automated.
   - *Fast serving:* customer-facing analytics that must answer in milliseconds uses engines such as ClickHouse, Druid or Pinot. Machine-learning *feature stores* keep the same features in an offline store for training and an online store for live predictions, so a model sees the same values in both.

```python
import hashlib

def make_reverse_etl_key(customer_id, sync_date, net_ltv_idr):
    raw = f"{customer_id}:{sync_date}:{net_ltv_idr}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
```

> 🛠 **Try it (20 min, in your own terminal).** Save `~/practice/strangler_reverse_etl.py` and write `run_strangler_and_reverse_etl(orders, legacy_daily_totals, sync_date)`. Each order has `order_id, customer_id, order_date, status, gross_idr, discount_idr, tax_idr`; `legacy_daily_totals` maps a date to the old pipeline's net revenue. Net revenue is gross minus discount minus tax, counted only for `paid`, `shipped` and `delivered` orders. Return a dict with:
> `semantic_daily`: date → net revenue, for every date that has orders · `drift_report`: one `{date, legacy_idr, semantic_idr, delta_idr}` per date where old and new differ, sorted by date, with `delta_idr = semantic - legacy` · `reverse_etl_payloads`: one `{customer_id, net_ltv_idr, tier_action, idempotency_key}` per customer worth sending, sorted by `customer_id`; `tier_action` is `VIP_UPGRADE` from 200000 upward, otherwise `STANDARD_SYNC`; the key is made as in the code above.
> Real data is untidy: think about how a status can be written, which dates either side might have that the other lacks, and which customers must not be sent.
> Check it: `python3 labs/tryit/check.py 2.6-1 ~/practice` (stuck? add `--hint 1`, then 2 and 3)

**Three kinds of analytics, three sets of requirements.** The book (chapter 9) separates who the analytics are for, because the audience decides almost every technical choice:

| | Business analytics | Operational analytics | Embedded (customer-facing) analytics |
|---|---|---|---|
| For whom | analysts, managers | operations teams and automated alerts | your customers, inside your product |
| Question | what happened and why | what is happening right now, act on it | how is *my* account doing |
| KopiKu example | weekly revenue by city and roast | "a store will run out of Gayo beans today" | KopiKu sells its till software to cafés; each owner sees their own sales dashboard |
| Freshness | daily is usually fine | seconds to minutes | minutes to hours, depending on the product |
| Time per query | a few seconds is acceptable | seconds | well under a second |
| Users at once | tens | a few people, many automated checks | hundreds to thousands, often in the same minute |
| Cost of a mistake | a wrong decision later | a missed stock-out or fraud | another customer sees your data: a breach |

Embedded analytics is the hardest. It is **multi-tenant**: one set of tables serves many customers (tenants), so the isolation must be enforced by the system, not by every developer remembering a `WHERE`. Take the tenant from the logged-in session, never from a value the user can change in the URL, and let the database enforce it with **row-level security** (PostgreSQL), **row access policies** (Snowflake) or **row-level security** in BigQuery (lesson 6). Speed comes from doing the heavy work before the customer arrives: a pre-aggregated table per tenant and day or month, built by the pipeline, or a serving engine such as ClickHouse, Druid or Pinot (point 4 above).

> 🛠 **Try it (15 min, Python).** With DuckDB and `SET threads = 1`, create 5,000,000 orders for 2,000 tenants: `SELECT range AS order_id, range % 2000 AS customer_id, DATE '2025-01-01' + CAST((range // 2000) % 700 AS INTEGER) AS order_date, 10000 + (range * 37) % 500000 AS total_idr FROM range(5000000)`. Build a table `monthly` with revenue per customer and month. Then time a tenant's dashboard query, "revenue per month for customer ?", 100 times for random customers, once on the raw orders and once on `monthly`, and compare the median. Check that both give the same rows. Finally, drop the `WHERE customer_id = ?` and count the distinct `customer_id` values the query would then read.
>
> **You should see:** `monthly` has `48000` rows (24 months for each of 2,000 customers) and takes about a tenth of a second to build. On a laptop CPU (AMD Ryzen 5 PRO 4650U, DuckDB 2.0.1) the median was about `13` ms on the raw orders and about `0.9` ms on `monthly`, around 14 times faster, with identical results: roughly 75 versus 1,100 queries per second per core. If 1,000 cafés open a five-chart dashboard in the same minute, that is 5,000 queries, about 83 per second: more than one core can serve from raw orders, a small fraction of one core from `monthly`. Without the `WHERE`, the dashboard silently adds up the orders of all `2000` tenants and shows them to one café. Your times will differ; the ratio should not by much.

:::ask You inherit a 3,000-line stored procedure that feeds the dashboards. What is the safest way to replace it?
@options
* the strangler fig: replace it piece by piece, comparing
rewrite everything in one go and switch on a Friday
never touch it, since it works
@why
A big-bang rewrite has no way back and no proof. The strangler fig replaces the old system **piece by piece**, with both running side by side so the numbers can be compared, until the old code has nothing left to do.
:::

## @lesson Deep dive: Google BigQuery architecture, ARRAY<STRUCT> modeling, FinOps & Free Sandbox {optional}
**Google BigQuery** appears in **12.7%** of the 1,130 data engineering postings measured in TalentHub (2026-07-23 to 2026-11-20), behind Databricks (34.8%) and Snowflake (25.8%) and just ahead of Redshift (11.7%). It is still the easiest *real* warehouse to practise on, because its sandbox needs no payment card, and its design explains a lot about the others. You need to understand how its internal architecture shapes how you model tables, ingest streams, and control costs on GCP.

### 1. How BigQuery works under the hood (Colossus, Capacitor, Dremel & Dynamic Shuffle)
Unlike Snowflake or Redshift, where you pick a cluster size (`X-Small`, `4 nodes`) and data is cached on local worker SSDs, BigQuery disaggregates **four** layers across a Google data center:

| BigQuery Layer | Internal Google Tech | What It Does & Why It Matters to You |
|---|---|---|
| **1. Distributed Storage** | **Colossus** + **Capacitor** | Stores data in **Capacitor** columnar files on Google's **Colossus** distributed file system, replicated across zones. Each column and sub-column has rich min/max, null, and dictionary headers for instant pruning. |
| **2. Multi-Tenant Compute Tree** | **Dremel** (on **Borg**) | When you run a query, BigQuery allocates thousands of stateless **slots** (virtual CPUs) arranged in a **Dremel execution tree**: *Leaf slots* read Capacitor blocks from Colossus in parallel; *Mixer slots* aggregate partial results up to the *Root*. |
| **3. In-Memory Distributed Shuffle** | **BigQuery RAM Shuffle** | Instead of writing shuffle spill files to local worker disks, Leaf slots push intermediate hash buckets into a separate **shared in-memory shuffle tier**. That is why BigQuery can dynamically add or remove slots mid-query! |
| **4. Petabit Network Fabric** | **Jupiter** | Connects Colossus, Dremel slots, and the RAM Shuffle tier at petabit/sec bisection bandwidth so remote storage reads nearly as fast as local SSDs. |

**Architectural consequence:** Because BigQuery has no persistent local disk cache on dedicated worker VMs, you cannot rely on "warm cluster SSD cache" to forgive a bad table layout. Every non-cached query reads directly from Colossus, so **partitioning, clustering, column selection, and nested `ARRAY<STRUCT>` modeling** are mandatory.

### 2. The #1 BigQuery Data Modeling Superpower: Nested & Repeated Fields (`ARRAY<STRUCT>` and `UNNEST`)
In a traditional relational database (or Kimball Star Schema, Module 1.4), an order with 4 line items is split across two tables (`fct_orders` and `fct_order_items`), requiring a distributed `JOIN` on `order_id` at query time. If you flatten them into One Big Table (OBT), the order header columns (`customer_id`, `order_date`, `shipping_city`) are duplicated 4 times.

In Chapter 8 of *Fundamentals of Data Engineering* and Google's BigQuery architecture guide, the canonical pattern is **denormalizing parent-child hierarchies into a single row using `ARRAY<STRUCT<...>>` (`REPEATED RECORD`)**:

```sql
-- 1. Create a partitioned, clustered table with a nested ARRAY<STRUCT> for line items:
CREATE TABLE analytics.fct_orders_nested (
  order_id      STRING,
  customer_id   STRING,
  order_date    DATE,
  city          STRING,
  items         ARRAY<STRUCT<
    sku         STRING,
    roast       STRING,
    qty         INT64,
    unit_idr    INT64
  >>
)
PARTITION BY order_date
CLUSTER BY city, customer_id;

-- 2. Querying header-level metrics touches ZERO item bytes (no fan-out, no join!):
SELECT city, COUNT(order_id) AS order_count
FROM analytics.fct_orders_nested
WHERE order_date = DATE '2026-10-19'
GROUP BY city;

-- 3. Querying line-item metrics uses CROSS JOIN UNNEST(items) — co-located inside the same row!
SELECT
  o.city,
  item.roast,
  SUM(item.qty * item.unit_idr) AS roast_revenue_idr
FROM analytics.fct_orders_nested AS o
CROSS JOIN UNNEST(o.items) AS item
WHERE o.order_date = DATE '2026-10-19'
GROUP BY o.city, item.roast;
```

**Why `ARRAY<STRUCT>` wins in BigQuery (and DuckDB / Parquet):**
1. **Zero network shuffle:** The parent order and its child items live in the exact same Capacitor/Parquet row group on the same Leaf slot. `UNNEST` is a local pointer loop in CPU cache, not a distributed network hash join.
2. **Zero grain fan-out on header queries:** Counting `COUNT(order_id)` on the table counts orders (1 row per order) without multiplying by line items.
3. **Sub-column pruning:** Capacitor stores `items.roast`, `items.qty`, and `items.unit_idr` as separate physical sub-columns on disk. The query above never even reads `items.sku`!

> 🛠 **Try it (10 min, Python with DuckDB: runs locally without a cloud account!).** DuckDB and Parquet use the exact same nested columnar representation as BigQuery Capacitor. In Python, run `import duckdb; con = duckdb.connect()` and execute:
> `con.execute("CREATE TABLE orders_nested AS SELECT 'O-1' AS order_id, 'Jakarta' AS city, [{'sku':'GAYO','qty':2,'price':45000}, {'sku':'TORAJA','qty':1,'price':55000}] AS items UNION ALL SELECT 'O-2', 'Jakarta', [{'sku':'GAYO','qty':3,'price':45000}]")`.
> First run `SELECT city, COUNT(order_id) AS orders FROM orders_nested GROUP BY city` (header grain). Next, unnest the array just like BigQuery: `SELECT o.city, it.sku, SUM(it.qty * it.price) AS rev FROM orders_nested o, UNNEST(o.items) AS t(it) GROUP BY o.city, it.sku ORDER BY rev DESC`.
>
> **You should see:** the header query returns `('Jakarta', 2)` with zero line-item duplication, and the `UNNEST` query returns `[('Jakarta', 'GAYO', 225000), ('Jakarta', 'TORAJA', 55000)]` with zero distributed join!

### 3. BigQuery Ingestion, CDC Upserts & Partition Limits
- **Partition limits:** A BigQuery table can have at most **10,000 partitions** (about 27 years of daily partitions), and a single job can modify at most 4,000 of them, which matters for large backfills (Google's quotas page, updated 2026-11-20). If you run into the limits, partition by `DATE_TRUNC(order_date, MONTH)` and `CLUSTER BY order_date, customer_id`: clustering inside each monthly partition still prunes days.
- **Real-time CDC without repeated `MERGE` jobs (not in the sandbox: it needs streaming):** Running a `MERGE` every few minutes on a multi-TB table is expensive. BigQuery can ingest change data capture through the **Storage Write API**: declare `PRIMARY KEY (order_id) NOT ENFORCED` on the table and stream rows with the pseudocolumn `_CHANGE_TYPE` set to `UPSERT` or `DELETE`. With `OPTIONS (max_staleness = INTERVAL 15 MINUTE)`, BigQuery applies the changes in the background at least once per interval, trading a little freshness for lower query cost and latency.

### 4. BigQuery FinOps: On-Demand ($/TiB) vs. BigQuery Editions (Autoscaling Slots)
BigQuery offers two billing models, and mixing them up is a classic production mistake:

| Billing Model | How You Pay | Best For | Crucial FinOps Guardrail |
|---|---|---|---|
| **On-Demand** | **~$6.25 per TiB scanned** (first 1 TiB/month free) | Spiky, unpredictable workloads, startups, and well-partitioned tables | Set `maximum_bytes_billed` on every query/dbt profile and `require_partition_filter = TRUE` on every large table |
| **BigQuery Editions** (*Standard, Enterprise, Enterprise Plus*) | **Slot-hours** (~$0.04–$0.06/slot-hour, autoscaled in multiples of 50 slots) | High-frequency dashboards and steady enterprise ETL scanning hundreds of TiB/day | Set a low **`max_slots` reservation cap** (e.g. `baseline = 0, max_slots = 100`); otherwise one unoptimized query will autoscale to 1,600 slots instantly! |

Prices are Google's US list prices on its pricing page in November 2026 (Standard edition $0.04, Enterprise $0.06 per slot-hour, pay as you go); other regions and commitments differ, so check the page before you estimate.

### 5. Hands-On Walkthrough: Google BigQuery Free Sandbox & Snowflake Guardrails
When you are ready to try these patterns on a live cloud warehouse without spending money, use the **Google BigQuery sandbox**: no payment card needed.

> **Status:** the sandbox steps follow Google's documentation as of November 2026 (sandbox page updated 2026-11-10, install page 2026-11-17, quotas page 2026-11-20), but the course has not yet run them on a real account, so the walkthrough below states no measured BigQuery numbers. If a step does not match what you see, report it (the link is on the **Start here** page).

The sandbox limits, from Google's sandbox page:

| Limit | Value |
|---|---|
| Storage | 10 GiB **for the lifetime of the sandbox**; deleting data does not give it back |
| Queries | 1 TiB of processed data per month |
| Expiry | every table, view and partition is deleted automatically after 60 days |
| Not available | streaming inserts, DML (`INSERT`, `UPDATE`, `DELETE`, `MERGE`), Data Transfer Service |

So in the sandbox you load files with **load jobs** rather than `INSERT` or `MERGE`, and you keep test data small, because the storage allowance never comes back. The `MERGE` and CDC patterns above need a billing-enabled project.

**1. Activate the BigQuery Sandbox & install `gcloud` / `bq` CLI.**
Open `https://console.cloud.google.com/bigquery`, sign in with any Google account, create a project (e.g. `kopiku-de-sandbox`), and install the CLI on Linux / WSL2:

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates gnupg curl
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
sudo apt-get update && sudo apt-get install -y google-cloud-cli
gcloud init
```

**2. Prove Columnar Pruning with `--dry_run` ($0 cost, 0 bytes billed).**
A `--dry_run` asks BigQuery's planner to read the Capacitor column headers and report the exact bytes that *would* be billed, without running the query:

```bash
# Dry-run selecting ONLY 1 column (name) vs. ALL 5 columns (SELECT *):
bq query --use_legacy_sql=false --dry_run \
  'SELECT name FROM `bigquery-public-data.usa_names.usa_1910_current`'

bq query --use_legacy_sql=false --dry_run \
  'SELECT * FROM `bigquery-public-data.usa_names.usa_1910_current`'
```

- **Why they differ:** `usa_1910_current` has 5 columns (`state`, `gender`, `year`, `name`, `number`). BigQuery stores each column separately and bills only the columns a query reads (lesson 2), so the one-column query reports far fewer bytes than `SELECT *`. Predict the ratio, then write both numbers down: the course will add measured values here once they have been run on a real account.

**3. Enforce Hard Scan Guardrails & Audit `INFORMATION_SCHEMA.JOBS_BY_USER`.**

```bash
# Refuse to run if the query would scan more than 200 MB (200,000,000 bytes):
bq query --use_legacy_sql=false --maximum_bytes_billed=200000000 \
  'SELECT name, SUM(number) AS total_births
   FROM `bigquery-public-data.usa_names.usa_1910_current`
   WHERE state = "CA"
   GROUP BY name ORDER BY total_births DESC LIMIT 5'

# Audit your actual billed bytes, slot milliseconds, and cache hits:
bq query --use_legacy_sql=false \
  'SELECT creation_time, total_bytes_processed, total_bytes_billed, total_slot_ms, cache_hit
   FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_USER
   ORDER BY creation_time DESC LIMIT 5'
```

**4. Snowflake Equivalent: Hard Credit Circuit-Breaker (`RESOURCE MONITOR`).**
On time-billed Snowflake, lock down `AUTO_SUSPEND = 60`, `STATEMENT_TIMEOUT_IN_SECONDS = 1800`, and a hard monthly credit cut-off:

```sql
CREATE OR REPLACE RESOURCE MONITOR kopiku_monthly_guardrail
  WITH CREDIT_QUOTA = 50 FREQUENCY = MONTHLY START_TIMESTAMP = IMMEDIATELY
  TRIGGERS ON 80 PERCENT DO NOTIFY ON 100 PERCENT DO SUSPEND_IMMEDIATE;

CREATE OR REPLACE WAREHOUSE kopiku_etl_wh
  WAREHOUSE_SIZE = 'XSMALL' AUTO_SUSPEND = 60 AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE STATEMENT_TIMEOUT_IN_SECONDS = 1800
  RESOURCE_MONITOR = kopiku_monthly_guardrail;
```

> 🛠 **Try it (15 min, terminal, optional if you installed `bq`).** Run the two `--dry_run` commands above on `usa_1910_current`, then run the `WHERE state = "CA"` query twice in a row and inspect `INFORMATION_SCHEMA.JOBS_BY_USER`.
>
> **You should see:** each dry run prints the bytes it would process, and `SELECT *` is several times the one-column query. The first real run of the `CA` query shows `cache_hit = false`; the identical second run is answered from the result cache, with `cache_hit = true` and `total_bytes_billed = 0` (lesson 4's `ResultCache`, on a real warehouse). Write down your byte counts and timings; no measured values are given here yet.

## @lesson Python-to-warehouse connectors, RBAC role hierarchies, BI rollup marts, and external vs. native tables {optional}

Combining the best production practices from *Data Engineering 101*, *DataTalksClub Data Engineering Zoomcamp*, and *Google Business Intelligence*, four practical workflows complete your cloud data warehouse toolkit:

**1. Programmatic Python-to-Warehouse Bulk Connectors (`Snowflake` & `BigQuery`).** When a Python pipeline loads a cleaned DataFrame into a cloud warehouse, never loop over rows with `cursor.execute("INSERT INTO ...")`. Use the native columnar bulk loader SDKs, which stage compressed Parquet/Arrow buffers directly into cloud storage and trigger a parallel warehouse load job:

```python
# --- A. SNOWFLAKE: Bulk Arrow/Parquet Load via write_pandas + Parameterized Query ---
import snowflake.connector
from snowflake.connector.pandas_tools import write_pandas

conn = snowflake.connector.connect(
    user="SVC_ELT_LOADER",
    account="kopiku-ap-southeast-1",
    private_key_file="/secrets/rsa_key.p8",   # Key-pair auth (never hardcode passwords!)
    warehouse="WH_LOADING_XS",
    database="PROD_DW",
    schema="RAW"
)
# Stages compressed Parquet chunks in parallel & runs COPY INTO under the hood:
success, nchunks, nrows, _ = write_pandas(conn, cleaned_df, "STG_ORDERS", auto_create_table=False)

# Always use parameterized placeholders (%s), NEVER f-strings, to prevent SQL injection:
with conn.cursor() as cur:
    cur.execute("SELECT COUNT(*) FROM STG_ORDERS WHERE order_date = %s", ("2026-02-02",))

# --- B. GOOGLE BIGQUERY: Zero-Copy Arrow/Parquet Load Job ---
from google.cloud import bigquery

bq = bigquery.Client(project="kopiku-prod")
job_config = bigquery.LoadJobConfig(
    write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    time_partitioning=bigquery.TimePartitioning(field="order_date"),
    clustering_fields=["store_id", "status"],
)
# Uploads DataFrame as compressed Parquet to Colossus in a single batch job:
load_job = bq.load_table_from_dataframe(
    cleaned_df, "kopiku-prod.raw_kopiku.stg_orders$20260202", job_config=job_config
)
load_job.result()  # Waits for atomic partition replacement
```

**2. Cloud Warehouse Role-Based Access Control (RBAC) Hierarchy.** In Snowflake, BigQuery, and Databricks Unity Catalog, never grant table permissions directly to individual human users, and never run pipelines as `ACCOUNTADMIN` / `Project Owner`. Separate **Access Roles** (what objects can be read/written) from **Functional Roles** (job titles):

```sql
-- Snowflake / Warehouse RBAC Least-Privilege Pattern:
CREATE ROLE IF NOT EXISTS ROLE_ELT_WRITER;
CREATE ROLE IF NOT EXISTS ROLE_BI_READER;

GRANT USAGE ON WAREHOUSE WH_BI_XS TO ROLE ROLE_BI_READER;
GRANT USAGE ON DATABASE PROD_DW TO ROLE ROLE_BI_READER;
GRANT USAGE ON SCHEMA PROD_DW.MARTS TO ROLE ROLE_BI_READER;

-- Grant read access to all current AND future mart tables automatically:
GRANT SELECT ON ALL TABLES IN SCHEMA PROD_DW.MARTS TO ROLE ROLE_BI_READER;
GRANT SELECT ON FUTURE TABLES IN SCHEMA PROD_DW.MARTS TO ROLE ROLE_BI_READER;

-- Assign functional role to the Looker/Tableau service account:
GRANT ROLE ROLE_BI_READER TO USER SVC_LOOKER_BI;
```

**3. External Tables vs. Native Managed Warehouse Tables.** Both BigQuery and Snowflake can query Parquet/Iceberg files sitting in your GCS/S3 bucket directly via an **External Table** (`CREATE EXTERNAL TABLE ... OPTIONS(format='PARQUET', uris=['gs://kopiku-lake/orders/*.parquet'])`), or ingest them into a **Native Table**:
- **External Tables:** Zero warehouse storage duplication cost; great for cold archival logs or one-off exploration. However, query planning is slower and fine-grained clustering/BI Engine acceleration is more limited (unless using **BigLake / Iceberg tables** with pinned metadata).
- **Native Managed Tables + Pre-Aggregated BI Rollup Marts:** For hot executive dashboards in Tableau or Looker, load atomic facts into partitioned/clustered native tables and materialize **Rollup Target Tables** (`mart_daily_store_rollup` at `(order_date, store_id, product_category)` grain). Pointing Tableau at a 50,000-row daily rollup instead of a 2-billion-row fact table means every filter reads 40,000 times fewer rows (2,000,000,000 / 50,000), and on a warehouse that bills by bytes scanned, the bill shrinks with it.

> 🛠 **Try it (15 min, Python with DuckDB).** Generate `data/orders.csv` first if it is not present yet (`python3 labs/shared/shopgen.py --out data`). Load the rows of `data/orders.csv` whose `total_idr` is all digits and whose `order_ts` survives `TRY_CAST`, and make a bigger fact table by repeating them 300 times (`CROSS JOIN range(300)`), with `order_date`, `payment_method`, `status` (lowercased and trimmed: the file spells it several ways) and `total_idr`. Build a rollup at the grain `(order_date, payment_method, status)` with `count(*)` and `sum(total_idr)`. Answer the dashboard question "revenue per payment method, not cancelled, 10 to 16 January" from both tables, check that the answers are identical, and time each query five times.
>
> **You should see:** `1061700` fact rows and `557` rollup rows, the same four totals from both (`bank_transfer` first with `20436000000`), and a median of about `13` ms on the fact table against `3` ms on the rollup. On a warehouse that bills by bytes scanned the gap is in money as well as time. The rollup only works because every filter the dashboard offers is a column of its grain: ask it for revenue per customer and it cannot answer. Measured with DuckDB 2.0.1 on the course's default data.

## @part The Microsoft data stack

## @lesson Azure and Microsoft Fabric: ADLS, Data Factory, Synapse and OneLake {optional}
Azure appears in **41.7%** of 1,134 data engineering postings in TalentHub (2026-07-23 to 2026-11-21), more than AWS (41.4%) or Google Cloud (28.0%) in the same count. **Azure Data Factory** appears in 17.1%, **Microsoft Fabric** in 10.7% and **Azure Synapse** in 10.1%. None of it is new to you: every Microsoft service below does a job you have already done with open tools in this course. Learn the mapping and the names, and a job post full of Microsoft words becomes readable.

| What you built in this course | On Azure | In Microsoft Fabric |
|---|---|---|
| Object storage (S3 in Module 2.1) | **ADLS Gen2**: Blob Storage with a hierarchical namespace, so folders are real and renames are cheap | **OneLake**, built on ADLS: one lake for the whole organisation |
| Ingestion and orchestration (Modules 1.6, 2.4) | **Azure Data Factory** pipelines | **Data Factory** in Fabric (pipelines and Dataflow Gen2) |
| Warehouse SQL (Module 2.6, T-SQL in 1.3) | **Synapse** dedicated SQL pool, **Azure SQL Database** | **Fabric Warehouse** (T-SQL) |
| Spark (Module 3.1) | **Azure Databricks**, Synapse Spark pools | Fabric **Data Engineering** (notebooks, Spark) |
| Lakehouse tables (Module 2.2) | Delta tables on ADLS | **Lakehouse** items: Delta Parquet or Iceberg tables in OneLake |
| Streaming (Modules 3.2, 3.3) | **Event Hubs** (it also accepts Kafka clients) | **Real-Time Intelligence** |
| BI (Module 1.4) | **Power BI** | Power BI, reading OneLake directly |

**Azure Data Factory (ADF) in six words.** Microsoft's documentation defines the pieces, and each maps to something you know:
- A **pipeline** is "a logical grouping of activities that together perform a task": the DAG of Module 2.4.
- An **activity** is one step: *Copy* (move data between stores), *Lookup* (read a value), *Stored Procedure*, *Notebook*, *ForEach*, *If Condition*.
- A **linked service** is "much like" a connection string: where a store is and how to log in.
- A **dataset** is "a named view of data" inside a linked service: one table, one folder, one file pattern.
- A **trigger** starts pipelines: on a wall-clock schedule, on demand, and other types such as tumbling windows and storage events.
- An **integration runtime** is the compute that does the work. The Azure one reaches public endpoints; a **self-hosted integration runtime** is a small program you install inside the company network, so ADF can reach an on-premises SQL Server or a private network without opening it to the internet. Companies that keep data on their own servers, banks among them, connect ADF this way.

Activities pass values with expressions such as `@{activity('LookupOldWaterMarkActivity').output.firstRow.WatermarkValue}`, and every pipeline is stored as JSON, which ADF can keep in Git. Treat that JSON like code: review it, version it, deploy it through CI (Module 3.4), never only click it together in the portal.

**Synapse and Fabric.** Synapse (2019) put a warehouse, Spark and pipelines in one Azure workspace. **Fabric** (2023) goes further: it is software as a service with one lake for every workload. Microsoft says the Fabric engines (T-SQL, Spark, Analysis Services and others) all store tables in OneLake in the open **Delta Parquet** format, so a table written by the warehouse can be read by a Spark notebook without copying. Two Fabric ideas come straight from *Fundamentals of Data Engineering*:
- A **shortcut** is "an object in OneLake that points to other storage locations" (ADLS, S3, Google Cloud Storage and more); it "behaves like a symbolic link". Reading through a shortcut is **data virtualization**: the data stays where it is and is queried in place.
- **Mirroring** "continuously replicates data from an operational database into OneLake as analytics-ready Delta tables": change data capture (Module 3.2) as a managed feature.

Microsoft publishes a migration plan and a *Fabric Migration Assistant* for moving Synapse dedicated SQL pools to Fabric Warehouse, which tells you which way the platform is heading: expect existing Synapse systems in brownfield jobs and Fabric in new projects.

**Practising without a company account.** The Azure and Fabric parts of this lesson were not run for this course, because they need an account. Your options: a **Fabric trial** gives free access for 60 days (as an F4 or F64 capacity); **Azure for Students** gives US$100 of credit with no credit card, using an academic e-mail address; a normal Azure account gives some services free for the first 12 months. Everything else runs locally: T-SQL in Docker (Module 1.3), Delta tables with `deltalake` (Module 2.2), Power BI Desktop on Windows (Module 1.4), and the Data Factory pattern below.

**Inheriting a GUI ETL tool.** Besides Data Factory, postings name **SSIS** (SQL Server Integration Services, 6.1%), **Talend** (4.7%), **Informatica** (4.1%) and **Pentaho** (2.0%); counting Data Factory and managed connectors such as Fivetran, **30.2%** name at least one tool of this kind. You will more often maintain or migrate these than start with them, and they share one shape:
- **Connections** (SSIS *connection managers*, ADF *linked services*): where each source and target lives. List them first; they are your lineage.
- **Control flow**: the order of steps and what happens on failure (in SSIS, tasks joined by *precedence constraints*). This is the DAG.
- **Data flow**: source, transformations (lookups, derived columns, conditional splits), destination. Most of the business logic hides here, or in the SQL of an *Execute SQL* task that calls a stored procedure.
- **Parameters and variables**: dates, paths and environment names, the things that change between runs.
- **Schedule**: SSIS packages are usually deployed to the SSIS catalog (`SSISDB`) and started by **SQL Server Agent** jobs; check the Agent history before you change anything.

An SSIS package is a `.dtsx` file, which is XML: you can search it with `grep` for table names and SQL, and diff two versions in Git. To migrate one, do what the strangler fig pattern of Lesson 7 says: rebuild one output at a time, run old and new side by side, compare row counts and totals, and switch only when they agree. Managed connectors (Fivetran, Airbyte, Data Factory's copy activity) only do the *extract and load* part: the transformation moves to SQL or dbt.

> 🛠 **Try it (25 min, SQL Server in Docker from Module 1.3).** Microsoft's tutorial *Incrementally copy a table using Azure portal* builds the most common ADF pattern: two **Lookup** activities read the old watermark (from a `watermarktable`) and the new one (`MAX(LastModifytime)` of the source), a **Copy** activity copies the rows with `LastModifytime > old AND <= new`, and a **Stored Procedure** activity, `usp_write_watermark`, saves the new watermark. Create the tutorial's `data_source_table` (5 people, modified 2017-09-01 to 2017-09-05), its `watermarktable` (starting at 2010-01-01) and `usp_write_watermark` in your `kopiku` database. Then write `usp_run_pipeline @run_no` that does the four activities in order, copying into a `sink_copy` table that records `run_no`. Run it; add the tutorial's rows 6 (2017-09-06 02:23) and 7 (2017-09-07 09:01) and run again; run once more with no change. Last, insert row 8 with `LastModifytime` 2017-09-06 23:00, as if it had been held up somewhere, and run a fourth time. Compare the rows in the source with the rows copied.
>
> **You should see:** run 1 moves the watermark from `2010-01-01` to `2017-09-05 08:06` and copies `5` rows, run 2 copies `2`, run 3 copies `0`. Run 4 also copies `0`: row 8 is stamped before the saved watermark (`2017-09-07 09:01`), so the source ends with `8` rows and the copy with `7`, and no error tells you. A watermark trusts the source's clock. This is the "ties and late updates" problem of Module 1.6, and the cure is the same: re-read a small overlap before the watermark and make the load idempotent, or select by the time rows were loaded rather than a business timestamp, as the dbt model of Module 2.3 does. Measured on SQL Server 2025 (17.0) in Docker.

## @lab Lab: how a warehouse saves work
Model the mechanisms of this module in plain Python: micro-partitions with zone maps, pruning and scanning, a clustering-quality measure, query cost, distribution styles and join data movement, bulk-load planning, a result cache, and a queue of concurrent queries. The tests (42) check each rule, and let you reproduce the key measurement: the same query scanning 100 of 100 partitions on random data and about 3 of 100 on clustered data.

### @steps
> 💡 **Completed Practice Pauses 1–5?** Your implementations in `labs/mod-2-6/warehouse_lab.py` are already in place, jump straight to **Step 7 / Practice Pause 6** below to run the full test suite and generate your proof token.

1. Install pytest if needed (`pip install -r labs/mod-2-6/requirements.txt`), then read `labs/mod-2-6/warehouse_lab.py` from top to bottom. `value_bytes` is provided; everything else has a docstring that is the specification and names the lesson.
2. Work in file order and run the tests after EACH function:

```bash
pytest labs/mod-2-6/test_lab.py -v
pytest labs/mod-2-6/test_lab.py -v -k "(Prune or Scan) and not test_query_cost"   # one group at a time
```

3. **Partitions first.** Write `build_micro_partitions` and print the `min` and `max` of the `order_date` column for the first three partitions of a random layout and of a clustered one. Say out loud why one of them can be skipped and the other cannot.
4. **Scan and cost.** After `scan` passes, run it on both layouts with a one-week filter and with one column and five columns. Write the four numbers (partitions scanned, bytes billed) in a table, and compute the dollar cost with `query_cost`.
5. **Distribution.** Predict `join_rows_moved` for five combinations of distribution before you implement it, then compare with the tests.
6. **Loading, caching and queueing.** Plan the files for a 10 GiB load on 16 slices, then change the number of slices to 12 and 20 and predict the file count.
7. **Verify and prove.** Run the full test suite (`pytest labs/mod-2-6/test_lab.py -v`) in your own virtual environment to confirm all 42 tests pass, then run `python3 scripts/prove.py mod-2-6` to generate the proof code for the **Proof** box on this lab page.

> 💡 **Practice Pause 6 (Full Verification & Proof Token):**
> 1. In terminal, run the complete test suite:
>    `pytest labs/mod-2-6/test_lab.py -v`
> 2. Generate the verification proof token:
>    `python3 scripts/prove.py mod-2-6`
> 3. **Success Indicator:** All 42 tests report `PASSED` (100% pass rate in < 1 second) and proof token is printed.

### @files
- labs/mod-2-6/warehouse_lab.py :: Your working file: implement the TODO functions and the ResultCache :: starter
- labs/mod-2-6/test_lab.py :: The 42 tests that check your work :: test
- labs/mod-2-6/requirements.txt :: pytest :: config
- labs/mod-2-6/reference/warehouse_lab.py :: One possible solution (try first!) :: reference

### @deliverables
- All 42 tests pass **on your own computer, run from your own terminal**
- You can explain, with your own measured numbers, why clustering changes the partitions scanned and the bytes billed
- You can explain what a co-located join is and which of the five distribution combinations needs the most data movement
- You can explain how to size load files and why the number of files should match the slices

### @verify
```bash
pytest labs/mod-2-6/test_lab.py -v
python3 scripts/prove.py mod-2-6
```

Known-good run: prefix the first command with `LAB_DIR=reference`.

## @chaos The dashboard that scanned the whole table every fifteen minutes
### @scenario
A company's executive dashboard has twelve tiles, each backed by a query on a 20 TB events table in a scan-priced warehouse. The table was loaded in the order events arrived and has no partitioning. Each tile filters on "the last 7 days" and shows two columns, but the queries are written `SELECT * FROM events WHERE event_date >= ...` by an analyst who copied a template, and the dashboard refreshes every 15 minutes.

Nothing is slow, because the warehouse is large, so nobody notices for a month. Then finance asks why the warehouse bill tripled. The most expensive items in the query history are the dashboard's own twelve queries, each billed for scanning most of the table every refresh.

### @cause
Three layout and query mistakes multiplied. The table was not **partitioned or clustered by `event_date`**, so the date filter could not prune partitions (the lab's random layout scanned 100 of 100 partitions; the clustered one 3 of 100). `SELECT *` read **all columns** instead of the two needed (the lab's five columns billed 6.6 times the bytes of one). And the **refresh rate** repeated the waste 96 times a day. With the lab's example price, a tile scanning 2 TB per refresh costs 96 × 2 × $5 = $960 a day; at 3% of that it costs $28.80.

Nobody saw it earlier because the dashboards worked and were fast; cost was visible only on the monthly invoice, with no per-query budget or alert (Module 3.4).

### @fix
1. **Partition the table by `event_date` and cluster it by the most common filter columns**, then verify with the query plan that partitions scanned fall to a few percent.
2. Replace `SELECT *` with the needed columns, and set a policy: lint queries in review, and **require a partition filter** on large tables so an unfiltered query fails instead of billing (BigQuery's `require_partition_filter`).
3. Put a **summary table** (for example daily counts per event type, built by dbt) behind the dashboard, so tiles read thousands of rows instead of terabytes, and lower the refresh rate where the data does not change.
4. Rely on **result caching** and on the BI tool's own cache for identical queries.
5. Add a **budget and a per-query byte limit**, group queries by dashboard with labels or tags, and review the top ten most expensive queries every week.

### @pattern
In a warehouse, cost is the amount of data a query touches. Layout, column choice and refresh rate decide it, not the SQL's cleverness.

## @quiz
### Why can a warehouse skip most of the partitions for `WHERE order_date BETWEEN '2026-03-01' AND '2026-03-07'`?
- [ ] It keeps an index of every order id and uses it to find the seven days of data directly
- [ ] It deletes the other dates from the table while the query runs, so only a week remains
- [x] Each partition stores its min and max date, so partitions that cannot match are never opened
- [ ] It compresses each day into its own file, and files of other days are ignored by the file system

> Zone maps (min and max per partition and column) let the engine prove that a partition holds no match. This only works well if the data is clustered by the filter column.

### The same query scanned 100 of 100 partitions on one layout and 3 of 100 on another. What most likely differs?
- [ ] The first layout uses a faster file format that needs to read more partitions to be quicker
- [x] The second layout is clustered by the filter column, so similar values share partitions
- [ ] The second layout has fewer rows, since pruning only applies when a table is very small in size
- [ ] The first layout is compressed, and compressed partitions must always be read in full

> Random order gives every partition a wide min-max range, so all of them overlap the filter. Sorting by the filter column makes ranges narrow and mostly non-overlapping.

### Why does `SELECT *` often cost much more than selecting two columns in a columnar warehouse?
- [ ] The warehouse converts every column to text before it returns the rows to the client application
- [x] A columnar store reads only the columns you name, so `SELECT *` pays for the bytes of every column
- [ ] `SELECT *` cannot use the result cache, which makes every query recompute its data from the source
- [ ] Wide result sets are always sent to the client through a slower network connection than narrow ones

> In the lab, one column billed 24,000 bytes against 158,041 for five columns on the same clustered table.

### Two large tables are joined on `customer_id`. Which setup moves the fewest rows across the network?
- [ ] Both tables spread evenly in round-robin order, so every node gets the same number of rows
- [ ] Both tables distributed by `order_id`, since it is a unique key that is present in both of them
- [x] Both tables distributed by `customer_id`, so the matching rows already sit on the same node
- [ ] Both tables replicated to every node, because copies are always cheaper than any other layout

> Co-located joins move nothing. Replicating a small dimension helps too, but a copy of a large table everywhere costs storage and load time.

### What does it mean that a cloud warehouse separates storage from compute?
- [ ] Data is stored in a different data centre for every user, and each user pays for storage separately
- [ ] The warehouse can store data but cannot run queries, so another product must be installed to query it
- [x] Data sits in cheap shared storage, while compute clusters are started, sized and stopped separately
- [ ] Compute always runs on the same machines as the data, which is why queries need no network at all

> Independent compute clusters can query the same data without slowing each other, and you pay for compute only while it runs.

### Why plan bulk-load files of roughly 100 to 250 MB, and a number of files that matches the slices?
- [ ] Larger files are rejected by every warehouse, and smaller files cannot be compressed in any way
- [x] It balances per-file overhead against parallelism, and gives each loader the same amount of work
- [ ] The file size sets the clustering key, and the number of files sets the price per terabyte stored
- [ ] Warehouses can read only one file at a time, so many files are needed to make the load progress

> Tiny files add overhead (the small-files problem); one huge file cannot be loaded in parallel; a count that is a multiple of the slices keeps all of them busy.

### A result cache returns the saved answer for a repeated query. When must it NOT be used?
- [ ] When the query text uses upper case letters instead of lower case letters in its keywords
- [ ] When two analysts run the query one after the other in the same warehouse within a few minutes
- [x] When any table the query reads has changed in the meantime since the answer was saved earlier
- [ ] When the query returns more than ten rows to the client application that asked for it

> The cache key is the normalised SQL plus the version of every table it reads. A changed table changes the key, so the old answer is not reused.

### Five 10-second queries arrive together on two slots. When does the last one finish, and what is the standard cure for long waits?
- [ ] At 10 seconds; no cure is needed, because every warehouse runs all queries at the same time
- [ ] At 50 seconds; the cure is to buy a larger single query that runs all five jobs in a single batch
- [x] At 30 seconds; isolate workloads on separate compute, scale out for bursts, shorten heavy queries
- [ ] At 20 seconds; the cure is to delete old results, because queueing is caused by storage that is full

> Two slots run two jobs at a time: 10, 10, 20, 20, 30 seconds. Isolation, auto-scaling and better layout reduce waiting.

### Why does every record that reverse ETL sends to the CRM carry a deterministic idempotency key?
- [ ] So that the CRM can sort incoming records in the order the warehouse computed them
- [ ] To encrypt the customer data while it travels between the warehouse and the CRM
- [x] So that a retry updates the same record instead of triggering the same action again
- [ ] Because CRMs reject any request that does not carry a unique random id in its header

> The tools act on what you send (emails, offers). A key built from the record's content makes a retry harmless: same content, same key, one effect.

### What does the strangler fig pattern ask you to do with an old pipeline you inherit?
- [x] Rebuild one metric at a time, run old and new side by side, explain the gaps, then switch
- [ ] Freeze the old pipeline and rewrite everything in one go over a long weekend with a test plan
- [ ] Keep the old pipeline forever and build the new features in a separate system next to it
- [ ] Delete the old code first, so nobody depends on it any more, then rebuild from the requirements

> Each difference between old and new is either a bug in the new code or an old bug you just found. Consumers move only when the numbers are explained.

### Azure Data Factory must copy tables from a SQL Server inside a bank's private network. What does it need?
- [ ] A public IP address on the SQL Server so the Azure integration runtime can connect
- [x] A self-hosted integration runtime installed inside that network, next to the server
- [ ] A Fabric shortcut pointing at the SQL Server's data files on the server's local disk
- [ ] A tumbling window trigger, because schedule triggers cannot reach private servers

> The Azure integration runtime reaches public endpoints. A self-hosted integration runtime runs inside the private network and connects out to Data Factory, so the database never has to be exposed.

## @resources
- [Snowflake documentation: micro-partitions and data clustering](https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions)
- [BigQuery documentation: partitioned and clustered tables](https://cloud.google.com/bigquery/docs/partitioned-tables)
- [Amazon Redshift documentation: distribution styles](https://docs.aws.amazon.com/redshift/latest/dg/c_choosing_dist_sort.html)
- [Snowflake documentation: preparing data files for loading](https://docs.snowflake.com/en/user-guide/data-load-considerations-prepare)
- [Amazon Redshift: best practices for loading data](https://docs.aws.amazon.com/redshift/latest/dg/c_loading-data-best-practices.html)
- [BigQuery: estimating and controlling costs](https://cloud.google.com/bigquery/docs/best-practices-costs)
