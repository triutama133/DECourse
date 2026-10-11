---
title: Beyond SQL: Key-Value, Document, Wide-Column and Graph Databases
duration: 2 weeks
summary: Learn why other database families exist, what each one is good and bad at, and how to choose by access pattern. You rebuild the core of a key-value store, a document store, a consistent-hashing ring, quorum replication and a wide-column table in plain Python, then see what a data engineer must do when data lives in such systems.
why: Bootcamps say "use MongoDB for flexible data and Cassandra for scale" and stop. Without knowing how they work you cannot choose, you cannot model data for them, and you cannot reliably get their data into a warehouse, where most data engineering work begins.
---

## @outcomes
- Explain what relational databases are good at, and which pressures led to key-value, document, wide-column and graph databases
- State the CAP theorem correctly, and explain what eventual consistency means in practice
- Choose between the database families by access pattern, and explain the trade-offs
- Explain partition keys, clustering keys, consistent hashing and quorum reads and writes, and why a bad partition key creates a hot spot
- Describe how data is extracted from such systems (change streams, exports) and why analytics should not run on operational stores
- Flatten documents into tables and handle schema drift during ingestion

## @prereq
Modules 0.3 (SQL basics) and 1.3 (indexes) help. The lab is plain Python (Module 0.0 is enough); no database needs to be installed.

## @lesson Why other databases exist
A relational database is superb at one thing: keeping **structured, related data correct** while many people read and change it, and answering **questions you did not plan for** with SQL. Tables, keys, joins and transactions (Module 0.3) solve a huge range of problems, and for most applications it is still the right first choice.

Other families appeared because of **pressures** that a single relational server handles poorly:

- **Scale and write volume.** One machine has limits. Spreading one logical database over many machines (sharding) is possible with SQL but hard, because joins and transactions across machines are slow and complicated.
- **Latency.** Some questions must be answered in a millisecond ("is this session valid?"), which suggests keeping data in memory with the simplest possible lookup.
- **Shape of data.** Some data is nested and varies from record to record (a product catalogue where every category has different attributes), or is mostly *relationships* (a social network).
- **Availability.** A shopping cart that cannot be written when one data centre is unreachable loses sales.

The NoSQL families are answers to these pressures, and each answer has a price. Their central trade is: **give up some of the general power of SQL (ad hoc queries, joins, strict transactions) to gain scale, speed or flexibility for a specific access pattern**. So the question is never "which is better" but "**how will this data be accessed?**".

Two ideas help you reason about the trade. The **CAP theorem** says that when a **network partition** happens (some machines cannot talk to others), a distributed system must choose between **consistency** (every read sees the latest write, so some requests must be refused) and **availability** (every request gets an answer, which may be stale). Partitions cannot be ruled out, so the real choice is C or A *during* a partition. **PACELC** adds the everyday case: even without a partition there is a trade between **latency** and **consistency**, because waiting for more replicas is slower. Many NoSQL systems choose availability and low latency and offer **eventual consistency**: if writes stop, all replicas converge, but a read may briefly return an old value. Others let you choose per query, as you will see with quorums.

ACID (atomic, consistent, isolated, durable transactions) is the relational promise. Some NoSQL systems relax it (sometimes jokingly called BASE: basically available, soft state, eventually consistent), and many have since added limited transactions. Always read what a specific product guarantees.

## @lesson Key-value stores: the simplest database
A key-value store is a giant dictionary: you **set** a value under a **key** and **get** it back by that key. That is all. It looks too simple to be useful, but this is exactly why it is so fast: there is nothing to plan, parse or join. Examples: **Redis**, Memcached, and DynamoDB used in its simplest form.

**Redis** keeps data in memory and also offers data *structures* as values: strings, hashes (a small dictionary), lists, sets and **sorted sets** (a set ordered by a score, perfect for leaderboards). It can write to disk (snapshots, or an append-only log) so data survives a restart, but its strength is speed, not storage of everything forever.

Two features define how key-value stores are used:

- **TTL (time to live).** A key can expire automatically after a number of seconds. Sessions, one-time passwords and cached results use this. The lab's `KeyValueStore` expires a key when `clock() >= set_time + ttl`; the clock is injected so tests do not need to sleep.
- **Eviction.** Memory is finite. When the store is full it must remove something; **LRU** (least recently used) removes the key that has been untouched the longest. The lab implements this with an ordered dictionary, where every `get` or `set` moves the key to the "recent" end.

**What it is for:** caching the result of an expensive query, sessions, rate limiting (count requests per user per minute), counters, leaderboards, feature flags, queues of small jobs. **What it is not for:** asking "all customers in Jakarta who spent over 1 million", because the only way in is the key. If you need to find data by something other than its key, you must maintain extra keys yourself, and at that point another family is probably a better fit.

A data engineer meets key-value stores as the *serving layer* of pipelines (feature stores, real-time lookups) and as caches that make a pipeline's data appear stale. Remember that a cache is a **copy**: when the source changes, the copy is wrong until it expires or is invalidated.

## @lesson Document databases: flexible shapes
A document database stores **documents**, usually JSON (MongoDB stores a binary form called BSON; limit 16 MB per document), grouped into **collections**. A document can contain nested objects and arrays, and two documents in the same collection can have different fields. Examples: **MongoDB**, Couchbase, Firestore.

```json
{ "_id": "1001", "customer": {"name": "Sari", "city": "Jakarta"},
  "items": [ {"sku": "KS-1", "qty": 2}, {"sku": "ES-9", "qty": 1} ], "status": "paid" }
```

The whole order, with its lines, is **one document**: you read and write it in one operation, with no join. That is the central modelling choice, **embedding versus referencing**. Embed data that is read together and belongs to the parent (order lines in an order). Reference (store an id) data that is shared or grows without limit, as with all orders of a customer, which would make a single customer document grow forever.

The database has **no enforced schema by default**; the structure is whatever the application wrote. This is **schema on read**, the same idea as Hive (Module 3.0). It is fast to start and dangerous later: a field spelled two ways, a number stored as text in some documents, a field missing in old ones. Validation rules exist, but you must turn them on.

You query with a document-shaped language: `{"customer.city": "Jakarta", "total": {"$gte": 100000}}` (the lab's `DocumentStore.find` supports dotted paths and the operators `$gt $gte $lt $lte $ne $in`). **Indexes** matter exactly as in SQL: without one, a query **scans every document**. In the lab, finding one user among 10,000 documents scans **10,000** documents without an index, and **10** with one. An aggregation pipeline (filter, group, sort, project in stages) covers analytics-style questions, and since version 4.0 MongoDB supports multi-document transactions, though the design goal remains keeping related data in one document.

**What it is for:** content, catalogues, user profiles, anything nested and evolving, where an application reads whole objects. **Pitfalls:** unbounded arrays inside documents, no joins (so repeated data must be updated in many places), and schema drift.

**For data engineers** this is the commonest NoSQL source. Documents must be **flattened** into rows: a nested object becomes columns (`customer_city`), an array becomes a child table with one row per element and the parent's id (the `items` above become an `order_items` table). Plan for fields that appear and disappear, and for type changes, with the contract ideas of Module 2.5.

## @lesson Wide-column and partitioned stores: scale by design
Cassandra, ScyllaDB, DynamoDB, Bigtable and HBase are built to spread data over **many machines** and keep working when some fail. Despite the name "wide-column", the best way to understand them is the **primary key**, which has two parts:

- The **partition key** decides *which machine(s)* store the row. All rows with the same partition key live together.
- The **clustering key** (DynamoDB: sort key) decides the **order of rows inside** a partition, which is physically sorted.

The lab's `WideColumnTable("customer_id", "order_ts")` models this: all orders of one customer form one partition, sorted by time, so "the last 10 orders of customer 7" or "orders of customer 7 in January" is a fast read of **one** sorted slice. Asking for "all orders in January for every customer" has no efficient answer, and the lab refuses a query without the partition key. This is **query-first modelling**: in a relational database you design tables from the data and write any query later; here you **list the queries first**, then design one table per query, repeating (denormalising) data as needed. It is the biggest mental shift.

**How partitions are placed.** The naive way is `hash(key) % number_of_nodes`, but when you add one node almost every key moves. The lab measures it on 10,000 keys going from 4 to 5 nodes: **modulo hashing moves 79.5% of the keys**. **Consistent hashing** puts nodes (and many *virtual* positions per node) on a ring; a key belongs to the next node clockwise. Adding a node takes over only its share: the lab's `HashRing` moves **19.9%** of the keys, about one fifth, and every moved key goes to the new node. Virtual nodes matter for balance: with one position per node the three nodes of the lab held 0.2%, 99.4% and 0.4% of the keys; with 200 positions each they held 28%, 33% and 39%.

**Replication and tunable consistency.** Each partition is copied to *N* replicas (commonly 3). A write is acknowledged after **W** replicas confirm; a read asks **R** replicas and returns the newest version. If **R + W > N**, any read set overlaps any write set, so a read **must** see the latest acknowledged write. With N = 3: W=2, R=2 is safe (the "quorum"); W=1, R=1 is fast but can return stale data; W=3, R=1 is safe for reads but writes fail if any replica is down. The lab's `ReplicaSet` demonstrates exactly this, including `Unavailable` when too few replicas are up. You pay in latency and availability for consistency, which is PACELC in practice.

**Writes are cheap** because of the log-structured design: a write is appended to a commit log and a memory table, then flushed to immutable sorted files (SSTables) that are merged later (**compaction**). A delete does not erase: it writes a **tombstone**, which is removed only after a safe period; many tombstones slow reads.

**What goes wrong:** a **hot partition** (one partition key receiving most of the traffic, such as the current date) overloads one machine while the others sleep; a partition that grows without bound; and queries that need a full scan. **DynamoDB** adds managed operation and a hard limit of 400 KB per item, and you pay by capacity or by request.

## @lesson Graph, search, time-series and the rest
Some access patterns are none of the above.

**Graph databases** (Neo4j, Amazon Neptune) store **nodes** and **relationships** (edges), both with properties, and make *following relationships* the fast operation. In SQL, "friends of friends of friends" needs one self-join per hop and gets slow quickly; a graph database walks the edges directly. Use them when the questions are about connections: fraud rings (accounts sharing devices and addresses), recommendations, network and dependency analysis, data lineage. Neo4j's query language is Cypher, for example `MATCH (a:Account)-[:USES]->(d:Device)<-[:USES]-(b:Account) RETURN a, b`. They are not the first choice for tabular reporting.

**Search engines** (Elasticsearch, OpenSearch) build an **inverted index** (word to list of documents) so they can match text, rank results by relevance and filter at speed. They are for search boxes and log exploration, not the system of record.

**Time-series databases** (TimescaleDB, InfluxDB) are tuned for append-heavy data indexed by time (metrics, sensor readings), with automatic retention and downsampling. **Vector databases** store embeddings for similarity search (Module 3.5). Many of these are features of other systems: PostgreSQL does time series with extensions and vector search with pgvector.

The lesson to keep: a database family is a set of **optimisations for an access pattern**. If you know the pattern, the family usually follows; if you do not know the pattern, start with a relational database and learn it first.

## @lesson Choosing, and what a data engineer does with them
A short decision guide, driven by how the data is read:

| The main access pattern | Usually |
|---|---|
| Many different questions, joins, strict correctness | relational (PostgreSQL, MySQL) |
| Look up one thing by an id, fast; cache; session; counter | key-value (Redis, DynamoDB) |
| Read and write whole nested objects; shape varies | document (MongoDB) |
| Huge write volume, known queries by key and time, always on | wide-column (Cassandra, DynamoDB, Bigtable) |
| The question is about relationships and paths | graph (Neo4j) |
| Free text and relevance | search engine (Elasticsearch) |
| Metrics over time | time-series |
| Analytics over huge history | **not these**: a warehouse or lakehouse (Modules 2.2 and 2.6) |

Companies use several at once (**polyglot persistence**): PostgreSQL for orders, Redis for sessions, Elasticsearch for search, Cassandra for events. That multiplies the places where data lives, which is why data engineers exist.

**Your job around them.**

1. **Never run analytics on an operational store.** A scan over a production MongoDB or Cassandra competes with customers and often fails on timeouts. Copy the data to an analytical store.
2. **Extract incrementally.** Use the system's change feed: MongoDB change streams, DynamoDB Streams, Cassandra CDC, or Debezium connectors (Module 3.2). Fall back to full exports to object storage for small or rarely changing data.
3. **Flatten and type.** Convert documents into tables as in lesson 3, decide how to handle missing and polymorphic fields, and record the schema you assumed.
4. **Mind consistency.** Reading from a replica can return old data, and a snapshot taken while writes continue may be inconsistent across partitions. Record when and from where you read.
5. **Respect the access pattern.** If you must query by an attribute the store does not index, ask the application team to add an index or a derived table, instead of scanning.

You can now answer the usual questions: "Why not MongoDB for everything?" (no joins, schema drift, limited analytics). "What is a partition key?" (decides placement and the unit of scaling). "What does R + W > N mean?" (reads overlap writes, so they see the latest write, at a cost in latency and availability). "Why consistent hashing?" (adding or removing a node moves a small share of keys instead of nearly all).

## @lab Lab: five database ideas in plain Python
Build five small, deterministic models: a **key-value store** with TTL and LRU eviction, a **document store** with queries and indexes, a **consistent-hashing ring**, **quorum replication**, and a **wide-column table**. The tests (36) check each behaviour the lessons describe, including the numbers: the index that cuts a scan from 10,000 documents to 10, modulo hashing that moves 79.5% of the keys against 19.9% for the ring, and the quorum rule.

### @steps
1. Read `labs/mod-1-7/nosql_lab.py` from top to bottom. Each class docstring is the specification, with the lesson that explains it.
2. Work in file order and run the tests after EACH class:

```bash
pytest labs/mod-1-7/test_lab.py -v
pytest labs/mod-1-7/test_lab.py -v -k TestKeyValueStore       # one group at a time
```

3. **Key-value first.** Predict, before you run, what `keys()` returns after `set a, set b, get a, set c` with `max_items=2`. Then write the class and check.
4. **Documents.** Build `insert` and a plain `find`; then operators; then the index. Print `last_scanned` before and after `create_index` and write down the difference.
5. **The ring and the quorum.** After `HashRing` passes, measure for yourself how many of 10,000 keys move with `zlib.crc32(key) % n` when n goes from 4 to 5, and compare with your ring. For `ReplicaSet`, fill in a table of (R, W) pairs for N = 3 and mark which can return stale data; check it with your code.
6. **Wide-column.** Predict what `query` does with a missing partition key and why a real system refuses it.
7. **Do it for real.** After Module 0.2, write the code again in your own venv **without copying**, and run `python3 scripts/prove.py mod-1-7` to get the proof code for the **Proof** box on this lab page.

### @files
- labs/mod-1-7/nosql_lab.py :: Your working file: implement the five TODO classes :: starter
- labs/mod-1-7/test_lab.py :: The 36 tests that check your work :: test
- labs/mod-1-7/requirements.txt :: pytest :: config
- labs/mod-1-7/reference/nosql_lab.py :: One possible solution (try first!) :: reference

### @deliverables
- All 36 tests pass **on your own computer, run from your own terminal**
- You can explain why `R + W > N` guarantees that a read sees the latest write, and name one (R, W) pair for N = 3 that can return stale data
- You can explain why consistent hashing moves far fewer keys than modulo hashing, using the numbers 19.9% and 79.5%
- You can say which family you would choose for sessions, for an order catalogue with varying attributes, and for a very high write rate of sensor readings, and why

### @verify
```bash
pytest labs/mod-1-7/test_lab.py -v
python3 scripts/prove.py mod-1-7
```

Known-good run: prefix the first command with `LAB_DIR=reference`.

## @chaos The partition key that was a date
### @scenario
A team moves an event log from PostgreSQL to a wide-column store "to scale". The table is designed as `PRIMARY KEY (event_date, event_id)`: the partition key is the date, the events of one day are sorted by id. In tests, with a few thousand rows, everything is fast. The queries are exactly what the product needs: "all events of a given day".

In production, on a day of 20 million events, the problems begin at midnight. Every write of the current day goes to **one partition**, which lives on three machines of a cluster of thirty. Those three machines hit 100% CPU, write latency rises from milliseconds to seconds, writes start timing out and are retried, and the retries make it worse. The other twenty-seven machines are almost idle. Adding machines changes nothing. The next morning, with the day finished, the old partition is perfectly quiet and the new day repeats the problem.

### @cause
The partition key decides where data lives, and a **date is a low-cardinality key that grows all day in the same place**: at any moment, all writes share one value. The cluster's capacity is the sum of its machines only if the load is spread; with one hot partition the capacity is that of three machines. The lab shows the same effect in miniature: with one virtual position per node the ring put 99.4% of keys on one node; and a `WideColumnTable` partitioned by a constant has all its rows in a single partition, no matter how many nodes exist.

The query "all events of a day" looked like the access pattern, but it was a **read** pattern. The **write** pattern (what is written at the same moment) is just as important when choosing a partition key.

### @fix
1. Change the partition key to something with **high cardinality that spreads writes**: for example `(event_date, bucket)` where `bucket = hash(event_id) % 64`, or `(customer_id, event_date)`. Reading a whole day then means querying all 64 buckets in parallel and merging, which is a deliberate trade.
2. Keep the **partition size bounded** (a partition should not grow without limit): include a time bucket such as the hour in the key.
3. **Test with realistic skew**, not a few thousand even rows: load-test with the real peak rate and look at the per-partition and per-node load, not the cluster average.
4. **Monitor per-partition metrics** (hottest partition, throttled requests), not just average CPU. DynamoDB and Cassandra both expose them.
5. For analytics ("all events of a day for every customer"), do not use this table: stream the events to a lakehouse (Module 2.2) and query there.

### @pattern
Design the partition key for the write pattern as well as the read pattern. The capacity of a distributed store is only as large as the spread of its load.

## @quiz
### In a key-value store, what does a TTL do?
- [ ] It limits how many keys the store may hold, and it removes the oldest key when the limit is reached
- [x] It makes a key expire automatically after some seconds, so sessions and caches clean themselves up
- [ ] It sets the number of replicas that must confirm a write, so that the store can stay consistent
- [ ] It sorts the keys by the time of their last change, so that range queries by time become possible

> TTL is expiry (time to live). The size limit with LRU eviction is a different feature, and replica counts are a replication setting.

### Why does an index make a document query much faster?
- [ ] It copies the whole collection to memory so that every query can run without touching the disk at all
- [ ] It removes duplicate documents from the collection so that fewer documents have to be compared
- [x] It lets the database jump straight to the matching documents instead of scanning all of them now
- [ ] It converts every document to a table row, so that the database can use an ordinary SQL join

> In the lab, finding one user among 10,000 documents scanned 10,000 documents without an index and 10 with one.

### What does the CAP theorem say about a network partition?
- [ ] A system can only be partitioned when it uses a relational database with strict transactions
- [ ] A partition makes consistency and availability both impossible, so the system must be stopped
- [x] In a partition a system must pick consistency (refusing requests) or availability (stale answers)
- [ ] The system can always keep both consistency and availability if it adds more replicas of every item

> Partitions cannot be ruled out in a distributed system, so the real choice is between C and A while one lasts. PACELC adds latency versus consistency when there is no partition.

### With N = 3 replicas, which setting guarantees that a read sees the latest acknowledged write?
- [ ] W = 1 and R = 1, because the single replica that took the write is also the one that serves reads
- [x] W = 2 and R = 2, because R + W is greater than N, so each read set always overlaps each write set
- [ ] W = 1 and R = 2, because reading from more replicas than were written always finds the newest value
- [ ] Any setting, as long as the replicas are in different data centres and have fast network links

> The rule is R + W > N. With W = 1 and R = 2 the sets of 1 and 2 out of 3 replicas need not overlap, and the lab's ReplicaSet shows a stale read.

### Why is consistent hashing preferred to `hash(key) % number_of_nodes` when the cluster changes size?
- [ ] It makes the hash function itself faster to calculate, so every lookup of a key costs less time
- [ ] It guarantees that every node holds exactly the same number of keys, however skewed the data is
- [x] Adding or removing a node moves only a small share of the keys, instead of nearly all of them
- [ ] It removes the need for replication, because every key is automatically stored on every node

> In the lab, going from 4 to 5 nodes moved 79.5% of 10,000 keys with modulo hashing and 19.9% with the ring. Virtual nodes keep the balance even.

### What does "query-first modelling" mean for a wide-column database such as Cassandra?
- [ ] You write the application's queries only after the tables exist, because the database will adapt to them
- [x] You list the queries first and design one table for each query, repeating data where that is needed
- [ ] You normalise all data into third normal form so that any query can be answered with joins
- [ ] You let the database choose the partition key by analysing the first queries it sees after launch

> These stores answer queries by partition key efficiently and cannot join, so tables are shaped by their queries and data is duplicated on purpose.

### A table is partitioned by event date, and the current day receives all the writes. What is the most likely problem?
- [ ] The cluster runs out of disk space on every machine at the same moment because of the date format
- [ ] The queries by date fail, because a date cannot be used as a partition key in any such database at all
- [x] A hot partition: one partition's machines are overloaded while the rest of the cluster is nearly idle
- [ ] The replicas disagree about the date, so reads return the data of the wrong day to the application

> The partition key decides placement, and a date concentrates all current writes in one place. Add a bucket or use a high-cardinality key.

### Why should analytics not run directly on an operational NoSQL store, and what is done instead?
- [ ] NoSQL stores cannot be read by more than one client, so the data is exported once a year
- [ ] Analytics needs the data to be encrypted, which operational stores are never allowed to do
- [x] Big scans compete with customers and often time out, so the data is copied to a warehouse
- [ ] Operational stores delete their data every day, so analysts must copy it before it disappears

> Operational stores serve one access pattern. Extract incrementally with change streams or CDC, flatten the documents, and query the copy.

## @resources
- [Redis documentation: data types](https://redis.io/docs/latest/develop/data-types/)
- [MongoDB manual](https://www.mongodb.com/docs/manual/)
- [Apache Cassandra documentation](https://cassandra.apache.org/doc/latest/)
- [Amazon DynamoDB Developer Guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
- [Neo4j: Cypher manual](https://neo4j.com/docs/cypher-manual/current/)
- [Dynamo: Amazon's Highly Available Key-value Store (paper)](https://www.allthingsdistributed.com/2007/10/amazons_dynamo.html)
