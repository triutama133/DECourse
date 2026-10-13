---
title: From Hadoop to Spark: HDFS, MapReduce, YARN and Hive
duration: 2 weeks
summary: Understand the big-data stack that came before Spark and the lakehouse: how HDFS stores files across machines, how MapReduce computes over them, how YARN shares the cluster and how Hive puts SQL on top. You rebuild each idea in a small, testable Python model, and see which parts still matter today.
why: Interviews and job posts still say Hadoop, HDFS and Hive, but most tutorials skip them. Without this history Spark's shuffle, partitions and "move the code to the data" look like magic, and you cannot explain why the modern stack looks the way it does.
---

## @outcomes
- Explain why data too big for one machine led to scale-out storage and compute, and why "failure is normal" shaped the design
- Describe how HDFS splits files into blocks, replicates them across racks, and survives node failures, and explain the small-files problem with numbers
- Trace a MapReduce job (map, shuffle, reduce) by hand, explain what a combiner does, and write a reduce-side join
- Explain what YARN schedules and why resource management was separated from MapReduce
- Explain what Hive and its metastore are, why tables are "schema on read" over files, and how Hive led to Iceberg
- Map each Hadoop-era component to its modern equivalent and talk about it accurately in an interview

## @prereq
Module 0.0 (Python) and Module 2.1 (columnar files) help. The lab is plain Python and needs no cluster. Module 3.1 (Spark) builds directly on this one.

## @lesson Why Hadoop was invented
Around 2003 a search company could not store the web on one computer. A single machine, however large, has limits: a disk holds a few terabytes, reading it takes hours, and the biggest machines cost far more than ten times what ten ordinary ones cost. There are two ways to grow. **Scale up** means buying a bigger machine; it hits a ceiling and a price wall. **Scale out** means connecting many ordinary machines and letting them share the work; it has no ceiling, but it creates new problems.

The central problem is failure. If one disk fails once every few years, a cluster of 4,000 machines with 12 disks each loses a disk **every day or so**. Google described the answer in two papers: the Google File System (2003) for storage, and MapReduce (2004) for computation. Doug Cutting and colleagues built open-source versions, and Apache **Hadoop** (from 2006) became the foundation of the first big-data decade. The design idea, which you will meet again in Spark and Kafka, is: **assume machines fail, keep several copies of data, and make computations re-runnable**.

Hadoop is a family of four parts that this module follows in order:

| Part | Job | One-line idea |
|---|---|---|
| **HDFS** | store files | cut files into blocks and copy each block to several machines |
| **MapReduce** | compute | send small functions to where the data lives, and combine the results |
| **YARN** | share the cluster | decide which job gets which machines |
| **Hive** | query with SQL | tables are descriptions laid over files |

A second idea runs through all of it: **move the computation to the data, not the data to the computation**. Moving a 1 GB block across a network to run a one-kilobyte program is wasteful; sending the program to the machine that already holds the block is cheap. You will see the same principle again as partition pruning, predicate pushdown and data locality.

> 🛠 **Try it (10 min, Python).** Simulate losing machines. Use `random.Random(seed)`. Put 1,000 blocks on 20 machines: each block gets `r` copies on `r` *different* machines (`rnd.sample(range(20), r)`). Then "kill" 3 random machines (`rnd.sample(range(20), 3)`) and count the blocks whose copies are **all** on dead machines. Write `lost(r, seed)` and print it for `r` = 1, 2 and 3 over seeds 0 to 4.
>
> **You should see:** roughly `150` lost blocks with one copy (130 to 162 across the seeds), roughly `15` with two copies (11 to 17), and `0` to `3` with three. The expected values are 150, 15.8 and 0.9. Each extra copy cuts the losses by about a factor of ten, which is why HDFS defaults to three copies on cheap machines.

## @lesson HDFS: a file system made of many machines
The Hadoop Distributed File System stores huge files on ordinary machines. A **file** is cut into **blocks** of a fixed size (the default is **128 MiB**; an ordinary disk file system uses 4 KiB blocks). Every block is **replicated**: by default **three copies** on three different machines. The last block of a file is just as long as it needs to be (a 300 MiB file becomes blocks of 128, 128 and 44 MiB; the lab's `split_into_blocks` does exactly this).

Two kinds of machine cooperate. The **NameNode** is the directory: it keeps in memory the namespace (folders and files) and, for every file, the list of blocks and which machines hold each one. The **DataNodes** hold the actual bytes. DataNodes send the NameNode a heartbeat every few seconds and a report of their blocks. If heartbeats stop, the NameNode declares the node dead and orders copies of its blocks to be made elsewhere until every block again has three replicas. That is how HDFS heals itself.

**Reading** a file: the client asks the NameNode "where are the blocks of this file?", then reads each block **directly from a DataNode** (the nearest copy). The NameNode never carries file data, so it is not a bottleneck for throughput. **Writing**: the client asks the NameNode for a DataNode for the first block, and the data flows through a **pipeline** (client to DataNode 1, which forwards to DataNode 2, which forwards to DataNode 3).

**Rack awareness.** Machines sit in racks that share a switch and a power supply. Losing a whole rack is a real event. The default placement policy for three replicas is: **1st replica on the writer's own machine, 2nd on a machine in a different rack, 3rd on a different machine in the same rack as the 2nd**. That gives rack-level fault tolerance while keeping most of the write traffic inside a rack. The lab's `place_replicas` implements this exactly, and `blocks_lost` shows that a block is lost only when *every* replica's machine failed.

> 💡 **Practice Pause 1 (HDFS Block Splitting & Rack-Aware Replication):**
> 1. Open `labs/mod-3-0/hadoop_lab.py` in your text editor (such as VS Code). Do not execute this Python file directly in terminal without arguments.
> 2. Implement `split_into_blocks(file_size, block_size=BLOCK_SIZE)` to partition files into default 128 MiB blocks plus the exact remainder.
> 3. Implement `place_replicas(nodes, writer, factor=3)` following the rack-awareness policy: replica 1 on writer, replica 2 on a different rack, replica 3 on the same rack as replica 2.
> 4. Implement `blocks_lost(placements, failed_nodes)` to report blocks whose replicas have all failed.
> 5. Run the tests in terminal:
>    `pytest labs/mod-3-0/test_lab.py -k "TestBlocks or TestReplicaPlacement or TestBlockLoss" -v`
> 6. **Success Indicator:** All 14 tests report `PASSED`, confirming accurate block chunking and multi-rack fault tolerance.

**The small-files problem.** The NameNode keeps one in-memory object per file, per directory and per block; a commonly quoted rule of thumb is about **150 bytes** each. The lab's `metadata_objects` makes the consequence visible. One terabyte stored as 1 GiB files is 1,024 files with 8 blocks each: **9,216 objects**, about 1.4 MB of NameNode memory. The same terabyte stored as 1 MiB files is **2,097,152 objects**, about **300 MB**, which is 227 times more, for identical data. Tens of millions of tiny files can exhaust the NameNode's memory and take down the whole cluster (see the chaos scenario). HDFS is built for **few, large files**.

Other limits: files can be appended to but not edited in the middle, so HDFS suits "write once, read many" data; a single NameNode would be a single point of failure, so production clusters run a standby NameNode with shared journals (**HA**); and **erasure coding** (Hadoop 3) stores parity blocks instead of full copies, for example six data blocks plus three parity blocks, which costs 1.5 times the data instead of 3 times.

> 💡 **Practice Pause 2 (The Small-Files Problem & NameNode Memory Overhead):**
> 1. Open `labs/mod-3-0/hadoop_lab.py` in your text editor.
> 2. Implement `metadata_objects(total_bytes, file_size, block_size=BLOCK_SIZE)` to compute total in-memory metadata objects (1 per file + 1 per block).
> 3. Implement `namenode_memory_bytes(objects, bytes_per_object=150)` multiplying total objects by the 150-byte rule of thumb.
> 4. Run the tests in terminal:
>    `pytest labs/mod-3-0/test_lab.py -k TestSmallFilesProblem -v`
> 5. **Success Indicator:** All 4 tests report `PASSED`, mathematically demonstrating why millions of small files consume 200x more NameNode RAM than large files.

## @lesson MapReduce: compute by moving the code
MapReduce is a way to write a distributed computation as two simple functions. You supply a **mapper** and a **reducer**; the framework does the hard work of running them on many machines.

The classic example is counting words. The input is split into pieces (one per block). Each piece is handled by a **map task**, which reads records and emits **(key, value)** pairs: for the line `"to be or not to be"` the mapper emits `("to", 1), ("be", 1), ("or", 1), ...`. Then comes the step that makes it all work, the **shuffle**: every pair with the same key is sent to the **same reducer**, and each reducer receives its keys sorted. A **reduce task** then sees `("be", [1, 1])` and emits `("be", 2)`.

```
input splits --> MAP --> (key,value) pairs --> SHUFFLE (group by key, send to reducers) --> REDUCE --> output
```

Which reducer gets which key? A **partitioner**: `hash(key) % number_of_reducers`. It must give the same answer on every machine, so a stable hash is used (the lab uses CRC32; Python's built-in `hash()` changes between runs and would be wrong). Everything about **skew** from Module 3.1 starts here: one very common key sends all its pairs to a single reducer.

A **combiner** is a mini-reducer that runs on the map side, before the shuffle, to shrink what must cross the network. In the lab's word count, 13 words produce 13 pairs; with a combiner only **7 pairs** (one per distinct word) are shuffled, and the answer is identical. Network is the expensive resource, so this matters.

> 💡 **Practice Pause 3 (Map, CRC32 Partitioning, Shuffle, and Combiner):**
> 1. Open `labs/mod-3-0/hadoop_lab.py` in your text editor.
> 2. Implement `map_phase`, `partition` (using `zlib.crc32(str(key).encode("utf-8")) % num_reducers`), `shuffle`, and `reduce_phase`.
> 3. Implement `wordcount_mapper`, `wordcount_reducer`, and full `run_job` execution supporting map-side pre-aggregation via `combiner`.
> 4. Run the tests in terminal:
>    `pytest labs/mod-3-0/test_lab.py -k "TestMapReduceSteps or TestWordCountJob" -v`
> 5. **Success Indicator:** All 11 tests report `PASSED`, verifying deterministic shuffle routing and combiner network optimization from 13 down to 7 pairs.

**Joins** use the same machinery. In a **reduce-side join** both inputs are mapped to `(customer_id, tagged record)`, so the shuffle brings a customer's row and all that customer's orders to the same reducer, which can then combine them. You write this in the lab (`revenue_per_city`). It is also exactly what Spark does for a sort-merge join.

**Fault tolerance** comes from a simple property: a task is **deterministic** (same input, same output) and its input is stored durably. If a machine dies mid-task, the framework starts the same task again elsewhere. The lab's `retry_task` shows the idea, and Module 0.0's lesson on pure functions is why it is safe. The framework can also start a duplicate of a very slow task (**speculative execution**) and keep whichever finishes first.

**Why MapReduce faded.** Between map and reduce, and between the end of one job and the start of the next, data is written to disk and (for the output of a job) to HDFS with three replicas. A task such as machine learning, which loops over the same data many times, pays that cost on every iteration. Writing a real analysis as a chain of MapReduce jobs was also slow to write and slow to run. Spark keeps intermediate data in memory and plans the whole chain as one graph (Module 3.1), but it still **shuffles by key exactly as described here**. If you understand this lesson, Spark's shuffle is no mystery.

> 💡 **Practice Pause 4 (Reduce-Side Join & Deterministic Task Retries):**
> 1. Open `labs/mod-3-0/hadoop_lab.py` in your text editor.
> 2. Implement `revenue_per_city(orders, customers, num_reducers=2)` using the reduce-side join pattern by tagging order and customer records under `customer_id`.
> 3. Implement `retry_task(task, max_attempts=4)` to retry deterministic tasks on `RuntimeError` up to `max_attempts`.
> 4. Run the tests in terminal:
>    `pytest labs/mod-3-0/test_lab.py -k "TestReduceSideJoin or TestFaultTolerance" -v`
> 5. **Success Indicator:** All 6 tests report `PASSED`, confirming accurate reduce-side joins and resilient automated task retries.

## @lesson YARN: sharing the cluster
In the first Hadoop, one component ran MapReduce jobs *and* decided which machine ran what. That meant the cluster could run only MapReduce. **YARN** (Yet Another Resource Negotiator, Hadoop 2) split the two jobs apart, so that Spark, Tez, Flink and others could share the same machines.

The pieces: a **ResourceManager** (one per cluster) knows the free memory and CPU on every machine and decides who gets what. A **NodeManager** on every machine launches and watches **containers**, a container being a slice of memory and CPU on one machine. Each application has an **ApplicationMaster**: the first container of a job, which asks the ResourceManager for more containers and runs the job's tasks inside them.

A **scheduler** decides the order when requests exceed capacity. The simplest is FIFO: first come, first served, which lets one huge job block everyone. The **Capacity** and **Fair** schedulers divide the cluster between teams or jobs. The lab's `allocate_containers` is a toy first-fit FIFO scheduler: it places each request on the first machine with room and leaves the rest **pending**. Pending work waiting for resources is the commonest sign of an overloaded cluster, in YARN just as in Kubernetes.

Today Spark can run on YARN (still common on-premises), on Kubernetes (now more common in the cloud), or on managed services where you never see the scheduler. The concept is the same: an application asks for containers with a memory and CPU size, and something decides where they run. When a Spark executor is killed for exceeding its memory limit (Module 3.1), that is YARN or Kubernetes enforcing the container size.

> 💡 **Practice Pause 5 (YARN Container Scheduling):**
> 1. Open `labs/mod-3-0/hadoop_lab.py` in your text editor.
> 2. Implement `allocate_containers(requests, nodes)` with First-Fit First-Come-First-Served logic to allocate memory requests to the first fitting node.
> 3. Run the tests in terminal:
>    `pytest labs/mod-3-0/test_lab.py -k TestYarnScheduler -v`
> 4. **Success Indicator:** All 3 tests in `TestYarnScheduler` report `PASSED`, verifying correct container placement without mutating the input node capacity dictionary.

## @lesson Hive: SQL over files
Writing MapReduce in Java for every question was slow work. **Hive** (from Facebook, around 2008) lets you write **SQL**; Hive translates it into jobs. The key idea is that a Hive table is not a special storage format. It is a **description laid over files** in HDFS: a table name, a list of columns and types, and the folder where the files live.

That description lives in the **Hive Metastore**, a small relational database. For each table it stores the schema, the location, the file format and, importantly, the list of **partitions** (folders such as `order_date=2026-01-15/`). The data files themselves are untouched, so this is called **schema on read**: the schema is applied when you read, not enforced when you write. A wrong file in the folder is not rejected on arrival; it fails (or gives NULLs) when someone queries it. You will recognise the problem that data contracts (Module 2.5) were invented to solve.

Hive started with text files and moved to columnar formats, **ORC** and **Parquet**, for the reasons of Module 2.1. Its execution engine moved from MapReduce to **Tez** and later also Spark, because MapReduce was too slow for interactive SQL. Separate engines such as **Impala** and **Presto/Trino** read the same tables in memory for fast queries.

The Hive Metastore survived all of this, and it is the part you will most likely meet in a modern stack: Spark, Trino, Athena and others still use it (or the AWS Glue Catalog, which has the same role) to know "what tables exist and where". Its weakness was the table format: Hive tables are folders of files, with no atomic commits, slow directory listing on cloud storage, no safe concurrent writers and no time travel. **Apache Iceberg** (Module 2.2) was created to fix exactly this while keeping the idea of "open files plus a catalog".

> 🛠 **Try it (10 min, Python).** Run `pip install duckdb`. Make the folder `orders/dt=2026-01-15/` with two CSV files that both have the header `id,amount`. `a.csv` holds the rows `1,100` and `2,250`; `b.csv` holds `3,n/a` and `4,400` (someone else's job wrote a wrong value). Treat the folder as a Hive-style table: query `count(*)` and `sum(amount)` with `read_csv('orders/*/*.csv', header=true, columns={'id':'INTEGER','amount':'INTEGER'})`. Then run the same query again with `ignore_errors=true` added to `read_csv`.
>
> **You should see:** the first query fails with a `ConversionException` that names the bad line, and only now, at read time, not when `b.csv` was written (schema on read). With `ignore_errors=true` it returns `(3, 750)`: the row with `n/a` vanished and the sum is wrong without any warning. Which of the two behaviours would you rather have in production, and which contract (Module 2.5) would have caught the bad file at the door?

## @lesson Why Spark and the lakehouse replaced most of it, and what remains
Three changes together explained the shift:

1. **Memory and graphs.** Spark keeps intermediate data in memory and plans the whole job as one graph, instead of a chain of disk-bound jobs. For multi-step and iterative work it is much faster, and its API (DataFrames, SQL) is far friendlier than hand-written MapReduce.
2. **Object storage.** Cloud object stores (S3, GCS, Azure storage) became cheap, durable and effectively unlimited. They separate **storage from compute**: you keep data on S3 for pennies and start a cluster only while you need it. An HDFS cluster, by contrast, pays for machines (and their disks) around the clock because compute and storage live on the same boxes.
3. **Managed services and open table formats.** Operating a Hadoop cluster was hard work. Managed Spark, warehouses and Iceberg/Delta tables moved that work to the provider.

What remains, so that you speak accurately: many **on-premises** companies still run HDFS and YARN, especially large banks, telecoms and older platforms; the **Hive Metastore** and Hive-style partitioned folders are everywhere; the **Hadoop libraries** (the S3A connector, Parquet and ORC readers) sit inside Spark; and the concepts (blocks, replication, shuffle, locality, schedulers) are the vocabulary of distributed systems. Whether Hadoop skills appear in the postings of *your* market is something to check on real job posts before you decide how deep to go.

A translation table for interviews:

| Hadoop era | Today, usually |
|---|---|
| HDFS | S3, GCS or Azure storage (object storage), sometimes still HDFS |
| MapReduce | Spark (also Flink, and SQL engines such as Trino) |
| YARN | Kubernetes, or YARN on-premises, or a managed service |
| Hive tables | Iceberg or Delta tables with a catalog |
| Hive Metastore | Hive Metastore, AWS Glue Catalog, or an Iceberg catalog |
| Oozie (workflows) | Airflow or Dagster (Module 2.4) |
| HBase | Cassandra, DynamoDB or Bigtable (Module 1.7) |
| Sqoop (database import) | Debezium and Kafka Connect (Module 3.2), or Airbyte/Fivetran |
| ZooKeeper (coordination) | built-in consensus, such as Kafka's KRaft |

**Questions you can now answer:** "Why three replicas?" (failures are normal; two would leave a single copy during a failure; three also allows one copy off the rack). "What is the shuffle?" (grouping map output by key across the network; the costly step in MapReduce and Spark). "Why did Spark replace MapReduce?" (in-memory, graph planning, friendlier API). "What is the small-files problem?" (metadata objects exhaust the NameNode memory; on S3 it is the cost of listing and opening many files).

> 🛠 **Try it (10 min, Python).** Compare two ways to run an iterative job. Write 500,000 random integers (1 to 1000) to a text file, one per line. Version A re-reads and re-parses the whole file in **every** pass (the MapReduce habit); version B reads it once and keeps the list in memory (the Spark habit). Each pass does the same small update, `x = (x + sum(vals) / len(vals)) / 2`, starting from `x = 500.0`. Time both for 1 pass and for 10 passes and check that the final `x` is identical.
>
> **You should see:** the same `x` from both versions (about `500.17` after 10 passes). With 1 pass they take about the same time; with 10 passes version A is around 800 ms and version B around 115 ms, roughly seven times faster, because B pays the cost of reading once. The exact times depend on your machine; the pattern does not.

## @lab Lab: HDFS, MapReduce and YARN in miniature
Build three small, deterministic models in plain Python: HDFS block splitting, rack-aware replica placement, failure and the small-files arithmetic; a MapReduce engine (map, partition, shuffle, reduce, combiner, a reduce-side join, task retries); and a toy YARN scheduler. No cluster is needed, and the tests (38) check each behaviour the lessons describe.

### @steps
1. Read `labs/mod-3-0/hadoop_lab.py` from top to bottom. Each function's docstring has an example and says which lesson explains it.
2. Work in file order, and run the tests after EACH function:

```bash
pytest labs/mod-3-0/test_lab.py -v
pytest labs/mod-3-0/test_lab.py -v -k "Blocks or Replica"      # one group at a time
```

3. **HDFS first.** Before you write `place_replicas`, draw the six machines and three racks of the test on paper and decide by hand where the replicas of a block written from `a1` go. Then code it and compare.
4. **MapReduce next.** Write `partition` and `shuffle`, then print `lab.shuffle(pairs, 3)` for a small input and read it: this is what every reducer in a real cluster receives. Then build `run_job` and the combiner. Compare `shuffled_pairs` with and without the combiner.
5. **The join.** Write `revenue_per_city` as a reduce-side join. Predict, before you run it, what the reducer sees for one customer.
6. Experiment: change the number of reducers, the block size, or the combiner and predict each result first. Then use `metadata_objects` to work out how much NameNode memory 50 million small files would need.
7. **Do it for real.** After Module 0.2, write the code again in your own venv **without copying**, and run `python3 scripts/prove.py mod-3-0` to get the proof code for the **Proof** box on this lab page.

> 💡 **Practice Pause 6 (Full Verification & Proof Token):**
> 1. In terminal, run the complete test suite:
>    `pytest labs/mod-3-0/test_lab.py -v`
> 2. Generate the verification proof token:
>    `python3 scripts/prove.py mod-3-0`
> 3. **Success Indicator:** All 38 tests report `PASSED` (100% pass rate in < 1 second) and proof token is printed.

### @files
- labs/mod-3-0/hadoop_lab.py :: Your working file: implement the fifteen TODO functions :: starter
- labs/mod-3-0/test_lab.py :: The 38 tests that check your work :: test
- labs/mod-3-0/requirements.txt :: pytest :: config
- labs/mod-3-0/reference/hadoop_lab.py :: One possible solution (try first!) :: reference

### @deliverables
- All 38 tests pass **on your own computer, run from your own terminal** (a browser preview does not exist for this lab)
- You can explain the default HDFS replica placement and why a block survives the loss of a rack
- You can explain what a combiner changes and what it cannot change (the answer), using the numbers 13 and 7 from the word-count test
- You can explain the small-files problem with the 9,216 versus 2,097,152 objects example

### @verify
```bash
pytest labs/mod-3-0/test_lab.py -v
python3 scripts/prove.py mod-3-0
```

Known-good run: prefix the first command with `LAB_DIR=reference`.

## @chaos The forty million tiny files
### @scenario
A team ingests clickstream events into HDFS. To get data into the lake quickly, a job writes **one file per micro-batch per partition** every minute, each file a few hundred kilobytes. It works for months. After a marketing campaign the number of partitions grows, and the file count passes forty million.

First, listing directories becomes slow, and every query spends minutes just opening files. Then the NameNode begins to pause for long garbage collections, and finally it runs out of heap and restarts, taking the whole cluster with it. Every job fails with connection errors, although no DataNode and no disk has any problem. Restarting the NameNode takes more than an hour because it must reload and verify the metadata of every file.

### @cause
Each file and each block is an object in the NameNode's memory. Forty million files, each with at least one block, are about 80 million objects; at roughly 150 bytes each that is **about 12 GB** of heap just for metadata, before any workload (the same arithmetic as the lab's `metadata_objects` and `namenode_memory_bytes`: one terabyte as 1 MiB files is 227 times more objects than as 1 GiB files). HDFS was designed for few large files, and the data volume was tiny; the *count* was the problem. A monitoring dashboard that showed disk usage and CPU stayed green, because neither resource was the limit.

The same mistake on object storage (S3) does not break a NameNode, but it costs in different ways: slow listings, one request per file, and Spark spending more time opening files than reading them.

### @fix
1. Stop the writer and **compact**: merge small files into files of at least a block (128 MiB or more) with a batch job, then delete the small ones. Do it partition by partition so the cluster stays usable.
2. Change the pipeline so that it never creates tiny files: write larger batches less often, or write to a log (Kafka) and let a job produce big files, or use a table format with built-in compaction (Iceberg, Module 2.2).
3. **Monitor the object count** (files plus blocks) and NameNode heap, with alerts well before the limit, not only disk and CPU.
4. Set a policy and a check in code review: a target file size for every dataset, and a test that fails if a job writes files far smaller than that.
5. For long-term safety, partition by something with fewer values, and use **federation** or move storage to object storage where metadata is not held in one machine's memory.

### @pattern
The scarce resource is not always the obvious one. Metadata and file counts can exhaust a system that has plenty of disk and CPU, so measure the thing that actually limits you.

## @quiz
### Why does HDFS store each block on several machines by default?
- [ ] Reading from three machines at once always makes a single file download three times faster
- [x] Machines and disks fail often in a large cluster, so extra copies keep the data available
- [ ] Each copy is encrypted differently, so that an attacker would need all three to read it
- [ ] The NameNode cannot store a block's location unless the block exists on at least three nodes

> At cluster scale failure is normal. Three replicas (one off the rack) let a block survive the loss of a machine or a whole rack, and the NameNode re-replicates when a node dies.

### What does the NameNode do?
- [ ] It stores the file data and sends it to the clients that ask for it through its network card
- [x] It keeps the directory and block locations in memory, while DataNodes hold the actual bytes
- [ ] It runs the map and reduce tasks, because it knows which machine is free at any moment
- [ ] It compresses the blocks before they are written and decompresses them for every client read

> The NameNode is the directory (namespace and block map). Clients then read blocks directly from DataNodes, so file data never flows through it.

### Why are millions of small files a problem for HDFS?
- [ ] Small files cannot be replicated, so they would exist on a single machine without any extra copy
- [ ] HDFS refuses to open a file that is smaller than the block size of 128 MiB when it is read back
- [x] Each file and block is a metadata object held in NameNode memory, so the count can exhaust it
- [ ] Small files are stored uncompressed, which makes the disks of every DataNode fill up quickly

> The cost is metadata, not bytes. In the lab one terabyte as 1 MiB files needs 2,097,152 objects, 227 times more than as 1 GiB files.

### In a MapReduce word count, what is the purpose of the shuffle?
- [ ] To put the words into a random order so that no reducer receives too much of the input
- [ ] To copy the input blocks to three machines before any map task is allowed to start
- [x] To send all pairs with the same key to the same reducer, so it sees all values of each key
- [ ] To sort the final output by count so that the most frequent word is printed on the first line

> The shuffle groups map output by key across the network. It is also the expensive step, and the same operation Spark calls a shuffle.

### What does a combiner change in a MapReduce job?
- [ ] It changes the final answer, because it merges different keys that look similar before reducing
- [ ] It makes the mappers run on more machines, so that the job needs fewer reduce tasks overall
- [x] It reduces data on the map side before the shuffle, so less crosses the network, same answer
- [ ] It stores the map output in HDFS with three replicas, so that a failed mapper does not need to be re-run

> In the lab, 13 map output pairs became 7 shuffled pairs with a combiner, with an identical result. A combiner only works for operations where partial results can be combined, like sums.

### Why can a failed MapReduce task simply be started again on another machine?
- [x] A task is deterministic and its input is stored durably, so re-running it gives the same output
- [ ] The failed machine keeps a snapshot of its memory that the next machine loads before it continues
- [ ] YARN guarantees that no machine fails while it is running a task, so the case does not occur
- [ ] The reducers wait until all mappers succeed once, and the final answer is then taken from the first run

> Pure, repeatable tasks over durable inputs make retries safe. It is the same property that makes pipeline steps idempotent (Module 0.1).

### What is the Hive Metastore?
- [ ] A cache that holds the results of recent queries so that Hive can answer them without reading any files
- [ ] A special file format that stores Hive tables in HDFS with built-in transactions and time travel
- [x] A small database that records each table's schema, location and partitions over the underlying files
- [ ] The scheduler that decides which Hive query may run first when the cluster has too few free machines

> A Hive table is a description laid over files. The metastore stores that description, and it outlived Hive itself: Spark, Trino and Athena still use it or the Glue Catalog.

### Which statement best explains why Spark and cloud object storage largely replaced MapReduce and HDFS?
- [ ] MapReduce could not process more than one terabyte of data, and HDFS could not store files of any kind
- [x] Spark keeps data in memory and has a friendlier API, and object storage separates storage from compute
- [ ] Companies stopped storing data in files at all, since modern databases do not need any file formats
- [ ] Hadoop was banned by cloud providers, so every company had to switch to another vendor at the same time

> In-memory graph execution, cheap durable object storage with on-demand compute, and managed services made the old stack costly to run. The concepts (blocks, shuffle, locality) live on.

## @resources
- [Apache Hadoop: HDFS Architecture](https://hadoop.apache.org/docs/stable/hadoop-project-dist/hadoop-hdfs/HdfsDesign.html)
- [Google File System paper (2003)](https://research.google/pubs/the-google-file-system/)
- [MapReduce: Simplified Data Processing on Large Clusters (2004)](https://research.google/pubs/mapreduce-simplified-data-processing-on-large-clusters/)
- [Apache Hadoop YARN](https://hadoop.apache.org/docs/stable/hadoop-yarn/hadoop-yarn-site/YARN.html)
- [Apache Hive: Getting Started](https://hive.apache.org/docs/latest/)
