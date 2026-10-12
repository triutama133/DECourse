---
title: Capstone: Real-Time Event Streaming, Watermarks & Late Data Handling
duration: 3 weeks
summary: Build a high-throughput, fault-tolerant real-time stream processor on fleet telemetry data: parse continuous vehicle telemetry events with simulated cellular network jitter, calculate event-time aggregations across tumbling and sliding windows, track monotonic high watermarks with bounded allowed lateness, quarantine expired late events into an auditable Dead-Letter Queue (DLQ), commit consumer offsets atomically with in-flight window accumulators, and emit aggregated metrics idempotently into DuckDB.
why: In production data engineering, data arrives as a continuous, messy, and unordered stream from mobile devices, connected vehicles, and IoT sensors. Clock skew, poor cellular signal, and network retries guarantee that events arrive out of order. If your pipeline groups events by processing time (when the server receives the packet), your metrics will distort during network spikes, triggering false surge billing and flawed operational decisions. This capstone challenges you to build a true event-time streaming engine from scratch that handles watermarks, late arrivals, and crash recovery with zero duplicate metrics.
---

## @outcomes
- Distinguish event-time, ingestion-time, and processing-time semantics under real-world mobile network latency and clock jitter
- Implement event-time tumbling and sliding window bucketing algorithms with strict mathematical boundary alignment
- Track monotonic high watermarks and enforce allowed lateness policies to process out-of-order event streams accurately
- Isolate late-arriving events that breach watermark boundaries into an auditable Dead-Letter Queue (DLQ) with diagnostic metadata
- Guarantee crash-resilient stream checkpointing via atomic offset commits and idempotent analytical database upserts

## @prereq
Modules 0.2 (terminal and virtual environment), 1.2 (idempotency, retries, and atomic operations), 2.1 (DuckDB and analytical storage), 3.2 (Kafka, Redpanda, and event logs), and 3.3 (Stream processing, windowing, and watermarks). You need Python 3.10+, about 1 GB of free disk space, and DuckDB installed.

## @lesson How this capstone works
Every lab earlier in the course provided predefined test files, unit assertions, and guided boilerplate code. In this capstone, **you receive an architectural contract, realistic streaming telemetry, and an automated verification suite that stress-tests your stream processor.**

The verification harness does not evaluate stylistic choices; it verifies **observable stream processing outcomes and state contracts**:
- Does your processor calculate accurate event-time window metrics (trips, passengers, total fares, and average fares) in DuckDB?
- When events arrive out of order due to simulated cellular jitter, are valid out-of-order events incorporated into their proper open windows?
- When severely delayed events arrive after a window has closed, are they rejected from the database and routed cleanly to a Dead-Letter Queue (`dlq/late_events.jsonl`)?
- When the processor is killed mid-stream, does it resume from its last committed offset and open window accumulators with **zero duplicate window rows** and **zero dropped records**?
- When configured for sliding windows (`--window-slide 60`), does every incoming event correctly update all overlapping window buckets?

The rules of engagement:
1. **Build it yourself.** Work in your own isolated directory (e.g. `~/fleet`) inside your virtual environment. Your workspace contains two files you create: `stream_processor.py` and `profile.json`.
2. **Verify incrementally after each step:**
   ```bash
   python3 labs/mod-4-3/check.py ~/fleet --step 1
   python3 labs/mod-4-3/check.py ~/fleet --step 2
   python3 labs/mod-4-3/check.py ~/fleet --step 3
   python3 labs/mod-4-3/check.py ~/fleet --step 4
   python3 labs/mod-4-3/check.py ~/fleet --step 5
   python3 labs/mod-4-3/check.py ~/fleet --step all
   ```
3. **Use tiered hints when stuck:** You can request `--hint 1` (a subtle nudge), `--hint 2` (conceptual explanation), or `--hint 3` (detailed technical hint). Wrestle with the problem for at least 30 minutes before requesting a hint.
4. **The checker attacks your processor.** In steps 3, 4, and 5, the verification suite feeds controlled out-of-order events, simulates abrupt mid-stream terminations, and tests overlapping sliding windows against ground-truth mathematical baselines.

Setup your workspace:
```bash
mkdir -p ~/fleet && cd ~/fleet
python3 -m venv venv && source venv/bin/activate
pip install -r labs/mod-4-3/requirements.txt
python3 labs/mod-4-3/fetch_data.py
cp labs/mod-4-3/starter/stream_processor.py ~/fleet/stream_processor.py
```

## @lesson Time semantics: Event time, processing time & out-of-order streams
In batch processing, time is static: a file contains historical rows from yesterday, and you run a SQL query over the whole dataset. In stream processing, time is continuous and multifaceted. There are three distinct notions of time:

```
[Event Occurrence in Taxi] ─────> [Network Ingestion Gateway] ─────> [Stream Processor Engine]
       Event Time                       Ingestion Time                     Processing Time
 (t = 1704067250 UTC)                (t = 1704067275 UTC)                (t = 1704067282 UTC)
```

1. **Event Time:** The instant at which the physical event occurred in the real world, captured by the sensor or client device clock (e.g., when a passenger tapped their credit card in taxi `taxi_12`).
2. **Ingestion Time:** The instant at which the event crossed the firewall and was appended to the distributed messaging log (e.g., Kafka or Redpanda partition leader).
3. **Processing Time:** The local wall-clock time of the worker node executing the window aggregation code.

### The Processing Time Trap:
Why not simply use processing time? It requires no stateful watermarking, no late data handling, and zero buffer queues.
Consider connected fleet vehicles driving through urban tunnels or cellular dead zones:
- Ten taxis complete trips between 08:00 and 08:05.
- Because they are inside an underground tunnel, their cellular modems cannot transmit packets.
- At 08:15, all ten taxis emerge from the tunnel and establish 5G connectivity.
- Their telemetry buffers dump 1,000 buffered events into the ingestion gateway simultaneously within two seconds.

If you group events by **processing time**, your pipeline will register 0 trips between 08:00 and 08:05, and a massive spike of 1,000 trips between 08:15 and 08:16! An automated surge-pricing system or fleet capacity allocator will conclude that an unprecedented emergency surge occurred at 08:15 and raise passenger fares unfairly, while assuming 08:00 had zero customer demand.

Only **event-time windowing** provides truthful analytical metrics. Regardless of when the data arrives at the server, an event from 08:02:30 must be assigned to the `[08:00:00, 08:05:00)` window.

### Meet the Seed Dataset:
Our seed stream (`labs/mod-4-3/data/events_seed.jsonl`) consists of 1,000 deterministic fleet telemetry events spanning 50 vehicles across dense urban taxi zones:
```json
{
  "event_id": "evt_0001",
  "vehicle_id": "taxi_29",
  "event_time": 1704067266,
  "zone_id": 186,
  "fare_amount": 28.53,
  "trip_distance": 5.48,
  "passenger_count": 1
}
```
Because mobile devices experience variable network jitter, **346 events in this stream arrive out of order** (where `event_time < previous_event_time`). Your processor must restore order mathematically.

## @lesson Watermarks, allowed lateness & window eviction mechanics
If we aggregate by event time, a critical dilemma arises: **how long must the stream processor wait before declaring a window complete and emitting its metrics?**
If a taxi's cellular modem reconnects three days late, can we keep all past windows open indefinitely? No. Keeping millions of historical windows open in memory would exhaust RAM (Out Of Memory crash).

Enter **watermarks** (conceptualized by Tyler Akidau et al. in the Google MillWheel and Apache Beam models).

```
Event Stream:  [e1: t=100] ──> [e2: t=250] ──> [e3: t=190] ──> [e4: t=400]
                                                                     │
                                                 Delay = 120s        ▼
                                          Watermark = 400 - 120 = 280
                                          Windows with end <= 280 are CLOSED!
```

### 1. Watermark Definition:
A watermark is a monotonically non-decreasing metric timestamp representing temporal completeness. When watermark $W = t$, the streaming engine asserts:
$$\text{"We expect no further events with event\_time } \le t \text{ to arrive."}$$

In our streaming engine, we implement **bounded out-of-orderness watermarks** with an allowed lateness delay $D$:
$$W_{\text{candidate}} = t_{\text{event}} - D$$
$$W = \max(W_{\text{previous}}, W_{\text{candidate}})$$

Watermarks must **never move backward**, even when an out-of-order event arrives with a timestamp smaller than the newest event seen.

### 2. Window Lifecycles and Eviction:
A window is defined by a half-open temporal interval $[t_{\text{start}}, t_{\text{end}})$.
- **Open Window:** While $t_{\text{end}} > W$, the window remains open in memory. Any event falling into this interval is aggregated into the window accumulator.
- **Eviction / Closure:** When watermark advances such that $t_{\text{end}} \le W$, the window is closed. Its final aggregates are emitted to analytical storage (DuckDB), and its in-memory accumulator is evicted to reclaim RAM.

### 3. Out-of-Order vs. Late Data:
It is crucial to distinguish **out-of-order events** from **late events**:
- **Out-of-order event:** An event whose $t_{\text{event}} < t_{\text{newest\_seen}}$, but whose candidate window has not closed yet ($t_{\text{end}} > W$). This event is **valid and welcomed**; it is folded into the open window accumulator.
- **Late event:** An event whose candidate window has already been closed and evicted ($t_{\text{end}} \le W$). The window aggregate was already emitted and published to downstream consumers. The event cannot be included without rewriting published history, so it is **dropped and quarantined**.

## @lesson Consumer offsets, checkpointing & analytical idempotency
Streaming engines run continuously for months. Hardware failures, operating system kernel updates, and container restarts are guaranteed occurrences. A robust engine must survive crashes with **exactly-once processing semantics** at the storage layer.

```
Incoming Stream (JSONL / Kafka)
           │
           ▼
┌───────────────────────┐
│ Stream Processor      │ ──[Save Checkpoint]──> offsets.json.tmp ──> [os.replace] ──> offsets.json
│ • Reads line N        │
│ • Updates accumulators│
└──────────┬────────────┘
           │
           ▼ [Emit Window via Temp Staging Table]
┌───────────────────────┐
│ DuckDB Warehouse      │ (DELETE WHERE pk IN staging; INSERT SELECT * FROM staging;)
│ PRIMARY KEY:          │
│ (start, end, zone_id) │
└───────────────────────┘
```

### 1. The Checkpoint Contract (`offsets.json`):
To resume processing without reprocessing the entire stream from scratch, the processor tracks its consumption progress in a checkpoint state file:
```json
{
  "last_offset": 200,
  "high_watermark": 1704071400,
  "total_events_processed": 200,
  "total_late_events_dropped": 0,
  "total_windows_emitted": 118,
  "open_windows": {
    "1704071100_1704071400_186": {
      "trips": 4,
      "passengers": 7,
      "total_fare": 112.50
    }
  }
}
```

### 2. The In-Flight Accumulator Preservation Rule:
A common architectural error in novice streaming systems is checkpointing *only* the offset integer (`last_offset: 200`) while ignoring in-memory window accumulators.
If the processor terminates while a 5-minute window is halfway through accumulating, restarting with an empty in-memory state will split the window in two: the pre-crash trips were emitted with incomplete counts, and post-crash trips form a separate incomplete window!
To guarantee exact stream continuity, a state checkpoint must serialize both the stream offset **and the open window accumulators (`open_windows`)**. On restart, open accumulators are restored into memory seamlessly.

### 3. Atomic State Commit via POSIX Rename:
Writing directly to `offsets.json` risks corrupting the file if the operating system crashes mid-write:
```python
tmp_file = state_path.with_suffix(state_path.suffix + ".tmp")
tmp_file.write_text(json.dumps(state_data, indent=2))
tmp_file.replace(state_path)  # Atomic on POSIX filesystems via rename(2)
```
Any concurrent reader or recovering process always sees either the complete prior checkpoint or the complete new checkpoint, never a half-flushed buffer.

### 4. Idempotent Storage Emission in DuckDB:
When an engine crashes and recovers, it may replay events from the last committed checkpoint. If your database write is a naive `INSERT`, duplicate rows will pollute analytical metrics.
We enforce idempotency in DuckDB using composite primary keys and atomic staging swaps:
```sql
CREATE TABLE IF NOT EXISTS windowed_metrics (
    window_start TIMESTAMP,
    window_end TIMESTAMP,
    zone_id INTEGER,
    total_trips BIGINT,
    total_passengers BIGINT,
    total_fare DOUBLE,
    avg_fare DOUBLE,
    emitted_at TIMESTAMP,
    PRIMARY KEY (window_start, window_end, zone_id)
);
```
During emission, rows are inserted into a temporary staging table, existing rows matching `(window_start, window_end, zone_id)` are deleted in DuckDB, and the latest aggregated metrics are inserted cleanly.

## @lesson Tumbling vs. sliding windows and Dead-Letter Queue (DLQ)
Real-time streaming architectures employ multiple windowing patterns depending on business requirements.

```
Tumbling Windows (Size = 300s, Slide = 300s): Non-overlapping, contiguous fixed blocks
[00:00 - 05:00)        [05:00 - 10:00)        [10:00 - 15:00)

Sliding Windows (Size = 300s, Slide = 60s): Overlapping moving blocks
[00:00 - 05:00)
   [01:00 - 06:00)
      [02:00 - 07:00)
         [03:00 - 08:00)
            [04:00 - 09:00)
```

### 1. Tumbling Windows:
Tumbling windows partition time into non-overlapping, contiguous chunks.
For window size $L$, an event at timestamp $t$ belongs to exactly **one** window starting at:
$$t_{\text{start}} = \left\lfloor \frac{t}{L} \right\rfloor \times L$$
$$t_{\text{end}} = t_{\text{start}} + L$$
Tumbling windows are ideal for discrete periodic financial settlements (e.g., hourly revenue reconciliation, daily driver payouts).

### 2. Sliding Windows:
Sliding windows provide a continuous smoothed metric over time (e.g., 5-minute moving average speed computed every 60 seconds).
Given window duration $L$ and slide step $S$ (where $S < L$):
A single event at timestamp $t$ falls into multiple overlapping windows starting at integer multiples $k \times S$ such that:
$$k \times S \le t < k \times S + L$$
Solving for integer $k$:
$$t - L < k \times S \le t \implies \frac{t - L}{S} < k \le \frac{t}{S}$$
The discrete window indices $k$ range from:
$$k_{\min} = \left\lfloor \frac{t - L + S}{S} \right\rfloor \quad \text{to} \quad k_{\max} = \left\lfloor \frac{t}{S} \right\rfloor$$
For $L = 300\text{s}$ and $S = 60\text{s}$, an event falls into exactly $\frac{300}{60} = 5$ overlapping windows! Your accumulator logic must update all 5 buckets simultaneously.

### 3. Dead-Letter Queue (DLQ) Quarantine:
When an event arrives whose candidate windows have all been evicted ($t_{\text{end}} \le W$), what should happen?
Silently discarding the event destroys financial traceability; allowing it into closed windows corrupts historical ledger reports.
The production solution is a **Dead-Letter Queue (DLQ)**. The dropped event is appended to `<output-dir>/dlq/late_events.jsonl` with audit metadata:
```json
{
  "error_code": "LATE_EVENT",
  "event_id": "evt_0842",
  "event_time": 1704067280,
  "current_watermark": 1704067830,
  "dropped_at": "2024-01-08T12:00:00Z",
  "raw_payload": { ... }
}
```
Site reliability engineers can monitor DLQ arrival rates, alert when cellular towers cause excessive packet lag, and replay quarantined records into batch reconciliation pipelines.

## @lab Lab: five steps to a production streaming engine
Build `stream_processor.py` and `profile.json` in your own workspace, one step at a time, running the checker after each step. The checker feeds real fleet streaming telemetry, introduces network jitter, drops simulated mid-flight sockets, verifies late-event DLQ routing, and asserts sliding window mathematical invariants.

### @steps
1. **Setup.** Follow the setup instructions in Lesson 1 (create `~/fleet`, activate virtual environment, install requirements, run `fetch_data.py`, copy `starter/stream_processor.py`). Inspect `events_seed.jsonl` with Python or DuckDB.
2. **Step 1: Raw stream profiling.** Profile the 1,000 seed events and write `profile.json` with 7 keys: `total_stream_events`, `min_event_time`, `max_event_time`, `distinct_vehicles`, `out_of_order_count`, `busiest_zone_id`, and `busiest_zone_event_count`. Verify with `--step 1`.
3. **Step 2: Baseline tumbling event-time windows.** Implement CLI argument parsing and tumbling window aggregation (`--window-size 300`, `--watermark-delay 120`). Aggregate `total_trips`, `total_passengers`, `total_fare`, and `avg_fare` into `<output-dir>/warehouse.duckdb` (table `windowed_metrics`). Ensure re-running the processor produces zero duplicate rows. Verify with `--step 2`.
4. **Step 3: Watermark progression & late event DLQ.** Track monotonic watermark ($W = \max(W, t - \text{delay})$). Evict closed windows when $t_{\text{end}} \le W$. Quarantine late-arriving events that fall outside open windows into `<output-dir>/dlq/late_events.jsonl` with `error_code: "LATE_EVENT"`. Verify with `--step 3`.
5. **Step 4: Consumer offset checkpointing & recovery.** Save stream offsets and open window accumulators atomically to `--state-file` (`.tmp` + `os.replace`). The checker simulates a process crash after 150 events, resumes with the full stream, and verifies that the engine completes without duplicating or losing records. Verify with `--step 4`.
6. **Step 5: Sliding windows.** Add support for `--window-slide` (e.g., size 300s, slide 60s). Route each incoming event to all active overlapping window buckets. Verify that total aggregated trip and fare counts match the theoretical multi-window factor ($\frac{\text{size}}{\text{slide}} \times \text{raw}$). Verify with `--step 5` and `--step all`.
7. **Proof.** When `--step all` passes, run `python3 scripts/prove.py mod-4-3 ~/fleet` to generate your proof code for the course app.

### @files
- labs/mod-4-3/starter/stream_processor.py :: Your starter template: copy it to your workspace and build the processor there :: starter
- labs/mod-4-3/check.py :: The automated checker: five steps, tiered hints, and chaos injection harness :: test
- labs/mod-4-3/fetch_data.py :: Generates and verifies the seed stream dataset with SHA-256 integrity :: config
- labs/mod-4-3/requirements.txt :: duckdb, pyarrow :: config

### @deliverables
- `python3 labs/mod-4-3/check.py ~/fleet --step all` passes on your computer inside your virtual environment
- You can explain why processing time causes artificial metric spikes during mobile network bursts
- You can explain how bounded watermarks allow out-of-order events while bounding memory consumption
- You can explain why stream checkpoints must serialize in-flight window accumulators alongside consumer offsets
- Your `NOTES.md` records your architectural reflections on the trade-offs between low latency and late data completeness

### @verify
```bash
python3 labs/mod-4-3/check.py ~/fleet --step all
python3 scripts/prove.py mod-4-3 ~/fleet
```

## @chaos The cellular dead-zone burst & billing window distortion
### @scenario
At 08:30 on a rainy Monday morning, commuter vehicle traffic entered a major 3-kilometer highway tunnel under the bay. Cellular signal dropped completely for thousands of vehicles. When vehicles exited the tunnel 12 minutes later, their onboard telematics devices flushed 45,000 buffered GPS trip completion events into the central Kafka cluster in less than five seconds.

The engineering team's legacy stream processing job grouped incoming records by **processing time** (using `datetime.now()` at the ingestion server). Within five seconds, the 08:42 processing-time window recorded 45,000 completed trips, while the windows between 08:30 and 08:41 recorded zero trips. An automated demand algorithm flagged an unprecedented demand surge, multiplying dynamic passenger fares by 4.5x and dispatching dozens of empty emergency support vans to the tunnel exit. Concurrently, driver earnings reports calculated zero trips during the tunnel crossing, triggering hundreds of support tickets.

### @cause
The legacy processor conflated ingestion arrival time with physical event occurrence time. Because it lacked event-time windowing and watermark tracking, network transit delays were falsely interpreted as physical real-world demand swings.

### @fix
1. **Switch to event time:** Window boundaries must be computed strictly from the vehicle sensor's GPS timestamp (`event_time`).
2. **Implement bounded watermarks:** Advance watermark monotonically with a configured allowed lateness delay (e.g., 15 minutes for highway transit).
3. **Quarantine true stragglers:** If an event arrives after its 15-minute watermark window has closed, reject it from active real-time operational windows and route it to an auditable Dead-Letter Queue for offline reconciliation.

### @pattern
Decouple event time from network arrival time in all real-time architectures. Allow out-of-order events within a bounded watermark delay, preserve in-flight accumulators across restarts, and isolate late data into a DLQ without polluting finalized production windows.

## @quiz
### Why does grouping streaming telemetry by processing time produce dangerous analytical errors during mobile network disruptions?
- [ ] Processing time requires specialized hardware acceleration that causes excessive battery drain on mobile vehicle devices
- [x] Network latency bursts concentrate queued records into artificial spikes instead of their true physical occurrence times
- [ ] Processing time forces analytical databases to lock tables exclusively and reject all concurrent analytical dashboard queries
- [ ] The JSON format strictly forbids timestamps generated by operating system clocks on Linux client vehicle containers

> When mobile clients experience connectivity dead zones, they buffer events locally and transmit them in sudden bursts upon reconnecting. If grouped by processing time, all buffered events fall into the single arrival window, creating an artificial demand spike while falsely depicting earlier periods as empty.

### How does a bounded out-of-orderness watermark behave when an event arrives with a timestamp smaller than the highest timestamp previously observed?
- [ ] The watermark resets backward to match the smaller timestamp and reopens previously evicted analytical window buckets
- [x] The watermark remains strictly unchanged because watermarks are monotonic and can only advance forward to larger timestamps
- [ ] The processor crashes with an unhandled timestamp exception and purges all active consumer group offsets from the brokers
- [ ] The watermark pauses the entire distributed streaming pipeline until an external human administrator confirms network health

> Watermarks represent a guarantee of temporal completeness and are strictly monotonic (non-decreasing). When an out-of-order event arrives, the watermark retains its current high value: $W = \max(W_{\text{prev}}, \text{ts} - \text{delay})$. It never regresses backward.

### In event-time stream processing, what is the critical difference between an out-of-order event and a late event?
- [ ] Out-of-order events arrive from cellular modems while late events are generated exclusively by fixed fiber-optic IoT sensor infrastructure
- [x] An out-of-order event falls into an open window whose end exceeds the watermark, while a late event belongs to an already closed window
- [ ] Out-of-order events are routed to a Dead-Letter Queue while late events are silently dropped without any audit log recording
- [ ] Out-of-order events contain missing primary key identifiers while late events contain negative financial transaction amounts

> An event is out of order if it arrives after events with higher timestamps, but its candidate window remains open ($t_{\text{end}} > W$). It is successfully aggregated. An event is late when its window has already closed ($t_{\text{end}} \le W$); because that window was already published, the late event is quarantined into a DLQ.

### For sliding windows with duration 300 seconds and slide step 60 seconds, how many distinct overlapping windows will an event at timestamp 1704067250 belong to?
- [ ] Exactly one window because streaming engines assign each discrete record to a single unique window bucket to avoid duplicate counts
- [x] Exactly five overlapping windows because the window duration divided by the slide step equals five overlapping 60-second intervals
- [ ] Exactly ten overlapping windows because each sliding window bucket requires a separate bidirectional pairing with adjacent bounds
- [ ] Exactly zero windows until the high watermark advances past the upper boundary of the entire hourly analytical partition block

> In sliding windows, the number of overlapping windows containing any timestamp is $\frac{\text{duration}}{\text{slide}}$. With duration 300s and slide 60s, $\frac{300}{60} = 5$. The event belongs to all five windows spanning $[1704067020, 1704067320)$ through $[1704067260, 1704067560)$.

### Why must a stream processor checkpoint its in-memory window accumulators alongside consumer stream offsets in state.json?
- [ ] Because the DuckDB storage engine requires external JSON state files to recreate its internal columnar compression tables
- [x] To prevent in-flight windows from splitting into incomplete fragments if the processor crashes and restarts before a window closes
- [ ] Because the Linux POSIX kernel automatically clears all analytical database tables whenever a running Python script exits abruptly
- [ ] To encrypt the offset integers with a cryptographic signature that prevents unauthorized replay attacks on public cloud networks and gateways

> If an engine checkpoints only the offset integer, any crash mid-window leaves the in-memory window state lost. On restart, pre-crash events cannot be merged with post-crash events, creating fragmented windows with partial counts. Persisting `open_windows` ensures seamless resumption.

### How does an analytical warehouse destination guarantee idempotency when a stream processor re-emits window aggregates after recovering from a crash?
- [ ] By rejecting any subsequent incoming batch that contains timestamps identical to previously processed data with an HTTP error
- [x] By defining a composite primary key on window boundaries and zone ID, deleting existing matching rows, and inserting updated records
- [ ] By automatically shutting down the entire streaming pipeline whenever an emitted record contains an identical zone identifier
- [ ] By saving all window metrics into unversioned append-only text logs and delegating deduplication to downstream business dashboard users

> Idempotent storage writes ensure that replaying an event batch produces identical database state. By creating a composite primary key on `(window_start, window_end, zone_id)` and executing an upsert (staging table insert followed by atomic replace), re-emitted windows overwrite stale state without duplicating rows.

### Why is an atomic file swap pattern (writing to .tmp and using os.replace) required when persisting stream checkpoints to disk?
- [ ] Because standard Python file write functions cannot serialize complex dictionary objects containing nested floating-point numerical values on disk
- [x] Because writing directly to the target file leaves a corrupted, half-written JSON payload if the process is killed in the middle of a write
- [ ] Because the POSIX operating system requires temporary file extensions before granting write permissions to user application processes
- [ ] Because atomic renaming automatically synchronizes file contents across multiple physical server nodes in a distributed cloud cluster

> If a server loses power or the operating system terminates a process mid-write, writing directly to `offsets.json` leaves the file truncated and corrupt, destroying state history. Writing to a `.tmp` file and executing `os.replace` guarantees an atomic rename: the file is always either the complete prior state or the complete new state.

### What is the primary operational role of a Dead-Letter Queue (DLQ) in a production event streaming architecture?
- [ ] To store valid high-priority events so they can be processed ahead of standard streaming traffic during peak business demand periods
- [x] To quarantine expired or malformed events with audit metadata so the pipeline continues running while preserving data for investigation
- [ ] To act as an in-memory caching layer that accelerates downstream SQL analytical queries on frequently accessed dimensional tables
- [ ] To automatically fix corrupted timestamps using machine learning interpolation algorithms before re-inserting them into warehouse tables

> A Dead-Letter Queue provides fault isolation without data loss. If an event is too late or malformed, failing the entire pipeline halts operations for all clean traffic, while silently dropping the record loses audit traceability. A DLQ quarantines defective payloads with error metadata for offline inspection and replay.

## @resources
- [The Dataflow Model: A Practical Approach to Balancing Correctness, Latency, and Cost (Akidau et al., VLDB 2015)](https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf)
- [Streaming Systems: What, Where, When, and How of Large-Scale Data Processing (O'Reilly)](https://www.oreilly.com/library/view/streaming-systems/9781491983867/)
- [Apache Flink Documentation: Timely Stream Processing & Watermarks](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time-attribute/)
- [DuckDB Documentation: Window Functions and Upsert Statements](https://duckdb.org/docs/sql/statements/insert#insert-on-conflict)
