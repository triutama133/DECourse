---
title: Getting Data In: Files, APIs and Databases
duration: 2 weeks
summary: Learn how data actually enters a platform: calling HTTP APIs with authentication, reading every page without gaps or duplicates, surviving rate limits and failures with retries and backoff, loading only what is new with a checkpoint, and landing raw data safely so a rerun never creates duplicates. You build it against a fake API that fails on purpose.
why: Tutorials call one API once and print the result. Real ingestion runs every night against a service that pages, throttles you, times out and changes shape, and a mistake in the order of two lines can silently lose a day of orders.
---

## @outcomes
- Describe the common ways data enters a platform (files, APIs, databases, events) and what a trustworthy ingestion job promises
- Make authenticated HTTP requests, read status codes and headers, and keep secrets out of code
- Read all pages of an API with cursor or offset pagination, and explain why offset pagination can duplicate or skip records
- Handle rate limits and failures with retries, exponential backoff and Retry-After, and know what must not be retried
- Build an incremental, idempotent load with a checkpoint written in the right order
- Land raw data with metadata, flatten nested JSON, and detect schema drift

## @prereq
Modules 0.0 and 1.2 (Python, errors, idempotence). The lab needs only the Python standard library and no internet connection: the tests start a small fake API on your own computer.

## @lesson How data enters a platform

> **In short:** Data arrives as files, API calls, database reads or events. You choose pull or push, and full or incremental. A trustworthy job is complete, repeat-safe, raw-first, observable and polite to the source.
Everything a data engineer builds starts with **ingestion**: moving data from where it is created to where it can be used. The sources fall into four families:

- **Files**: CSV, JSON, Parquet dropped on a server, an SFTP folder or cloud storage by a partner or an export job.
- **APIs**: a service (a payment provider, a marketing tool, a government open-data portal) that you call over HTTP.
- **Databases**: tables in an operational database, read in bulk or incrementally (Module 3.2 covers change data capture).
- **Events**: messages from Kafka, webhooks and queues (Module 3.2).

Two choices shape every job. **Pull or push:** do you ask the source for data on a schedule (pull), or does it send you data when something happens (push, as with webhooks and events)? **Full or incremental:** do you copy everything every time (simple, correct, expensive as data grows), or only what changed since last time (cheap, but you must track "since when" and handle updates and deletes)?

What a **trustworthy ingestion job** promises, and what this module teaches you to build:

1. **Complete**: no record is lost, even after a crash or a rate limit.
2. **No duplicates, safe to rerun**: running it twice produces the same result as running it once (idempotence, Module 1.2).
3. **Raw first**: it stores what it received, unchanged, before any cleaning (the ELT habit of Module 0.1), so you can reprocess later without calling the source again.
4. **Observable**: it reports how many records it fetched, how long it took, how many retries it needed and how fresh the data is.
5. **Polite**: it respects the source's limits and fails clearly rather than hammering it.

A last principle: the source is **not under your control**. It may be slow, change its fields, return errors at 3 a.m. or ban you for abuse. Code written as if the network were perfect breaks the first week.

> 🛠 **Try it (3 min, pen and paper).** For each case write down the source family (file, API, database, event), pull or push, and full or incremental.
> 1. A partner uploads `sales.csv` to an SFTP folder every night.
> 2. A payment provider calls a URL of yours whenever a payment succeeds.
> 3. A job runs `SELECT * FROM orders WHERE updated_at > :last_run` every hour.
> 4. An app publishes every click to a Kafka topic.
>
> Then pick the hardest of the five promises (complete, repeat-safe, raw first, observable, polite) for each case, and say why in one sentence.
>
> *Compare when you are done:* 1 is a file you pull (full, or incremental if the file only holds new rows); 2 is an event pushed to you (incremental by nature); 3 is a database you pull incrementally; 4 is an event stream: the app pushes into the log and your consumer pulls from it.

## @lesson HTTP APIs in ten minutes

> **In short:** A request is a method, a URL and headers; the answer is a status, headers and JSON. 2xx is fine, 4xx means your request is wrong (do not retry), 429 and 5xx mean try again later. Keep secrets out of code and always set a timeout.
An HTTP API works like a web page for programs. You send a **request** (a method such as GET, a URL, headers and sometimes a body) and receive a **response** (a status code, headers and a body, usually JSON).

```text
GET /orders?limit=100&cursor=abc HTTP/1.1
Authorization: Bearer <your token>
Accept: application/json
```

The **status code** tells you what happened, and your code must react differently to each family:

| Code | Meaning | What to do |
|---|---|---|
| 200 | OK | use the body |
| 400 | bad request: your parameters are wrong | fix the code; retrying is pointless |
| 401, 403 | not authenticated, or not allowed | fix the credentials; do not retry |
| 404 | not found | fix the URL or treat as "no data"; do not retry |
| 429 | **too many requests**: you are rate limited | wait, then retry (see below) |
| 500, 502, 503, 504 | the server has a problem | wait and retry |

**Authentication** is how the API knows who you are: an **API key** in a header or query string, a **bearer token** (`Authorization: Bearer ...`), or **OAuth**, where you exchange credentials for a token that expires and must be refreshed. Whatever the method, **a credential is a secret**: keep it in an environment variable or a secret manager, never in the code or in Git (Module 0.2), and never in logs. The lab's `build_request` puts the token in the header, builds the URL with `urllib.parse.urlencode` with parameters sorted so the URL is reproducible, and drops parameters whose value is `None`.

Always set a **timeout**. Without one, a hung connection blocks your job forever. Connection problems (the server unreachable, a reset, a timeout) are different from HTTP errors: there is no status code, so you treat them like a 5xx, as something temporary.

Read the API documentation for four things before writing code: how **authentication** works, how **pagination** works, what the **rate limit** is, and how to ask for **only the changes** (a parameter such as `updated_since`). Many APIs are versioned (`/v2/orders`); pin the version, because an unannounced change is a way for your job to break.

You can do all of this with Python's standard library (`urllib.request`), as the lab does, or with the popular `requests` package; the ideas are identical.

> 💡 **Practice Pause 1 (HTTP Request Construction & Auth Headers):**
> Start building your ingestion module with deterministic HTTP request formatting:
> 1. Open `labs/mod-1-6/ingest_lab.py` in your text editor (remember: do not execute directly in bash!).
> 2. Implement `build_request(url, token, params=None)`: drop None query values, sort parameters with `urllib.parse.urlencode` (ensuring reproducible URLs), and attach headers `Authorization: Bearer <token>` and `Accept: application/json`.
> 3. Test in the terminal:
> `pytest labs/mod-1-6/test_lab.py -k TestBuildRequest -v`
> When TestBuildRequest tests are PASSED, proceed to Lesson 3 to handle pagination and network retries!

> 🛠 **Try it (10 min, hands on).** Start the practice API in a second terminal and leave it running: `python3 labs/mod-1-6/fakeapi.py` (it holds 25 orders; the token is `learner-token`; the file's docstring lists its endpoints).
> 1. In your first terminal: `curl -i "localhost:8765/orders?limit=3"`. Which status do you get, and why?
> 2. Fix it yourself by adding the header `-H "Authorization: Bearer learner-token"`. Read the status line, the `Content-Type` header and the JSON. What does `next_cursor` hold?
> 3. In `try_http.py`, with only `urllib` from the standard library, GET the same URL with the header and print the status code and the list of order ids. Then call it without the header, catch the error and print its code.
>
> **You should see:** `401` for step 1, then `HTTP/1.0 200 OK`, `application/json` and `"next_cursor": "3"` for step 2, and from your script `200 [1, 2, 3]` followed by `401`.

## @lesson Reading all the data: pagination, rate limits and retries

> **In short:** Offset pages shift when data changes (duplicates and gaps); cursors do not. On 429 wait as long as `Retry-After` says; on 5xx retry with growing waits and a limit; never retry other 4xx.
An API will not return a million records at once. It returns a **page** and tells you how to get the next one. There are three styles:

- **Offset pagination** (`?offset=20&limit=10`): simple, but unsafe on live data. If new records arrive while you read, the offsets shift. In a newest-first feed of 25 orders, reading pages of 10 while 3 new orders arrive after the first page gives **28 rows fetched for 25 real orders**: 3 duplicates (an older row slides into the next page). Deleted rows cause the opposite, skipped records. It is also slow on large offsets.
- **Page numbers** (`?page=3`): the same weakness.
- **Cursor (keyset) pagination** (`?cursor=abc`): each response contains a `next_cursor` that marks exactly where to continue. Reading the same feed this way gives the 25 orders with no duplicates and none missing. **Prefer cursors whenever the API offers them.** The lab's `fetch_all_cursor` follows `next_cursor` until it is missing, and `fetch_all_offset` shows the offset loop (stop when a page is shorter than `limit`; note that when the total is an exact multiple of `limit` you need one extra request to see the empty page).

**Rate limits.** To protect itself, an API limits how many requests you may send, for example 100 per minute. When you exceed it you receive **429 Too Many Requests**, often with a **`Retry-After`** header saying how many seconds to wait. The polite and effective response is to **wait exactly that long**. Hammering the API makes things worse and can get you banned.

**Retries with exponential backoff.** Networks and servers fail temporarily, so retry the *temporary* errors (429, 5xx, connection problems), and only those. After each failure wait longer: 1 second, then 2, 4, 8, 16, capped at, say, 30 (`backoff_delay` in the lab: `min(cap, base * 2 ** (attempt - 1))`, giving 1, 2, 4, 8, 16, 30, 30). Doubling gives a struggling server time to recover; in production add a little random **jitter** so that a thousand clients that failed together do not all retry at the same instant. Put a **limit on the number of retries**, and when it is reached **fail loudly** with the last error, so that the orchestrator (Module 2.4) can alert and rerun later. Never retry 400, 401, 403 or 404: the answer will not change.

Retrying is only safe for operations that are **idempotent**. A GET that reads data is. A POST that creates something may create it twice if the first attempt succeeded but the response was lost; such calls need an idempotency key if the API offers one. Ingestion mostly reads, which is why it is the friendly case.

In the lab you test all this against a **real HTTP server running on your computer**, which answers 429 with `Retry-After` and 500 on request. The `sleep` function is a parameter, so tests record the waits (1, 2 or 7 seconds) instead of really sleeping. Designing code so that time and the network can be replaced in tests is a skill in itself.

> 💡 **Practice Pause 2 (Resilient Network Fetching & Pagination):**
> Handle network volatility, 429 rate limits, and multi-page responses:
> 1. In `labs/mod-1-6/ingest_lab.py` in your text editor, implement:
>    - `backoff_delay(attempt, base=1.0, cap=30.0)`: exponential delay `min(cap, base * 2 ** (attempt - 1))`.
>    - `get_json(...)`: retry on 429 (respecting `Retry-After`), 5xx, and connection errors, while failing immediately on non-retryable 4xx codes (401, 404).
>    - `fetch_all_cursor(...)`: walk cursor-paginated endpoints until `next_cursor` is None.
>    - `fetch_all_offset(...)`: loop offset pages until record count < limit.
> 2. Test in the terminal:
> `pytest labs/mod-1-6/test_lab.py -k "TestBackoff or TestGetJson or TestPagination" -v`
> When tests show PASSED, proceed to Lesson 4 for incremental checkpoints!

> 🛠 **Try it (15 min, hands on).** Keep the practice API running. Start every step from a clean state with `curl localhost:8765/reset`.
> 1. *Offset pages drift.* Read page 1 with `curl -H "Authorization: Bearer learner-token" "localhost:8765/orders_offset?limit=10&offset=0"`. Now let 3 new orders arrive (`.../arrive?n=3`, same header). Read page 2 with `offset=10`. Which ids does page 2 contain that page 1 already had?
> 2. *Cursors do not.* In `cursor_all.py`, read **all** orders from `/orders?limit=10` by following `next_cursor` until it is empty, and call `/arrive?n=3` once right after the first page. Print how many ids you collected and how many are distinct.
> 3. *Rate limits.* Call `/limited` from `limited.py`. On a 429, print the status and the `Retry-After` value, sleep exactly that long, call again and print the new status.
>
> **You should see:** page 1 has ids 25 down to 16, and page 2 repeats 18, 17 and 16; the cursor script prints `28 28`; the rate-limit script prints `429 2.0` and then `200`.

## @lesson Incremental loads and checkpoints

> **In short:** A checkpoint says how far you got. Write the data first, then the checkpoint, and make the load safe to repeat (replace or deduplicate), so a crash costs a retry, not data.
Copying 5 years of orders every night is wasteful. An **incremental load** fetches only what is new or changed. It needs two things: an API parameter such as `updated_since`, and a **checkpoint** (also called a high-water mark or watermark): the point up to which you have already loaded, for example the greatest `updated_at` you have seen.

One run then looks like this:

1. Read the checkpoint (none on the first run, which loads everything).
2. Fetch everything with `updated_since = checkpoint`.
3. **Write the data somewhere durable.**
4. **Only then** move the checkpoint forward to the greatest `updated_at` of what you fetched.

**The order of steps 3 and 4 is the most important line of the module.** If you save the checkpoint first and the write then fails, the next run starts *after* the data that was never stored: those records are lost, silently, forever. With the right order, a crash between 3 and 4 only means that the next run fetches the same records again, which is harmless **if the load is idempotent**. Hence the rule: *a checkpoint may only ever describe data that is safely stored.*

How to make the load idempotent:

- **Name the output after the run** (`orders_<run_id>.jsonl`). A rerun of the same run overwrites the same file instead of adding a second one.
- **Write atomically**: write a temporary file in the same folder, then rename it over the final name (`os.replace`). The file is either complete or absent, never half written. The lab applies the same idea to the checkpoint file itself, so a crash cannot leave a corrupt checkpoint.
- **Deduplicate** by the record's id, keeping the version with the greatest `updated_at`, because the same record may appear twice (an update arrived between pages).

Edge cases to design for. **Updates**: a changed old record has a new `updated_at`, so it shows up again, and your load must treat it as a new version (the lab test changes order 3 to "refunded"). **Deletes**: an API based on `updated_since` usually cannot tell you that a record was deleted; look for a soft-delete flag or a "deleted since" endpoint, or reconcile with an occasional full load, or use change data capture (Module 3.2). **Ties and late updates**: several records may share one timestamp, and clocks differ, so many teams re-read a small overlap window (the last few minutes) and rely on deduplication. **No `updated_since`**: fall back to a full snapshot and compare it with what you have.

The checkpoint is itself state. Store it somewhere durable that survives the machine (a file in cloud storage, a table), and make it easy to inspect and to reset for a **backfill** (reloading a period on purpose).

> 💡 **Practice Pause 3 (Atomic Checkpoint State Storage):**
> Guard your high-water mark against sudden system crashes:
> 1. In `labs/mod-1-6/ingest_lab.py` in your text editor, implement the `Checkpoint(path)` class:
>    - `load()`: parse the JSON file and return the saved checkpoint value, or None if the file does not exist yet.
>    - `save(value)`: atomically write `{"value": value}` via a temp file swapped with `os.replace()` so crashes never leave corrupt state.
> 2. Test in the terminal:
> `pytest labs/mod-1-6/test_lab.py -k TestCheckpoint -v`
> When TestCheckpoint tests are PASSED, proceed to Lesson 5 for raw data flattening!

> 🛠 **Try it (15 min, hands on).** Write `load.py` against the practice API: read the orders with a cursor (`limit=5`) and append them to `out.jsonl`; **after** each page is written, save `{"cursor": ...}` to `checkpoint.json` (write a temporary file, then `os.replace`). When the script starts it resumes from `checkpoint.json` if there is one. Put `time.sleep(1)` after writing each page, so that you have time to interrupt.
> 1. Run `curl localhost:8765/reset`, then start `load.py` and press Ctrl+C after about two pages. Compare `wc -l out.jsonl` with the cursor in `checkpoint.json`: why can the file hold more rows than the checkpoint says?
> 2. Run `load.py` again to the end, then run `python3 -c "import json; ids=[json.loads(l)['id'] for l in open('out.jsonl')]; print(len(ids), len(set(ids)))"`. Make your loader deduplicate by `id` until it prints `25 25`.
> 3. Now break it on purpose: delete `out.jsonl` and `checkpoint.json`, reset the API, and swap the order (save the checkpoint **first**, sleep, then write the page). Interrupt during the sleep, run it to the end, and run the check from step 2 again.
>
> **You should see:** in step 1 more lines than the checkpoint implies (the page in flight was written but not yet checkpointed); `25 25` in step 2; in step 3 fewer than 25 rows, and the missing ids form one page of five. That page is lost forever, which is exactly why the checkpoint is saved last.

## @lesson Landing and shaping raw data

> **In short:** Land the raw data untouched, with metadata and a date partition. Flatten nested objects into columns, keep lists as JSON text, and detect when a field changes type.
Store what you received, as you received it, in a **landing** area (also called raw or bronze, Module 2.2). Do not fix, rename or drop anything at this stage; do the cleaning in a later, repeatable step (Module 2.3). The reason is practical: if your cleaning had a bug, you can fix it and reprocess from the raw copy instead of asking the source for last month's data again, which may no longer be available.

Good landing habits:

- **JSON Lines** (one JSON object per line) is a safe, appendable, splittable format for API data. Parquet is better for large volumes, once the shape is stable.
- Add **metadata** to every record: `_run_id`, `_source` and `_ingested_at` (the lab's `incremental_load` does). When a number looks wrong, these tell you which run brought it.
- **Partition by ingestion date** (`dt=2026-02-01/`), so a day's data is easy to find, reprocess or delete (the lab writes exactly that path).
- Keep files a **reasonable size**: not one tiny file per request (the small-files problem, Modules 3.0 and 2.6), not one giant file.

**Flattening nested JSON.** APIs return nested objects and arrays, but tables are flat. A nested object becomes columns (`customer.address.city` becomes `customer_address_city`); an **array** needs a decision. Keeping it as a JSON string in one column is the safe default for landing (the lab's `flatten_record`), and a later step explodes it into a **child table** with one row per element and the parent's id (an order's `items` become an `order_items` table, the grain of Module 1.4).

**Schema drift.** The API's shape will change: a new field appears, a field disappears, a number arrives as the text `"Rp 6.000"`. Silently loading it is dangerous. The lab's `detect_schema_drift` compares incoming records with the schema you expect and reports **new columns**, **missing columns** and **type changes** (with every type seen). Then decide a policy: **fail** the load (strict, safe for finance data), **quarantine** the odd records and continue, or **evolve** the schema automatically (convenient, risky). Write the policy down as a data contract with the provider or your consumers (Module 2.5), and alert when drift is detected.

> 💡 **Practice Pause 4 (JSON Flattening & Schema Drift Detection):**
> Shape raw payloads into tabular records and protect data contract schemas:
> 1. In `labs/mod-1-6/ingest_lab.py` in your text editor, complete 2 data shaping functions:
>    - `flatten_record(record, sep="_")`: unnest nested dictionaries (e.g., `customer.address.city` -> `customer_address_city`), keeping arrays as sorted-key JSON strings.
>    - `detect_schema_drift(expected, records)`: compare records against expected schema to detect `new_columns`, `missing_columns`, and `type_changes`.
> 2. Test in the terminal:
> `pytest labs/mod-1-6/test_lab.py -k "TestFlatten or TestSchemaDrift" -v`
> When tests show PASSED, proceed to Lesson 6 to assemble the complete incremental ingestion pipeline!

> 🛠 **Try it (10 min, hands on).** With the practice API running, fetch one order with nested data: `curl -H "Authorization: Bearer learner-token" localhost:8765/orders/1`.
> 1. Write `flatten(record)` in `flat.py`: nested objects become columns named by their path (`customer_address_city`), lists are kept as JSON text. Your code must pass these checks (`order1` is the parsed JSON of `/orders/1`):
>    `flat = flatten(order1)`
>    `assert flat["customer_address_city"] == "Jakarta"`
>    `assert flat["customer_id"] == 7`
>    `assert flat["items"] == '[{"sku": "A1", "qty": 2}, {"sku": "B2", "qty": 1}]'`
>    `assert "customer" not in flat`
> 2. Make a copy of `flat` in which `total_idr` is the text `"Rp 1.000"`. Write a small function that compares the field types of two records and prints every field whose type changed.
>
> **You should see:** no assertion error, and for step 2 one line: `total_idr: int -> str`. That is schema drift, found in four lines of code.

## @lesson Files, databases, and running it for real

> **In short:** Files: wait until they are complete and record names and checksums. Databases: read from a replica and use an incremental column. Run it with counts, reconciliation and a deliberate backfill.
**Files.** Partners drop files, and files are full of surprises: encodings (always say UTF-8 explicitly, Module 0.0), quoted line breaks, a header that changes, **late or missing files**, and the same file delivered twice. Practices: wait for the file to be completely written (a marker file, or a stable size), record the **file name and checksum** of everything loaded so a duplicate delivery is recognised, and make arrival a monitored event ("the 06:00 file has not come").

**Databases.** The options are a **full table copy** (simple, heavy on the source), an **incremental copy by a timestamp or increasing id** (the same checkpoint logic as above; it misses deletes and relies on a trustworthy `updated_at`), and **change data capture** from the log (Module 3.2). Whatever you choose, read from a **replica** when possible and avoid long queries on the production primary (Module 1.3). Respect the application team's limits as you would an API's.

**Build or buy.** Managed connectors (Airbyte, Fivetran and others) handle common sources, pagination, retries and schema changes for you. Buy for popular sources where the connector is mature; build when the source is unusual, when you need control over cost or latency, or when the connector hides behaviour you must understand. Knowing how to build it, as in this lab, is what lets you judge and debug a connector.

**Operating an ingestion job.**

- **Log and measure**: records fetched, pages, retries, waits, duration, bytes written, checkpoint before and after. A job that "succeeds" with zero records is often broken; alert on **freshness** (age of the newest data) and on **volume** (Module 2.5).
- **Reconcile**: compare the count you loaded with what the source says it has. It is the cheapest completeness check.
- **Backfill on purpose**: have a documented way to reset the checkpoint and reload a period, and make sure the rerun is idempotent.
- **Test without the real service**: a fake server like the lab's lets you test 429, 500, timeouts and bad tokens in seconds. Add **contract tests** that run against the real API occasionally to catch changes.
- **Secrets and limits**: tokens in a secret manager, rotated; request rates configured and documented.

You can now answer: "How do you ingest from a paginated API reliably?" (cursor, retries with backoff, rate-limit handling, checkpoint after durable write, idempotent landing, schema checks). "What if the job crashes halfway?" (the checkpoint did not move, so the rerun fetches the same data and overwrites the same file). "Why not offset pagination?" (it duplicates or skips when data changes while you read).

> 💡 **Practice Pause 5 (Idempotent Incremental Ingestion Pipeline - Lab Complete):**
> Assemble the battle-tested production ingestion workflow:
> 1. In `labs/mod-1-6/ingest_lab.py` in your text editor, implement the `incremental_load(...)` function:
>    - Read checkpoint, fetch records with `fetch_all_cursor(..., since=checkpoint)`.
>    - Deduplicate by id (keeping greatest `updated_at`).
>    - Land raw records into `landing_dir/dt=<today>/orders_<run_id>.jsonl` with audit metadata (`_run_id`, `_source`, `_ingested_at`) using atomic file writes.
>    - Update checkpoint ONLY AFTER the data file is safely landed.
> 2. Run the complete test suite in the terminal:
> `pytest labs/mod-1-6/test_lab.py -v`
> When all 37 tests show PASSED, your ingestion pipeline is enterprise ready!

> 🛠 **Try it (10 min, hands on).** Generate the KopiKu files (`python3 labs/shared/shopgen.py --out data`) and treat `data/orders.csv` as a delivery from a partner.
> 1. With the `csv` module count the rows and the distinct `order_id` values. Compare with `orders_rows`, `orders_distinct` and `orders_duplicate_rows` in `data/manifest.json`.
> 2. Load the file into a SQLite table whose primary key is `order_id` (use `INSERT OR REPLACE`), and print the row count.
> 3. Run the load a second time in the same script and print the row count again.
>
> **You should see:** `3634 3599` in step 1 (35 duplicate rows, as the manifest says), then `3599` and `3599` in steps 2 and 3. Also compare with `wc -l data/orders.csv`: it shows 3635, because of the header line. Counting rows at every hop is the cheapest way to prove nothing was lost.

## @lab Lab: ingest from a flaky API, safely
Build the core of an ingestion job against a **fake HTTP API running on your own computer** (started by the tests; no internet or account is needed): request building and authentication, retries with exponential backoff and `Retry-After`, cursor and offset pagination, an atomic checkpoint, flattening, schema-drift detection, and an incremental, idempotent load that lands JSON Lines. The tests (37) check every behaviour, including a simulated crash between writing the file and saving the checkpoint.

### @steps
1. Read `labs/mod-1-6/ingest_lab.py` and then the first 70 lines of `test_lab.py` to see the fake API (it is ordinary Python: a small HTTP server in a thread). `ApiError` is provided.
2. Work in file order and run the tests after EACH function:

```bash
pytest labs/mod-1-6/test_lab.py -v
pytest labs/mod-1-6/test_lab.py -v -k "GetJson or Pagination"      # one group at a time
```

3. **Requests and retries first.** Implement `build_request` and `backoff_delay`, then `get_json`. Before you run the tests, write on paper the list of waits you expect for the sequence "500, 503, then success", and for "429 with Retry-After 7, then 429 with Retry-After 2, then success".
4. **Pagination.** Implement the cursor loop first, then the offset loop. Run `fetch_all_offset` against a data set whose size is an exact multiple of the page size and count the requests.
5. **Checkpoint, flatten, drift.** These are small and pure. For `Checkpoint.save`, explain in one sentence what could go wrong if you wrote the file directly.
6. **The incremental load.** Write it last. Before you run `test_a_crash_before_the_checkpoint_is_repaired_by_rerunning`, explain why your order of steps makes it pass. Then deliberately swap steps 5 and 6 and watch which test fails.
7. **Do it for real.** After Module 0.2, write the code again in your own venv **without copying**, and run `python3 scripts/prove.py mod-1-6` to get the proof code for the **Proof** box on this lab page.

### @files
- labs/mod-1-6/ingest_lab.py :: Your working file: implement the TODO functions and the Checkpoint class :: starter
- labs/mod-1-6/test_lab.py :: The 37 tests, including the fake HTTP API :: test
- labs/mod-1-6/fakeapi.py :: A small practice API for the Try it exercises (run it in a second terminal) :: config
- labs/mod-1-6/requirements.txt :: pytest :: config
- labs/mod-1-6/reference/ingest_lab.py :: One possible solution (try first!) :: reference

### @deliverables
- All 37 tests pass **on your own computer, run from your own terminal**
- You can explain, with a number, why offset pagination can duplicate records, and why cursors do not
- You can explain which status codes to retry and which not to, and what `Retry-After` is for
- You can explain why the checkpoint is saved after the data is written, and what happens after a crash in between

### @verify
```bash
pytest labs/mod-1-6/test_lab.py -v
python3 scripts/prove.py mod-1-6
```

Known-good run: prefix the first command with `LAB_DIR=reference`.

## @chaos The checkpoint that moved before the data landed
### @scenario
A nightly job loads orders from a payment provider's API. To avoid "wasting" time, a developer saves the new checkpoint as soon as the last page has been fetched, then writes the records to cloud storage. It has run for months.

One night the storage service has a short outage while the job is writing. The write fails and the job exits with an error, but the checkpoint has already moved to the end of the data it had fetched. The orchestrator retries the job in the morning; it reads the new checkpoint, asks the API for orders after it, and finds only a few. The job reports **success**. Three weeks later the finance team notices that one night of revenue, 4,200 orders, is missing from the warehouse and from every report built on it, and the provider's own dashboard shows the difference.

### @cause
The steps were in the wrong order. The checkpoint claimed that data up to a point was safely loaded, but the data had not been stored yet, so a failure in between created a **permanent gap**: those orders were older than the checkpoint and would never be requested again. Nothing detected it, because the retry succeeded and nothing compared counts with the source.

Contributing factors: no reconciliation between the provider's totals and the warehouse, no alert on volume (the night's row count was a fraction of normal), and a job that was not designed to be rerun, so nobody could simply "load that night again".

### @fix
1. **Write first, checkpoint last**, in that order, and treat the pair as one unit: the checkpoint file is replaced atomically only after the data file is in place (the lab's `incremental_load`, and its crash test).
2. Make the load **idempotent** (output named by run id, atomic rename, deduplication by id), so rerunning a failed or suspicious night is always safe.
3. **Backfill the missing night** by resetting the checkpoint to before it and rerunning; check the counts against the provider.
4. Add **reconciliation**: compare the number and total value of records loaded per day with the provider's own report, and alert on a difference.
5. Add **volume and freshness alerts** (Module 2.5): a night with 5% of the normal row count must raise an alert even when the job "succeeded".
6. Add a **replay window**: re-read the last few hours on every run and rely on deduplication, so a small gap from any cause is self-healing.

### @pattern
A checkpoint may only describe data that is safely stored. Order the steps so that a crash causes a repeat, never a loss, and then prove it by comparing with the source.

## @quiz
### An API answers `429 Too Many Requests` with the header `Retry-After: 7`. What should the client do?
- [ ] Retry at once and as fast as possible, because the server will accept it the second time
- [ ] Stop the job for good and report an error, since a rate limit can never be handled by the client itself
- [x] Wait about 7 seconds, then retry, because the server told the client exactly when to try again
- [ ] Change to another API key at once, so that the limit is counted against a different identity each time

> `Retry-After` states how long to wait. Hammering makes the problem worse and can get a client banned.

### Which of these HTTP errors should a client NOT retry?
- [ ] 503 Service Unavailable, because the server is overloaded and may be able to answer a little later
- [ ] 500 Internal Server Error, since a temporary fault on the server often disappears on the next try
- [ ] A connection timeout, because the network or server may have been briefly unavailable
- [x] 401 Unauthorized, because the credentials are wrong and the same request will fail again

> Retry temporary problems (429, 5xx, connection errors). Errors that mean "your request is wrong" (400, 401, 403, 404) will not change by waiting.

### Why does exponential backoff wait 1, 2, 4, 8 seconds instead of a fixed second each time?
- [ ] A doubling wait uses less memory in the client program than a wait of the same length every time
- [x] A struggling server gets more time to recover, and many clients do not all retry at the same moment
- [ ] The HTTP standard requires that the waits are powers of two, and servers reject other waiting times
- [ ] It guarantees that the request succeeds on the fourth attempt, so no further retries are ever needed

> Increasing waits reduce pressure on a failing service. Adding random jitter spreads out clients that failed together. A retry limit and a loud failure are still needed.

### In a newest-first feed, 3 orders arrive after you read page 1 with offset pagination. What can happen on page 2?
- [ ] Nothing, since offsets are fixed numbers that always point to the same records, whatever is inserted
- [x] Some rows slide down into the next page and appear a second time, so the result contains duplicates
- [ ] The server closes the connection, because a client may not read a feed while rows arrive
- [ ] The next page comes back empty, because new records make the earlier offsets invalid for all clients

> Inserts shift later offsets. In the lab's example 25 orders were fetched as 28 rows. Cursor (keyset) pagination avoids this.

### What is the correct order for one incremental run?
- [ ] Save the new checkpoint, then fetch the data, then write it, so the next run starts as early as possible
- [ ] Fetch the data, save the checkpoint, then write the data, because the checkpoint is the cheaper step
- [x] Read the checkpoint, fetch the data, write it durably, and only after that save the new checkpoint
- [ ] Write the data and the checkpoint at the same moment, since the order never matters to a job

> A checkpoint may only describe data that is stored. With this order a crash causes a repeat, which an idempotent load tolerates, and never a loss.

### Why write a file to a temporary name and then rename it?
- [ ] Renaming a file compresses it, so the final file takes less space than one written directly
- [ ] Temporary files are exempt from disk quotas, which lets large loads finish without errors
- [x] The final file is either complete or absent, so a crash never leaves a half-written file behind
- [ ] The operating system requires every file to be renamed once before any other program may read it

> An atomic rename (`os.replace`) makes the switch all-or-nothing. The same technique protects the checkpoint file.

### A rerun of the same run id should leave the landing folder with how many files for that run?
- [ ] Two, one for each attempt, because every run must keep its own copy for the audit trail later
- [x] One, because the output is named after the run id and the rerun overwrites the same file
- [ ] None, because a rerun deletes its output when it finds that the data was already loaded earlier
- [ ] As many as there are pages, since each page of the API must be stored in its own file

> Naming output by run id plus an atomic overwrite makes the load idempotent: running it again gives the same result as running it once.

### The API starts sending `total_idr` as the text "Rp 6.000" for some records. What should an ingestion job do?
- [ ] Load it silently, since the warehouse will convert the text to a number when someone queries it
- [ ] Drop those records, so the table stays clean and nobody has to be told about the problem
- [x] Detect the type change as schema drift, then fail or quarantine by an agreed policy, and alert
- [ ] Convert every column of every record to text, so that a type change can never cause a problem again

> Silent type changes corrupt downstream numbers. Detect drift, apply an explicit policy (fail, quarantine or evolve), and tell the owner.

## @resources
- [MDN: HTTP response status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [MDN: Retry-After header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After)
- [Python: urllib.request](https://docs.python.org/3/library/urllib.request.html)
- [Slack API: pagination (cursor example)](https://api.slack.com/docs/pagination)
- [AWS Architecture Blog: Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [JSON Lines](https://jsonlines.org/)
