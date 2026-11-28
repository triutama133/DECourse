---
title: Capstone: Fault-Tolerant Incremental API Ingestion & Checkpointing
duration: 3 weeks
summary: Build an enterprise-grade, stateful incremental ingestion pipeline on real scientific data: extract paginated seismic records from the USGS Earthquake Hazards API, negotiate rate limits (HTTP 429) and transient failures (5xx) with exponential backoff and jitter, isolate poisoned payloads into a Dead-Letter Queue (DLQ), upsert records into DuckDB with CDC deduplication, and guarantee crash-recovery resilience via atomic checkpointing.
why: In production data engineering, data rarely arrives in tidy monthly CSV files. Instead, you extract continuously from third-party REST APIs that throttle requests, crash intermittently, return malformed records, and revise historical records. This capstone removes the safety harness: you must build an ingestion engine that survives crashes mid-sync, guarantees zero duplicate records, never loses state, and isolates toxic records without aborting the pipeline.
---

## @outcomes
- Ingest paginated REST APIs reliably using cursor-based watermarking and defensive pagination contracts
- Implement network fault resilience with exponential backoff, jitter, and HTTP 429 `Retry-After` negotiation
- Guarantee transactional crash resilience using atomic file swaps and state checkpointing
- Isolate corrupt and malformed payloads into an auditable Dead-Letter Queue (DLQ) with error codes and raw payloads
- Perform Change Data Capture (CDC) upserts and historical backfills into DuckDB without corrupting production incremental watermarks

## @prereq
Modules 0.1 (terminal and virtual environment), 1.2 (idempotency, retries, and atomic operations), 1.6 (API ingestion, pagination, and watermarks), and 2.1 (DuckDB and Parquet). You need Python 3.10+, about 1 GB of free disk space, and DuckDB installed.

## @lesson How this capstone works
> **Prior Modules Synthesized:** This capstone pulls together **Module 0.1** (terminal & venv), **Module 1.2** (exponential backoff, retries & idempotency), **Module 1.6** (cursor/offset API pagination & atomic checkpoints), and **Module 2.1** (DuckDB table storage & CDC upserts). Lessons 2–6 align 1-to-1 with `check.py --step 1` through `--step 5`.

Every lab earlier in the course gave you predefined function signatures, unit test files, and guided scaffolding. A capstone is intentionally different: **you receive a technical contract, real public data, and an automated verification suite that attacks your pipeline.**

Nobody grades your coding aesthetics or style. The verification suite checks **observable behaviors and outcomes**:
- Does your pipeline produce the exact schema in DuckDB with correct geographical types?
- When the upstream server cuts the TCP socket halfway through a sync, does your pipeline resume cleanly on the next run with **zero duplicate rows** and **zero dropped records**?
- When the API returns HTTP 429 (Too Many Requests), does your extractor back off respectfully according to the server's `Retry-After` header?
- When upstream delivers malformed coordinates or poisoned JSON, does your pipeline keep processing clean data while writing defective records to a Dead-Letter Queue (DLQ)?
- When you run a historical backfill for last year, does your production high-watermark stay strictly protected?

The rules of engagement:
1. **Build it yourself.** Work in your own isolated directory (e.g. `~/seismic`) inside your virtual environment. Your workspace contains two files you write: `pipeline.py` and `profile.json`.
2. **Verify incrementally after each step:**
   ```bash
   python3 labs/mod-4-2/check.py ~/seismic --step 1
   python3 labs/mod-4-2/check.py ~/seismic --step 2
   python3 labs/mod-4-2/check.py ~/seismic --step 3
   python3 labs/mod-4-2/check.py ~/seismic --step 4
   python3 labs/mod-4-2/check.py ~/seismic --step 5
   python3 labs/mod-4-2/check.py ~/seismic --step all
   ```
3. **Use tiered hints when stuck:** You can request `--hint 1` (a subtle nudge), `--hint 2` (conceptual explanation), or `--hint 3` (detailed technical hint). Try wrestling with the defect for at least 30 minutes before requesting a hint.
4. **The checker attacks your pipeline.** In steps 3, 4, and 5, the verification harness spins up an ephemeral HTTP server that injects socket resets, HTTP 429 throttles, 503 service outages, toxic payloads, and CDC record updates. Real production systems encounter these every single week.

**When a check fails, find out whose fault it is.** First run `python3 scripts/doctor.py mod-4-2`: it checks your computer (Python, tools, packages), not your code. If it is happy, rerun only the failing step, for example `python3 labs/mod-4-2/check.py ~/seismic --step 3`, and read the first line of the message: it names the file, the number or the behaviour that is wrong. A failure that mentions a missing command, a busy port or no space left is your laptop; a failure that names a number or a file you write is your code.

Setup your workspace:
```bash
cd ~/projects/DECourse          # example path (or wherever you cloned the course): the labs/ paths below live there
mkdir -p ~/seismic
python3 -m venv ~/seismic/venv && source ~/seismic/venv/bin/activate
pip install -r labs/mod-4-2/requirements.txt
python3 labs/mod-4-2/fetch_data.py
cp labs/mod-4-2/starter/pipeline.py ~/seismic/pipeline.py
```

> 🛠 **Try it (20 min, terminal).** Do the setup above in `~/seismic`. Before you write the pipeline, run the checker for step 1 on the untouched starter: `python3 labs/mod-4-2/check.py ~/seismic --step 1`, then `--hint 1`. Read what the checker tells you literally, and note which of the four "attacks" listed above you have not yet thought about handling.
>
> **You should see:** `fetch_data.py` reports `earthquakes_seed.json` with a matching hash. The checker prints `--- Step 1: Raw data profiling (profile.json) ---`, `FAIL  profile.json exists in workspace`, and `Summary: 0 passed, 1 failed`; hint 1 tells you to load the seed file with `json.load()` and look at the properties and geometry of the features. Nothing more: the work is yours.

:::ask In this capstone the verification suite 'attacks' your pipeline. What does it check?
@options
whether your code looks tidy to a reviewer
how many lines your pipeline has
* observable outcomes, not code style
@why
Nobody grades style. The suite checks outcomes: the exact DuckDB schema, a clean resume after the server cuts the connection mid-sync, rate-limit handling, and reconciled counts.
:::

## @lesson Meet the data: USGS Earthquake Hazards API
The **United States Geological Survey (USGS)** operates the Earthquake Hazards Program, providing open real-time and historical seismic data worldwide. Their public API endpoint returns GeoJSON feeds:
`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson`

We seed our baseline dataset with global seismic events of magnitude 2.5 or greater from the first week of January 2024 (513 events), including the catastrophic magnitude 7.5 earthquake on the Noto Peninsula, Japan (`us6000m0xl`).

```
GeoJSON Feature Collection
├── metadata: { generated, count, title, status }
└── features: [ Array of Feature Objects ]
    ├── type: "Feature"
    ├── id: "us6000m0xl"            <-- Unique event identifier
    ├── properties:
    │   ├── mag: 7.5                <-- Magnitude (Double, nullable)
    │   ├── place: "2024 Noto..."   <-- Text description
    │   ├── time: 1704093009476     <-- Event epoch ms (UTC)
    │   ├── updated: 1791612789213  <-- Revision epoch ms (UTC)
    │   ├── status: "reviewed"      <-- "automatic" vs "reviewed"
    │   ├── tsunami: 1              <-- 1 if tsunami warning issued, 0 otherwise
    │   ├── sig: 2376               <-- Significance rating
    │   └── type: "earthquake"
    └── geometry:
        ├── type: "Point"
        └── coordinates: [lon, lat, depth_km]  <-- CRITICAL TRAP!
```

### The Pitfalls of Real Scientific APIs:

:::talk Latitude first, or longitude first?
@teacher An earthquake in Jakarta arrives as a GeoJSON point: `[106.8, -6.2, 10.0]`. Everyone who reads maps says "latitude, longitude", so a new colleague stores the first number as latitude.
@ask What goes wrong?
@choice Nothing: both orders describe the same place | They do not: swapping puts the point at latitude 106.8, which does not exist, and anywhere else on Earth it is a different place. Try again.
@choice * GeoJSON uses [longitude, latitude, elevation]: the swap makes a latitude of 106.8, outside the valid range of -90 to 90 | Yes. Validate coordinate bounds at the door: a latitude outside -90 to 90 is proof of a swap, and the row belongs in quarantine.
@choice The elevation is read as the latitude | Elevation is the third value. The first two are the ones swapped. Try again.
@teacher The two pairs differ by convention (maps say latitude first, GeoJSON says longitude first). When two conventions meet, add a bounds check and a test.
:::

1. **The Coordinate Order Inversion:** In geographic mathematics, people say "Latitude, Longitude". But in GeoJSON (RFC 7946), coordinates are strictly `[longitude, latitude, elevation/depth]`.
   - `coordinates[0]` is **Longitude** (valid range: -180.0 to 180.0)
   - `coordinates[1]` is **Latitude** (valid range: -90.0 to 90.0)
   - `coordinates[2]` is **Depth in kilometers**
   If you accidentally map `lat = coords[0]`, any earthquake with longitude beyond +/-90 degrees (such as Japan or Indonesia, roughly 95 to 145 degrees East) will crash your coordinate bounds validation!
2. **SCD Type 1 (overwrite in place with the latest version, Module 1.4) & Revision Timestamps (`updated`):** Seismological data evolves over time. When a tremor occurs, automated seismographs generate a preliminary event (`status: "automatic"`). Hours or days later, geophysicists recalculate the epicenter, refine the magnitude, and promote the record to `status: "reviewed"` with an updated timestamp (`updated > time`). A pipeline whose watermark follows only the event `time` never sees these revisions. **Track the watermark on `updated`** (the time of the last change) and ask the API for what changed with `updatedafter`; upsert by event id.
3. **Nullable and Negative Measures:** Micro-earthquakes or quarry blasts can have null or negative magnitudes (logarithmic Richter scale allows values below 0). Depths can be 0 or negative (mountainous quakes above sea level). Your schema must accommodate nullable floats without crashing.
4. **Pagination Strategies (Offset vs Watermark Keysets):** REST APIs commonly offer offset pagination (`limit` and `offset`). While intuitive, pure offset pagination suffers from O(N) scanning on deep offsets and drifts if records are inserted concurrently. In modern data architecture, we pair a high-watermark on the `updated` time (the `updatedafter` filter) with small page offsets inside one sync session, keeping extraction queries fast and idempotent. The filter stays constant while the offset moves.
5. **Preserving Data Dictionaries:** Scientific APIs carry domain-specific codes such as `magType` (`ml` local Richter, `mw` moment magnitude, `md` duration). Never discard these attributes during extraction; analysts rely on magnitude types to determine physical sensor calibration accuracy.

> 💡 **Practice Pause 1 (Step 1: Raw Data Profiling & profile.json Creation):**
> 1. Create `profile.json` in your workspace folder (`~/seismic/profile.json`) using your text editor.
> 2. Compute the 9 statistical metrics from `earthquakes_seed.json` (remember GeoJSON coordinate ordering `[lon, lat, depth]`): `total_features`, `max_magnitude`, `min_magnitude`, `tsunami_alert_count`, `max_depth_km`, `min_depth_km`, `min_time_epoch_ms`, `max_time_epoch_ms`, and `noto_peninsula_event_id`.
> 3. Run the step 1 check in terminal:
>    `python3 labs/mod-4-2/check.py ~/seismic --step 1`
> 4. **Success Indicator:** All 9 metrics report `PASS`, confirming your raw seismic profiling matches reference truth.

:::drill python Longitude first, then latitude
GeoJSON stores coordinates as `[longitude, latitude, depth]`, the opposite of how people say "lat, long". Write `to_event(feature)`: `feature` is a dictionary like `{"id": "x1", "geometry": {"coordinates": [139.2, 37.5, 10.0]}}`. Return a dictionary with the keys `id`, `longitude`, `latitude` and `depth_km`.
@starter
# write your function below this line

@check
defines("to_event") ## Define to_event(feature).
to_event({"id": "x1", "geometry": {"coordinates": [139.2, 37.5, 10.0]}}) == {"id": "x1", "longitude": 139.2, "latitude": 37.5, "depth_km": 10.0} ## Position 0 is longitude, 1 is latitude, 2 is depth.
to_event({"id": "y", "geometry": {"coordinates": [-70.0, -33.4, 80.5]}})["latitude"] == -33.4 ## A negative latitude (southern hemisphere).
to_event({"id": "z", "geometry": {"coordinates": [0, 0, 0]}}) == {"id": "z", "longitude": 0, "latitude": 0, "depth_km": 0} ## Zeros are valid values.
@hint
`lon, lat, depth = feature["geometry"]["coordinates"]`
@solution
def to_event(feature):
    lon, lat, depth = feature["geometry"]["coordinates"]
    return {"id": feature["id"], "longitude": lon, "latitude": lat, "depth_km": depth}
:::

## @lesson Baseline ingestion contract: pagination, coordinates & DuckDB storage
Before adding retries or dead-letter routing, get the **core ingestion contract** right cleanly from API page to analytical table:

1. **Paginate with `limit` and 1-based `offset`:** Loop page by page (`offset = 1`, advancing by page length) until the returned `features` list is empty or shorter than `limit` (`len(features) < limit`, which saves one trailing empty request).
2. **Enforce coordinate ordering:** Always map `longitude = coords[0]`, `latitude = coords[1]`, and `depth_km = coords[2]`, converting timestamps to UTC consistently.
3. **Create the target DuckDB `events` table idempotently:** Use `event_id` as the primary key and store `time_utc`, `updated_epoch_ms`, `latitude`, `longitude`, `depth_km`, `magnitude`, and `status`, updating existing rows cleanly if an event is revised rather than appending duplicates.

> 💡 **Practice Pause 2 (Step 2: Baseline Ingestion Contract & DuckDB Storage):**
> 1. Open `pipeline.py` in your workspace (`~/seismic/pipeline.py`) using your text editor.
> 2. Implement the CLI subcommand `pipeline.py ingest` with flags `--api-url`, `--output-dir`, `--state-file`, and `--batch-size`, pagination (`limit` and `offset`), exact coordinate parsing (`lon = coords[0]`, `lat = coords[1]`, `depth = coords[2]`), creation of table `events` in `<output-dir>/warehouse.duckdb`, and initial `state.json` write (see Lab Step 2 for full column details).
> 3. Run the step 2 check in terminal:
>    `python3 labs/mod-4-2/check.py ~/seismic --step 2`
> 4. **Success Indicator:** All step 2 checks report `PASS`, validating DuckDB schema, geographic coordinate bounds, and API pagination.

:::ask How does the baseline ingestion know it has read the last page?
@options
* the features list that comes back is empty
the API prints the word 'done' at the end
the offset reaches 1,000 pages
@why
Page through with limit and a 1-based offset, advancing by the length of each page, until a page returns no features. Never assume a page count: data can change between runs.
:::

## @lesson Stateful checkpointing & crash-safe storage
An incremental pipeline is defined by its ability to ingest **only what is new since the last run**, while safely resuming after an unexpected termination.

```
State Checkpoint (state.json):
{
  "high_watermark_epoch_ms": 1704367849415,       <-- the largest properties.updated you have COMMITTED
  "high_watermark_iso": "2024-01-04T11:30:49Z",   <-- send as updatedafter (ISO-8601 UTC, not raw epoch ms)
  "last_sync_utc": "2024-01-08T00:00:00Z",
  "total_records_ingested": 450,
  "total_dlq_records": 5
}
```

### The Atomic Checkpoint Write Trap:

:::talk The checkpoint half written
@teacher Your pipeline saves its high-watermark by opening `state.json` and writing the new JSON straight into it. The machine loses power in the middle of that write.
@ask What does `state.json` contain when the machine comes back?
@choice The old watermark, because the write did not finish | Writing in place starts by emptying the file, so the old content is already gone. Try again.
@choice * A truncated, broken JSON, so the next run cannot even read its own state | Yes. Write the new state to `state.json.tmp` and swap it in with `os.replace`, which is atomic: readers see either the whole old file or the whole new one, never a half.
@choice The new watermark, because the computer finishes writes on restart | A crash leaves whatever bytes had reached the disk. Try again.
@teacher Never write the only copy of important state in place. Write beside it, then swap.
:::

Consider this disastrous sequence:
1. Extractor downloads Page 3 of data.
2. Extractor writes new watermark to `state.json`.
3. Power fails or OOM-killer terminates process before database writes finish.
4. On restart, extractor reads `state.json`, believes Page 3 was already completed, and skips it! **Permanent data loss.**

Or the inverse:
1. Extractor writes partial data to file.
2. Machine crashes before `state.json` is updated.
3. On restart, extractor reads old `state.json`, re-fetches Page 3, and blindly appends it. **Duplicate data corruption.**

### The Solution:
1. **Commit data to analytical storage first.**
2. **Update checkpoint state in memory only after database commit succeeds.**
3. **Write `state.json` via atomic rename:**
   ```python
   tmp_file = state_path.with_name(state_path.name + ".tmp")  # state.json.tmp
   tmp_file.write_text(json.dumps(state_data))
   os.replace(tmp_file, state_path)  # Atomic on POSIX filesystems
   ```
4. **Idempotent Destination Writes (Upsert):** When resuming from a crash, the pipeline will inevitably re-process records that were already partially written. The destination table must use an idempotent `UPSERT` or deduplication query on `event_id`, keeping the row with the greatest `updated_epoch_ms`.
5. **POSIX Rename Semantics:** In Linux and POSIX systems, `os.replace` maps directly to the `rename(2)` system call. If `state.json` already exists, it is atomically unlinked and replaced in a single filesystem operation. Any concurrent reader opens either the previous valid JSON or the new valid JSON, never a half-flushed buffer.

:::ask Your ingestion run fetches 500 records, writes them, and only then moves the checkpoint. It crashes right after writing. What happens on the next run?
@options
the 500 records are lost for good
it refuses to start until you reset state.json
* it refetches them safely via idempotent load
@why
A checkpoint may only describe data that is safely stored. Crashing between the write and the checkpoint costs a repeated fetch, which a deduplicating load makes harmless.
:::

> 💡 **Practice Pause 3 (Step 3: Stateful Watermarking & Atomic Crash Recovery):**
> 1. Open `pipeline.py` in your workspace using your text editor.
> 2. Implement `high_watermark_epoch_ms` tracking on the largest committed `updated` timestamp, query with `updatedafter` formatted as an **ISO-8601 UTC string** (e.g., `2024-01-04T13:50:49Z`, NOT raw epoch ms) on subsequent runs, and protect `state.json` writes via atomic rename (`state.json.tmp` + `os.replace`).
> 3. Run the step 3 check in terminal:
>    `python3 labs/mod-4-2/check.py ~/seismic --step 3`
> 4. **Success Indicator:** All step 3 checks report `PASS`, proving mid-flight socket drops do not advance checkpoints prematurely and subsequent runs produce zero loss and zero duplicates.

:::drill python The watermark never goes backwards
After each page, the pipeline keeps the largest `updated` time it has **committed**. Write `next_watermark(current, updated_values)`: `current` is the stored number (or `None` for a first run) and `updated_values` is a list of the `updated` numbers just committed. Return the new watermark: the largest of all of them, never lower than `current`.
@starter
# write your function below this line

@check
defines("next_watermark") ## Define next_watermark(current, updated_values).
next_watermark(None, [5, 9, 7]) == 9 ## A first run: the largest value.
next_watermark(10, [5, 9, 7]) == 10 ## All values are older: the watermark stays at 10.
next_watermark(10, [12, 11]) == 12 ## Newer data moves it forward.
next_watermark(10, []) == 10 ## A page with nothing new changes nothing.
next_watermark(None, []) is None ## A first run with no data: still no watermark.
@hint
Put `current` (if it is not `None`) and all the values in one list; return `max(...)`, or `None` when the list is empty.
@solution
def next_watermark(current, updated_values):
    candidates = list(updated_values)
    if current is not None:
        candidates.append(current)
    return max(candidates) if candidates else None
:::

:::ask The extractor wrote page 3 to the file, and the machine crashed before state.json was updated. On restart it re-fetches page 3. What protects you from duplicates?
@options
nothing: duplicates are unavoidable in this design
* an upsert by event id, and data before state
deleting state.json after every run
@why
The checkpoint is written only after the data is durably stored, and writes are upserts keyed by event id, so a replayed page replaces the same rows instead of adding them again.
:::

## @lesson Network resilience: Backoff, Jitter & Rate Limits
In distributed systems, networks are fundamentally unreliable (Fallacies of Distributed Computing #1: *The network is reliable*). A production data pipeline must survive transient disruptions without human intervention.

```
Request ───────> [API Server]
                   │
                   ├──> HTTP 429 (Too Many Requests) ──> Inspect `Retry-After` header ──> Sleep & Retry
                   ├──> HTTP 500 / 503 (Server Error)  ──> Exponential Backoff + Jitter  ──> Sleep & Retry
                   └──> HTTP 400 (Bad Request)         ──> Fatal Non-retryable Error     ──> Exit code 2
```

### 1. HTTP 429 Too Many Requests & `Retry-After`:
When an API throttles your client, standard REST APIs return an HTTP 429 response accompanied by a `Retry-After` HTTP response header indicating how many seconds to pause:
```python
try:
    with urllib.request.urlopen(url, timeout=15) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    if e.code == 429:
        retry_after = e.headers.get("Retry-After")
        delay = float(retry_after) if retry_after else base_backoff
        time.sleep(delay)
```

### 2. Truncated Exponential Backoff with Jitter:

:::talk Why wait a random time?
@teacher An API starts answering `429 Too Many Requests` to 100 workers at the same moment. All 100 are told to retry after exactly 2 seconds.
@ask What happens two seconds later?
@choice The API is calm again and everything works | All 100 workers come back at the same instant, and the API is overwhelmed again. Try again.
@choice * All 100 retry together and get throttled again, in lockstep; random jitter spreads the retries out | Yes. This is the thundering herd. Exponential backoff gives the server more time with every attempt, and jitter makes the clients wait different amounts, so they do not collide again.
@choice Only the first worker retries | Every worker follows the same rule. Try again.
@teacher Backoff gives the server room to recover, and jitter keeps the clients from arriving together.
:::

For transient server errors (HTTP 500, 502, 503, 504) or network timeouts, retrying immediately (*thundering herd problem*) only overwhelms an already struggling server. Instead, increase wait time exponentially:
```text
wait = base * 2 ** attempt + jitter        (attempt = 0, 1, 2, ...; with base = 1 s: about 1 s, 2 s, 4 s, 8 s)
```
Where jitter is a small randomized offset (about plus or minus 10%) preventing multiple concurrent extraction workers from retrying in lockstep synchronization.

### 3. Non-Retryable Fatal Errors (HTTP 4xx):
Not all errors should be retried. If the upstream server returns `HTTP 400 Bad Request`, `401 Unauthorized`, or `404 Not Found`, retrying 5 times will simply fail 5 times and waste time. Fatal client errors must log clear diagnostic details and exit immediately with exit code `2` without altering checkpoint state.

### 4. Socket Timeouts and Connection Hygiene:
A common rookie mistake is issuing HTTP requests without an explicit timeout (e.g. `urllib.request.urlopen(url)`). If a network middlebox drops packets silently, the thread can hang indefinitely, locking cron jobs and stalling pipelines. Always enforce an explicit timeout (e.g. 15-30 seconds). Furthermore, use Python context managers (`with ... as resp:`) to guarantee sockets are closed immediately, preventing file descriptor leaks in high-frequency batch runs.

:::ask The API answers HTTP 429 with a `Retry-After: 30` header. What do you do?
@options
* wait at least 30s, then retry
retry immediately, as fast as possible
give up and fail the run at once
@why
429 means "you are asking too fast", a transient failure. Respect `Retry-After`, add jitter so many clients do not return at the same instant, and cap the attempts. A 400-level error such as 404 is not transient: retrying never fixes it.
:::

> 💡 **Practice Pause 4 (Step 4: Network Resilience: HTTP 429 Rate-Limits & 5xx Backoff):**
> 1. Open `pipeline.py` in your workspace using your text editor.
> 2. Enhance your HTTP fetching logic with a retry loop: parse `Retry-After` on HTTP 429, apply exponential backoff with jitter on 5xx server errors, and immediately exit with code 2 on fatal 4xx client errors without retrying.
> 3. Run the step 4 check in terminal:
>    `python3 labs/mod-4-2/check.py ~/seismic --step 4`
> 4. **Success Indicator:** All step 4 checks report `PASS`, confirming orderly backoff during rate limits and upstream outages.

:::drill python How long to wait?
After a failure the pipeline waits before trying again. Write `retry_wait(attempt, base, retry_after)`: `attempt` counts from 0. If the server sent a `Retry-After` number of seconds (`retry_after` is not `None`), wait **exactly that long**. Otherwise use exponential backoff: `base * 2 ** attempt`.
@starter
# write your function below this line

@check
defines("retry_wait") ## Define retry_wait(attempt, base, retry_after).
retry_wait(0, 1, None) == 1 ## The first wait is the base.
retry_wait(3, 1, None) == 8 ## 1, 2, 4, 8.
retry_wait(2, 1, 30) == 30 ## The server asked for 30 seconds: obey it.
retry_wait(1, 5, None) == 10 ## Another base: 5, 10, 20...
@hint
Check whether `retry_after` was provided first (using `is not None`) and return it directly; otherwise multiply `base` by a power of two based on `attempt`.
@solution
def retry_wait(attempt, base, retry_after):
    if retry_after is not None:
        return retry_after
    return base * 2 ** attempt
:::

:::ask Why add a small random jitter (about ±10%) to the wait before a retry?
@options
so the wait becomes shorter on average
so the server can tell the requests apart
* so workers do not all retry at once
@why
Without jitter, clients that failed together retry together and hit the server in a wave again. A small random offset spreads them out.
:::

## @lesson The Dead-Letter Queue (DLQ) & Historical Backfills
:::talk A backfill and the watermark
@teacher Your earthquake pipeline remembers a high-watermark: the newest event time it has loaded. Someone finds a gap in last year's data and starts a backfill that reloads March of last year. It runs for an hour and finishes.
@ask What should the backfill do to the production watermark?
@choice Move it back to March, because that is the latest data it loaded | Then tomorrow's incremental run would start from last March and reload a year of data. Try again.
@choice * Leave it untouched: a backfill repairs the past, it must not change where the live pipeline continues | Yes. The incremental run keeps advancing the watermark. A backfill is a separate, bounded job over a past range, and it must not disturb the state of the live one.
@choice Move it to the end of the backfill's range | That is still in the past. It would make the live pipeline skip everything after March. Try again.
@teacher Two kinds of run, two kinds of state: incremental runs own the watermark, and backfills never touch it.
:::

In production, upstream schemas mutate and sensor data gets corrupted. If 1 record out of 10,000 contains `latitude = 999.0` or missing event IDs, what should your pipeline do?
- **Option A (Fail the entire batch):** The pipeline crashes. Business dashboards go stale for 48 hours until an on-call engineer wakes up. (Unacceptable).
- **Option B (Silently drop the bad record):** Data vanishes with zero paper trail. When auditors ask why revenue or telemetry is missing, nobody knows. (Dangerous).
- **Option C (Dead-Letter Queue - DLQ):** The pipeline validates every incoming record against an explicit schema contract: reject any record whose `id` is missing or empty, whose `geometry` is `None`, whose `time < 0`, or whose coordinates fall outside `latitude` `[-90, 90]` or `longitude` `[-180, 180]`. Valid records proceed to the warehouse; corrupted records are segregated into a Dead-Letter Queue (`dlq/rejected.jsonl`) accompanied by audit metadata:
  ```json
  {
    "error_code": "INVALID_COORDINATES",
    "reason": "Latitude 125.0 out of range [-90, 90]",
    "failed_at": "2024-01-08T12:00:00Z",
    "raw_payload": { ... }
  }
  ```
  The pipeline continues processing clean data without downtime, while site reliability engineers can monitor DLQ size and inspect rejected payloads.

### Historical Backfills & Data Reconciliation:
Frequently, upstream fixes a historical sensor calibration bug and asks: *"Please re-ingest all data from December 2023."*
Your pipeline provides a `backfill` subcommand:
```bash
python pipeline.py backfill --api-url URL --output-dir OUT --state-file OUT/state.json --start 2023-12-01 --end 2023-12-31
```
Pass `starttime` and `endtime` query parameters (from `--start` and `--end`) to the API, paginate, route invalid records to the DLQ, and upsert valid records only when the incoming `updated_epoch_ms` is greater than or equal to the existing row's.

**The Cardinal Rule of Backfills:** A backfill must load historical records into the analytical warehouse using the same upsert rules, **BUT IT MUST NEVER MODIFY OR REGRESS THE INCREMENTAL WATERMARK IN `state.json`!** If a December 2023 backfill rewrote `state.json`, your next hourly production run would think the current high-watermark is December 2023 and re-fetch an entire month of data redundantly.

Finally, always implement strict **reconciliation counters**: at the conclusion of every sync session, verify the invariant that `total_records_fetched == valid_records_persisted + dlq_records_quarantined`. If the numbers do not reconcile, a row was silently leaked in memory.

:::drill python Route the record
A record is **valid** only if it has a non-empty `id` and a `latitude` between -90 and 90 and a `longitude` between -180 and 180. Anything else goes to the dead-letter queue. Write `route(record)`: return `"valid"` or `"dlq"`.
@starter
# write your function below this line

@check
defines("route") ## Define route(record).
route({"id": "a", "latitude": 10.0, "longitude": 20.0}) == "valid" ## A normal record.
route({"id": "a", "latitude": 999.0, "longitude": 20.0}) == "dlq" ## Latitude out of range.
route({"id": "", "latitude": 10.0, "longitude": 20.0}) == "dlq" ## An empty id.
route({"latitude": 10.0, "longitude": 20.0}) == "dlq" ## A missing id.
route({"id": "a", "latitude": -90, "longitude": 180}) == "valid" ## The edges of the range are valid.
@hint
Use `record.get("id")`, `record.get("latitude")`, and `record.get("longitude")` so missing keys never raise `KeyError`. Reject to `"dlq"` if the id is falsy or either coordinate is `None`, then check the `[-90, 90]` and `[-180, 180]` bounds.
@solution
def route(record):
    if not record.get("id"):
        return "dlq"
    lat = record.get("latitude")
    lon = record.get("longitude")
    if lat is None or lon is None:
        return "dlq"
    if -90 <= lat <= 90 and -180 <= lon <= 180:
        return "valid"
    return "dlq"
:::

:::drill python Do the counts add up?
At the end of a sync, every fetched record must be accounted for. Write `reconciles(fetched, valid, dlq)`: return `True` when `fetched == valid + dlq`, otherwise `False`.
@starter
# write your function below this line

@check
defines("reconciles") ## Define reconciles(fetched, valid, dlq).
reconciles(100, 97, 3) == True ## Every record is accounted for.
reconciles(100, 97, 2) == False ## One record leaked.
reconciles(0, 0, 0) == True ## An empty sync is fine.
@hint
Compare the total fetched count against the sum of valid and quarantined (`dlq`) counts and return the resulting boolean.
@solution
def reconciles(fetched, valid, dlq):
    return fetched == valid + dlq
:::

:::ask A backfill loads December 2023 records. What must it never do?
@options
* move the incremental watermark in state.json backwards
use the same upsert rules as the normal run
write its records into the analytical table
@why
A backfill may fill history using the same upsert rules, but if it rewrote the watermark the next hourly run would think it has to re-fetch everything from December.
:::

## @lab Lab: five steps to a resilient incremental ingestion pipeline
Build `pipeline.py` and `profile.json` in your own workspace, one step at a time, with the checker after each step. The checker runs your pipeline on real USGS seismic events, simulates connection drops, triggers HTTP 429 throttles, injects toxic payloads, and tests historical backfill isolation.

### @steps
1. **Setup.** Follow the setup instructions in Lesson 1 (create `~/seismic`, activate venv, install requirements, run `fetch_data.py`, copy `starter/pipeline.py`). Inspect `earthquakes_seed.json` with Python or DuckDB.
2. **Step 1: Raw data profiling.** Profile the seed dataset and create `profile.json` with 9 keys: `total_features`, `max_magnitude`, `min_magnitude`, `tsunami_alert_count`, `max_depth_km`, `min_depth_km`, `min_time_epoch_ms`, `max_time_epoch_ms`, and `noto_peninsula_event_id`. Verify with `--step 1`.
3. **Step 2: Baseline ingestion contract.** Implement `pipeline.py ingest` with CLI flags (`--api-url`, `--output-dir`, `--state-file`, `--batch-size`). Paginate through events (`limit` and a 1-based `offset`), extract coordinates correctly (`lon = coords[0]`, `lat = coords[1]`, `depth = coords[2]`), store clean records into `<output-dir>/warehouse.duckdb` in a table `events` with at least the columns `event_id` (primary key), `time_utc`, `updated_epoch_ms`, `latitude`, `longitude`, `depth_km`, `magnitude` and `status`, and save `state.json`. Verify with `--step 2`.
4. **Step 3: Stateful watermarking & crash recovery.** Record the largest committed `updated` timestamp as `high_watermark_epoch_ms`, and on the next run send `updatedafter` (an ISO-8601 UTC time, for example `2024-01-04T11:30:49.415`) so that only new or revised events come back; subtracting one second as overlap is safe because your upsert is idempotent. Use atomic temporary file swap (`.tmp` + `os.replace`) for `state.json`. The checker tests a mid-sync socket disconnection, verifies that the checkpoint is never ahead of the data, locks the warehouse so that a write fails and the checkpoint must not move, and verifies that resuming produces zero duplicates and zero missing rows. Verify with `--step 3`.
5. **Step 4: Network resilience.** Add retry loop with exponential backoff for transient 5xx errors. Inspect the HTTP 429 `Retry-After` header and pause for at least that long (the checker measures the gap between requests). Exit with code `2`, without retrying, on fatal non-retryable 4xx errors. Verify with `--step 4`.
6. **Step 5: DLQ, CDC upsert & historical backfill.** Validate coordinates (`latitude` in `[-90, 90]`, `longitude` in `[-180, 180]`), non-null `geometry`, non-negative timestamps (`time >= 0`), and non-empty IDs. Route poisoned records to `<output-dir>/dlq/rejected.jsonl`. Upsert updated records in DuckDB without creating duplicate rows. Implement the `backfill` subcommand (`--api-url --output-dir --state-file --start --end --batch-size`), querying the API with `starttime` and `endtime`; it receives `--state-file` only so that the checker can prove you never write it, and an older revision of an event must never overwrite a newer one. Verify with `--step 5` and `--step all`.
7. **Proof.** When `--step all` passes, run `python3 scripts/prove.py mod-4-2 ~/seismic` to generate your proof code for the course app.

> 💡 **Practice Pause 5 (Step 5: DLQ Isolation, CDC Upsert, Historical Backfill & Proof Token):**
> 1. In `pipeline.py`, validate coordinate bounds and route malformed records to `dlq/rejected.jsonl`. Implement CDC upsert in DuckDB and the `backfill` subcommand (`--start`, `--end`) without modifying `state.json`.
> 2. Run the complete verification suite in terminal:
>    `python3 labs/mod-4-2/check.py ~/seismic --step all`
> 3. Generate your Capstone verification proof token:
>    `python3 scripts/prove.py mod-4-2 ~/seismic`
> 4. **Success Indicator:** All verification checks report `PASS` and your completion proof token is printed to terminal.

### @files
- labs/mod-4-2/starter/pipeline.py :: Your starter template: copy it to your workspace and build the pipeline there :: starter
- labs/mod-4-2/check.py :: The automated checker: five steps, tiered hints, and chaos attack harness :: test
- labs/mod-4-2/fetch_data.py :: Downloads the USGS seed dataset and verifies its SHA-256 hash :: config
- labs/mod-4-2/requirements.txt :: duckdb, pyarrow :: config

### @deliverables
- `python3 labs/mod-4-2/check.py ~/seismic --step all` passes on your computer inside your virtual environment
- You can explain why GeoJSON coordinates order longitude before latitude and how swapping them creates spatial bugs
- You can explain why the state checkpoint file must be updated atomically only after database writes succeed
- You can explain how a Dead-Letter Queue enables high-availability ingestion without hiding corrupted data
- Your `NOTES.md` records your architectural reflections on state isolation between backfills and incremental runs
- Before you write code: a one-page `DESIGN.md` in your workspace (template: `labs/shared/writing/design_doc_template.md`) that passes `python3 scripts/check_writing.py design ~/seismic/DESIGN.md`, then kept up to date when a decision changes

### @verify
```bash
python3 labs/mod-4-2/check.py ~/seismic --step all
python3 scripts/prove.py mod-4-2 ~/seismic
```

## @chaos The mid-sync server crash & poisoned coordinates
### @scenario
At 03:15 UTC on a Saturday morning, an upstream API server experienced an unexpected memory exhaustion crash while streaming Page 4 of an hourly batch. Halfway through transmission, the TCP connection reset. When the ingestion cron job ran an hour later, a junior engineer's pipeline had updated its state watermark before persisting records to disk—permanently skipping 150 seismic events, including an offshore tsunami warning.

Simultaneously, a newly deployed upstream seismic sensor in the South Pacific began emitting coordinates with longitude and latitude reversed, broadcasting `[lat, lon]` instead of standard `[lon, lat]`. Pipelines without explicit coordinate bounds checking inserted latitudes of 175 degrees South, corrupting spatial GIS layers and breaking downstream dashboard aggregations.

### @cause
The pipeline was neither transactional nor defensive. It updated its watermark before writes were committed, causing permanent data loss on process termination. It also lacked input schema validation, trusting upstream geographic coordinates blindly without verifying that latitude is strictly bounded between -90 and 90.

### @fix
1. **Commit storage before checkpointing:** Write the analytical batch to DuckDB first. Only when the commit succeeds do you advance the watermark and write `state.json`.
2. **Atomic state swaps:** Write `state.json.tmp` and use `os.replace` to prevent corrupted half-written checkpoint files.
3. **Idempotent upserts:** Deduplicate by `event_id` and `updated_epoch_ms` so re-processing a batch after a crash never introduces duplicate rows.
4. **Dead-Letter Queue quarantine:** Validate latitude between -90 and 90 and longitude between -180 and 180. Route corrupted coordinates to `dlq/rejected.jsonl` with diagnostic metadata.

### @pattern
An ingestion pipeline must treat upstream networks and data producers as untrusted and volatile. Persist data before updating checkpoints, make storage writes idempotent, and quarantine poisoned records into a DLQ without crashing the entire batch.

## @quiz
### In GeoJSON format (RFC 7946), how are spatial coordinates structured for a Point geometry, and what is the common ingestion trap?
- [ ] Coordinates are stored as latitude followed by longitude, causing GIS rendering engines to crash if values exceed ninety degrees
- [x] Coordinates are stored as [longitude, latitude, elevation], and swapping them will invert world coordinates or violate latitude bounds
- [ ] Coordinates are stored as an ISO-6709 text string that requires complex regular expressions to split degrees, minutes, and hemisphere letters
- [ ] Coordinates are stored as a single geohash string that must be decoded using an external geospatial library before spatial indexing insertion

> GeoJSON RFC 7946 strictly requires [longitude, latitude, elevation/depth]. Because spoken English typically says "latitude, longitude", engineers frequently invert indices. Since latitude is bounded between -90 and 90 while longitude spans -180 to 180, swapping them will cause valid quakes with longitude > 90 to fail latitude validation.

### When an upstream REST API throttles an ingestion extractor with HTTP 429 (Too Many Requests), what is the correct architectural response?
- [ ] Immediately retry twenty times in an unthrottled loop until an available server thread accepts the pending network connection
- [x] Inspect the Retry-After header, sleep for the requested duration, and apply exponential backoff if the header is absent
- [ ] Terminate the pipeline immediately, purge the local database file, and notify the upstream API support desk via email
- [ ] Switch to HTTP GET requests without user-agent headers to bypass the upstream IP rate limiter and continue extraction

> The standard HTTP response to 429 Too Many Requests is to check for the 'Retry-After' header, pause execution for the specified duration, and employ truncated exponential backoff if the header is not provided. Retrying aggressively only exacerbates rate limiting.

### Why must state checkpoint files (such as state.json) be updated using an atomic file swap pattern (write to .tmp then os.replace)?
- [x] Because writing directly to an existing file can corrupt JSON contents if the process or power fails in the middle of writing
- [ ] Because the POSIX operating system kernel automatically encrypts files that are moved using the standard atomic rename system call
- [ ] Because writing to a temporary file is the only technique in Python that allows multiple threads to write to the same file
- [ ] Because the DuckDB storage engine requires all external state files to have the .tmp file extension before reading them

> If a machine crashes or runs out of memory while writing directly to state.json, the file is left half-written and corrupt, destroying the pipeline's checkpoint history. Writing to a temporary file and atomically renaming it guarantees that state.json is either the old valid version or the new valid version, never corrupted.

### How should a Change Data Capture (CDC) upsert behave when an incoming record has the same primary key as an existing record?
- [ ] The incoming record should always be discarded immediately because analytical databases enforce strict append-only table immutability
- [x] The incoming record should replace the existing record only if its updated timestamp is greater than or equal to the existing record
- [ ] The pipeline should append the incoming record into the table and create a composite foreign key referencing the earlier older version
- [ ] The incoming record should trigger an immediate database truncate and re-ingest all historical records from the initial epoch

> In CDC and slowly changing data streams, revisions to existing entities are identified by comparing version or updated timestamps. If incoming.updated >= existing.updated, the existing record is updated/replaced to reflect the latest state; otherwise, older out-of-order deliveries are ignored.

### What is the fundamental operational difference between an incremental ingestion run and a historical backfill run?
- [ ] Incremental runs read Parquet files while historical backfill runs are restricted to extracting raw uncompressed CSV payload dumps
- [x] Incremental runs advance the production high-watermark state, whereas backfills must leave the production watermark untouched
- [ ] Incremental runs execute on DuckDB while historical backfills must run on a distributed Apache Spark cluster in the cloud
- [ ] Incremental runs discard malformed records while historical backfills must crash immediately upon encountering any null values

> An incremental run advances the high-watermark checkpoint in state.json so future cron runs pick up newly arrived data. A backfill extracts a past date window (e.g. last month); if a backfill altered state.json, it would reset the production watermark backwards, breaking subsequent scheduled extractions.

### When a batch of 100 records arrives from an API containing 3 records with invalid coordinates, what is the role of a Dead-Letter Queue (DLQ)?
- [ ] The DLQ drops the 3 records silently so downstream dashboards never notice missing telemetry or validation errors
- [x] The DLQ routes the 3 corrupted records to an audit store with error metadata while allowing the 97 valid records to be saved
- [ ] The DLQ rolls back the entire batch and forces the pipeline to crash with an unhandled fatal exception until code is changed
- [ ] The DLQ automatically guesses the correct coordinates using an AI model and inserts the repaired records into the warehouse table

> A Dead-Letter Queue isolates defective payloads without halting the entire pipeline. Valid records continue flowing to production consumers, while toxic records are preserved in an auditable quarantine file alongside failure reasons and timestamps for engineering inspection.

### Why is random jitter added to exponential backoff when retrying failed network requests across multiple worker nodes?
- [x] To prevent all concurrent extractors from synchronizing their retries and repeatedly overwhelming upstream servers in lockstep
- [ ] To encrypt the HTTP request payload with a cryptographic nonce that prevents middlebox cache poisoning on public proxies
- [ ] To compress the request headers before transmission and reduce total bandwidth consumption across wide-area networks
- [ ] To trick the upstream API gateway into treating subsequent retry requests as if they originated from different geographic regions

> Without jitter, multiple distributed extraction workers that fail simultaneously will all back off for the exact same duration (2, 4, 8 seconds), hammering the recovering upstream server at the exact same instant (the thundering herd problem). Jitter breaks this synchronization.

### If an API supports both limit/offset pagination and timestamp-based filtering (starttime), what subtle bug occurs if offset is incremented while starttime is simultaneously updated to the highest timestamp of the previous page?
- [ ] The HTTP client throws an invalid protocol error because REST servers forbid combining starttime filters with numerical limits
- [x] Records will be skipped because applying an offset greater than one on an already filtered timestamp slice skips past valid events
- [ ] The destination database will crash because DuckDB cannot accept records that have been filtered by more than one parameter in a single query
- [ ] The API server will interpret the request as a denial-of-service attack and permanently blacklist the client extraction IP address for one day

> If starttime is updated to the latest timestamp of page 1, the upstream query result is already narrowed to only events after that timestamp. If you then also pass offset=101, the server will skip the first 100 events of that new filtered list, causing massive data loss. A pagination session must either hold starttime constant while paginating offset, or reset offset=1 when advancing starttime.

## @resources
- [USGS Earthquake API Documentation](https://earthquake.usgs.gov/fdsnws/event/1/)
- [RFC 7946 - The GeoJSON Format Specification](https://datatracker.ietf.org/doc/html/rfc7946)
- [Exponential Backoff And Jitter - AWS Architecture Blog](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [DuckDB Python API & SQL Reference](https://duckdb.org/docs/api/python/overview)
