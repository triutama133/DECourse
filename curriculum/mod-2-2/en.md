---
title: Open Table Formats: Apache Iceberg and Delta Lake
duration: 3 weeks
summary: Learn how a table format turns a folder of immutable files into a real table with transactions, history, safe schema changes and row-level deletes, by inspecting Iceberg's metadata tree and Delta's transaction log on disk.
why: Courses treat a data lake as a folder of Parquet files. Without a table format you get half-written reads, conflicting writers, impossible row-level deletes and silent schema breaks, which is exactly why table formats were invented.
---

## @outcomes
- Explain the specific problems of "a folder of Parquet files" that table formats solve
- Draw Iceberg's metadata tree (catalog, metadata file, manifest list, manifests, data files) and say what each layer is for
- Explain how a commit stays atomic, how optimistic concurrency resolves two writers, and what snapshot isolation guarantees readers
- Use time travel, row-level deletes and schema and partition evolution, and explain why a delete does not remove data immediately
- Compare Iceberg and Delta Lake (metadata tree versus transaction log) and know the routine maintenance a table needs

## @prereq
Module 2.1 (Parquet, row groups, statistics). `pip install -r labs/mod-2-2/requirements.txt` installs PyIceberg and delta-rs; no Docker or cloud account is needed because the lab uses a local catalog and plain folders.

## @lesson What goes wrong with a folder of Parquet files
Module 2.1 gave you an excellent file format. The natural next step is a **data lake**: store Parquet files in cheap object storage (S3, GCS, a local folder) and query them. Every one of the following problems shows up quickly in production.

1. **No atomic writes.** A job that writes 200 files can fail after 120. Readers now see a table with 60% of yesterday's data, and nothing marks it incomplete. A job that *replaces* data by deleting the old files then writing the new ones leaves a window where the table is empty.
2. **No consistent view for readers.** A query that lists the folder, then reads the files, can see some files from a write in progress and not others.
3. **Conflicting writers.** Two jobs writing to the same folder have no way to detect each other. One's output can be overwritten, or the table ends up with duplicates.
4. **No row-level changes.** Parquet files are immutable. "Delete the data of user 4821" (a legal requirement under privacy laws such as GDPR) or "update this order's status" means finding every file that contains the rows, rewriting them, and swapping files by hand without breaking readers.
5. **Slow discovery.** Object stores list files slowly (thousands per second at best). A table of 500,000 files needs minutes just to *find* what to read, before reading any.
6. **Fragile schema changes.** Rename a column and old files no longer match; add a column and old files lack it; change a type and queries fail depending on which file they read.
7. **No history.** You cannot ask "what did this table look like yesterday?" or undo a bad load.
8. **Partitioning by folder name** (`month=2026-01/`) forces every user to know and filter on the partition column; query `WHERE order_ts > ...` and the engine cannot use the folders, scanning everything.

A **table format** solves all of these with one idea: **define the table not as "whatever files are in the folder" but as an explicit, versioned list of files, kept in metadata, and change the table by atomically replacing that metadata.** The data files stay ordinary immutable Parquet; the format adds a metadata layer on top.

The main open formats are **Apache Iceberg**, **Delta Lake** and **Apache Hudi**. They are not storage formats (the data is still Parquet) and not engines: Spark, Trino, Flink, DuckDB, Snowflake, BigQuery and others read and write them. Together with an engine and a catalog they make a **lakehouse**: the cheap storage of a lake with the reliability of a warehouse.

> 🛠 **Try it (10 min, Python).** Load `data/orders.csv` and cut it into five chunks of 727 rows (`df.iloc[i*727:(i+1)*727]`). Write them as `lake/orders/part-0.parquet` to `part-4.parquet`, but make the job die with `raise RuntimeError("job killed")` just before it writes the fourth file. Now read the folder with `pd.read_parquet("lake/orders")` and compare the row count with 3634. Then repair the writer so a reader can never see half a table: write into `lake/orders.tmp` and only `os.rename` it to `lake/orders` after all five files exist. Crash it again in a fresh folder and check what a reader finds. Delete `lake/` when you are done.
>
> **You should see:** the broken writer leaves `lake/orders` with 3 files and the reader returns `2181` rows out of 3634 with **no error at all**. With the temp-folder-then-rename writer, `lake/orders` does not exist after the crash, so the reader fails loudly with `FileNotFoundError` instead of silently returning partial data, and the leftover `orders.tmp` is easy to find and clean up. Table formats (next lessons) do the same trick with a metadata file instead of a folder rename.

## @lesson Iceberg: the metadata tree
Iceberg's design is a **tree of immutable files** with a single pointer on top.

```text
catalog                 "table shop.orders -> current metadata file"      (one atomic pointer)
  └─ metadata.json      schema, partition spec(s), list of snapshots, current snapshot
       └─ manifest list (snap-*.avro)   one per snapshot: which manifests make up that version
            └─ manifest (*.avro)        a list of data files with per-file stats and partition values
                 └─ data file (*.parquet)
```

A real table from the lab, after two appends. The metadata file records the schema with **numeric column ids**, the partition spec, and a list of snapshots:

```json
{ "format-version": 2,
  "location": "file:///.../warehouse/shop/orders",
  "schemas": [{"fields": [{"id": 1, "name": "order_id", "type": "long"}, "...", {"id": 4, "name": "status", "type": "string"}]}],
  "partition-specs": [{"spec-id": 0, "fields": [{"source-id": 3, "transform": "day", "name": "order_day"}]}],
  "snapshots": [
    {"snapshot-id": 450127879888050227, "manifest-list": "snap-4501...avro",
     "summary": {"operation": "append", "added-records": "3", "total-records": "3"}},
    {"snapshot-id": 6372821490839696416, "parent-snapshot-id": 450127879888050227, "manifest-list": "snap-6372...avro",
     "summary": {"operation": "append", "added-records": "2", "total-records": "5"}}],
  "refs": {"main": {"snapshot-id": 6372821490839696416, "type": "branch"}} }
```

Read it from the top. The **catalog** says which metadata file is current. That file lists the **snapshots** (each a complete version of the table); `refs.main` points to the current one. A snapshot points to a **manifest list**, which lists **manifests**; each manifest lists data files together with statistics (record counts, min and max per column, the partition each file belongs to). The leaves are Parquet files.

Why so many layers? **Scalability and pruning.** To plan a query, the engine reads the small metadata file, then the manifest list, and uses partition summaries and column min/max in the manifests to **skip entire manifests and files before opening a single data file**, with no folder listing at all. That is how an Iceberg table of millions of files plans a query in a second.

On disk, the lab's table looks like this after three appends:

```text
warehouse/shop/orders/
  metadata/
    00000-....metadata.json   00001-....metadata.json   00002-....   00003-....    (one per table version)
    snap-....avro (x3)        ....-m0.avro (x3)                                     (manifest lists, manifests)
  data/
    order_day=2026-01-01/00000-0-....parquet
    order_day=2026-01-02/00000-0-....parquet   00000-0-....parquet
```

Notice that **nothing is ever modified in place**. A write adds new data files, new manifests, a new manifest list and a new metadata file. The old ones remain, which is exactly what makes history, time travel and safe concurrent reads possible. Iceberg also tracks **delete files** (rows to hide) for row-level deletes, covered below.

> 💡 **Practice Pause: Creating Iceberg Table & Inspecting Metadata Layout**
> 1. Open `labs/mod-2-2/lakehouse.py` in your text editor (VS Code / Cursor). Do not execute python source files directly in bash without an interpreter.
> 2. Locate function `create_orders_table(catalog)`. Create namespace `shop` and table `shop.orders` with a five-column schema (`order_id`, `customer_id`, `order_ts`, `status`, `total_idr`) using explicit `NestedField` ids, and a `PartitionSpec` with `DayTransform` on `order_ts` (named `order_day`).
> 3. Implement `append_batch(table, rows)` to append data as a single new snapshot, and `layout(table)` to count `.metadata.json` files, manifest lists (`snap-*.avro`), manifests (`*.avro`), and data parquet files on disk.
> 4. Open your terminal and test the Iceberg table setup:
> `pytest labs/mod-2-2/test_lab.py -v -k "test_table_definition or test_each_append_is_one_snapshot or test_data_is_partitioned or test_layout"`
> 5. Ensure all 4 tests pass (`4 passed`). Observe how the `metadata/` and `data/` directories are laid out in your local warehouse.

## @lesson Commits, ACID and concurrent writers
A change to an Iceberg table is a **commit**: (1) write the new data files, (2) write new manifests, a manifest list and a new `metadata.json`, (3) ask the catalog to **atomically swap the table's pointer** from the old metadata file to the new one, *but only if the pointer still equals what you started from*. Steps 1 and 2 are invisible to readers (they are just unreferenced files). Step 3 is a single atomic operation, a compare-and-swap in the catalog. So a reader either sees the old complete version or the new complete version, never half of one. A job that dies at step 1 leaves harmless orphan files, not a half-written table. That is **atomicity**.

This is **optimistic concurrency control**: writers do not take locks; they do their work assuming nobody else changed the table, and verify at the commit. If two writers start from the same snapshot and one commits first, the second one's compare-and-swap fails. What happens next depends on whether the two changes *conflict*. In the lab, a second writer holding a stale view of the table tried to append after the first had committed; PyIceberg logged `Commit failed due to a concurrent update, retrying` and **succeeded on the retry**, because two appends add independent files and do not conflict, so the writer can refresh the base metadata and replay its change on top. Both appends ended up in the table. By contrast, two jobs that **delete or overwrite the same rows**, or one that overwrites a partition another just appended to, cannot both be right, and the later commit fails with an error that you must handle (reload and retry the logic, or serialise those jobs).

What readers get is **snapshot isolation**: a query starts from one snapshot and sees exactly that version of the table for its whole life, even while writers commit new ones. Readers never block writers and never see partial results. **Durability** comes from the object store; **consistency** from the schema and the commit protocol.

Practical points:

- Appends from many jobs work well; *competing overwrites* need care. A frequent pattern: streaming jobs append continuously and one maintenance job compacts; configure the compaction to avoid conflicting with the writers' partitions.
- The catalog is the single point of coordination: it must support atomic pointer updates (a database, a REST catalog service, the Hive Metastore, AWS Glue, Nessie and others). That is why the catalog is also where **access control** and table discovery live.
- Retries are bounded (PyIceberg retries a few times with backoff). Your job should still treat a final commit failure as an error to alert on, not ignore.

> 💡 **Practice Pause: Snapshot Operations & Optimistic Concurrency Control**
> 1. In your text editor in `labs/mod-2-2/lakehouse.py`, locate function `snapshot_ops(table)`.
> 2. Retrieve the table's snapshot history (`table.snapshots()`) and return the list of operation names that created each snapshot (`s.summary.operation.value`, e.g. `['append', 'append', ...]`).
> 3. Run the unit test in your terminal to verify that two concurrent writers are resolved cleanly by OCC:
> `pytest labs/mod-2-2/test_lab.py -v -k "test_a_writer_with_a_stale_view_still_commits"`
> 4. Ensure the test passes (`1 passed`). Notice the log message showing PyIceberg automatically retrying the commit when a concurrent update occurs.

## @lesson Time travel, deletes and why data does not vanish
Because every commit creates a snapshot and old snapshots are kept, you get **time travel** for free: read the table as of a snapshot id or a timestamp. In the lab, after the table received appends of 3, 2 and 2 rows, reading snapshot 0 returns 3 rows and snapshot 2 returns 7. This supports debugging ("what did the table look like when the dashboard broke?"), reproducing a model's training data, auditing, and **rollback** (point the table back at an earlier snapshot after a bad load).

**Row-level changes** (`DELETE`, `UPDATE`, `MERGE`) are the capability that plain Parquet lacks. Table formats implement them in two ways:

| Strategy | How a delete works | Write cost | Read cost |
|---|---|---|---|
| **Copy-on-write** | Rewrite every data file that contains an affected row, without those rows | High (whole files rewritten) | None (files are clean) |
| **Merge-on-read** | Write a small **delete file** that lists the rows to ignore; readers apply it | Low | Higher until compaction merges them |

Copy-on-write suits read-heavy tables with infrequent changes. Merge-on-read suits frequent small updates (change data capture, Module 3.2). In the lab, `table.delete(EqualTo("status", "cancelled"))` created a new snapshot with operation `delete`; the table then returned 5 rows, but **snapshot 2, taken before the delete, still returned 7**.

That last fact has a serious consequence. **A delete in a table format hides rows from the current version; it does not erase them from storage.** The old data files that still contain the rows remain referenced by older snapshots, so they stay in the bucket and can still be read via time travel. For ordinary corrections that is a feature. For a **privacy deletion request** it is a compliance trap: the user's data is still there. To physically remove it you must **expire the old snapshots** (so nothing references the old files) and then **remove the orphaned files** from storage, and also deal with backups and any derived tables built from the original data. Plan data retention and deletion deliberately, per table.

> 💡 **Practice Pause: Time Travel & Row-Level Deletes**
> 1. In your text editor in `labs/mod-2-2/lakehouse.py`, locate functions `count_as_of(table, snapshot_index)` and `delete_status(table, status)`.
> 2. In `count_as_of`, fetch the snapshot at the given position and run `table.scan(snapshot_id=snap.snapshot_id).to_arrow().num_rows` to query past table states.
> 3. In `delete_status`, perform a row-level delete using `table.delete(EqualTo("status", status))`.
> 4. Run the time travel and delete tests in your terminal:
> `pytest labs/mod-2-2/test_lab.py -v -k "test_time_travel_sees_the_past or test_delete_creates_a_snapshot"`
> 5. Ensure both tests pass (`2 passed`). Prove to yourself that the snapshot prior to the delete still yields 7 rows, even though active queries only show 5 rows.

## @lesson Schema evolution, partition evolution and hidden partitioning
**Schema evolution.** Iceberg identifies every column by a permanent **numeric field id**, not by its name or its position. The ids are in the metadata (`{"id": 4, "name": "status"}`) and in each Parquet file. Consequences, all demonstrated in the lab's tests:

- **Rename** a column and only the metadata changes: id 4 is now called `order_status`; old files still hold field 4, and queries on the new name read them correctly.
- **Add** a column (id 6, `channel`) and old files, which have no field 6, return `NULL` for it.
- **Drop** a column and its id is retired and never reused, so an old file can never be misread as a new column.
- Data file count before and after a rename plus add: unchanged. **No data was rewritten.**

Compare with plain Parquet files matched by *column name*: rename a column and the old files no longer match; drop one and re-add another with the same name and a different meaning and you silently read the wrong data. Iceberg also supports safe type widening (int to long) and reordering. Some changes remain unsafe by nature (narrowing a type), and the format refuses them.

**Hidden partitioning.** In a Hive-style layout you create a `month` column, folders `month=2026-01/`, and every query must filter on `month` or it scans everything. Iceberg stores a **partition transform** of an existing column: here `day(order_ts)`, named `order_day`. Users write `WHERE order_ts >= '2026-01-10'`; the engine knows the transform, converts that predicate to the partition values it implies, and prunes files. There is no extra column to keep in sync and no way to filter wrongly. Available transforms include `year`, `month`, `day`, `hour`, `bucket(N, col)` (hash into N buckets, good for high-cardinality ids) and `truncate(W, col)`.

**Partition evolution.** If the data grows and daily partitions become too fine or too coarse, you can change the partition spec (for instance, from `month` to `day`) **without rewriting old data**. Old files keep the old spec, new files use the new one, and the metadata records which spec each file follows, so queries plan correctly across both. With folder partitioning, changing the scheme means rewriting the whole table.

> 💡 **Practice Pause: Schema Evolution Without Data Rewrites**
> 1. In your text editor in `labs/mod-2-2/lakehouse.py`, locate function `evolve(table)`.
> 2. Use the context manager `with table.update_schema() as update:` to add optional string column `channel` and rename column `status` to `order_status` in a single atomic commit.
> 3. Run the schema evolution tests in your terminal:
> `pytest labs/mod-2-2/test_lab.py -v -k "test_schema_evolution or test_new_schema"`
> 4. Ensure both tests pass (`2 passed`). Verify that the list of Parquet data files on disk remains strictly identical (zero bytes rewritten) and old rows read the new column as `NULL`.

## @lesson Delta Lake: the transaction log
**Delta Lake** reaches the same goals with a different structure: an ordered **transaction log** of JSON commit files in a `_delta_log/` folder beside the data.

```text
delta_orders/
  order_day=2026-01-01/part-....parquet
  order_day=2026-01-02/part-....parquet
  _delta_log/
    00000000000000000000.json      <- version 0
    00000000000000000001.json      <- version 1
    00000000000000000002.json      <- version 2
```

Each commit file is a list of **actions**, one JSON object per line. From the lab's real table:

```text
version 0: commitInfo, protocol, metaData, add      (creates the table: schema, protocol version, first file)
version 1: commitInfo, add                          (an append adds a file)
version 3: commitInfo, add, remove                  (a delete REMOVES the old file and ADDS a rewritten one)
```

The current state of the table is **the result of replaying the log from the beginning**: start empty, apply each commit's `add` and `remove`; what remains is the set of live files. To keep that fast, Delta periodically writes a **checkpoint** (a Parquet snapshot of the state, by default every 10 commits), so a reader starts from the latest checkpoint plus the few later commits. A commit is atomic because creating the next numbered log file is an atomic "put if absent": if two writers try to create `...0003.json`, only one wins and the other retries. Time travel is reading the table at an earlier version (in the lab, version 2 holds 6 rows; the delete at version 3 leaves 5, and version 2 can still be read).

**`VACUUM`** is Delta's physical cleanup: it deletes data files that are no longer referenced by versions within a retention period (7 days by default). Until then the data remains readable by time travel, the same trade-off as in Iceberg.

How do the two compare?

| | Iceberg | Delta Lake |
|---|---|---|
| Source of truth | A tree of metadata files plus a catalog pointer | An ordered log of JSON commits (plus checkpoints) |
| Atomic commit | Compare-and-swap of the catalog's pointer | Create the next numbered log file if absent |
| Column identity | Field ids | Names by default (with optional column mapping to allow renames) |
| Partitioning | Hidden partitioning, partition evolution | Partition columns (liquid clustering and generated columns exist) |
| Strengths | Engine neutrality, hidden partitioning, scale of metadata | Deep Spark and Databricks integration, simple log model |
| Typical home | Multi-engine platforms (Trino, Flink, Snowflake, Spark) | Databricks and Spark-centred platforms |

The formats have been converging, and tools exist to expose one format's tables to readers of another. For a first project, choose by your ecosystem: **Delta** if you live on Databricks, **Iceberg** if you want maximum engine and vendor neutrality. **Hudi** is the third option, strong for incremental processing and upserts. Everything in this module (snapshots, atomic commits, field ids, pruning, maintenance) applies to all three.

> 💡 **Practice Pause: Managing Delta Lake Transaction Logs**
> 1. In your text editor in `labs/mod-2-2/lakehouse.py`, navigate to Part B (Delta Lake).
> 2. Implement `delta_write_versions(path, batches)` with `write_deltalake`, `delta_rows_at(path, version)` for Delta time travel, `delta_delete(path, predicate)` for row deletions, and `delta_log_actions(path, version)` to read the JSON action keys in `_delta_log/`.
> 3. Run the Delta Lake test suite in your terminal:
> `pytest labs/mod-2-2/test_lab.py -v -k TestDelta`
> 4. Ensure all 3 Delta Lake tests pass (`3 passed`). Notice how deleting a row in Delta Lake logs a `remove` action for the old file and an `add` action for the rewritten file.

## @lesson Operating tables: maintenance and catalogs
Tables are not "create and forget". Every commit adds files, and without care a table slowly degrades. The routine maintenance tasks:

- **Compaction** (file rewriting): frequent small appends (a streaming job writing every minute) create thousands of small files, which makes planning and scans slow (the small files problem from Module 2.1). A periodic job rewrites many small files into a few well-sized ones (aim for roughly 128 MB to 1 GB each) and may sort them (clustering) to improve data skipping. In Delta this is `OPTIMIZE`; in Iceberg `rewrite_data_files`.
- **Expire snapshots**: delete old snapshots beyond a retention window, so metadata stays small and deleted data can really go. This defines how far back time travel works.
- **Remove orphan files**: delete files that no snapshot references (left by failed writes), carefully, only older than a safety window so you never delete a file of an in-progress commit.
- **Rewrite manifests**: merge many small manifests so planning stays fast.
- **Monitor** file counts, average file size, snapshot counts and the age of the oldest snapshot. Alert before the table becomes slow, not after.

**Catalogs.** A catalog maps table names to the current metadata and provides the atomic pointer. Options include a database-backed catalog (the lab's SQLite file; fine for learning), the **Hive Metastore**, **AWS Glue**, **REST catalogs** (a standard HTTP API implemented by Polaris, Nessie, Unity and others) and managed catalogs from cloud vendors. The catalog is also the natural place for **governance**: who may read or write which table. Choose one that your engines all support, because the catalog, not the file format alone, decides which tools can share your tables.

**Design advice.** Partition coarsely (daily is common) and let sorting and file statistics handle fine-grained filters; never partition by a high-cardinality column. Write in large batches. Define retention for snapshots and deletes up front. Write through a single, well-understood path where possible, and test concurrency, because the failures in this area are rare and expensive.

> 💡 **Practice Pause: Full Lakehouse Test Suite Verification**
> 1. Once all Iceberg and Delta Lake functions in `labs/mod-2-2/lakehouse.py` are implemented, run the complete unit test suite from your terminal:
> `pytest labs/mod-2-2 -v`
> 2. Ensure all 12 tests pass cleanly (`12 passed`).
> 3. Congratulations! You have proven firsthand how ACID transactions, time travel, schema evolution, and transaction logs operate on disk across both leading open table formats.

## @lab Lab: build a lakehouse table, then look inside it
Create an Iceberg table, make it change over time, and prove the format's promises with tests: snapshots, time travel, deletes that keep history, schema evolution that rewrites no data, and a metadata layout you verify on disk. Then do the same observations for Delta Lake's transaction log.

### @steps
1. Install the requirements and run the tests to see them fail:

```bash
python -m pip install -r labs/mod-2-2/requirements.txt
pytest labs/mod-2-2 -v
```

2. Read `labs/mod-2-2/lakehouse.py`. `make_catalog` is provided: a local Iceberg catalog backed by a SQLite file, with the warehouse in a plain folder. Implement `create_orders_table`: a five-column schema with explicit field ids, a **day** partition on `order_ts` named `order_day`.
3. Implement `append_batch`, `snapshot_ops`, `count_as_of` and `delete_status`. After each, run the tests. Time travel (`count_as_of`) uses `table.scan(snapshot_id=...)`; the delete test checks that the snapshot before the delete still shows the deleted rows.
4. Implement `evolve` (add `channel`, rename `status` to `order_status`, in one commit). The test confirms **no data file changed**, old rows read `NULL` for `channel`, and the old snapshot is still readable.
5. Implement `layout`: count, directly on disk, the metadata files, manifest lists, manifests and data files. While you do it, open the newest `*.metadata.json` in an editor and find the schema, the partition spec, the snapshots and `refs`. Explain to yourself how many of each file you expect and why.
6. Part B, Delta Lake: implement `delta_write_versions`, `delta_rows_at`, `delta_delete` and `delta_log_actions`. Open the `_delta_log/*.json` files and match the action lists you return to what you see (`protocol`, `metaData`, `add`, `remove`).
7. Experiment beyond the tests: make two handles to the same table and append from both; list the data files after a delete; try appending rows with an old column name after `evolve` and read the error.
8. Optional, with Docker: run the same table on S3-compatible object storage. Start `docker compose up -d s3 s3-init`, then create the catalog with `SqlCatalog("s3", uri="sqlite:///catalog.db", warehouse="s3://warehouse/", **{"s3.endpoint": "http://localhost:8333", "s3.access-key-id": "dataforge", "s3.secret-access-key": "dataforge-secret", "s3.path-style-access": "true", "s3.region": "us-east-1"})`. Append a batch, read it back, then list the objects in the bucket (`curl "http://localhost:8333/warehouse?list-type=2"`) and match them to your `layout` counts. (Checked by hand: create, append and read work against this stack.)

### @files
- labs/mod-2-2/lakehouse.py :: Your working file: Iceberg and Delta functions to implement :: starter
- labs/mod-2-2/test_lab.py :: The tests :: test
- labs/mod-2-2/requirements.txt :: pyiceberg (with sqlite, pyarrow and pyiceberg-core extras), deltalake, pytest :: config
- labs/mod-2-2/reference/lakehouse.py :: One possible solution (try first!) :: reference

### @deliverables
- All 12 tests pass
- You can explain, with the files in front of you, which files a single `append` created and which it left untouched
- You can say in two sentences why deleting the rows of one customer does not yet make the data unrecoverable

### @verify
```bash
pytest labs/mod-2-2 -v
```

Known-good run: `LAB_DIR=reference pytest labs/mod-2-2 -v`. Note: writing to a day-partitioned Iceberg table needs the `pyiceberg-core` extra; the requirements file includes it.

## @chaos The deletion request that did not delete
### @scenario
A customer exercises her privacy rights and asks KopiKu to erase her personal data. The data team runs a row-level `DELETE` on the Iceberg `orders` table for her customer id and confirms that `SELECT ... WHERE customer_id = 4242` now returns nothing. They tell legal it is done.

Six weeks later a regulator's auditor, given read access, runs a time-travel query against a snapshot from the previous month and retrieves her orders, with name and address columns, from the bucket.

### @cause
The delete created a *new snapshot* in which her rows are hidden. The previous snapshots, and the data files containing her rows, were untouched, because Iceberg never modifies files in place. Time travel (and anyone who can read the storage directly) can still reach them. Nobody had configured snapshot expiry, so the old data is retained indefinitely; nobody had scheduled removal of orphan files; and copies existed in a downstream table and in backups.

Nothing here is a bug: it is exactly how the format preserves history. The failure was treating "the query returns nothing" as "the data is gone".

### @fix
1. **Expire** snapshots older than the retention window, then **remove orphaned files**, so no metadata references the old files and storage deletes them.
2. Set a **retention policy per table** (for example, expire snapshots after 7 days) that is shorter than your legal deadline for erasure.
3. Track erasure end to end: derived tables, extracts, search indexes, caches and backups need their own deletion step. Consider **crypto-shredding** (delete the encryption key of a user's data) for hard cases.
4. Restrict who can read raw storage and who can time travel to old snapshots, and audit that the deletion really happened by testing it (query old snapshots and file listings after the maintenance run).
5. Prefer designs where personal data is separated from facts (a small identity table you can delete from) so an erasure touches little.

### @pattern
In a table format, delete hides and maintenance erases. Make expiry and orphan removal part of every deletion process, and verify them.

## @quiz
### What is the core idea shared by Iceberg, Delta Lake and Hudi?
- [ ] They store data in a new binary file format that replaces Parquet and is faster to read than it
- [x] They define the table as a versioned list of files kept in metadata, and change it atomically
- [ ] They move the data into a managed database server that applies locks to every single query
- [ ] They compress the folder of files into one archive that the engine has to download in full

> The data files stay ordinary Parquet. What the formats add is a metadata layer that says exactly which files make up each version of the table, and commits swap that metadata atomically.

### In Iceberg's metadata tree, which is the correct order from the top down?
- [ ] Data file, manifest, manifest list, metadata file, and then the catalog entry for the table
- [ ] Manifest list, catalog entry, data file, metadata file, and then the manifest of partitions
- [x] Catalog entry, then the metadata file, then the manifest list, then manifest, then data file
- [ ] Metadata file, data file, catalog entry, manifest, and then the manifest list of each snapshot

> The catalog points to the current metadata file, which lists snapshots; each snapshot points to a manifest list, which lists manifests, which list the data files with their statistics.

### Two jobs load the same Iceberg table. Job B started from an older snapshot and tries to commit an append after job A has committed. What most likely happens?
- [ ] Job A's data is silently overwritten, because the last writer always replaces the table
- [ ] The table is locked for job B until job A is finished, then both are merged by the catalog
- [x] The compare-and-swap fails, then the writer refreshes and retries, and appends commit
- [ ] The table becomes corrupted, so both jobs must be repeated after restoring a backup

> Commits are optimistic: the swap succeeds only if the base is unchanged. Independent appends do not conflict, so the client reloads the metadata and replays its change; conflicting overwrites would raise an error.

### You rename the column `status` to `order_status` in an Iceberg table. What happens to the existing data files?
- [ ] They are rewritten in the background with the new name, which can take hours for big tables
- [ ] They stop working, so the old data has to be reloaded from the original source system
- [x] They are untouched, because columns are tracked by field id and only metadata changes
- [ ] They keep the old name, so queries must use the old name when reading old rows

> Iceberg identifies columns by permanent numeric ids stored in metadata and files. A rename updates only the name for that id, so no data is rewritten.

### What does hidden partitioning give users compared with Hive-style partition folders?
- [ ] It encrypts the partition values so that analysts cannot see how the data is split up
- [x] Filters on the original column (such as order_ts) prune files without a partition column
- [ ] It removes the need for any partitioning, because the engine reads all files in parallel anyway
- [ ] It stores each partition in a different catalog so that the tables can scale to more users

> The table stores a transform of a real column (for example, day of order_ts). Predicates on the original column are translated to partition values automatically, so queries cannot accidentally skip the pruning.

### After `DELETE FROM orders WHERE customer_id = 4242`, a time-travel query on last week's snapshot still returns her rows. Why, and what makes the data really disappear?
- [ ] The delete failed silently, so you should rerun it with a higher transaction isolation level
- [ ] The catalog is cached by the engine, so you have to restart the cluster to see the delete
- [x] Old snapshots still reference the old files, so expire snapshots and remove orphaned files
- [ ] Time travel always ignores deletes, since it reads the original source files of the load

> A delete creates a new snapshot that hides rows; it never edits files. Until the old snapshots are expired and the unreferenced files removed, the data is still stored and reachable.

### How does Delta Lake determine the current state of a table?
- [ ] By listing every file in the folder and reading the newest ones that were created lately
- [ ] By asking an external database server which files belong to the table at the present time
- [x] By replaying the add and remove actions in `_delta_log`, starting from the last checkpoint
- [ ] By reading a single manifest file that is rewritten completely every time a commit is made to it

> The transaction log is an ordered list of JSON commits. Replaying add and remove actions yields the set of live files; checkpoints avoid replaying from version zero.

### A streaming job appends to a table every minute for three months, and queries have become slow. What is the most likely cause and the standard fix?
- [ ] The table has too few partitions, so you should partition it by customer id to spread the load
- [x] There are thousands of small files and many snapshots, so schedule compaction and expiry jobs
- [ ] Parquet files become slower as they age, so the data should be converted to CSV before reading it
- [ ] The catalog is running out of room, so the tables must be moved to a bigger catalog server

> Frequent small commits create many small data files and manifests, which slows planning and scans. Periodic compaction, snapshot expiry and manifest rewrites restore performance.

## @resources
- [Apache Iceberg documentation](https://iceberg.apache.org/docs/latest/)
- [Apache Iceberg table spec](https://iceberg.apache.org/spec/)
- [PyIceberg documentation](https://py.iceberg.apache.org/)
- [Delta Lake documentation](https://docs.delta.io/latest/)
- [delta-rs (Python deltalake) documentation](https://delta-io.github.io/delta-rs/)
