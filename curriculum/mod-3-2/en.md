---
title: Event Streaming and Change Data Capture (CDC)
duration: 3 weeks
summary: Understand Kafka's log, partitions, offsets and consumer groups, the delivery guarantees that follow, and how PostgreSQL changes become a reliable event stream through the write-ahead log, with working code at each level.
why: Tutorials push random messages into Kafka and print them. Real systems must handle duplicates after a crash, consumer lag, poison messages, and a database whose replication slot can fill the disk when a connector stops.
---

## @outcomes
- Explain the log abstraction (topics, partitions, offsets, retention, compaction) and how keys give ordering and scale
- Reason about producer and consumer delivery guarantees (at-most-once, at-least-once, exactly-once effect) and make a consumer idempotent
- Explain leaders, followers and in-sync replicas, what `acks=all` with `min.insync.replicas` guarantees, and what a broker failure looks like
- Describe consumer groups, assignment, rebalances and lag, and monitor them
- Explain how log-based CDC reads PostgreSQL's WAL (publications, slots, replica identity) and what a Debezium event contains
- Consume CDC events into a replica that stays correct under duplicates and reordering, and identify the operational risks
- Evolve a schema safely with a schema registry (compatibility modes, defaults, upgrade order) and read the registry's wire format

## @prereq
Modules 1.2 (idempotency), 2.2 (table formats) and 2.4 (orchestration). Part A of the lab needs no installation. Part B needs a Kafka-compatible broker (`docker compose up -d redpanda`, or any Kafka). Part C needs PostgreSQL with logical decoding (an embedded one is installed by `pip`).

## @lesson The log: why streaming exists
Until now data moved in **batches**: a job copies yesterday's rows. Many needs are different: fraud checks within seconds, a dashboard that updates as orders arrive, a search index that follows the product database, ten teams that all want the same stream of events without hammering the source. For these, systems exchange **events** continuously.

The central idea of Apache Kafka (and Redpanda, which speaks the same protocol) is a deceptively simple data structure: the **log**, an **append-only, ordered, durable sequence of records**. Producers append to the end; consumers read from any position and remember where they are. Records are **not deleted when read**; they stay until a retention rule removes them.

This differs from a traditional message queue, where a message is delivered once and then gone:

| | Queue | Log (Kafka) |
|---|---|---|
| After a read | The message is removed | The record stays; readers keep their own position |
| Many consumers | Compete for messages | Each group reads the full stream independently |
| Replay | Not possible | Rewind to any offset: reprocess history, recover from bugs |
| Ordering | Often weak | Guaranteed within a partition |

That **replayability** is what makes logs a foundation for data platforms: a new consumer can start from the beginning; a bug in a consumer is fixed by resetting its offset and re-reading; producers and consumers are **decoupled** in time and speed.

Typical uses for data engineers: **change data capture** (database changes as events, below), clickstream and application events, a buffer between systems, and feeding stream processing (Module 3.3) and lakehouse tables (Module 2.2).

## @lesson Kafka's building blocks: topics, partitions, offsets, replication
- A **topic** is a named stream, such as `orders`.
- A topic is split into **partitions**. Each partition is its own log, ordered and independent. **The partition is the unit of parallelism and of ordering.**
- Every record in a partition has an **offset**, a sequence number starting at 0. A record's identity is (topic, partition, offset).
- A **producer** chooses the partition for each record. If the record has a **key**, a hash of the key decides the partition, so **all records with the same key go to the same partition, in order**. With no key, records are spread across partitions. (The hash is a client setting: the Java client defaults to *murmur2*, while librdkafka-based clients default to a CRC32-based partitioner, so the same key can land on different partitions depending on the producer library. Use one client family per topic, or set the partitioner explicitly.)
- **Brokers** are the servers that store partitions. Each partition is **replicated**: one broker holds the **leader** (handles reads and writes) and others hold **followers**. The followers that are caught up form the **in-sync replicas (ISR)**. A typical production topic uses replication factor 3.

Ordering is the property people misunderstand. Kafka guarantees order **only within a partition**. If all of customer 7's events must be processed in order, give them the same key (`customer_id`) so they share a partition; events of different customers may interleave freely, which is fine. Choose keys that match the order you need and that spread load evenly (a hot key gives you a hot partition: skew again, Module 3.1).

**How many partitions?** Partitions set the maximum parallelism of a consumer group (below) and the throughput of a topic. Too few limits scale; too many adds overhead and, importantly, you can **increase but not decrease** a topic's partitions, and increasing changes which partition a key maps to, breaking per-key ordering for existing data. Plan with headroom (for example 6 to 30 for a moderate topic) rather than guessing small.

**Retention.** By default Kafka deletes records older than a retention time (7 days) or beyond a size limit. Setting `cleanup.policy=compact` instead keeps **the latest record per key** forever: log compaction, which turns a topic into a changelog of the *current state* of each key. A record with a key and a **null value** is a **tombstone** that tells compaction to remove the key. Compacted topics are how a table's current state is stored in Kafka.

**Durability** depends on settings: `replication.factor` and `min.insync.replicas` say how many copies must acknowledge a write; together with the producer's `acks=all` they mean an acknowledged write survives the loss of a broker.

The lab's Part A has you build these ideas in a miniature in-memory Kafka, so the rules become concrete: stable key-to-partition mapping, per-partition offsets, lag, range assignment, and compaction with tombstones. (It uses a CRC hash for determinism; real Kafka uses murmur2. The behaviour, not the hash function, is the lesson.)

> 💡 **Practice Pause 1 (MiniLog Topic, CRC32 Partitioning & Log Compaction):**
> 1. Open `labs/mod-3-2/minilog.py` in your text editor. Do not execute this file directly in terminal without pytest.
> 2. Implement class `Topic`: methods `__init__`, `partition_for(key)` using `zlib.crc32(str(key).encode()) % partitions` (or round-robin if key is `None`), `produce(key, value)`, `end_offsets()`, and `compact()`.
> 3. Run the tests in terminal:
>    `pytest labs/mod-3-2/test_minilog.py -k "TestProducing or TestCompaction" -v`
> 4. **Success Indicator:** All 7 tests report `PASSED`, verifying sequential per-partition offsets, deterministic key-to-partition affinity, and proper compaction with tombstone deletion.

## @lesson Inside the cluster: leaders, in-sync replicas and surviving a broker failure
"Replication factor 3" is easy to say. What actually happens when a broker dies? We ran a real three-broker Apache Kafka 4.0.0 cluster (KRaft mode, no ZooKeeper; `labs/mod-3-2/cluster/docker-compose.yml`) and broke it on purpose. First the topic:

```text
$ kafka-topics.sh --create --topic orders --partitions 3 --replication-factor 3 --config min.insync.replicas=2
$ kafka-topics.sh --describe --topic orders
Partition: 0  Leader: 2  Replicas: 2,3,1  Isr: 2,3,1
Partition: 1  Leader: 3  Replicas: 3,1,2  Isr: 3,1,2
Partition: 2  Leader: 1  Replicas: 1,2,3  Isr: 1,2,3
```

Each partition has one **leader** (all reads and writes go through it) and two **followers** that continuously fetch from the leader to copy its log. `Replicas` lists the brokers that should hold a copy (the first is the *preferred* leader, so leaders are spread over the brokers). `Isr` lists the **in-sync replicas**: the followers that are caught up. Only an in-sync replica may become leader, which is why a new leader never lacks an acknowledged record.

**What `acks=all` and `min.insync.replicas` mean together.** With `acks=all`, the leader answers only after **every replica currently in the ISR** has the record. `min.insync.replicas=2` adds a floor: if the ISR is smaller than 2, the leader **refuses** the write instead of accepting it with fewer copies. So `replication.factor=3`, `min.insync.replicas=2` and `acks=all` is the standard recipe: any single broker can fail without losing an acknowledged record *and* without stopping writers.

**Experiment 1: crash the leader under load.** We started a producer sending 20 records per second with `acks=all` and, after about 9 seconds, killed (`docker kill`, a crash, not a clean shutdown) the broker leading partition 0. The producer received `NOT_LEADER_OR_FOLLOWER`, **retried by itself**, and finished: all 500 records were delivered, the slowest took **7.46 seconds**, and the throughput in that interval fell from 20 to 7.5 records per second. `describe` then showed the survivors as the new world: `Leader: 3, Isr: 3,1`. After the broker was restarted it rejoined every ISR (`Isr: 3,1,2`) within the 40 seconds we waited, but leadership stayed with broker 3; Kafka moves leaders back to the preferred broker later, in the background. The final offsets summed to **507 = 6 + 500 + 1**, exactly the records we sent: no loss and no duplicates, because the Java producer is idempotent by default when `acks=all` (since Kafka 3.0).

**Experiment 2: the cost of a strict floor.** We made a second topic with `min.insync.replicas=3` (every replica must be present) and killed one broker. Producers with `acks=all` failed with **`NOT_ENOUGH_REPLICAS`** until the broker returned: the topic had chosen *consistency over availability*. A producer with `acks=1` kept succeeding, writing to a leader with only two copies: **availability won and the durability promise was silently lowered**. The topic with `min.insync.replicas=2` accepted `acks=all` writes with one broker down, which is why 2 is the usual value. Remember that `acks=1` or `acks=0` can lose a record that was acknowledged only by a leader that then crashed.

**Watch for it.** `kafka-topics.sh --describe --under-replicated-partitions` lists partitions with fewer in-sync replicas than replicas (in the experiment: all four partitions while one broker was down), and `--under-min-isr-partitions` lists those that **refuse `acks=all` writes** (the strict topic). Both should be empty and are the first alerts of a Kafka operator. Related settings: `unclean.leader.election.enable` (default `false`) would let an *out-of-sync* replica become leader when no in-sync one exists, restoring availability by **throwing away acknowledged records**; leave it off for important data. Rack-aware placement (`broker.rack`) spreads the replicas over failure zones.

**Who decides the leaders?** In KRaft mode a quorum of **controller** nodes keeps the cluster metadata with the Raft protocol and elects partition leaders. In our small cluster every node was both broker and controller. The broker we killed in the first attempt was also the active controller, and the others elected a new one within **5 seconds** (the log shows the new controller recorded exactly 5.0 s after the kill). Raft needs a **majority**: three controllers survive one failure, five survive two. Production clusters therefore run 3 or 5 dedicated controller nodes separate from the brokers, so a busy broker cannot starve the cluster's brain.

## @lesson Producers and consumers: delivery guarantees
**Producers.** Important settings:

- **`acks`**: `0` (do not wait), `1` (wait for the leader), `all` (wait for all in-sync replicas). Use `all` when you cannot lose data.
- **Retries and idempotence.** Networks fail, so the producer retries; a retry after a lost acknowledgement could write the record twice. The **idempotent producer** (`enable.idempotence=true`) attaches sequence numbers so the broker discards duplicates caused by retries within a partition, and keeps ordering. Use it. (The Java client enables it by default since Kafka 3.0; clients built on librdkafka, such as the `confluent-kafka` package used in the lab, need it set explicitly.)
- **Batching** (`linger.ms`, `batch.size`) and **compression** trade a little latency for much higher throughput.
- **Always handle delivery callbacks.** `produce()` is asynchronous: it queues the message. A failure is reported later in the callback. Ignoring it loses data silently. Call `flush()` before exit.

**Consumers and offsets.** A consumer reads in a loop (`poll`) and, after processing, **commits** its offsets, stored in Kafka itself. After a restart, a consumer in the same **group** resumes from the last committed offset. *When* you commit defines your delivery guarantee:

| Commit timing | If the consumer crashes between processing and commit | Guarantee |
|---|---|---|
| **Before** processing | The record is skipped: it was committed but never processed | **At-most-once** (may lose) |
| **After** processing | The record is processed again | **At-least-once** (may duplicate) |
| After processing, **with an idempotent effect** | Processed again, but the repeat changes nothing | **Exactly-once *effect*** |

The mainstream choice is **at-least-once with idempotent processing**: commit after processing, and make processing safe to repeat (an upsert by key, a write keyed by `(partition, offset)`, a deduplication table). The lab tests this directly: a crash before commit makes some records appear twice, and a consumer that remembers `(partition, offset)` ends with exactly one effect per record. (Kafka also offers **transactions** for exactly-once between Kafka topics, with consumers reading only committed data; they help for Kafka-to-Kafka processing, but writing to an external system still needs an idempotent write.)

**Consumer groups.** Consumers with the same `group.id` **share** a topic: each partition is assigned to **exactly one** member of the group at a time. Two groups (billing and analytics) each receive the full stream independently. Consequences:

- The maximum useful parallelism of a group is **the number of partitions**; extra consumers sit idle.
- Assignment is computed (the lab's range assignment gives each member a contiguous block) and **rebalanced** when members join, leave or crash. During a classic ("eager") rebalance all consumers briefly stop; the **cooperative sticky** assignor moves only the partitions that must move.
- A consumer that does not call `poll` within `max.poll.interval.ms` (5 minutes by default) is considered dead and removed from the group; a consumer that stops sending heartbeats is dropped after `session.timeout.ms`. A slow, blocking processing step can therefore cause **rebalance storms**: do heavy work outside the poll loop or in bounded batches.

**Lag** is how far behind a group is: for each partition, the end offset minus the committed offset. It is **the** key health metric of a streaming pipeline. Rising lag means consumers are slower than producers. Monitor it, alert on it, and know what normal looks like. Part B of the lab reads it from a real broker: a new group over 60 messages shows a lag of 60, and 0 after consuming.

**Poison messages.** One record that your code cannot process (malformed, unexpected) must not block the partition forever, and must not be dropped silently. Catch the error, send the record (with the error and its coordinates) to a **dead-letter topic**, commit, and continue: the same quarantine pattern as Module 1.2.

> 💡 **Practice Pause 2 (Consumer Groups, Range Assignment & Idempotent Commit):**
> 1. Open `labs/mod-3-2/minilog.py` in your text editor.
> 2. Implement `assign(partitions, members)` using contiguous range assignment.
> 3. Implement class `Consumer`: `__init__` (resuming from committed offset), `poll(max_records)`, `commit()`, and `lag(group)` on `Topic`.
> 4. Run the tests in terminal:
>    `pytest labs/mod-3-2/test_minilog.py -k "TestConsuming or TestGroupsAndAssignment" -v`
> 5. **Success Indicator:** All 8 tests report `PASSED`, confirming non-overlapping partition allocation, committed offset resumption, and idempotent recovery from mid-poll consumer crashes.

## @lesson Schemas, serialisation and Kafka Connect
Records are bytes; you choose the format. **JSON** is easy to read and debug but verbose and with no enforced structure. **Avro** and **Protobuf** are compact, typed and designed for evolution. With them you normally run a **schema registry**: a service that stores schemas, gives each a numeric id embedded in the message, and enforces **compatibility rules** when a schema changes (backward: new readers can read old data; forward: old readers can read new data; full: both). This is the streaming counterpart of the data contracts of Module 2.5: a producer cannot publish an incompatible change without being told.

**Kafka Connect** is the framework for moving data in and out of Kafka **without writing code**. **Source connectors** pull from a system into topics (the Debezium PostgreSQL connector is one); **sink connectors** push topics into systems (object storage, Iceberg, warehouses, search indexes). Connect handles scaling, offset tracking, retries and converters (JSON, Avro), and lets you apply small **single message transforms (SMTs)**. Misbehaving sink records can be routed to a dead-letter topic. For a first version of "database to lakehouse", a Debezium source plus a sink connector is often all you need.

## @lesson Schema Registry in practice: evolving a topic without breaking consumers
The schema registry from the previous lesson becomes real when a team wants to *change* a message. We ran Redpanda's built-in registry, which speaks the same REST API as Confluent's, with an Avro subject `orders-value` and the default rule, **BACKWARD** ("a consumer using the new schema can read data written with the old one"). Starting from `{id: int, customer: string, total: int}`, we asked the registry whether each change is allowed:

| Change to the schema | BACKWARD | FORWARD | FULL |
|---|---|---|---|
| Add an **optional** field (`["null","string"]`, default `null`) | accepted | accepted | accepted |
| Add a **required** field with no default | **rejected** | accepted | **rejected** |
| **Remove** a field that has no default (`total`) | accepted | **rejected** | **rejected** |

(The columns come from tests on the same subject after switching its compatibility setting. Changing a type, `int` to `string`, was **rejected** under BACKWARD, because Avro can only promote numeric types, for example `int` to `long`.) Registering a rejected schema returns **HTTP 409** with the reason, for example `READER_FIELD_MISSING_DEFAULT_VALUE: the field 'channel' has no default value and is missing in the old schema`. The registry therefore stops a producer team from shipping a breaking change; it **does not** make your consumers correct, only the two schemas compatible.

Practical rules:

- **Always give new fields a default** (or make them optional). This is the single habit that keeps you out of trouble.
- **Never reuse a field name with a different meaning or type.** Add a new field, migrate readers, and retire the old one later.
- **Choose the order of upgrades.** BACKWARD means *upgrade consumers first* (they can read old and new data); FORWARD means *upgrade producers first*; FULL allows either order. Compatibility **across all versions** (`BACKWARD_TRANSITIVE`) matters when old data stays in the topic for months or forever, as in a compacted topic.
- **Test the change before registering** with the `/compatibility/subjects/<subject>/versions/latest` endpoint in CI. A failed check in CI is cheaper than an incident.

**What is in the message.** With a registry the producer does not embed the schema in every record. We produced `{"id":1,"customer":"Budi","total":150000}` through the registry and read the raw bytes: `00 00000001 02 08 42756469 e0a712`. The first byte is a **magic byte** (0), the next four bytes are the **schema id** (1), and the rest is the compact Avro binary: **16 bytes in total, against 41 bytes of the same record as JSON**. The consumer reads the id, fetches (and caches) the schema from the registry, and decodes. That is also why a registry outage hurts only consumers that meet an id they have not cached.

**Where stream processing fits.** Kafka itself stores and delivers records; transforming them is another layer. **Kafka Streams** is a Java library you embed in your own application (no separate cluster) to filter, join and aggregate topics, keeping its state in local stores backed up to *changelog topics* in Kafka. **ksqlDB** offers SQL over topics. **Flink** and **Spark Structured Streaming** (Module 3.3) are separate engines for larger or more complex jobs. This is a description from the projects' documentation: the lab does not run them.

## @lesson Change data capture: turning a database into a stream
How do you get an operational database's changes into the platform? The naive way is **query-based**: every few minutes, `SELECT * FROM orders WHERE updated_at > :last_run`. Problems: it **misses deletes** (a deleted row is simply gone), it misses intermediate states (two updates between polls look like one), it needs a reliable `updated_at`, and it puts repeated load on the production database.

**Log-based CDC** reads the database's own record of changes. PostgreSQL writes every change to the **write-ahead log (WAL)** *before* applying it, for crash recovery and replication. With `wal_level = logical`, the WAL contains enough information to reconstruct row-level changes, and PostgreSQL offers **logical decoding** to stream them. The pieces:

- A **publication** declares which tables to publish (`CREATE PUBLICATION pub FOR TABLE orders`).
- A **replication slot** is a server-side bookmark for one consumer: PostgreSQL promises to **keep all WAL the slot has not yet confirmed** (`pg_create_logical_replication_slot('slot', 'pgoutput')`).
- An **output plugin** formats the changes; **pgoutput** is the built-in binary format that Debezium reads.

The lab's `pgoutput.py` decodes that real binary stream. Seeing it demystifies CDC: a transaction arrives as `Begin`, a `Relation` message describing the table's columns, then `Insert`, `Update`, `Delete` messages, then `Commit`. Observations from running it on real changes:

- **Every change carries the position of its commit** (the LSN, log sequence number), and changes inside one transaction share it. A change's sequence inside the transaction completes the ordering: `(lsn, seq)`.
- **Replica identity** decides what an update or delete carries. By default (`REPLICA IDENTITY DEFAULT`) an **update contains only the new row**, and a **delete contains only the primary-key columns** (the other columns are NULL). An update that changes the primary key additionally carries the old key. After `ALTER TABLE ... REPLICA IDENTITY FULL`, updates and deletes carry the **complete old row** (the "before image"), at the cost of more WAL. If you need before-images (for auditing, or to know what a deleted row contained), you must enable it.

  What Debezium shows for the same rows, measured against the lab's Docker stack: with the default identity an update event has `before: null`, and a delete event has a `before` that contains the key but **made-up values for the other columns** (customer 0, amount "0.00", status "PENDING", the column defaults), not the real old values. Nothing marks them as fake. After `ALTER TABLE orders REPLICA IDENTITY FULL`, the same operations carry the true before image (customer 9, amount "99.00", status "DONE"). A consumer that trusts `before` on a default-identity table writes wrong history.
- With FULL, the stream marks every column as part of the identity, so **the consumer must know the real primary key** from the catalog.

**The Debezium event.** Debezium turns these changes into a standard envelope, published on a topic named `<prefix>.<schema>.<table>` (for example `shop.public.orders`) and keyed by the primary key, so one row's changes stay ordered in one partition:

```json
{ "before": { "order_id": 1, "status": "paid",    "total_idr": 100000 },
  "after":  { "order_id": 1, "status": "shipped", "total_idr": 100000 },
  "source": { "db": "production", "table": "orders", "lsn": 21683720, "ts_ms": 1767225600000 },
  "op": "u", "ts_ms": 1767225600123 }
```

`op` is `c` (create), `u` (update), `d` (delete) or `r` (a row read during the initial snapshot). A delete is followed by a **tombstone** (key with null value) so a compacted topic drops the key. The lab's `to_events` builds this shape (`op`, `before`, `after`, `key`, `pos`) from the decoded stream.

**Snapshot, then stream.** A connector first takes a consistent **snapshot** of the existing table (events with `op = r`) and then switches to streaming from the log position at which the snapshot was taken, so no change is lost between the two. **Schema changes** (a new column) flow through as new fields in later events; renames and type changes need coordination (a contract again).

## @lesson Consuming CDC correctly, and running it safely
A CDC consumer builds or updates a copy of the table, for example a **lakehouse table** that keeps current state (an Iceberg `MERGE`, Module 2.2) or a search index. Because delivery is at-least-once and consumers restart and rebalance, the apply step must be **idempotent and order-safe**. The lab's `apply_events` shows the pattern in miniature:

- Key the replica by **primary key**, not by arrival.
- Remember, per key, the **position `(lsn, seq)` of the last event applied**, and **skip any event that is not newer**. Replaying the same events, or receiving them out of order, then produces the same final state. The tests apply the events twice, and apply them in five random orders, and require the replica to equal the source table every time.
- A **delete removes the row but keeps the position**, so a replayed older insert cannot resurrect it.
- A **primary-key change** removes the old key's row and creates the new one.
- Changes within one transaction must be applied in their sequence, which is why the decoder numbers them.

Other practices: keep the **raw event log** (a bronze layer) so you can rebuild the replica; keep CDC topics for long enough to recover; keep a separate **history** table when analysts need every change (an SCD Type 2, Module 1.4); and compare row counts or checksums between source and replica regularly (Module 2.5).

**Operational risks of log-based CDC**, all of which are real incidents:

1. **The replication slot pins WAL.** PostgreSQL cannot recycle WAL that a slot has not confirmed. If the connector stops (a crash, a paused consumer, a network issue), the slot keeps holding WAL and the **source database's disk fills**, taking *production* down. In the lab, an unread slot held back **118 MB of WAL after only 450,000 changes**, and `max_slot_wal_keep_size` defaults to `-1`, meaning unlimited. Defences: alert on **slot lag** (`pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)` in `pg_replication_slots`); set `max_slot_wal_keep_size` as a safety limit; drop abandoned slots; make CDC consumers high-priority services; and send periodic heartbeat events so the slot keeps advancing on quiet tables.
2. **Large transactions and bulk updates** produce bursts of events and lag.
3. **Schema drift** in the source can break downstream consumers.
4. **Initial snapshots** of big tables take time and load.
5. **Failover and slots.** After a database failover, slots must be recreated or synchronised depending on version and setup, and a gap in the log means you must re-snapshot.

**The outbox pattern** is the alternative when you want application *events* (OrderPlaced) rather than raw row changes: the application writes the event to an `outbox` table in the same transaction as its business change, and CDC publishes the outbox rows. It gives atomicity (no event without its change, no change without its event) without distributed transactions.

**When not to stream.** Streaming adds moving parts, state and operational burden. If a decision can wait an hour, a batch job is simpler and cheaper (Module 0.1). Use streaming for genuinely time-sensitive uses, for many consumers of the same data, or for replicating databases with deletes and low latency.

> 💡 **Practice Pause 3 (Idempotent CDC State Replication & Tombstones):**
> 1. Open `labs/mod-3-2/cdc.py` in your text editor.
> 2. Implement `to_events(changes, pk)` converting PostgreSQL WAL mutations into standard Debezium event envelopes.
> 3. Implement `apply_events(state, events)` tracking `(lsn, seq)` positions per primary key to discard duplicates and out-of-order replays, plus `materialize(state, table)`.
> 4. Run the tests in terminal (when PostgreSQL dependencies are present):
>    `pytest labs/mod-3-2/test_cdc.py -v`
> 5. **Success Indicator:** All CDC tests report `PASSED` (or skip gracefully if local database services are inactive), verifying idempotent state synchronization and tombstone safety.

## @lab Lab: a mini Kafka, a real broker, and CDC from real WAL
Three parts, each testable. A: build a miniature Kafka to master the semantics. B: use a real broker (producer with idempotence, a consumer with manual commit, lag). C: consume PostgreSQL's actual replication stream into a replica that is correct under replay and reordering.

### @steps
1. Install the requirements (Part A needs only pytest):

```bash
python -m pip install -r labs/mod-3-2/requirements.txt
```

2. **Part A: the mini log.** Open `labs/mod-3-2/minilog.py` and implement `Topic` (partitions, produce, end offsets, lag, compaction), `assign` (range assignment) and `Consumer` (resume from committed offsets, poll, commit). Run `pytest labs/mod-3-2/test_minilog.py -v`. Pay attention to the at-least-once test: a crash before commit duplicates records, and the idempotent test fixes it.

> 💡 **Practice Pause 4 (Full MiniLog Verification):**
> 1. In terminal, run the complete test suite for Part A:
>    `pytest labs/mod-3-2/test_minilog.py -v`
> 2. Verify against the reference solution:
>    `LAB_DIR=reference pytest labs/mod-3-2/test_minilog.py -v`
> 3. **Success Indicator:** All 15 tests in `test_minilog.py` report `PASSED` in < 0.1s in pure Python with zero external servers.

3. **Part B: a real broker.** Start Kafka or Redpanda. With Docker, from the course repository: `docker compose up -d redpanda` (external listener `localhost:19092`). Implement the five functions in `labs/mod-3-2/real_kafka.py` (`create_topic`, `topic_config`, `produce_orders`, `consume_with_manual_commit`, `group_lag`) and run:

```bash
KAFKA_BOOTSTRAP=localhost:19092 pytest labs/mod-3-2/test_real_kafka.py -v
```

   Without `KAFKA_BOOTSTRAP` these tests are skipped. Look at your topic with the broker's console (Redpanda Console at http://localhost:8080) and watch the group's lag go from 60 to 0.
4. **Part C: CDC.** Read the docstring of `labs/mod-3-2/pgoutput.py` (provided) and then its code. Implement `to_events`, `apply_events` and `materialize` in `labs/mod-3-2/cdc.py`, and run `pytest labs/mod-3-2/test_cdc.py -v`. The tests start an embedded PostgreSQL with `wal_level=logical`, create a publication and a slot, run inserts, updates, a delete and a primary-key change, and compare your replica with the real table.
5. Experiment: print the raw decoded changes for one scenario with and without `REPLICA IDENTITY FULL`; apply events in random order and confirm the replica never changes; in a `psql` session, create a slot, make changes without consuming them, and watch `pg_replication_slots` retain WAL.
6. Optional, with Docker: start the stack from the repository (`docker compose up -d --wait postgres redpanda connect`), register the connector with the JSON in `labs/mod-3-2/debezium-orders.json`, and watch real events arrive as you change the seeded `orders` table. (This part uses Docker images and is not covered by automated tests; it was checked by hand against Debezium 2.7 and Redpanda.)

```bash
curl -s -X POST -H 'Content-Type: application/json' --data @labs/mod-3-2/debezium-orders.json localhost:8083/connectors
docker compose exec postgres psql -U postgres -d production -c "UPDATE orders SET status='SHIPPED' WHERE order_id=1"
docker compose exec redpanda rpk topic consume shop.public.orders -o start
```

   You should see three snapshot reads (`op: "r"`) for the three seeded rows, then an update (`u`), and after an insert (`c`) and a delete (`d`) also a **tombstone** (the same key with a null value, which lets a compacted topic forget the key). Then repeat the experiment after `ALTER TABLE orders REPLICA IDENTITY FULL` and compare the `before` field. Redpanda Console at http://localhost:8080 shows the topic and consumer lag.
7. Optional, with Docker (about 1.5 GB of memory): **break a real cluster**. Start three Apache Kafka brokers with `docker compose -f labs/mod-3-2/cluster/docker-compose.yml up -d`, wait about 30 seconds, and run the Kafka tools inside a broker:

```bash
K="docker exec df_kafka1 /opt/kafka/bin"
$K/kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic orders --partitions 3 --replication-factor 3 --config min.insync.replicas=2
$K/kafka-topics.sh --bootstrap-server kafka1:9092 --describe --topic orders           # who leads, who is in sync
docker kill df_kafka2                                                                  # crash a broker
$K/kafka-topics.sh --bootstrap-server kafka1:9092 --describe --under-replicated-partitions
docker start df_kafka2                                                                 # watch the Isr column recover
docker compose -f labs/mod-3-2/cluster/docker-compose.yml down -v                      # clean up when you are done
```

   Before you kill the broker, **predict** the new `Leader` and `Isr` of each partition, then compare. Next create a topic with `--config min.insync.replicas=3`, kill a broker, and produce with `kafka-console-producer.sh ... --producer-property acks=all`; explain the `NOT_ENOUGH_REPLICAS` you get. For the schema registry, `docker compose up -d redpanda` also exposes it on `localhost:8081`: register an Avro schema with `POST /subjects/orders-value/versions`, then check an incompatible change against `POST /compatibility/subjects/orders-value/versions/latest` and see the answer change when you set `FORWARD` or `FULL` with `PUT /config/orders-value`. (These parts were run by hand against Apache Kafka 4.0.0 and Redpanda; they are not covered by automated tests.)

> 💡 **Practice Pause 5 (Full Broker & CDC Verification):**
> 1. Run the real broker tests (optional, when Redpanda container is running):
>    `KAFKA_BOOTSTRAP=localhost:19092 pytest labs/mod-3-2/test_real_kafka.py -v`
> 2. Generate the verification proof token:
>    `python3 scripts/prove.py mod-3-2`
> 3. **Success Indicator:** All active tests report `PASSED` and your completion proof token is printed to terminal.

### @files
- labs/mod-3-2/minilog.py :: Part A working file: the mini Kafka :: starter
- labs/mod-3-2/test_minilog.py :: Part A tests (15) :: test
- labs/mod-3-2/real_kafka.py :: Part B working file: real broker functions :: starter
- labs/mod-3-2/test_real_kafka.py :: Part B tests (4; need KAFKA_BOOTSTRAP) :: test
- labs/mod-3-2/pgoutput.py :: Provided decoder of PostgreSQL's replication stream :: data
- labs/mod-3-2/cluster/docker-compose.yml :: Optional: a real three-broker Kafka cluster to break on purpose :: config
- labs/mod-3-2/cdc.py :: Part C working file: events and an idempotent replica :: starter
- labs/mod-3-2/test_cdc.py :: Part C tests (8) :: test
- labs/mod-3-2/debezium-orders.json :: Debezium connector configuration for the Docker stack (step 6) :: config
- labs/mod-3-2/requirements.txt :: Dependencies :: config
- labs/mod-3-2/reference/minilog.py :: Part A reference (try first!) :: reference
- labs/mod-3-2/reference/real_kafka.py :: Part B reference :: reference
- labs/mod-3-2/reference/cdc.py :: Part C reference :: reference

### @deliverables
- Part A: all 15 tests pass
- Part B: all 4 tests pass against a real broker
- Part C: all 8 tests pass, including replay and out-of-order delivery
- You can explain what `(lsn, seq)` is for, what a delete event contains with and without `REPLICA IDENTITY FULL`, and how a stalled CDC consumer can take down the source database

### @verify
```bash
pytest labs/mod-3-2/test_minilog.py labs/mod-3-2/test_cdc.py -v
KAFKA_BOOTSTRAP=localhost:19092 pytest labs/mod-3-2/test_real_kafka.py -v
```

Known-good run: prefix with `LAB_DIR=reference`.

## @chaos The replication slot that filled the production disk
### @scenario
KopiKu's CDC connector captures the `orders` table into Kafka. On Friday evening, a Kafka Connect worker is restarted for a patch and does not come back up; nobody notices because the dashboards still show data (a day old) and the connector's alert goes to a channel that nobody watches over the weekend.

On Sunday night the production PostgreSQL stops accepting writes: the disk holding its data directory is 100% full. Checkout is down. The database team finds 410 GB of WAL files in the `pg_wal` directory.

### @cause
The logical replication slot belongs to the Debezium connector. PostgreSQL must keep every WAL segment the slot has not yet confirmed, because the consumer might still need it. With the connector down for two days, the slot confirmed nothing, so WAL piled up at KopiKu's normal write rate (hundreds of gigabytes) until the disk was full. `max_slot_wal_keep_size` was left at its default of `-1`, which means *no limit*.

(The effect is easy to reproduce: in the lab, an unread slot pinned 118 MB of WAL after 450,000 row changes.) The design flaw is that the analytics pipeline could harm the system it only reads from.

### @fix
1. **Immediate**: free space safely. Dropping the slot (`pg_drop_replication_slot`) releases the WAL but forces a **new snapshot** of the table; restart the database writes first, then rebuild the pipeline.
2. Set `max_slot_wal_keep_size` to a safe fraction of the disk, so a stalled slot is invalidated *before* it kills production (you then re-snapshot, which is far better than an outage).
3. **Alert on slot lag and on connector state**, routed to an on-call channel: `pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)` per slot, and disk usage of the WAL volume.
4. Treat the CDC connector as a **production service** with its own redundancy and runbook; send heartbeats so slots advance even when tables are quiet.
5. Review the failure mode in a post-mortem and test it: stop the connector in staging and verify the alerts fire.

### @pattern
A replication slot is a promise made by the source database. A CDC consumer that stops does not only fall behind: it can fill the source's disk. Limit it, monitor it, and page someone.

## @quiz
### In Kafka, what does a message key determine?
- [ ] Which consumer in the group will receive the message, regardless of how the partitions are assigned
- [x] Which partition the message goes to, so that messages with the same key keep their relative order
- [ ] How long the message is retained by the broker before the retention rule finally deletes it
- [ ] Whether the producer waits for an acknowledgement from the follower replicas of that partition

> The key is hashed to choose a partition. Kafka guarantees ordering within a partition, so records with the same key are consumed in the order they were produced.

### A consumer commits its offset BEFORE processing each message and crashes halfway through a batch. What can happen?
- [ ] Some messages are processed twice, because the offset was committed after they had been handled
- [x] Some messages are never processed, since their offsets were already committed as done and dusted
- [ ] Nothing, because the broker keeps a copy of each message until it is processed correctly by someone
- [ ] The whole topic is replayed from offset zero, because the group loses all of its committed offsets

> Committing before processing gives at-most-once delivery: an offset marked as done may belong to a message that was never handled. Commit after processing for at-least-once.

### Why is "at-least-once delivery with idempotent processing" the common design?
- [ ] Kafka cannot deliver any message more than once, so the processing step must always be very fast
- [ ] It avoids the need to commit offsets at all, since idempotent code never has to be restarted again
- [x] Duplicates after a crash are harmless when handling a record twice leaves the same final state
- [ ] It guarantees that all of the messages are delivered in the same global order to every group

> Crashes cause redelivery. If processing is an upsert or is keyed by (partition, offset), repeats change nothing, which gives an exactly-once effect.

### A topic has 6 partitions and a consumer group has 10 members. How many members receive data?
- [ ] All ten, because the broker splits every partition into smaller parts to share among members
- [ ] Ten, but each one receives only part of the messages from the partitions that it is assigned
- [x] Six: each partition goes to exactly one member, so the other four members stay idle
- [ ] Only one, because a consumer group always reads from a single partition at a time

> Within a group a partition is consumed by one member at a time, so parallelism is limited to the number of partitions.

### What is consumer lag?
- [ ] The time that a consumer takes to open its first connection to the broker when the application starts
- [ ] The number of messages that a producer has queued locally before it finally sends them to the broker
- [x] For each partition, the end offset minus the group's committed offset, summed over the whole topic
- [ ] The difference in clock time between the producer's server and the consumer's own server machine

> Lag shows how far behind a group is. It is the main health metric: rising lag means consumers are slower than producers.

### With the default `REPLICA IDENTITY` in PostgreSQL, what does a logical-decoding DELETE event contain?
- [ ] The complete deleted row with all of its columns, which is exactly the same as an insert event
- [ ] Only the transaction id and the time of the delete, but no information about the row at all
- [x] Only the primary-key columns of the deleted row; the other columns are not included in it
- [ ] The row as it will look after the delete, which is the same as having an empty row

> Without REPLICA IDENTITY FULL the old row in a delete (or key-changing update) holds only the key. Set FULL if consumers need the before image.

### Why does an idempotent CDC consumer remember the position (lsn, seq) of the last event applied per key?
- [ ] To compress the events so that the replica needs less disk space than the source table does at all
- [ ] To decide which database user is allowed to read the replication slot on the source system
- [x] To skip duplicates and late older events, so replays and reordering never change the final state
- [ ] To calculate the lag of the replica, which cannot be measured in any other way than that one

> Comparing each event's position with the last applied one for its key makes replay safe and order-independent. A delete keeps its position so old inserts cannot resurrect the row.

### Why can a stopped CDC connector bring down the source PostgreSQL database?
- [ ] The connector holds an exclusive lock on the replicated tables for as long as it is down
- [x] The replication slot keeps all unconfirmed WAL, which then accumulates until the disk is full
- [ ] The database restarts itself repeatedly when its replication client fails to reconnect in time
- [ ] The topic in Kafka sends back pressure to the source, which fills the memory of the database

> A logical slot pins WAL until the consumer confirms it. A long outage makes WAL pile up on the production server. Limit it with max_slot_wal_keep_size and alert on slot lag.

### A topic has replication factor 3 and `min.insync.replicas=2`. A producer uses `acks=all`. One broker crashes. What is the correct expectation?
- [ ] Writes stop, because Kafka requires every one of the three replicas to be alive before it accepts data
- [x] Writes continue and acknowledged records survive, because two replicas still stay in the in-sync set
- [ ] Writes continue, but any acknowledged record that the dead broker held is lost for good
- [ ] Writes stop until an operator picks a new leader, since followers can never be promoted automatically

> With two in-sync replicas left, the ISR still meets the floor of 2. A caught-up follower becomes leader and the producer retries. We measured a 7.5 second stall, no lost records and no duplicates.

### A team must add a field `channel` to an Avro schema registered with BACKWARD compatibility, without breaking existing consumers. Which change does the registry accept?
- [ ] A required field `channel` with no default value, because every new record contains the field anyway
- [ ] Renaming the field `customer` to `channel`, as long as the type of the field stays a string
- [x] An optional field `channel` with a default of null, so records written without it can still be read
- [ ] Changing `total` from `int` to `string`, because a string can hold any integer value in text form

> Under BACKWARD, a new reader must be able to read old data, so a new field needs a default. We saw the registry accept an optional field and answer HTTP 409 for a required one without a default.

## @resources
- [Apache Kafka documentation](https://kafka.apache.org/documentation/)
- [Debezium documentation](https://debezium.io/documentation/)
- [PostgreSQL docs: logical replication](https://www.postgresql.org/docs/current/logical-replication.html)
- [PostgreSQL docs: logical decoding](https://www.postgresql.org/docs/current/logicaldecoding.html)
- [confluent-kafka Python client](https://docs.confluent.io/kafka-clients/python/current/overview.html)
