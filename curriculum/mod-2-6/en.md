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
Modules 1.4 (dimensional modeling), 2.1 (columnar storage and Parquet) and 3.4 (FinOps basics) help. The lab is plain Python and needs no cloud account.

## @lesson What a cloud data warehouse is
An operational database (Module 0.1) is built to read and write a few rows very quickly for many users. A **data warehouse** is built for the opposite job: **scan huge amounts of data and aggregate it** for a few analysts and dashboards. The same SQL, a different engine.

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

## @lesson How data is stored: micro-partitions, zone maps and pruning
A warehouse does not store a table as one big file. It cuts it into many **micro-partitions** (Snowflake's name; BigQuery and Redshift have equivalents), each holding a slice of the rows in columnar form, typically tens to hundreds of megabytes. For every partition and every column it records cheap **statistics**: the smallest and the largest value, a **zone map**. These live in metadata, so reading them costs almost nothing.

Now run `WHERE order_date BETWEEN '2026-03-01' AND '2026-03-07'`. For each partition the engine checks its statistics: if the partition's largest date is before March 1, or its smallest is after March 7, **no row in it can match**, so it is skipped without being opened. This is **partition pruning**, and it is the single biggest reason a warehouse query can touch 3% of a table instead of all of it. The lab implements it: `build_micro_partitions`, `prune`, and `scan`.

**It only works if similar values are stored together.** The lab's generator (`make_rows` in the test file, called here with 100,000 rows) makes orders across 365 days in random order. Cut into 100 partitions of 1,000 rows, every partition holds orders from almost every day, so its min is early in the year and its max late: **all 100 partitions match** the one-week filter. Sort the same rows by `order_date` first and cut them again: **3 partitions** match. Same data, same query, same 1,874 result rows, **a thirtieth of the work**. The lab's `average_overlap` measures it: 100.0 partitions overlapping each other in the random layout, 3.0 in the clustered one.

That sorting is what **clustering** means. In Snowflake you define a **clustering key** and the service keeps the table roughly sorted as data arrives. In BigQuery you **partition** a table by a date or integer column (a partition is a unit that can be skipped completely) and **cluster** it by up to four more columns that are sorted within each partition. In Redshift a **sort key** orders rows on disk so that zone maps work. The principle is shared: **pick the columns you filter by most often, and keep data ordered by them**.

Rules of thumb that follow: cluster on columns that appear in `WHERE` and `JOIN` (dates first for event data); a column with extremely high cardinality (a unique id) clusters poorly for range filters; and too many tiny partitions, as in the small-files problem of Module 3.0, add overhead. Clustering costs maintenance, so it pays off on **large** tables that are filtered repeatedly.

The second saving comes from **columns**. In the lab, selecting only `total` from the clustered table bills **24,000 bytes**, against **158,041** for all five columns, because a columnar store reads only the columns you name. Against the random layout the same one-column query bills 800,000 bytes: 33 times more. `SELECT *` throws the columnar advantage away.

> 💡 **Practice Pause 1 (Micro-Partitions, Zone Maps & Partition Pruning):**
> 1. In your text editor (VS Code / Cursor), open `labs/mod-2-6/warehouse_lab.py` (do not run `.py` files directly in bash).
> 2. Implement `build_micro_partitions(rows, target_rows, cluster_key=None)` to split rows and compute min/max statistics for every column.
> 3. Implement `prune(partitions, column, low, high)` to skip non-matching partitions using zone maps, and `scan(...)` to project only requested columns.
> 4. Test in terminal:
>    `pytest labs/mod-2-6/test_lab.py -k "TestMicroPartitions or TestPrune or TestScan" -v`
> 5. **Success Indicator:** 17 tests report `PASSED`, confirming that queries touch only relevant partitions and read only requested columnar bytes.

## @lesson Compute: parallel work, distribution and joins
**MPP.** A warehouse spreads a table over many compute nodes (Redshift calls the per-node worker units **slices**), and every node scans its own part in parallel; the results are combined on a coordinator (Redshift's leader node). More nodes mean more parallelism, until something must be moved between them.

**Joins are where data moves.** To join orders and customers on `customer_id`, matching rows must meet on the same node. If they sit on different nodes, one or both tables must be sent over the network (a **shuffle**, as in Module 3.0). Redshift lets you choose a **distribution style** per table:

- **KEY**: rows with the same value of a chosen column go to the same node (like the lab's `distribute(..., style="key")`).
- **EVEN**: rows are dealt out round-robin; balanced, but joins need data movement.
- **ALL**: every node holds a full copy; ideal for small dimension tables.
- **AUTO**: the service decides and may change it as the table grows.

The lab's `join_rows_moved` captures the rules: if both tables are distributed by the join key the join is **co-located and moves no rows**; if one side is a small replicated table (ALL), also no rows; if only one side is on the join key, the other is redistributed; if neither is, both are reshuffled. This is why a big fact table is distributed on its most common join key and small dimensions are replicated. Snowflake and BigQuery make these choices automatically, so you tune less, but the same cost exists inside the engine, and you see it as time spent in a "repartition" or "shuffle" step of the query profile.

**Skew** also appears here: if one key value (a customer with half of all orders) lands on one node, that node does half the work while others wait. Look for unbalanced steps in the query profile.

**Sizing compute.** In Snowflake a **virtual warehouse** comes in sizes (X-Small, Small, Medium, ...); each size up doubles the machines and the credits per hour. A bigger warehouse often finishes a heavy query faster for roughly the same total cost, but gives no benefit to a query that is already small; auto-suspend (Module 3.4) keeps idle time cheap. BigQuery allocates **slots** (units of compute) per query automatically, or you reserve a fixed number. Redshift provisioned clusters are sized in nodes; Redshift Serverless scales on demand.

> 💡 **Practice Pause 2 (Clustering Overlap & MPP Distribution):**
> 1. Open `labs/mod-2-6/warehouse_lab.py` in your text editor.
> 2. Implement `average_overlap(partitions, column)` to quantify clustering layout quality.
> 3. Implement `distribute(rows, key, nodes, style)` (styles `key`, `even`, `all`) and `join_rows_moved(...)` to model network data movement during MPP joins.
> 4. Test in terminal:
>    `pytest labs/mod-2-6/test_lab.py -k "TestClusteringQuality or TestDistribution or TestJoinMovement" -v`
> 5. **Success Indicator:** 13 tests report `PASSED`, verifying zero network movement for co-located joins and replicated dimension tables.

## @lesson Cost: scan-based and time-based pricing
Warehouses charge in two basic ways, and you must know which one you are on (Module 3.4 introduced both).

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

## @lesson Loading data: bulk, not row by row
A warehouse is built for **bulk loads**, not for inserting one row at a time as an application does. The standard path is: land files in object storage, then tell the warehouse to load them: Snowflake `COPY INTO` from a **stage** (and Snowpipe for continuous loading), BigQuery **load jobs** from Cloud Storage, Redshift `COPY` from S3. They read files in parallel, validate, convert and write micro-partitions.

**File sizing matters.** Snowflake's guidance is files of roughly **100 to 250 MB compressed**, because very small files add per-file overhead (the small-files problem again) and one huge file cannot be read in parallel. Redshift's guidance is a number of files that is a **multiple of the number of slices**, so that every slice loads the same amount of work. The lab's `plan_load_files` combines both: for a 10 GiB load on a cluster with 16 slices it plans **48 files** of about 213 MiB each (a multiple of 16, and under 250 MiB).

Other practices:

- Prefer a columnar, compressed format such as **Parquet** for loads; use CSV only when you must, and then watch quoting, encoding and the dirty values of Module 0.1.
- **Load into a staging table first**, validate, then **MERGE** into the final table, so that a retried load never creates duplicates (idempotence, Module 1.2; dbt incremental models, Module 2.3).
- For small, frequent updates prefer micro-batches (every minute) to row-level streaming inserts, which are more expensive and, in some systems, limited.
- **External tables** let a warehouse query files in object storage without loading them (Redshift Spectrum, BigQuery external tables, Snowflake external and Iceberg tables): flexible, but usually slower than loaded data because there are no warehouse statistics and no clustering.
- **Unloading** (`COPY INTO` a bucket, `UNLOAD`, `EXPORT DATA`) writes query results back to object storage for other systems.

Record **where every load came from and when**: file names, load ids, row counts and rejected rows. Reconciling counts between source and warehouse (Module 2.5) is the cheapest data quality check there is.

> 💡 **Practice Pause 4 (Planning Parallel Bulk Load Files):**
> 1. Open `labs/mod-2-6/warehouse_lab.py` in your text editor.
> 2. Implement `plan_load_files(total_bytes, slices, target_file_bytes=200 * MiB, max_file_bytes=250 * MiB)` to balance ideal file size and slice multiples.
> 3. Run the tests in terminal:
>    `pytest labs/mod-2-6/test_lab.py -k TestLoadPlanning -v`
> 4. **Success Indicator:** All 4 tests in `TestLoadPlanning` report `PASSED`, confirming balanced file sizing without small-file overhead.

## @lesson Concurrency, governance, and choosing
**Concurrency.** A warehouse has finite compute. When more queries arrive than it can run at once, the extra ones **queue**. The lab's `simulate_queue` shows it: five 10-second jobs on two slots finish at 10, 10, 20, 20 and 30 seconds, so the last user waits 20 seconds before the job even starts. The cures are the same everywhere: isolate workloads on separate compute (a warehouse for ETL, one for dashboards, one for analysts), use multi-cluster or auto-scaling features for bursts, and make heavy queries shorter with the layout tools above. Isolation also makes the bill attributable to a team (Module 3.4).

**Governance.** Data engineers set up access, not just tables. The common pieces: **roles** with privileges granted to roles rather than to people (Snowflake's role hierarchy, BigQuery IAM, Redshift groups and roles); **column masking** and **row access policies** so that analysts see masked emails or only their region's rows; **encryption** at rest and in transit (the warehouse handles it; you manage the keys policy); and **audit logs** of who queried what. Personal data needs extra care (Module 3.5, deletion requests).

Two features you will hear about: **zero-copy cloning** (Snowflake) creates a copy of a table or database as metadata, which costs storage only for changes, ideal for test environments; and **secure data sharing** lets another account query your data without copying it.

**Choosing.** There is no universal winner. A fair summary:

| | Strong points | Watch out for |
|---|---|---|
| **Snowflake** | Easy to run, strong isolation with virtual warehouses, cross-cloud, sharing | Cost control needs discipline (idle warehouses, size) |
| **BigQuery** | No servers, strong on very large scans, tight Google Cloud integration | Scan-based cost surprises; partition and cluster properly |
| **Redshift** | Deep AWS integration, predictable cost on steady load | More tuning (distribution and sort keys), cluster sizing |
| **Lakehouse** (Spark, Trino, DuckDB on Iceberg/Delta) | Open formats, no lock-in, one copy of data for many engines | More to operate yourself, fewer built-in governance tools |

In practice the choice is often made by the company's cloud provider and existing contracts. What transfers between all of them is what you learned here: **layout** (pruning), **bytes and time** (cost), **movement** (distribution and shuffles), **bulk loading**, and **isolation**.

Questions you can now answer: "Why is this query expensive?" (it scans many partitions or columns; look at partitions scanned and bytes billed). "How do I make it cheaper?" (filter on the clustering or partition column, select only needed columns, pre-aggregate). "What is the difference between Snowflake and BigQuery pricing?" (compute time versus bytes scanned). "Why file sizes of 100 to 250 MB?" (parallelism without per-file overhead).

> 💡 **Practice Pause 5 (Result Caching & Concurrency Queueing):**
> 1. Open `labs/mod-2-6/warehouse_lab.py` in your text editor.
> 2. Implement class `ResultCache`: normalize whitespace and SQL casing, track table versions, and invalidate cache entries when underlying tables change.
> 3. Implement `simulate_queue(query_durations, slots)` to model finish times of queries competing for execution slots.
> 4. Run the tests in terminal:
>    `pytest labs/mod-2-6/test_lab.py -k "TestResultCache or TestQueueing" -v`
> 5. **Success Indicator:** 8 tests report `PASSED`, validating cache invalidation and concurrency queue behavior.

## @lab Lab: how a warehouse saves work
Model the mechanisms of this module in plain Python: micro-partitions with zone maps, pruning and scanning, a clustering-quality measure, query cost, distribution styles and join data movement, bulk-load planning, a result cache, and a queue of concurrent queries. The tests (42) check each rule, and let you reproduce the key measurement: the same query scanning 100 of 100 partitions on random data and about 3 of 100 on clustered data.

### @steps
1. Read `labs/mod-2-6/warehouse_lab.py` from top to bottom. `value_bytes` is provided; everything else has a docstring that is the specification and names the lesson.
2. Work in file order and run the tests after EACH function:

```bash
pytest labs/mod-2-6/test_lab.py -v
pytest labs/mod-2-6/test_lab.py -v -k "Prune or Scan"          # one group at a time
```

3. **Partitions first.** Write `build_micro_partitions` and print the `min` and `max` of the `order_date` column for the first three partitions of a random layout and of a clustered one. Say out loud why one of them can be skipped and the other cannot.
4. **Scan and cost.** After `scan` passes, run it on both layouts with a one-week filter and with one column and five columns. Write the four numbers (partitions scanned, bytes billed) in a table, and compute the dollar cost with `query_cost`.
5. **Distribution.** Predict `join_rows_moved` for five combinations of distribution before you implement it, then compare with the tests.
6. **Loading, caching and queueing.** Plan the files for a 10 GiB load on 16 slices, then change the number of slices to 12 and 20 and predict the file count.
7. **Do it for real.** After Module 0.2, write the code again in your own venv **without copying**, and run `python3 scripts/prove.py mod-2-6` to get the proof code for the **Proof** box on this lab page.

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

## @resources
- [Snowflake documentation: micro-partitions and data clustering](https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions)
- [BigQuery documentation: partitioned and clustered tables](https://cloud.google.com/bigquery/docs/partitioned-tables)
- [Amazon Redshift documentation: distribution styles](https://docs.aws.amazon.com/redshift/latest/dg/c_choosing_dist_sort.html)
- [Snowflake documentation: preparing data files for loading](https://docs.snowflake.com/en/user-guide/data-load-considerations-prepare)
- [Amazon Redshift: best practices for loading data](https://docs.aws.amazon.com/redshift/latest/dg/c_loading-data-best-practices.html)
- [BigQuery: estimating and controlling costs](https://cloud.google.com/bigquery/docs/best-practices-costs)
