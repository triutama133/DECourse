---
title: Columnar Storage, Parquet, DuckDB and Polars
duration: 2 weeks
summary: Understand why analytics engines store data by column, how a Parquet file is organised and skipped over, and use DuckDB and Polars to analyse tens of millions of rows on one machine, with measured memory and speed.
why: Tutorials tell you to spin up a cluster for a 15 GB file. A single modern machine with the right file format and engine handles that in seconds, and knowing why saves months of complexity and a large cloud bill.
---

## @outcomes
- Explain how row and column layouts differ, and why column layout makes analytical scans smaller and faster
- Describe the structure of a Parquet file (row groups, column chunks, pages, footer statistics) and how engines skip data using it
- Convert CSV to Parquet with sensible compression and row group size, and explain how sort order changes both file size and skipping
- Query files directly with DuckDB (SQL) and Polars (lazy dataframes), and read their plans to confirm filters and column pruning
- Choose between pandas, Polars, DuckDB and a distributed engine for a given data size, using measurements

## @prereq
Modules 1.2 (streaming and memory) and 1.3 (SQL, plans). `pip install -r labs/mod-2-1/requirements.txt` installs DuckDB, Polars and PyArrow.

## @lesson Rows versus columns
A table is a grid. To store it in a file or in memory you must flatten it into a sequence, and there are two ways.

**Row-oriented** storage writes one whole row after another: `(order 1: id, customer, status, amount) (order 2: ...)`. This is what PostgreSQL and CSV do. It is ideal when you work with **whole records**: fetch order 4821, update its status, insert a new order. All the bytes of one record sit together.

**Column-oriented** storage writes all the values of one column together: `(all ids) (all customers) (all statuses) (all amounts)`. Analytical questions rarely need whole records. "Total amount by status" touches **two columns** out of perhaps fifty. With a column layout the engine reads just those two columns and never touches the other 48; with a row layout it must read every byte of every row to get to them.

Three benefits stack up:

1. **Less I/O.** Reading 2 of 50 columns is roughly 4% of the data. In the lab you will see the engine report `PROJECT 3/7 COLUMNS`: only three of seven columns are read.
2. **Better compression.** Values of one column are the same type and often similar (`'mobile'`, `'mobile'`, `'desktop'`, ...), which compresses far better than a row mixing text, numbers and dates. Techniques such as **dictionary encoding** (store each distinct string once, then small integer codes), **run-length encoding** (store `'mobile' x 1000`), **delta encoding** (store differences between sorted timestamps) and **bit-packing** (use only as many bits as the values need) shrink columns dramatically.
3. **Faster computation.** Summing a column is a tight loop over a contiguous array of numbers, which modern CPUs execute very efficiently.

The trade-off is the mirror image: updating or fetching **one whole record** touches every column's data, so columnar files suit analytics and bulk loads, not frequent single-row writes. That is why you keep an OLTP database for the application (Module 0.1) and a columnar format for analysis.

Real numbers from a 5,000,000-row event table with seven columns (ids, timestamps, a few categories and an amount), written by the lab's tools:

| Format | Size on disk |
|---|---|
| CSV | 273 MB |
| Parquet, snappy compression, sorted by time | 65 MB |
| Parquet, zstd compression, sorted by time | **40 MB** |
| Parquet, zstd compression, rows in random order | 66 MB |

The last two rows show something important: the *same* data, in a different row order, is 65% larger, because sorted timestamps and repeated values sit next to each other and compress better. How you order data before writing it is a performance decision.

## @lesson Inside a Parquet file
**Apache Parquet** is the standard open columnar file format for analytics, read by DuckDB, Polars, Spark, pandas, Snowflake, BigQuery and almost every other tool. A Parquet file has a layered structure:

```text
file
 ├─ row group 0           (a horizontal slice: about 100,000 to 1,000,000 rows)
 │    ├─ column chunk: event_id   ─ pages (compressed, encoded)
 │    ├─ column chunk: event_ts   ─ pages
 │    └─ ...
 ├─ row group 1
 │    └─ ...
 └─ footer                (schema + for every column chunk: offset, size, encoding, min, max, null count)
```

- A **row group** is a horizontal slice of the table. Within it, each column is stored as a **column chunk**, and a chunk is divided into **pages** (the unit of compression and encoding).
- The **footer** at the end of the file is the key to speed. It holds the schema and, for every column chunk of every row group, **statistics**: the minimum and maximum value, and the number of nulls. A reader fetches the footer first (a few kilobytes), and then knows where every column lives and what range of values every chunk contains.
- Data is **typed** (integers, decimals, timestamps, strings, nested structures); CSV's "everything is text" problem disappears.
- Compression is chosen per file or column: **snappy** (fast, moderate savings), **zstd** (slower to write, much smaller, an excellent default today), **gzip** (older, slow).

**Two optimisations make Parquet fast**, both visible in query plans:

- **Projection pushdown (column pruning).** Read only the columns the query uses.
- **Predicate pushdown (filter pushdown).** Before reading any data, compare the filter with each row group's min/max statistics and **skip row groups that cannot contain a match**. If a row group's timestamps run from 09:00 to 09:15 and you want 14:00 to 15:00, it is skipped without being read.

The second one depends entirely on **sort order**. In the 5-million-row file (50 row groups of 100,000 rows) a one-hour window of timestamps needed only **5 of 50** row groups when the file was sorted by time, and **all 50** when rows were in random order: every row group's min/max range spans the whole day, so none can be skipped, and the engine reads everything. The statistics are the same; the layout decided whether they were useful. You can implement this decision yourself in the lab (`row_groups_to_read`): given only the footer, return which row groups might contain values in a range.

Practical consequences:

- **Sort or cluster by the column you filter on most** (usually time) when writing.
- **Row group and file size.** Row groups of roughly 100,000 to a few million rows balance skipping granularity against metadata overhead. Files of roughly 100 MB to 1 GB are a good target. Thousands of tiny files are slow (each needs an open, a footer read, and bookkeeping); this is the **small files problem**, fixed by compaction (Module 2.2).
- **Parquet files are immutable.** You cannot change one row in place; you rewrite the file. Table formats (Module 2.2) build safe updates on top of this.

## @lesson Arrow and vectorised execution
**Apache Arrow** is a columnar format for data **in memory**, the counterpart of Parquet on disk. Its value is a shared standard: DuckDB, Polars, pandas (with PyArrow), Spark and databases can hand each other Arrow data **without converting or copying** it. That is why `duckdb_result.pl()` (to Polars) and `.arrow()` are nearly instant, and why a stack made of several tools does not pay a heavy translation tax between them.

How does an engine compute on columns quickly? Older databases processed **one row at a time** ("tuple-at-a-time"), paying function-call and branching overhead per value. Modern analytical engines are **vectorised**: they process a **batch of values** (DuckDB uses vectors of 2,048 values) at once, in tight loops over arrays. Benefits: data stays in the CPU cache, the overhead is amortised over thousands of values, the compiler can use **SIMD** instructions (one CPU instruction operating on several numbers), and filters are evaluated before the other columns are even read (**late materialisation**). Combined with multiple threads (each handles different row groups), a laptop saturates its memory bandwidth on a scan.

The practical takeaway is not the mechanism but the habit: **express work as whole-column operations** (SQL, dataframe expressions) and let the engine run the loop. A Python `for` loop over rows pays interpreter overhead per value (Module 1.2); the same logic as a SQL aggregate or a Polars expression runs orders of magnitude faster.

## @lesson DuckDB: SQL on files, in your process
**DuckDB** is an analytical database that runs **inside your Python process**, like SQLite but built for scans and aggregations (columnar, vectorised, parallel). No server, nothing to install beyond the package, and it queries files directly:

```python
import duckdb

duckdb.sql("SELECT device, count(*) AS n FROM 'ev.parquet' GROUP BY device ORDER BY device").show()

# many files at once, with a glob; Hive-style folders (month=2026-01/) become columns
duckdb.sql("SELECT * FROM read_parquet('lake/*/*.parquet', hive_partitioning = true) LIMIT 5")

# CSV works the same way, with automatic type detection
duckdb.sql("SELECT * FROM read_csv('orders.csv')")
```

Move results between worlds without copying through text: `rel.df()` gives a pandas DataFrame, `rel.pl()` a Polars DataFrame, `rel.arrow()` an Arrow table. Write files with `COPY`, optionally split by a column into folders:

```python
con = duckdb.connect()
con.sql("""COPY (SELECT * FROM read_csv('events.csv'))
           TO 'lake' (FORMAT PARQUET, COMPRESSION zstd, PARTITION_BY (event_type))""")
```

That writes `lake/event_type=purchase/data_0.parquet`, and so on. (A gotcha: the target path of `COPY ... TO` is part of the SQL text; it cannot be a bound `?` parameter.) To keep data, `duckdb.connect("warehouse.duckdb")` uses a persistent database file; for temporary analysis, files alone are enough. DuckDB can also read from S3 and HTTP (the `httpfs` extension), reading only the footer and the needed column chunks via range requests, so a query over a multi-gigabyte remote file may transfer a small fraction of it.

**Read its plan.** `EXPLAIN` shows what the engine will do. For `SELECT device, sum(amount) FROM read_parquet('ev.parquet') WHERE event_type = 'purchase' GROUP BY device`, the scan node reads:

```text
READ_PARQUET
  Projections: device, amount
  Filters: event_type='purchase'
```

Both the **projection** (only two columns) and the **filter** are part of the scan itself: pushdown in action. If the filter appeared in a separate node *above* the scan, it would mean rows were read first and discarded later. `EXPLAIN ANALYZE` adds timings per node.

**Larger than memory.** DuckDB spills to disk when a query exceeds its budget: `SET memory_limit = '2GB'; SET temp_directory = '/tmp/duck'`. In a test, sorting all 5,000,000 rows under a 200 MB limit completed in 0.3 seconds with a peak of 194 MB, instead of being killed (Module 1.1). Other useful settings: `SET threads = 4` (limit CPU use in a shared container).

## @lesson Polars, and choosing between the tools
**Polars** is a dataframe library written in Rust, built on Arrow, with an **expression** API:

```python
import polars as pl

q = (
    pl.scan_parquet("ev.parquet")                  # lazy: nothing is read yet
      .filter(pl.col("event_type") == "purchase")
      .group_by("device")
      .agg(pl.len().alias("n"), pl.col("amount").sum().alias("total"))
)
print(q.explain())      # the optimised plan
df = q.collect()        # run it now
```

The key idea is **lazy evaluation**. `scan_parquet` and the chain of operations only build a *plan*; `.collect()` optimises and runs it. The optimiser applies the same pushdowns, and `explain()` shows them:

```text
Parquet SCAN [ev.parquet]
PROJECT 3/7 COLUMNS
SELECTION: col("event_type") == "purchase"
```

Three of seven columns, and the filter inside the scan. (`pl.read_parquet` is the *eager* version: it loads everything first and forfeits these optimisations; prefer `scan_*` for files.) Polars runs on all cores by default and has a streaming mode for larger-than-memory work.

**What about pandas?** pandas is everywhere and perfect for small data, exploration and the ecosystem (plotting, scikit-learn). Its costs appear at scale: it loads whole tables into memory, uses Python objects for strings (which is expensive), and mostly runs on one core. Measured on the same 5-million-row file, each in a fresh process (peak memory includes the roughly 100 to 150 MB that the Python and library imports themselves take):

| Task: sum of `amount` by `event_type` | Time | Peak memory |
|---|---|---|
| pandas: `read_csv`, then group by | 3.5 s | 662 MB |
| pandas: `read_parquet` (all columns), group by | 0.8 s | 1,081 MB |
| pandas: `read_parquet(columns=[2 columns])` | 0.6 s | 576 MB |
| DuckDB over the CSV | 0.5 s | 332 MB |
| DuckDB over the Parquet | **0.1 s** | **80 MB** |
| Polars lazy over the Parquet | 0.2 s | 160 MB |

Notice the second row: reading Parquet into pandas used *more* memory than reading the CSV, because pandas must materialise all seven columns as in-memory objects. Reading only the columns you need (`columns=[...]`) cut that in half. The engines that push work into the scan never build the full table at all. (Exact numbers depend on your machine and library versions; measure your own, as the lab does. The ratios are the lesson.)

A practical guide:

| Situation | Reach for |
|---|---|
| A few hundred thousand rows, exploring, plotting | pandas |
| SQL-minded analysis on files; joins and aggregations; "SELECT on a Parquet folder" | **DuckDB** |
| Python data pipelines with chains of transformations; reusable code | **Polars** |
| Data too large for one machine's disk and time budget; many concurrent writers | A distributed engine (Spark, Module 3.1) or a cloud warehouse |

DuckDB and Polars interoperate through Arrow, so you can mix them: SQL for the heavy aggregation, Polars for the Python-side shaping. The honest rule of thumb is that **a single machine takes you much further than most teams expect**, into the hundreds of gigabytes with good file layout, so move to a cluster when measurement shows you must, not by default.

## @lesson Layout, types and the traps to avoid
**Partitioning.** Splitting data into folders by a column's value (`month=2026-01/`) lets an engine skip entire folders when you filter on that column (partition pruning). Rules: partition on a **low-cardinality column that queries filter on** (date, region), not on ids; avoid partitions that produce tiny files (100 customers x 365 days = tens of thousands of small files); and prefer **sorting within files** for high-cardinality filters, since row group statistics handle those. Over-partitioning is the most common mistake.

**Types matter.** A few that bite:

- **Money.** Do not store currency as floating point (`0.1 + 0.2 != 0.3`). Use integers in the smallest unit (rupiah or cents, as KopiKu does) or a fixed-precision `DECIMAL`. The lab's revenue must come back as an integer for this reason.
- **Timestamps and time zones.** Decide whether a column is local time or UTC and store it consistently; a `TIMESTAMP` without a zone is ambiguous. Prefer UTC at storage.
- **Identifiers as numbers.** CSV type inference reads a phone number or postcode `00123` as the integer 123. Declare such columns as text explicitly. Inference samples the start of the file, so a column that is numeric for the first 10,000 rows and text later breaks it; set the types or sample more rows.
- **Schema drift.** A column that is `int` in January's files and `string` in March's makes a multi-file read fail or coerce. Validate the schema at ingestion (Module 2.5).

**Other habits.** Avoid `SELECT *` on columnar data (it defeats column pruning); filter early and on the sorted column; write Parquet with explicit compression and row group size; prefer a few large files to many small ones; keep raw data and the converted copy separate (Module 0.1's raw layer); and measure with `EXPLAIN` and a stopwatch before believing any claim, including the ones in this lesson.

## @lab Lab: from CSV to Parquet, two engines, and pushdown by hand
Convert the KopiKu tables to Parquet, answer the same business question with DuckDB and with Polars (and prove both give the independently calculated answer), and implement predicate pushdown yourself from nothing but a Parquet footer. Then measure on a bigger dataset and compare engines.

### @steps
1. Install the requirements and look at the tests first; they explain every rule:

```bash
python -m pip install -r labs/mod-2-1/requirements.txt
pytest labs/mod-2-1 -v          # all fail at first
```

2. Open `labs/mod-2-1/analytics.py`. Implement `to_parquet` with DuckDB's `COPY (SELECT * FROM read_csv(...)) TO ... (FORMAT PARQUET, COMPRESSION zstd, ROW_GROUP_SIZE ...)`. The tests check row counts, zstd, inferred types, and that a small `row_group_size` produces several row groups.
3. Implement `revenue_by_month_roast_duckdb`: join order lines, orders and products (the three Parquet files) and return `(month, roast_level, revenue)` as plain tuples sorted by month and roast. Revenue must be an integer.
4. Implement the same in Polars, **lazily** (`scan_parquet` ... `collect()`). The same expected result proves two different engines agree with a third, independent calculation done in SQLite.
5. Implement `row_groups_to_read(path, column, lo, hi)` using only `pyarrow.parquet.ParquetFile(path).metadata` and each row group's `statistics`. A row group may be skipped only if its max is below `lo` or its min is above `hi`. Run the pushdown tests: on time-sorted data you should need 1 to 3 row groups; on shuffled data nearly all, which is the point.
6. Measure for yourself. Generate a larger file and compare, with your own numbers, the time and peak memory of pandas, DuckDB and Polars for one aggregation (use `/usr/bin/time -v python script.py` on Linux, or `resource.getrusage` inside a *fresh* process):

```python
import duckdb
duckdb.sql("""COPY (SELECT i AS event_id, 1767225600 + i // 100 AS event_ts, (hash(i) % 20000)::INT AS customer_id,
                    round((hash(i * 17) % 100000) / 100.0, 2) AS amount
             FROM range(5000000) t(i) ORDER BY event_ts)
             TO 'events.parquet' (FORMAT PARQUET, COMPRESSION zstd, ROW_GROUP_SIZE 100000)""")
```

7. Compare the same file with `ORDER BY hash(event_id)` (shuffled) and read the size and the number of row groups a one-hour filter touches.

### @files
- labs/mod-2-1/analytics.py :: Your working file: four functions to implement :: starter
- labs/mod-2-1/test_lab.py :: The tests (they build the data and check your work) :: test
- labs/mod-2-1/requirements.txt :: duckdb, polars, pyarrow, pytest :: config
- labs/mod-2-1/reference/analytics.py :: One possible solution (try first!) :: reference

### @deliverables
- All 10 tests pass
- You can show, with `EXPLAIN` (DuckDB) and `.explain()` (Polars), that both engines push the projection and the filter into the scan
- You have a short table of your own measurements (time and peak memory for three tools on one aggregation) and one sentence explaining the biggest difference

### @verify
```bash
pytest labs/mod-2-1 -v
```

Known-good run: `LAB_DIR=reference pytest labs/mod-2-1 -v`.

## @chaos The cluster that was never needed
### @scenario
A team's nightly job aggregates 40 GB of CSV event logs. It runs on a 16-node cluster, takes 55 minutes, and costs about Rp 8 million per month in compute. A new engineer notices that most of the 55 minutes is spent reading and parsing CSV and that the dashboards only use five of the 38 columns.

A colleague argues that "big data needs big infrastructure", and that Parquet would not help because "the cluster is fast anyway".

### @cause
Three avoidable costs compound. CSV is text: every run parses 40 GB of characters into types, wasting CPU. CSV is row-oriented, so all 38 columns are read even though 5 are used (about 13% of the data is useful). And without sorting or statistics there is no way to skip data, so a query for one day still scans everything. The cluster is not the solution to any of these; it is only making a wasteful plan finish sooner.

### @fix
1. Convert once, at ingestion: land the raw CSV, then write **zstd Parquet** (typed, a fraction of the size) sorted or partitioned by event date.
2. Read only the five columns used (projection pushdown) and filter by date so row groups or partitions can be skipped (predicate pushdown).
3. Benchmark the same aggregation on one machine with DuckDB or Polars. Typically a few gigabytes of compressed Parquet processes in seconds to minutes on a single node.
4. Keep the cluster only for jobs that measurement shows really exceed one machine, and track cost per job so waste is visible.

### @pattern
Fix the format and the layout before you scale the hardware. Columnar, typed, sorted files plus a pruning-aware engine turn many "big data" jobs into single-machine jobs.

## @quiz
### Why is a columnar file usually much smaller and faster than a CSV for a query that uses 2 of 50 columns?
- [ ] Columnar files store the numbers in a binary form, so the text rows are never parsed again by any engine
- [x] It reads only the needed column chunks and compresses each column well because its values are alike
- [ ] The engine keeps the whole file in memory permanently, which makes every later read instant
- [ ] Columnar files delete all rows that the query does not need while they are written to disk

> Column layout allows column pruning (reading 2 of 50 columns) and better compression since each column holds similar values. Updating whole records is the weak side.

### What are the min/max statistics in a Parquet footer used for?
- [ ] They tell the engine which compression method was used so that it can choose the right decoder
- [x] They let the engine skip row groups whose value range cannot contain the filter's matches
- [ ] They store the sorted order of the table so that no further ORDER BY is ever needed by queries
- [ ] They verify that the file was not corrupted when it was copied between storage systems

> Predicate pushdown compares the filter with each row group's min and max and skips groups that cannot match, without reading their data pages.

### The same 5 million rows were written twice, once sorted by timestamp and once in random order. What differs when you filter on a one-hour window?
- [ ] Nothing, because the footer statistics are calculated from the same set of values in both files
- [ ] The random file is faster, since random order spreads the matching rows evenly over many threads
- [x] The sorted file lets most row groups be skipped, while in the random file every group's range overlaps
- [ ] The sorted file cannot be filtered at all, because filters need a column with randomly distributed values

> Statistics only help when values are clustered. In the lab 5 of 50 row groups were needed for sorted data and all 50 for shuffled data.

### In a DuckDB plan, where should a `WHERE event_type = 'purchase'` filter appear for the best performance?
- [ ] In a separate FILTER node after the aggregation, so that fewer groups have to be calculated
- [ ] In a node after the join, because filters are always applied last, once all the rows are available
- [x] Inside the READ_PARQUET scan node, so rows are discarded while reading and not afterwards
- [ ] Filters are never visible in plans, since the optimiser always removes them to save time

> A filter shown in the scan node's `Filters:` list has been pushed down, so non-matching row groups or rows are dropped at the source. A filter above the scan means rows were read first.

### What is the main difference between `pl.read_parquet` and `pl.scan_parquet` in Polars?
- [ ] `scan_parquet` only works with local files, and `read_parquet` is needed for cloud storage
- [ ] `read_parquet` is lazy and builds a plan, while `scan_parquet` loads the whole file at once
- [x] `scan_parquet` is lazy, so the optimiser can push down filters and columns before reading anything
- [ ] There is no difference except the name, since Polars always optimises every query before it runs

> `scan_*` returns a LazyFrame whose plan is optimised on `.collect()`. `read_*` is eager: it loads everything first and cannot prune columns or rows.

### Why should money be stored as an integer in the smallest unit instead of a float?
- [ ] Integers use less disk space in Parquet than floating point numbers do in every case
- [ ] Floating point numbers cannot be summed together by engines such as DuckDB and Polars
- [x] Binary floating point cannot represent many decimal fractions exactly, so sums drift and mismatch
- [ ] Parquet does not support floating point columns, so they would be converted to text on writing

> `0.1 + 0.2 != 0.3` in binary floating point. Integers (rupiah or cents) or fixed-precision decimals keep totals exact and reconcilable.

### You partition a Parquet dataset by `customer_id` (100,000 distinct values) and by day. What is the likely result?
- [ ] Queries become faster because each customer's rows live in their own small folder
- [ ] The dataset becomes smaller because partition folders are compressed with a dedicated codec
- [x] Millions of tiny files, with slow listing, slow opens and little benefit from pruning
- [ ] Nothing changes, since engines merge small partitions into large ones during every query

> Partition on low-cardinality columns that queries filter on. High-cardinality partitioning creates the small files problem; sorting inside files serves high-cardinality filters.

### A teammate says "we need a cluster, our data is 20 GB". What is the best first response?
- [ ] Agree, since any dataset larger than the memory of a laptop requires a distributed system
- [ ] Reject the idea, because clusters are always slower than a single machine for any workload
- [x] Convert to sorted zstd Parquet and measure one aggregation in DuckDB or Polars before deciding
- [ ] Load the whole 20 GB into pandas first, because pandas is the standard tool for analysis

> Measurement should decide. With a columnar format and a pruning engine, 20 GB often processes on one machine in seconds, and larger-than-memory spilling is supported. Move to a cluster when the numbers say so.

## @resources
- [Apache Parquet documentation](https://parquet.apache.org/docs/)
- [DuckDB documentation](https://duckdb.org/docs/)
- [Polars user guide](https://docs.pola.rs/)
- [Apache Arrow documentation](https://arrow.apache.org/docs/)
