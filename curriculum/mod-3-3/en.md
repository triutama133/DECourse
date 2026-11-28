---
title: Real-Time Stream Processing: Event Time, Windows and Watermarks
duration: 3 weeks
summary: Learn event time versus processing time, windows, watermarks, state and checkpoints, and the guarantees that make a streaming job correct, by modelling a watermark in Python and verifying it against a real Spark Structured Streaming job.
why: Tutorials count events by when the server received them. A mobile app that was offline for four hours then sends yesterday's events, and a processing-time pipeline reports analytics that are simply wrong.
---

## @outcomes
- Distinguish event time from processing time and explain why event-time results are the correct ones
- Assign events to tumbling, sliding and session windows
- Explain precisely when a windowed result is emitted, which late events are counted or dropped, and what a watermark trades off
- Describe state, checkpoints, restart behaviour and the conditions for exactly-once results
- Write a Spark Structured Streaming job reading Kafka, and compare Spark's micro-batch model with Flink's record-at-a-time model

## @prereq
Modules 3.1 (Spark basics) and 3.2 (Kafka, offsets, at-least-once). Part A of the lab is pure Python; Part B needs Java 17+ and `pip install -r labs/mod-3-3/requirements.txt`.

## @part Time and windows

## @lesson Event time versus processing time
:::talk The spike that never happened
@teacher Your dashboard counts events per minute by the time the pipeline PROCESSED them. Between minute 20 and minute 40 the pipeline was down. When it recovered at minute 40, it processed all the waiting events at once. The dashboard shows a huge spike at minute 40 and nothing in the minutes before it.
@ask What really happened to the customers' activity?
@choice Customers were extremely active at minute 40 | The events happened during minutes 20 to 39. Minute 40 is only when the pipeline caught up. Try again.
@choice * Nothing unusual: one event per minute all along. The spike is an artefact of processing time | Yes. By event time every minute has the same number of events. Processing time describes your pipeline, event time describes what happened in the world.
@choice The events from minutes 20 to 39 were lost | They were delayed, not lost: they were all counted at minute 40. Try again.
@teacher That is why windows use the time the event happened, and why they must wait a little for late events.
:::

Every event in a stream has two timestamps:

- **Event time**: when the thing actually happened (the customer tapped "Pay" at 10:03:12).
- **Processing time**: when your system saw it (10:03:15, or 14:30 if the phone was offline for four hours).

If you group events by *processing time*, results depend on network delays, outages and backlogs. After an incident, a pipeline that catches up processes six hours of events within five minutes, and a "per-minute" chart shows a giant spike that never happened. Mobile apps, IoT devices, partners that batch uploads, and any retry produce events that arrive **late and out of order**.

Correct analytics use **event time**: group by when it *happened*. The price is a new problem: because events can arrive late, **when is a time window complete?** At 10:05:00 the window for 10:00 to 10:05 has ended in real life, but a late event for 10:03 might still be on its way. If you wait forever, you never emit a result; if you emit immediately, you will be wrong. Stream processors answer with the **watermark**, a deliberate, bounded trade-off between **latency** (how soon you answer) and **completeness** (how many late events you include). Understanding that trade-off precisely is the subject of this module.

A related point: if a decision does not need an answer within seconds, **batch is simpler** (Module 0.2). Stream processing earns its complexity for fraud checks, live operations dashboards, alerting, and feeding downstream systems quickly.

> 🛠 **Try it (10 min, Python).** Simulate an outage. There is one event per minute with event minutes 0 to 59. Normally the processing minute equals the event minute, but the events of minutes 20 to 39 are only processed together at processing minute 40, after the pipeline recovers. Count events per processing minute and per event minute with `collections.Counter`. Print the busiest minute of each, and how many distinct minutes have data in each.
>
> **You should see:** processing time: minute `40` has `21` events (the spike that never happened), and only `40` minutes have any data (the gap of 20 empty minutes); event time: every one of the `60` minutes has exactly `1` event. The event-time view is the true one, and a window has to wait for the late events to see it.

:::ask After an outage a pipeline catches up and processes six hours of events in five minutes. If you group by processing time, what does the per-minute chart show?
@options
a flat line, since events are evenly spread
* one huge spike: old events are counted as now
nothing, because the late events are dropped
@why
Processing time is when your system saw the event, not when it happened. Grouping by it turns a backlog into a fake burst. Event time puts every event in the minute it really belongs to.
:::

## @lesson Windows
Aggregations over an unbounded stream need a bounded group, usually a **window** of event time.

| Window | Shape | Example |
|---|---|---|
| **Tumbling** | Fixed size, no overlap | Orders per 5-minute block: `[10:00, 10:05)`, `[10:05, 10:10)` |
| **Sliding (hopping)** | Fixed size, overlapping, advances by a smaller slide | The last 5 minutes, updated every minute |
| **Session** | Dynamic size: a burst of activity separated by a gap of inactivity | A user's visit: ends after 30 minutes with no event |

:::talk How many windows hold one event?
@teacher A 5-minute window slides forward by 1 minute, so windows start at 10:00, 10:01, 10:02 and so on. An event arrives with the time 10:07.
@ask In how many windows does this one event fall?
@choice One, because an event has only one time | The event has one time, but sliding windows overlap, so several of them cover that time. Try again.
@choice * Five: the windows starting at 10:03, 10:04, 10:05, 10:06 and 10:07 | Yes. The window size divided by the slide gives the number of overlapping windows: 5 / 1 = 5. The event is counted in each of them.
@choice Seven, because it is 7 minutes past the hour | The minute of the event does not decide the count: the size of the window and the slide do. Try again.
@teacher A tumbling window is a sliding window whose slide equals its size, so each event lands in exactly one.
:::

Each event belongs to **one** tumbling window, to `size / slide` **sliding** windows (a 5-minute window sliding by 1 minute puts every event into 5 windows), and to one **session** (sessions merge when a late event bridges two of them). Windows are half-open: the start is included and the end is not, so an event at exactly 10:05:00 belongs to `[10:05, 10:10)`.

In Part A of the lab you implement `window_starts(ts, size, slide)`, which returns the start of every window containing an event, and test that tumbling windows give 1 and the 300/60 sliding case gives 5. Concrete worked example: take event time `ts = 320` seconds with `size = 300` and `slide = 60`. The latest multiple of `slide` at or before `ts` is `floor(320 / 60) * 60 = 300`, giving `[300, 600)`, while the earliest window that still reaches `320` starts at `60` (`[60, 360)`, since `[0, 300)` already ended before `320`!). Stepping by `60` from `60` to `300` produces the five starts `[60, 120, 180, 240, 300]`. In Spark the same thing is `F.window("event_time", "5 minutes")` (tumbling) or `F.window("event_time", "5 minutes", "1 minute")` (sliding). Windows are keyed by time **and** by your grouping column (for example, per account), so the unit of state is `(key, window)`.

> 💡 **Practice Pause 1 (Window Starts Mapping: Tumbling & Sliding):**
> 1. Open `labs/mod-3-3/windows.py` in your text editor. Do not execute this Python file directly in terminal.
> 2. Implement `window_starts(ts, size, slide)` to compute all window start times `[start, start + size)` containing `ts`, aligned to multiples of `slide`.
> 3. Run the tests in terminal:
>    `pytest labs/mod-3-3/test_windows.py -k TestWindowStarts -v`
> 4. **Success Indicator:** All 3 tests report `PASSED`, confirming tumbling windows produce 1 unique start and sliding windows yield `size // slide` overlapping starts.

:::drill python Which windows contain this event?
Write `window_starts(ts, size, slide)`: `ts`, `size` and `slide` are whole numbers of seconds. A window starts at every multiple of `slide` and lasts `size` seconds, `[start, start + size)`. Return the sorted list of the starts of all windows that contain `ts`. When `size == slide` (tumbling windows) that is exactly one window.
@starter
# write your function below this line

@check
defines("window_starts") ## Define window_starts(ts, size, slide).
window_starts(125, 60, 60) == [120] ## Tumbling: 125 s is in the window that starts at 120.
window_starts(125, 300, 60) == [0, 60, 120] ## Sliding 5 minutes by 1 minute: windows starting at 0, 60 and 120 contain 125 s (windows starting before 0 do not exist).
window_starts(600, 300, 60) == [360, 420, 480, 540, 600] ## 300/60 = 5 windows contain a normal event.
window_starts(0, 60, 60) == [0] ## An event exactly on the boundary belongs to the window that starts there.
@hint
Start from the last window start `(ts // slide) * slide` and go backwards by `slide` while `start > ts - size` and `start >= 0`; sort at the end.
@solution
def window_starts(ts, size, slide):
    starts = []
    start = (ts // slide) * slide
    while start >= 0 and start > ts - size:
        starts.append(start)
        start -= slide
    return sorted(starts)
:::

:::ask A 5-minute sliding window moves forward by 1 minute. In how many windows is one event counted?
@options
1: every event has exactly one time
60: one for each second of the window
* 5: the size divided by the slide
@why
Each event belongs to size / slide sliding windows, here 300 / 60 = 5. A tumbling window is the special case where size equals slide, so each event belongs to exactly one.
:::

## @lesson Watermarks: when is a window finished?
A **watermark** is the stream processor's estimate of "how far event time has progressed": a promise that **events older than the watermark are unlikely to still arrive**. Spark defines it as:

```text
watermark = (newest event time seen so far) - (the delay you chose)
```

:::talk A short or a long watermark delay?
@teacher A window counts clicks per 5 minutes. The watermark delay says how long to wait for late events before closing a window. Team A sets 10 seconds. Team B sets 10 minutes.
@ask What is the trade-off?
@choice A longer delay is always better, because nothing is ever lost | A longer delay waits longer before every result, and it keeps more windows open in memory. Try again.
@choice * A short delay gives early results but more events arrive too late and are dropped; a long delay catches more late events but delays every result and holds more state | Yes. The delay is your tolerance for lateness, bought with latency and memory. Measure how late your events really arrive, then set the delay to cover most of them.
@choice The delay only matters for the first window | It applies to every window the job ever closes. Try again.
@teacher There is no free setting: a watermark delay trades completeness against speed and memory.
:::

The delay is your tolerance for lateness. With `withWatermark("event_time", "2 minutes")`, if the newest event seen was 10:07, the watermark is 10:05: "I will treat everything before 10:05 as essentially complete." In append mode, **a window is emitted once the watermark passes its end**.

[[diagram:watermark]]

The mechanics are subtle and frequently misunderstood, so here they are, observed from a real Spark job (and reproduced by the lab's pure-Python model). Five-minute tumbling windows, a 2-minute watermark delay, one file per micro-batch:

| Batch | Events (event time → value) | Watermark at start | What happens |
|---|---|---|---|
| 0 | a 10:01 (10), a 10:02 (20), b 10:03 (5) | none | Nothing emitted. Newest = 10:03, so the watermark becomes **10:01** |
| 1 | a 10:06 (30), b 10:07 (7), a 10:04 (99) | 10:01 | Nothing emitted (no window ends by 10:01). Newest = 10:07, watermark becomes **10:05** |
| 2 | a 10:11 (1), **a 10:03 (1000)**, b 10:06 (50) | 10:05 | The 10:03 event is *behind* the watermark, but its window `[10:00, 10:05)` is still open, so it **is counted**. At the end of the batch the window is **emitted**: a: count 4, total 1,129; b: count 1, total 5. Watermark becomes 10:09 |
| 3 | a 10:16 (2) | 10:09 | Nothing emitted (`[10:05, 10:10)` ends at 10:10, after 10:09). Watermark becomes 10:14 |
| 4 | a 10:30 (3) | 10:14 | `[10:05, 10:10)` is emitted: a: 1 / 30, b: 2 / 57. Watermark becomes 10:28 |
| after | (an empty extra batch) | 10:28 | `[10:10, 10:15)` and `[10:15, 10:20)` are emitted |

From this, the rules your model must follow (and the tests check):

1. **The watermark is computed from previous batches.** A batch's own events move it only for the *next* batch.
2. **A window is emitted at the end of the first batch whose starting watermark has reached the window's end**, and is then removed from state.
3. **Late is not the same as dropped.** An event behind the watermark is still counted *as long as its window has not yet been emitted*. Only events whose windows have **all** been emitted and removed are **dropped**. (Spark guarantees events within the delay are never dropped; events older than that may or may not be, depending on batch timing.)
4. The watermark **never moves backwards**.
5. A final **empty batch** lets the watermark close the last windows when a run ends: with no new data the watermark would otherwise never advance. (A stream that goes quiet leaves its latest windows unemitted until new data arrives; for a low-traffic stream, consider a heartbeat event.)

The late-event test in the lab shows the other side: after the `[10:00, 10:05)` window was emitted, a 10:02 event with value 5,000 arrives in a later batch. **Nothing is emitted and no state is recreated: it is silently dropped.** It never appears in any result. That is the cost of a finite delay, and the reason you must **choose the delay from data**: measure the lateness distribution of your events (the 99th percentile of "arrival time minus event time") and set the delay to cover it, remembering that **a larger delay means higher latency and more state**.

**What to do with data that is too late.** Count it (a metric of dropped events); write the *raw* events to storage in parallel, so a nightly batch job (Module 2.3) can recompute exact numbers; or, in Flink, route it to a **side output**. The common pattern is a fast, approximate streaming result plus a slower, exact batch correction.

**Output modes** decide what is written each batch: **append** (each result row once, only when final; needs a watermark for windowed aggregates), **update** (only the rows that changed since the last batch, which gives early, revised results), and **complete** (the whole result table every time; only for small results).

### See it: the watermark decides what is too late

`watermark = the newest event time seen so far, minus the watermark delay` (often called *allowed lateness* in simple examples; note that Spark's `withWatermark` delay controls when a window closes and is dropped, whereas Flink also has a separate *allowed lateness* setting for updating already-emitted windows, covered in Lesson 4). An event older than the watermark is late. Watch it move (delay / allowed lateness 5):

:::trace The watermark moves, late events are routed aside
@code
allowed_lateness = 5
watermark = 0
accepted = []
late = []
events = [10, 12, 9, 20, 11, 21]
for ts in events:
    if ts < watermark:
        late.append(ts)
    else:
        accepted.append(ts)
    watermark = max(watermark, ts - allowed_lateness)
print(accepted, late)
@notes
7 | Each event is first compared with the watermark **as it was before this event**.
8 | `ts < watermark`: too late. The event is routed aside, not silently dropped.
10 | An event that is not behind the watermark is accepted: `9` was out of order, but still within the allowed lateness.
11 | The watermark only ever moves **forward**: `max(...)`. After 20 it is 15, so the old event 11 (which comes next) is late.
:::

:::ask The watermark is 15 and an event with time 11 arrives. What should the system do?
@options
* treat it as late (drop or side output)
accept it and move the watermark back to 11
stop the whole stream until it is fixed
@why
A watermark never moves backwards, and an event behind it is **late**. The window it belongs to may already have been emitted, so the system either updates it deliberately (allowed lateness) or sends the event to a side output for inspection.
:::

:::drill python Is it late?
Write `is_late(event_time, watermark)`: `True` when the event is **older** than the watermark, `False` otherwise (an event exactly at the watermark is not late).
@starter
# write your function below this line

@check
defines("is_late") ## Define is_late(event_time, watermark).
is_late(11, 15) is True ## 11 is older than 15: late.
is_late(15, 15) is False ## Exactly at the watermark is not late.
is_late(20, 15) is False ## Newer than the watermark: not late.
@hint
Compare the event's timestamp against the watermark using strict less-than, since an event arriving exactly at the watermark is still on time.
@solution
def is_late(event_time, watermark):
    return event_time < watermark
:::

:::drill python Move the watermark
Write `advance(watermark, event_time, allowed_lateness)`: the new watermark is the greater of the current one and `event_time - allowed_lateness`. It must never go backwards.
@starter
# write your function below this line

@check
defines("advance") ## Define advance(watermark, event_time, allowed_lateness).
advance(0, 20, 5) == 15 ## 20 - 5 = 15 is greater than 0.
advance(15, 11, 5) == 15 ## An old event (11 - 5 = 6) must not move the watermark back.
advance(10, 10, 0) == 10 ## With no allowed lateness the watermark follows the newest event.
@hint
Compute the candidate watermark by subtracting the lateness tolerance from the event time, then take the larger of that candidate and the existing watermark so it never moves backwards.
@solution
def advance(watermark, event_time, allowed_lateness):
    return max(watermark, event_time - allowed_lateness)
:::

> 💡 **Practice Pause 2 (Watermark Simulation & Windowed Aggregation):**
> 1. Open `labs/mod-3-3/windows.py` in your text editor.
> 2. Implement class `WindowedAggregator`: methods `__init__`, `add_batch(events)`, and `advance()`.
> 3. Enforce watermark semantics: compute watermarks from preceding batches, emit windows ending ≤ watermark at batch completion, and drop late arrivals whose windows have already been evicted.
> 4. Run the tests in terminal:
>    `pytest labs/mod-3-3/test_windows.py -k TestWatermark -v`
> 5. **Success Indicator:** All 7 tests report `PASSED`, confirming delayed window emission, monotonic advancement, and strict late-data discarding.

## @part State and operations

## @lesson State, checkpoints and exactly-once
:::talk A counter for every window, forever
@teacher A streaming job counts clicks per 5-minute window. That is 288 windows a day. The job has no watermark, so it never decides that a window is finished.
@ask What happens to the job's memory over a year?
@choice * It keeps state for every window, forever, because any event might still arrive for any of them: about 105,000 windows after a year, and still growing | Yes. Without a watermark nothing may be deleted, so the state only grows until the job runs out of memory. This is one of the most common reasons streaming jobs die after weeks.
@choice Nothing: old windows are deleted by the garbage collector | The garbage collector can only free what nobody refers to. The job still needs those windows in case a late event arrives. Try again.
@choice It stays flat, because only today's windows are kept | Only a watermark tells the job it may forget old windows. Try again.
@teacher A watermark is not only about correctness. It is also the rule that lets the job throw old state away.
:::

An aggregation over time must **remember** things between events: the running count for each open window. That is **state**. Two consequences:

**State must be bounded.** Windowed state is deleted when the watermark passes the window, which is exactly why watermarks exist. Remove the watermark and Spark must keep every window forever, since any event could still arrive. Measured on the same job, 120 micro-batches of data:

| | State rows after 120 batches | State size |
|---|---|---|
| With a watermark (10 minutes) | about 40 (stays flat) | 15 KB |
| Without a watermark | 1,187 (grows linearly, without limit) | 277 KB, and growing |

At production scale (millions of keys, months of data) the second row ends in executor out-of-memory failures or a state store that grows until the job dies (this module's chaos lab). Large state can be kept on disk with a **RocksDB state store** (RocksDB is a fast storage engine that keeps data on the machine's own disk instead of in memory; an option in Spark 3.2 and later; Flink uses RocksDB for keyed state too).

**State must survive failures.** Streaming jobs run for weeks, and machines fail. Spark writes a **checkpoint** to durable storage: the **offsets** it has processed from the source, the **state** of every operator, and metadata. On restart with the same checkpoint location, the job resumes exactly where it stopped, with its windows intact. The lab's tests demonstrate both sides:

- Run the job, then run it again with the **same** checkpoint and no new data: **nothing is re-emitted**.
- Run it with a **new** checkpoint directory: it reads everything again and re-emits the same windows. *The checkpoint, not the job code, holds the progress.* Deleting or reusing the wrong checkpoint is a common production accident. Also note that substantial changes to a query (different aggregations or keys) may make an old checkpoint unusable; plan upgrades.

**Delivery guarantees.** A streaming job's output is exactly-once only if the whole chain cooperates:

1. The **source is replayable** (Kafka offsets, files): after a failure the job can re-read the same data.
2. **Progress and state are checkpointed atomically**: the job can restart from a consistent point.
3. The **sink is idempotent or transactional**: re-delivering the output of a batch after a failure does not duplicate rows. In Spark's `foreachBatch`, the function receives a `batch_id`: use it as an idempotency key (for example, `MERGE` by key, or record the last batch id written); table formats such as Iceberg and Delta provide atomic commits. In Flink, the **two-phase commit** protocol on transactional sinks (such as Kafka) coordinates output with checkpoints.

Without the third condition you have at-least-once with possible duplicates (Module 3.2). With it you have exactly-once *effect*, the realistic goal.

> 🛠 **Try it (20 min, Python).** Write a streaming job in miniature: a source list `["a","b","a","c","a","b","a","a"]` processed in batches of 3, keeping a running count per key. After each batch, write the output to a sink and then write a checkpoint file (`{"offset": ..., "state": ...}`). Make the job crash after the output of batch 1 is written but before its checkpoint, then start it again. Run it twice: once with a sink that **appends** `(batch_id, counts)` rows, and once with a sink that **overwrites** by `batch_id` (a dict). Compare the final state and the number of sink rows.
>
> **You should see:** both runs end with the state `{'a': 5, 'b': 2, 'c': 1}` because the checkpoint holds the progress. The appending sink has `4` rows (batch 1 appears twice: duplicated output), the overwriting sink has `3`, one per batch id. Replayable source, checkpoint, and idempotent sink: you have just built the three conditions for exactly-once effect.

:::ask A streaming aggregation by window runs without a watermark. What happens to its state over months?
@options
* it grows forever: any event may still arrive
it shrinks, since old windows close by themselves
it stays the same, as state lives on disk
@why
A watermark is what tells Spark that a window can no longer receive events, so its state can be deleted. Without it every window must be kept, until the job runs out of memory.
:::

## @lesson Spark Structured Streaming and Flink
**Structured Streaming** treats a stream as an unbounded table and uses the same DataFrame and SQL API as batch. Your batch logic often runs on streaming data with minimal change. Internally it is **micro-batch**: it repeatedly runs small batch jobs over newly arrived data. That gives high throughput, fault tolerance from the batch engine, and typical end-to-end latency of seconds (sub-second is possible with effort).

**Apache Flink** processes **record by record** with long-running operators, with latencies in milliseconds, and exposes a lower-level **DataStream API** besides SQL. It has first-class **keyed state**, **timers** (callbacks at an event-time or processing-time moment), **event-time windows with allowed lateness and side outputs for late data**, complex event processing, and **savepoints** (a manual, portable snapshot of state to upgrade or migrate a job). Fault tolerance uses **distributed snapshots**: checkpoint barriers flow through the stream so that all operators snapshot a consistent state.

| | Spark Structured Streaming | Flink |
|---|---|---|
| Model | Micro-batch on the Spark engine | True streaming, record at a time |
| Typical latency | Seconds | Milliseconds |
| API | DataFrame/SQL shared with batch | DataStream, Table/SQL |
| Late data | Watermark; late rows beyond it are dropped | Watermark plus *allowed lateness* and side outputs |
| State | State store (memory or RocksDB), checkpoints | Keyed state, RocksDB, checkpoints and savepoints |
| Strength | One engine for batch and streaming; huge ecosystem | Low latency, rich state and time control |

Choose by latency needs and team skills. For most analytical pipelines where "within a minute" is fine and the team already uses Spark, Structured Streaming is a pragmatic choice; for ultra-low-latency, complex stateful logic (fraud rules with timers), Flink is the specialist. Kafka Streams is a third option for processing inside ordinary JVM applications. The concepts of this module (event time, windows, watermarks, state, checkpoints) are shared by all of them.

**Reading from Kafka** with Structured Streaming (verified against a real broker; add the Kafka connector matching your Spark and Scala versions, for example `--packages org.apache.spark:spark-sql-kafka-0-10_2.13:4.2.0`):

```python
schema = StructType([
    StructField("account_id", StringType()),
    StructField("event_time", TimestampType()),
    StructField("amount", DoubleType()),
])

raw = (spark.readStream.format("kafka")
       .option("kafka.bootstrap.servers", "localhost:19092")
       .option("subscribe", "transactions")
       .option("startingOffsets", "earliest")
       .load())                                   # key and value arrive as BINARY

parsed = (raw.select(F.from_json(F.col("value").cast("string"), schema).alias("data"))
             .select("data.*")
             .withWatermark("event_time", "2 minutes"))

windowed = (parsed.groupBy(F.window("event_time", "5 minutes", "1 minute"), "account_id")
                  .agg(F.count("*").alias("tx_count"), F.sum("amount").alias("total_amount")))
```

The two lines that beginners get wrong: the Kafka `value` is binary, so cast it to a string before `from_json`; and `kafka.bootstrap.servers` is required. A window argument with two durations is a sliding window.

Other patterns: **stream-static joins** enrich a stream with a dimension table (a customer lookup); **stream-stream joins** need watermarks on both sides and a time bound, because state for unmatched rows is kept only until the watermark passes; **deduplication** (`dropDuplicatesWithinWatermark`) removes repeated events by id, using the watermark to bound state; and **triggers** control cadence: `processingTime="1 minute"` for continuous micro-batches, `availableNow=True` for incremental batch (process everything new, then stop), which is a cheap way to get "streaming-as-incremental-batch" from a scheduler without a cluster running all day.

> 💡 **Practice Pause 3 (Structured Streaming Job & Model Equivalence):**
> 1. Open `labs/mod-3-3/stream_job.py` in your text editor.
> 2. Implement `run_available_now(spark, input_dir, checkpoint_dir, size_s, delay_s)` using `readStream`, `withWatermark`, `groupBy` on `F.window`, and `writeStream` in `append` mode with `availableNow=True`.
> 3. Run the tests in terminal:
>    `pytest labs/mod-3-3/test_stream.py -v`
> 4. **Success Indicator:** The test suite reports `PASSED` (or skips cleanly if Java runtime is not installed), verifying real Spark Structured Streaming output exactly matches our pure Python watermark model.

:::ask Which situation points to Flink rather than Spark Structured Streaming?
@options
a dashboard refreshed each minute with SQL
* fraud rules needing millisecond latency and timers
a team that already runs Spark, changing little
@why
Structured Streaming is micro-batch, which suits 'within a minute' work and reuses batch skills. Flink processes record by record, with keyed state and timers, which suits very low latency and complex stateful logic.
:::

## @lesson Operating streaming systems
A streaming job is a service that never finishes, and it fails in ways batch does not.

- **Monitor throughput and lag.** Compare the input rate with the processing rate per batch; if processing is slower, lag (Module 3.2) grows without bound. Watch batch duration, source lag, **watermark delay** (how far the watermark trails real time), and **state size**.
- **Plan for backpressure.** Bursts must not crash the job: limit the batch size (`maxOffsetsPerTrigger`, `maxFilesPerTrigger`) and scale resources for peaks.
- **Restarts and upgrades.** Know whether your code change is compatible with the existing checkpoint, keep savepoints or checkpoints safe, and rehearse a restart.
- **Reprocessing.** To fix a bug, you replay history: reset to earlier Kafka offsets, or recompute a period with a batch job from the raw data (Modules 2.2 and 2.3). A design that keeps the raw events lets streaming be approximate and batch exact. (This is the *lambda architecture*: a speed layer plus a batch layer. The *kappa architecture* uses only streaming, replaying the log for reprocessing: simpler, but it needs a log with long retention and a processor fast enough to replay.)
- **Data quality still applies** (Module 2.5): late-event rates, dropped counts, null rates and duplicates as metrics with alerts.
- **Test deterministically.** Do what the lab does: drive the job with files written in a known order (explicit modification times), run it with `availableNow`, and compare with an independent model. Avoid tests that depend on sleeping and wall-clock timing.
- **Cost.** Always-on clusters cost money around the clock. If a result is needed every ten minutes, a scheduled `availableNow` run may be much cheaper than a continuous stream.

> 🛠 **Try it (10 min, Python).** A job receives 100 events per second but can process only 80. Simulate 600 seconds, keeping `lag += arrived - processed` each second, and print the lag. Then drop the input to 50 per second and count how many more seconds it takes the lag to reach zero (processing stays at 80, and the lag cannot go below 0).
>
> **You should see:** a lag of `12000` events after 10 minutes, and `400` seconds to catch up once the input drops to 50 per second (12,000 divided by the spare 30 per second). A job that crashes wakes someone up right away, whereas a job that is merely slower than its input fails quietly; that is why lag is the first metric to alert on.

:::ask A streaming job's input rate is 10,000 events per second but it only processes 8,000. What happens if nobody acts?
@options
the job slows the input down to match itself
Kafka deletes the extra events right away
* lag grows without bound until you scale it
@why
Every second the backlog grows by 2,000 events. Kafka keeps the records, so nothing is lost at first, but results fall further behind real time. Monitor lag and batch duration and add capacity before it matters.
:::

## @lesson Lambda vs. Kappa vs. unified lakehouse, PyFlink & Redpanda, stream joins, and real-time OLAP (Pinot, ClickHouse, Druid) {optional}

Extending Chapters 7 and 8 (ingestion, and queries including streaming) of *Fundamentals of Data Engineering* and Module 6 of the *DataTalksClub Data Engineering Zoomcamp*, four production streaming architectures appear frequently in system design interviews and low-latency platforms:

**1. Evolution of Streaming Architectures: Lambda → Kappa → Unified Lakehouse.**
- **Lambda Architecture (2011):** Ran two separate codebases in parallel—a **Batch Layer** (Hadoop/Spark nightly full accuracy) and a **Speed Layer** (Storm/Flink approximate low-latency)—merged in a serving view. *Fatal flaw:* Maintaining and debugging the exact same business logic in two different frameworks caused constant drift.
- **Kappa Architecture (2014):** Eliminated the batch codebase by treating the **append-only Kafka log** as the single source of truth; to recompute historical logic, you spin up a new streaming consumer instance from offset `0`. *Limitation:* Replaying 2 years of raw events from Kafka takes days and scanning raw Kafka topics for ad-hoc SQL analytics is inefficient.
- **Unified Lakehouse Streaming (Modern Standard):** One codebase (Spark Structured Streaming / Delta Live Tables / **PyFlink**) reads from **Kafka / Redpanda** and writes incremental checkpoints into **Apache Iceberg / Delta Lake** tables on S3/GCS, unifying sub-minute streaming ingestion with petabyte-scale columnar historical backfills.

**2. Local & Production Event Streaming with `Redpanda` and `PyFlink` (Flink SQL).**
In local development and CI (as popularized by *Data Engineering Zoomcamp*), spinning up a full JVM Apache Kafka + ZooKeeper/KRaft cluster is heavy. **Redpanda** is a Kafka-API-compatible broker written in C++: one container, no JVM and no ZooKeeper, and Kafka clients such as `confluent-kafka` and Flink's Kafka connector talk to it unchanged. When paired with **PyFlink's Table API / Flink SQL**, you can declare stateful event-time tumbling windows and watermarks directly in SQL:

```python
# PyFlink Table API / Flink SQL: Event-time 5-minute Tumbling Window with a 30-second Watermark
from pyflink.table import EnvironmentSettings, TableEnvironment

t_env = TableEnvironment.create(EnvironmentSettings.in_streaming_mode())

t_env.execute_sql("""
    CREATE TABLE courier_pings (
        courier_id STRING,
        region_id  STRING,
        speed_kmh  DOUBLE,
        ping_ts    TIMESTAMP(3),
        WATERMARK FOR ping_ts AS ping_ts - INTERVAL '30' SECOND
    ) WITH (
        'connector' = 'kafka',
        'topic' = 'gokirim.gps.pings',
        'properties.bootstrap.servers' = 'redpanda:9092',
        'format' = 'json'
    )
""")

# Stateful event-time window aggregation sinking continuously to Postgres / Iceberg:
t_env.execute_sql("""
    SELECT
        window_start,
        window_end,
        region_id,
        COUNT(DISTINCT courier_id) AS active_couriers,
        AVG(speed_kmh)             AS avg_speed_kmh
    FROM TABLE(
        TUMBLE(TABLE courier_pings, DESCRIPTOR(ping_ts), INTERVAL '5' MINUTES)
    )
    GROUP BY window_start, window_end, region_id
""")
```

**3. Stream-to-Table Lookup Joins vs. Stream-to-Stream Interval Joins.**
- **Stream-to-Table Join (Enrichment):** Joining a live stream of `orders` against a slowly changing `dim_store` table. Only the stream side is buffered; the table side is looked up in memory or broadcast state.
- **Stream-to-Stream Interval Join:** Joining a live stream of `ad_impressions` with a live stream of `ad_clicks` that arrive up to 30 minutes later. **Both streams must be buffered in RocksDB state**, and you **must** define an explicit time-bound interval (`ON click.imp_id = imp.imp_id AND click.ts BETWEEN imp.ts AND imp.ts + INTERVAL '30' MINUTE`) plus watermarks on *both* streams—otherwise Flink/Spark must keep every impression in state forever and will crash with an Out-Of-Memory (OOM) error!

**4. Real-Time OLAP Serving Engines (`ClickHouse`, `Apache Pinot`, `Apache Druid`, `StarRocks`).**
When a user-facing product (like live surge-pricing maps or merchant analytics) requires **5,000 concurrent queries per second at `< 100 ms` p95 latency** over fresh Kafka streams, traditional cloud warehouses (BigQuery / Snowflake, designed for `1–10 second` analytical scans) are too slow and expensive. Real-time OLAP databases (**ClickHouse**, **Apache Pinot**, **Apache Druid**) ingest directly from Kafka topics, maintain pre-sorted sparse primary indexes / star-tree rollup indexes, and serve sub-100ms aggregations at high concurrency.

> 🛠 **Try it (15 min, Python).** Simulate an impression-click stream join without Flink. With `random.seed(42)`, make 20,000 impressions, one every half second, and give 10% of them a click between 1 and 1,800 seconds later; sort all events by time. Process them in order, keeping impressions in a dict and counting a match when a click finds its impression no more than 30 minutes old. Run it twice: once keeping every impression forever, once also dropping impressions older than 30 minutes before each event (the time bound plus a watermark). Track the largest number of impressions held in state.
>
> **You should see:** both runs match the same number of clicks (about 2,000; ours was `1999`, and yours will differ a little, because it depends on the order in which you draw the random numbers). Without the bound the state peaks at `20000` impressions and is still `20000` at the end: it grows for as long as the stream runs. With the bound it never holds more than `3601` (30 minutes of impressions, an exact number: 2 per second for 1,800 seconds, plus one) and ends at a few hundred (`404` in our run, depending on the last events). A real stream runs for months, so only the second version survives. Measured with Python 3.14.

## @lab Lab: model a watermark, then check it against real Spark
Part A: write the windowing and watermark logic in plain Python until it reproduces the behaviour in the lesson's table. Part B: write the real Structured Streaming job that reads files as micro-batches, and verify that **Spark agrees with your model**, restarts correctly from its checkpoint, and drops a genuinely late event.

### @steps
1. Install and run the tests (Part B needs Java 17+; it is skipped if Java is missing):

```bash
python -m pip install -r labs/mod-3-3/requirements.txt
pytest labs/mod-3-3 -v         # fail at first
```

> **Already did Practice Pauses 1–3?** If you already finished `windows.py` and `stream_job.py` during the lessons above, skip Steps 2–5 below and jump straight to Step 6 (experiments) and Practice Pause 5.

2. **Part A.** Open `labs/mod-3-3/windows.py`. Implement `window_starts`, then `WindowedAggregator` following the rules in its docstring. Run `pytest labs/mod-3-3/test_windows.py -v`. Use the lesson's table as your reference; when a test fails, draw the watermark and the state after each batch.
3. Pay special attention to the three tests of the *late* behaviour: late but counted, dropped, and an old event does not recreate a window.

> 💡 **Practice Pause 4 (Full Python Model Verification):**
> 1. In terminal, run the complete test suite for Part A:
>    `pytest labs/mod-3-3/test_windows.py -v`
> 2. Verify against the reference solution:
>    `LAB_DIR=reference pytest labs/mod-3-3/test_windows.py -v`
> 3. **Success Indicator:** All 10 tests in `test_windows.py` report `PASSED` in milliseconds in pure Python with zero external servers.

4. **Part B.** Open `labs/mod-3-3/stream_job.py`. `write_batch_file` is provided (note why it sets the file modification times: Spark reads files in that order). Implement `run_available_now` using the recipe in its docstring.
5. Run `pytest labs/mod-3-3/test_stream.py -v` (about 20 seconds). The first test is the centrepiece: for the same five batches, Spark's emitted windows equal your model's.
6. Experiment: remove `withWatermark` and watch Spark reject `append` mode with an `AnalysisException` (and if you switch to `update` mode, watch state grow without bound); change the delay to 0 and 10 minutes and predict what your model emits before you run Spark; print `query.recentProgress` to see the watermark and the number of state rows per batch.
7. Optional: with a Kafka broker (`docker compose up -d redpanda`), publish JSON events with the Part B producer from Module 3.2 and run the Kafka version of the job from the lesson.

> 💡 **Practice Pause 5 (Full Verification & Proof Token):**
> 1. In terminal, run both test suites (Part A and Part B):
>    `pytest labs/mod-3-3/test_windows.py -v && pytest labs/mod-3-3/test_stream.py -v`
> 2. Generate the verification proof token:
>    `python3 scripts/prove.py mod-3-3`
> 3. **Success Indicator:** All 10 tests in `test_windows.py` and all 5 tests in `test_stream.py` report `PASSED`, and your completion proof token is printed to terminal.

### @files
- labs/mod-3-3/windows.py :: Part A working file: windows and the watermark model :: starter
- labs/mod-3-3/test_windows.py :: Part A tests (10) :: test
- labs/mod-3-3/stream_job.py :: Part B working file: the Structured Streaming job :: starter
- labs/mod-3-3/test_stream.py :: Part B tests (5; compare Spark with your model) :: test
- labs/mod-3-3/requirements.txt :: pytest, pyspark :: config
- labs/mod-3-3/reference/windows.py :: Part A reference (try first!) :: reference
- labs/mod-3-3/reference/stream_job.py :: Part B reference :: reference

### @deliverables
- Part A: all 10 tests pass
- Part B: all 5 tests pass, including "Spark emits exactly what the model predicts"
- You can explain, with the lesson's table, why the 10:03 event of batch 2 is counted while a 10:02 event arriving later is dropped

### @verify
```bash
pytest labs/mod-3-3/test_windows.py -v
pytest labs/mod-3-3/test_stream.py -v        # needs Java
```

Known-good run: prefix with `LAB_DIR=reference`.

## @chaos The streaming job with no watermark
### @scenario
A fraud-detection job counts transactions per account in 5-minute windows from a Kafka topic. It was built as a quick prototype and went to production without a watermark. For two weeks it ran fine. Then 50,000 IoT-style payment terminals, offline since a regional outage, reconnect and upload two days of buffered transactions at once.

Over the next hours the job's state store grows from a few hundred megabytes to tens of gigabytes, batch durations climb, executors are killed for exceeding memory, and the job restarts in a loop from the same checkpoint, because the state it is trying to reload no longer fits.

### @cause
Without a watermark, Spark can never know that a window is final, so it keeps the state of every window ever seen, since any event might still arrive. In normal operation that growth is slow enough to go unnoticed; the backfill of two days of events created thousands of old windows per account at once, and none could ever be evicted. In the lab's measurement, the same job grew linearly to 1,187 state rows in 120 batches without a watermark, versus a flat 40 with one.

A second contributing factor: the job's dashboards showed throughput, not state size or watermark delay, so nothing warned the team that the state was growing.

### @fix
1. Add `withWatermark("event_time", "<delay>")` with a delay chosen from the measured lateness of the data, so that state is bounded and windows are emitted once final.
2. Decide what to do with data older than the delay: count it, and write raw events to storage so that a batch job recomputes exact figures. The device backlog is exactly this case.
3. Recover the failing job: because the checkpoint holds the bloated state, start from a **new checkpoint** at a known-good offset (accepting a reprocessing of recent data) with the corrected query.
4. Use a **RocksDB state store** for large state, and cap memory and batch size so bursts cannot overwhelm executors.
5. Monitor **state size, watermark delay and batch duration**, alert on their growth, and test a backlog scenario before going live.

### @pattern
In event-time processing, the watermark is what bounds state and defines "final". A stateful streaming job without one is a memory leak with a deadline.

## @quiz
### What is the main reason to aggregate by event time rather than processing time?
- [ ] Event time is always smaller than processing time, so the aggregations finish a lot faster
- [x] Late and out-of-order arrivals would otherwise put events into the wrong time windows of a job
- [ ] Processing time cannot be read by streaming engines, so they have no other choice but this one
- [ ] Event time lets the job skip the checkpoint, because no state has to be kept at all in that case

> Delays, outages and retries make arrival time unreliable. Grouping by when events actually happened gives results that do not depend on network or backlog timing.

### A 5-minute window slides by 1 minute. In how many windows does a single event fall?
- [ ] One, because an event can only belong to the window that starts at its own timestamp value
- [ ] Two, because the window it starts and the window before it both contain the same event
- [x] Five, since the window size divided by the slide gives the number of overlapping windows
- [ ] Sixty, because there is one window per second in each of the minutes of the window length

> With size 300 s and slide 60 s, every event is contained in 300 / 60 = 5 overlapping windows.

### With a 2-minute watermark delay, the newest event seen so far is 10:07. What does the watermark say?
- [ ] That every window ending before 10:09 is finished, because it adds the delay to the newest time
- [x] That events older than 10:05 are unlikely to arrive, so windows ending by then can be closed
- [ ] That the stream will be paused until 10:09 to give the late events time to arrive in good order
- [ ] That all events with a timestamp after 10:05 are going to be dropped from the final result

> Watermark = newest event time minus the delay = 10:05. Windows ending at or before it may be emitted; events newer than it are never dropped.

### An event with event time 10:03 arrives when the watermark is 10:05, and its window [10:00, 10:05) has not been emitted yet. What happens?
- [ ] It is dropped immediately, since its time is older than the current watermark of the stream
- [ ] It creates a new, extra window for itself so that the late event can be reported separately
- [x] It is counted in its own window, which is emitted when that same batch comes to an end
- [ ] The whole job fails with an exception that reports a violation of the watermark rule

> Late is not dropped: an event behind the watermark is still counted as long as its window is open. Only events for windows that have already been emitted are dropped.

### Why does a streaming aggregation without a watermark eventually run out of memory?
- [ ] The checkpoint files are loaded into the executor memory again after every single micro-batch
- [ ] Spark adds a copy of each incoming record to the driver, which runs out of memory first
- [x] State for every window must be kept forever, since any event might still arrive for any of them
- [ ] The output mode complete is switched on automatically, and it writes the entire result each time

> The watermark is what allows old windows to be finalised and deleted. Without it, state grows without bound (in the lab: 1,187 rows after 120 batches against a flat 40).

### You rerun a streaming job with the same input but a NEW, empty checkpoint directory. What do you expect?
- [ ] Nothing is processed, because the job remembers all earlier input in the source system itself
- [ ] The job continues from the last offset, since the progress is stored together with the input data
- [x] The job starts over and emits the same windows again, because progress lives in the checkpoint
- [ ] The job fails with an error, because a checkpoint directory must exist before a job can start

> Offsets and state are stored in the checkpoint. A new checkpoint means no progress is known, so everything is reprocessed and re-emitted.

### Which combination is needed for end-to-end exactly-once results from a Spark streaming job?
- [ ] A replayable source and a very large watermark delay, so that no event is ever late
- [x] A replayable source, checkpointed progress, and an idempotent or transactional sink
- [ ] Any source and a sink that appends rows, as long as the job restarts quickly after a failure
- [ ] A checkpoint on the local disk of the driver and the output mode set to complete

> The source must be re-readable, the engine must restore a consistent state, and writing the same batch twice must not duplicate output (idempotent writes keyed by batch id, or atomic table commits).

### What is the key difference between Spark Structured Streaming and Flink?
- [ ] Spark cannot read from Kafka, while Flink includes a built-in Kafka server inside its own engine
- [ ] Flink is only able to process data in batches, and Spark is the only engine that really streams
- [x] Spark runs small batches with seconds of latency, while Flink handles records one at a time
- [ ] Spark has no event-time windows, which are only available in Flink and Kafka Streams

> Spark's model is micro-batch on a batch engine (simple, high throughput, seconds of latency); Flink processes record by record with millisecond latency and richer state and timer control. Both support event time and watermarks.

## @resources
- [Apache Spark documentation (see Structured Streaming)](https://spark.apache.org/docs/latest/)
- [Apache Flink](https://flink.apache.org/)
- [Apache Kafka documentation](https://kafka.apache.org/documentation/)
