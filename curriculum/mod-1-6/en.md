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

## @part Getting data from APIs

## @lesson How data enters a platform

> **In short:** Data arrives as files, API calls, database reads or events. You choose pull or push, and full or incremental. A trustworthy job is complete, repeat-safe, raw-first, observable and polite to the source.
Everything a data engineer builds starts with **ingestion**: moving data from where it is created to where it can be used. The sources fall into four families:

- **Files**: CSV, JSON, Parquet dropped on a server, an **SFTP** folder (Secure File Transfer Protocol, encrypted file transfer over SSH) or cloud storage by a partner or an export job.
- **APIs**: a service (a payment provider, a marketing tool, a government open-data portal) that you call over HTTP.
- **Databases**: tables in an operational database, read in bulk or incrementally (Module 3.2 covers change data capture).
- **Events**: messages from Kafka, **webhooks** (an HTTP URL of yours that another service calls automatically when an event happens) and queues (Module 3.2).

Two choices shape every job. **Pull or push:** do you ask the source for data on a schedule (pull), or does it send you data when something happens (push, as with webhooks and events)? **Full or incremental:** do you copy everything every time (simple, correct, expensive as data grows), or only what changed since last time (cheap, but you must track "since when" and handle updates and deletes)?

What a **trustworthy ingestion job** promises, and what this module teaches you to build:

1. **Complete**: no record is lost, even after a crash or a rate limit.
2. **No duplicates, safe to rerun**: running it twice produces the same result as running it once (idempotence, Module 1.2).
3. **Raw first**: it stores what it received, unchanged, before any cleaning (the ELT habit of Module 0.2), so you can reprocess later without calling the source again.
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
> *Compare when you are done:* 1 is a file you pull (full, or incremental if the file only holds new rows); 2 is an event pushed to you (incremental by nature); 3 is a database you pull incrementally; 4 is an event stream: the app pushes into the log and your consumer pulls from it. This one has no checker: the answers above are the check.

:::ask Why does a trustworthy ingestion job store the data exactly as received before cleaning it?
@options
because raw data takes less space than clean data
* so you can reprocess if the cleaning was wrong
because cleaning is not allowed in ingestion jobs
@why
'Raw first' is the ELT habit: land the original, then transform. If a rule had a bug, or late data arrives, you rerun from the raw copy instead of asking the source again.
:::

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

**Authentication** is how the API knows who you are: an **API key** in a header or **query string** (the `?key=value&...` parameters at the end of a URL), a **bearer token** (`Authorization: Bearer ...`), or **OAuth**, where you exchange credentials for a token that expires and must be refreshed. Whatever the method, **a credential is a secret**: keep it in an environment variable or a **secret manager** (a dedicated vault service such as AWS Secrets Manager or GCP Secret Manager that stores and rotates credentials), never in the code or in Git (Module 0.1), and never in logs. The lab's `build_request` puts the token in the header, builds the URL with `urllib.parse.urlencode` with parameters sorted so the URL is reproducible, and drops parameters whose value is `None`.

Always set a **timeout**. Without one, a hung connection blocks your job forever. Connection problems (the server unreachable, a reset, a timeout) are different from HTTP errors: there is no status code, so you treat them like a 5xx, as something temporary.

Read the API documentation for four things before writing code: how **authentication** works, how **pagination** works, what the **rate limit** is, and how to ask for **only the changes** (a parameter such as `updated_since`). Many APIs are versioned (`/v2/orders`); pin the version, because an unannounced change is a way for your job to break.

You can do all of this with Python's standard library (`urllib.request`), as the lab does, or with the popular `requests` package; the ideas are identical:

```python
import json, urllib.error, urllib.request

req = urllib.request.Request("http://localhost:8765/orders?limit=3", headers={"Authorization": "Bearer learner-token"})
try:
    with urllib.request.urlopen(req, timeout=5) as resp:
        data = json.load(resp)                       # resp.status is 200
except urllib.error.HTTPError as e:                  # 4xx / 5xx: read e.code and e.headers
    print("HTTP error:", e.code, e.headers.get("Retry-After"))
except urllib.error.URLError as e:                   # connection problem or timeout (no status code)
    print("Network error:", e.reason)
```

> 💡 **Practice Pause 1 (HTTP Request Construction & Auth Headers):**
> Start building your ingestion module with deterministic HTTP request formatting:
> 1. Open `labs/mod-1-6/ingest_lab.py` in your text editor (remember: do not execute directly in bash!).
> 2. Implement `build_request(url, token, params=None)`: drop None query values, sort parameters with `urllib.parse.urlencode` (ensuring reproducible URLs), and attach headers `Authorization: Bearer <token>` and `Accept: application/json`.
> 3. Test in the terminal (if `pytest` is not installed yet, run `pip install -r labs/mod-1-6/requirements.txt` once):
> `pytest labs/mod-1-6/test_lab.py -k TestBuildRequest -v`
> When TestBuildRequest tests are PASSED, proceed to Lesson 3 to handle pagination and network retries!

> 🛠 **Try it (10 min, hands on).** Start the practice API in a second terminal and leave it running: `python3 labs/mod-1-6/fakeapi.py` (it holds 25 orders; the token is `learner-token`; the file's docstring lists its endpoints).
> 1. In your first terminal: `curl -i "localhost:8765/orders?limit=3"`. Which status do you get, and why?
> 2. Fix it yourself by adding the header `-H "Authorization: Bearer learner-token"`. Read the status line, the `Content-Type` header and the JSON. What does `next_cursor` hold?
> 3. In `try_http.py`, with only `urllib` from the standard library, GET the same URL with the header and print the status code and the list of order ids. Then call it without the header, catch the error and print its code.
>
> **You should see:** `401` for step 1, then `HTTP/1.0 200 OK`, `application/json` and `"next_cursor": "3"` for step 2, and from your script `200 [1, 2, 3]` followed by `401`.
>
> **Check it:** keep the scripts of these exercises in one folder, for example `~/practice`, and run `python3 labs/tryit/check.py 1.6-2 ~/practice`. The checker starts its own copy of the practice API, so stop yours (Ctrl+C) first.

:::ask An API call returns 404 for one order and 503 for another. What should the ingestion code do?
@options
retry both the same number of times
stop at the first error and discard everything
* retry 503 (temporary), not 404
@why
4xx means the request itself is wrong (a 404 will not fix itself), so retrying wastes calls. 5xx and connection problems are usually temporary, and so is 429 after waiting the time the server asks for.
:::

## @lesson Reading all the data: pagination, rate limits and retries

> **In short:** Offset pages shift when data changes (duplicates and gaps); cursors do not. On 429 wait as long as `Retry-After` says; on 5xx retry with growing waits and a limit; never retry other 4xx.
An API will not return a million records at once. It returns a **page** and tells you how to get the next one. There are three styles:

- **Offset pagination** (`?offset=20&limit=10`): simple, but unsafe on live data. If new records arrive while you read, the offsets shift. In a newest-first feed of 25 orders, reading pages of 10 while 3 new orders arrive after the first page gives **28 rows fetched covering only the 25 distinct original orders**, 3 duplicates (older rows slide into the next page), and the 3 new orders are missed. Deleted rows cause the opposite, skipped records. It is also slow on large offsets.
- **Page numbers** (`?page=3`): the same weakness.
- **Cursor (keyset) pagination** (`?cursor=abc`): each response contains a `next_cursor` that marks exactly where to continue. Reading the same feed this way gives every order once, with no duplicates and none skipped. **Prefer cursors whenever the API offers them.** The lab's `fetch_all_cursor` follows `next_cursor` until it is missing, and `fetch_all_offset` shows the offset loop (stop when a page is shorter than `limit`; note that when the total is an exact multiple of `limit` you need one extra request to see the empty page).

**Rate limits.** To protect itself, an API limits how many requests you may send, for example 100 per minute. When you exceed it you receive **429 Too Many Requests**, often with a **`Retry-After`** header saying how many seconds to wait. The polite and effective response is to **wait exactly that long**. Hammering the API makes things worse and can get you banned.

**Retries with exponential backoff.** Networks and servers fail temporarily, so retry the *temporary* errors (429, 5xx, connection problems), and only those. After each failure wait longer: 1 second, then 2, 4, 8, 16, capped at, say, 30 (`backoff_delay` in the lab: `min(cap, base * 2 ** (attempt - 1))`, giving 1, 2, 4, 8, 16, 30, 30). Doubling gives a struggling server time to recover; in production add a little random **jitter** so that a thousand clients that failed together do not all retry at the same instant. Put a **limit on the number of retries**, and when it is reached **fail loudly** with the last error, so that the orchestrator (Module 2.4) can alert and rerun later. Never retry 400, 401, 403 or 404: the answer will not change.

Retrying is only safe for operations that are **idempotent**. A GET that reads data is. A POST that creates something may create it twice if the first attempt succeeded but the response was lost; such calls need an idempotency key if the API offers one. Ingestion mostly reads, which is why it is the friendly case.

In the lab you test all this against a **real HTTP server running on your computer**, which answers 429 with `Retry-After` and 500 on request. The `sleep` function is a parameter, so tests record the waits (1, 2 or 7 seconds) instead of really sleeping. Designing code so that time and the network can be replaced in tests is a skill in itself.

> 💡 **Practice Pause 2 (Resilient Network Fetching & Pagination):**
> Handle network volatility, 429 rate limits, and multi-page responses:
> 1. In `labs/mod-1-6/ingest_lab.py` in your text editor, implement:
>    - `backoff_delay(attempt, base=1.0, cap=30.0)`: exponential delay `min(cap, base * 2 ** (attempt - 1))`.
>    - `get_json(...)`: retry on 429 (respecting `Retry-After`), 5xx, and connection errors, while raising `ApiError` immediately on non-retryable 4xx codes (401, 404).
>    - `fetch_all_cursor(...)`: walk cursor-paginated endpoints until `next_cursor` is None.
>    - `fetch_all_offset(...)`: loop offset pages until record count < limit.
> 2. Test in the terminal:
> `pytest labs/mod-1-6/test_lab.py -k "TestBackoff or TestGetJson or TestPagination" -v`
> When tests show PASSED, proceed to Lesson 4 for incremental checkpoints!

> 🛠 **Try it (15 min, hands on).** Keep the practice API running. Start every step from a clean state with `curl localhost:8765/reset`.
> 1. *Offset pages drift.* Read page 1 with `curl -H "Authorization: Bearer learner-token" "localhost:8765/orders_offset?limit=10&offset=0"`. Now let 3 new orders arrive (`http://localhost:8765/arrive?n=3`, same header). Read page 2 with `offset=10`. Which ids does page 2 contain that page 1 already had?
> 2. *Cursors do not.* In `cursor_all.py`, read **all** orders from `/orders?limit=10` by following `next_cursor` until it is empty, and call `/arrive?n=3` once right after the first page. Print how many ids you collected and how many are distinct.
> 3. *Rate limits.* Call `/limited` from `limited.py`. On a 429, print the status and the `Retry-After` value, sleep exactly that long, call again and print the new status.
>
> **You should see:** page 1 has ids 25 down to 16, and page 2 repeats 18, 17 and 16; the cursor script prints `28 28`; the rate-limit script prints `429 2` (or `429 2.0`) and then `200`.
>
> **Check it:** `python3 labs/tryit/check.py 1.6-3 ~/practice` (it needs `cursor_all.py` and `limited.py`; stop your own practice API first). It also tries your `limited.py` against a server that asks for a different wait, so read the header instead of hard-coding the number.

:::drill python Wait longer each time
Retries use exponential backoff: wait 1 second after the first failure, then 2, 4, 8, and so on, never more than a cap. Write `backoff_delay(attempt, base, cap)` with `attempt` starting at 1: return `min(cap, base * 2 ** (attempt - 1))`.
@starter
# write your function below this line

@check
defines("backoff_delay") ## Define backoff_delay(attempt, base, cap).
backoff_delay(1, 1, 30) == 1 ## The first wait is the base.
backoff_delay(4, 1, 30) == 8 ## 1, 2, 4, 8.
backoff_delay(6, 1, 30) == 30 ## 32 would be too long: the cap wins.
backoff_delay(3, 5, 100) == 20 ## Another base: 5, 10, 20.
@hint
Double `base` for each retry after the first (`attempt - 1` doublings using powers of 2), then cap the result with `min()`.
@solution
def backoff_delay(attempt, base, cap):
    return min(cap, base * 2 ** (attempt - 1))
:::

:::drill python Read every page
An API returns one page at a time: `get_page(cursor)` gives a dictionary `{"items": [...], "next": cursor_or_None}`. Start with the cursor `None`. Write `fetch_all(get_page)`: keep fetching until `next` is `None`, and return all items in order.
@starter
# write your function below this line

@check
defines("fetch_all") ## Define fetch_all(get_page).
fetch_all(lambda c: {None: {"items": [1, 2], "next": "a"}, "a": {"items": [3], "next": None}}[c]) == [1, 2, 3] ## Two pages, in order.
fetch_all(lambda c: {"items": [], "next": None}) == [] ## One empty page.
fetch_all(lambda c: {None: {"items": [7], "next": "x"}, "x": {"items": [8], "next": "y"}, "y": {"items": [9, 10], "next": None}}[c]) == [7, 8, 9, 10] ## Three pages.
@hint
`cursor = None`, then loop: `page = get_page(cursor)`, add `page["items"]`, set `cursor = page["next"]`, stop when it is `None`.
@solution
def fetch_all(get_page):
    items = []
    cursor = None
    while True:
        page = get_page(cursor)
        items.extend(page["items"])
        cursor = page["next"]
        if cursor is None:
            return items
:::

:::ask You page through a live newest-first feed with `?offset=10&limit=10` while 3 new orders arrive. What can go wrong?
@options
* offsets shift, so some rows come back twice
the API returns an empty page every time
the new orders overwrite the old ones
@why
With offset pagination, new rows push older rows down the list, so the same row can appear at the end of one page and the start of the next. Cursor pagination avoids this.
:::

:::trace Offset pagination on a live feed
@code
feed = [5, 4, 3, 2, 1]
page1 = feed[0:2]
feed = [7, 6] + feed
page2 = feed[2:4]
print(page1 + page2)
@notes
2 | The first page (offset 0, limit 2) holds the two newest orders: 5 and 4.
3 | Two new orders arrive. They go to the **front** of a newest-first feed and push every older order two places down.
4 | The second page (offset 2) now points at 5 and 4 again, because they moved down by exactly the amount the offset moved.
5 | It prints `[5, 4, 5, 4]`: orders 5 and 4 twice, and order 3 not read yet. A cursor ("everything older than order 4") would not have shifted.
:::

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
- **Write atomically**: write a temporary file in the same folder, then rename it over the final name (`os.replace`). The file is either complete or absent, never half written. In Python, `fd, tmp = tempfile.mkstemp(dir=folder)` creates a unique temporary file in that folder and `with os.fdopen(fd, "w", encoding="utf-8") as f:` writes to it before `os.replace(tmp, final_path)`. The lab applies the same idea to the checkpoint file itself, so a crash cannot leave a corrupt checkpoint.
- **Deduplicate** by the record's id, keeping the version with the greatest `updated_at`, because the same record may appear twice (an update arrived between pages).

Edge cases to design for. **Updates**: a changed old record has a new `updated_at`, so it shows up again, and your load must treat it as a new version (the lab test changes order 3 to "refunded"). **Deletes**: an API based on `updated_since` usually cannot tell you that a record was deleted; look for a **soft-delete flag** (a column such as `is_deleted = true` or `deleted_at` that marks a row deleted instead of removing it) or a "deleted since" endpoint, or reconcile with an occasional full load, or use change data capture (Module 3.2). **Ties and late updates**: several records may share one timestamp, and clocks differ, so many teams re-read a small overlap window (the last few minutes) and rely on deduplication. **No `updated_since`**: fall back to a full snapshot and compare it with what you have.

The checkpoint is itself state. Store it somewhere durable that survives the machine (a file in cloud storage, a table), and make it easy to inspect and to reset for a **backfill** (reloading a period on purpose).

### See it: why the order of "write" and "checkpoint" matters

The checkpoint says how far you got. Watch what a crash does when the checkpoint is saved **first**:

:::trace Checkpoint first: rows lost forever
@code
store = []
checkpoint = 0
batch = [{"id": 1, "updated_at": 5}, {"id": 2, "updated_at": 9}]

checkpoint = max(r["updated_at"] for r in batch)
try:
    raise ConnectionError("the write failed")
except ConnectionError:
    pass
print(store, checkpoint)
@notes
5 | The checkpoint moves forward **before** anything is stored. It now claims that everything up to 9 is loaded.
7 | The write fails.
10 | The store is empty, but the checkpoint says 9. The next run asks for rows "updated since 9", so these two rows are never fetched again: lost, silently, forever.
:::

Now the same crash, with the right order: write first, checkpoint second.

:::trace Write first, then the checkpoint
@code
store = []
checkpoint = 0
batch = [{"id": 1, "updated_at": 5}, {"id": 2, "updated_at": 9}]

store.extend(batch)
try:
    raise ConnectionError("crash before the checkpoint is saved")
except ConnectionError:
    pass
print(store, checkpoint)
@notes
5 | The data is stored first.
7 | The crash happens now, before the checkpoint moved.
10 | The checkpoint is still 0, so the next run fetches the same two rows again. That costs a retry, not data, **if the load is idempotent** (deduplicated by id).
:::

:::ask Which order makes a crash safe?
@options
save the checkpoint, then write the data
* write the data, then save the checkpoint
the order does not matter
@why
A checkpoint may only ever describe data that is safely stored. With the right order, a crash only means the next run repeats some work, which an idempotent load absorbs.
:::

:::drill python The next checkpoint
Write `next_checkpoint(rows, old)`: the greatest `"updated_at"` among the fetched `rows` (a list of dicts). When `rows` is empty, nothing new arrived: return `old` unchanged (the checkpoint must never move backwards or reset).
@starter
# write your function below this line

@check
defines("next_checkpoint") ## Define next_checkpoint(rows, old).
next_checkpoint([{"updated_at": 5}, {"updated_at": 9}, {"updated_at": 7}], 3) == 9 ## The greatest updated_at is 9.
next_checkpoint([], 42) == 42 ## With no new rows the checkpoint stays 42.
next_checkpoint([{"updated_at": 2}], 10) == 10 ## It must never move backwards: old rows (2) must not lower the checkpoint of 10.
@hint
Collect the `"updated_at"` value from each row, include `old` as a candidate (so empty rows or older timestamps never move the checkpoint backwards), and return the largest value with `max()`.
@solution
def next_checkpoint(rows, old):
    newest = [r["updated_at"] for r in rows]
    return max(newest + [old])
:::

:::drill python Keep the newest version of each record
The same record can arrive twice (an update arrived between pages). Write `latest(rows)`: one row per `"id"`, the one with the greatest `"updated_at"`, returned as a list sorted by id.
@starter
# write your function below this line

@check
defines("latest") ## Define latest(rows).
latest([{"id": 1, "updated_at": 5, "s": "paid"}, {"id": 1, "updated_at": 8, "s": "refunded"}, {"id": 2, "updated_at": 6, "s": "paid"}]) == [{"id": 1, "updated_at": 8, "s": "refunded"}, {"id": 2, "updated_at": 6, "s": "paid"}] ## Id 1 appears twice: keep the version with updated_at 8.
latest([]) == [] ## An empty input gives an empty list.
[r["id"] for r in latest([{"id": 3, "updated_at": 1}, {"id": 1, "updated_at": 1}])] == [1, 3] ## The result is sorted by id.
@hint
Keep a dictionary mapping each `"id"` to the best row seen so far. For each row, store it if its id is new or its `"updated_at"` is greater than the stored one, then return the values sorted by id.
@solution
def latest(rows):
    best = {}
    for row in rows:
        known = best.get(row["id"])
        if known is None or row["updated_at"] > known["updated_at"]:
            best[row["id"]] = row
    return [best[i] for i in sorted(best)]
:::

> 💡 **Practice Pause 3 (Atomic Checkpoint State Storage):**
> Guard your high-water mark against sudden system crashes:
> 1. In `labs/mod-1-6/ingest_lab.py` in your text editor, implement the `Checkpoint(path)` class (in `__init__(self, path)`, store `self.path = Path(path)` so `load()` and `save()` use the same location):
>    - `load()`: parse the JSON file and return the saved checkpoint value, or None if the file does not exist yet.
>    - `save(value)`: atomically write `{"value": value}` via a temp file swapped with `os.replace()` so crashes never leave corrupt state.
> 2. Test in the terminal:
> `pytest labs/mod-1-6/test_lab.py -k TestCheckpoint -v`
> When TestCheckpoint tests are PASSED, proceed to Lesson 5 for raw data flattening and schema drift!

> 🛠 **Try it (15 min, hands on).** Write `load.py` against the practice API: read the orders with a cursor (`limit=5`) and append them to `out.jsonl`; **after** each page is written, save `{"cursor": ...}` to `checkpoint.json` (write a temporary file, then `os.replace`). When the script starts it resumes from `checkpoint.json` if there is one. Put `time.sleep(1)` **between** writing the page to `out.jsonl` and saving `checkpoint.json`, so that pressing Ctrl+C during the pause reliably catches a page that was written but not yet checkpointed.
> 1. Run `curl localhost:8765/reset`, then start `load.py` and press Ctrl+C after about two pages. Compare `wc -l out.jsonl` with the cursor in `checkpoint.json`: why can the file hold more rows than the checkpoint says?
> 2. Run `load.py` again to the end, then run `python3 -c "import json; ids=[json.loads(l)['id'] for l in open('out.jsonl')]; print(len(ids), len(set(ids)))"`. Make your loader deduplicate by `id` until it prints `25 25`.
> 3. Now break it on purpose: delete `out.jsonl` and `checkpoint.json`, reset the API, and swap the order (save the checkpoint **first**, sleep, then write the page). Interrupt during the sleep, run it to the end, and run the check from step 2 again.
>
> **You should see:** in step 1 more lines than the checkpoint implies (the page in flight was written but not yet checkpointed); `25 25` in step 2; in step 3 fewer than 25 rows, and the missing ids form one page of five. That page is lost forever, which is exactly why the checkpoint is saved last.
>
> **Check it:** `python3 labs/tryit/check.py 1.6-4 ~/practice` checks the version of `load.py` from steps 1 and 2 (checkpoint saved last). It interrupts your script itself, as Ctrl+C would, and starts it again.

## @part Landing it and running it

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
> 1. Write `flatten(record)` in `flat.py`: nested objects become columns named by their path (`customer_address_city`), lists are kept as JSON text (either `json.dumps(value)` or `json.dumps(value, sort_keys=True)`). Your code must pass these checks (`order1` is the parsed JSON of `/orders/1`):
>    `flat = flatten(order1)`
>    `assert flat["customer_address_city"] == "Jakarta"`
>    `assert flat["customer_id"] == 7`
>    `assert isinstance(flat["items"], str) and json.loads(flat["items"]) == [{"sku": "A1", "qty": 2}, {"sku": "B2", "qty": 1}]`
>    `assert "customer" not in flat`
> 2. Make a copy of `flat` in which `total_idr` is the text `"Rp 1.000"`. In `flat.py` also write `type_changes(old, new)`: it returns a list with one text, such as `total_idr: int -> str`, for every field that exists in both records and whose type changed (an empty list when nothing changed). Put your fetch, assertions and `print(...)` inside `if __name__ == "__main__":` so `check.py 1.6-5` can `import flat` cleanly without hitting a stopped practice API.
>
> **You should see:** no assertion error, and for step 2 `['total_idr: int -> str']`. That is schema drift, found in four lines of code.
>
> **Check it:** `python3 labs/tryit/check.py 1.6-5 ~/practice` tries `flat.py` on other records too.

:::drill python What changed in the shape?
Schema drift: the source changed its shape without telling you. Write `detect_drift(expected, record)`: `expected` maps a field name to its expected type (for example `{"id": int, "city": str}`); `record` is one incoming dictionary. Return a dictionary with three sorted lists: `"new"` (fields in the record but not expected), `"missing"` (expected fields not in the record), and `"type_changed"` (fields in both whose value is not of the expected type).
@starter
# write your function below this line

@check
defines("detect_drift") ## Define detect_drift(expected, record).
detect_drift({"id": int}, {"id": 1}) == {"new": [], "missing": [], "type_changed": []} ## No drift.
detect_drift({"id": int}, {"id": 1, "coupon": "X"}) == {"new": ["coupon"], "missing": [], "type_changed": []} ## A new field appeared.
detect_drift({"id": int, "city": str}, {"id": 1}) == {"new": [], "missing": ["city"], "type_changed": []} ## A field disappeared.
detect_drift({"id": int}, {"id": "1"}) == {"new": [], "missing": [], "type_changed": ["id"]} ## The number arrived as text.
@hint
Compare the sets of names for new and missing. For type changes: `not isinstance(record[name], expected[name])` for names in both.
@solution
def detect_drift(expected, record):
    new = sorted(set(record) - set(expected))
    missing = sorted(set(expected) - set(record))
    changed = sorted(n for n in set(expected) & set(record) if not isinstance(record[n], expected[n]))
    return {"new": new, "missing": missing, "type_changed": changed}
:::

:::ask Why add `_run_id`, `_source` and `_ingested_at` columns to every landed record?
@options
they make the file smaller on disk
* they show which run brought a wrong number in
they are required by the Parquet format
@why
Metadata on each record turns 'this number is wrong' into 'run 482 from the payments API at 02:10 produced it', so you can find and fix the run instead of guessing.
:::

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
> 2. Run the complete test suite and generate your lab proof in the terminal:
> `pytest labs/mod-1-6/test_lab.py -v`
> `python3 scripts/prove.py mod-1-6`
> When all 37 tests show PASSED, your ingestion pipeline is enterprise ready, paste the proof code into the **Proof** box on the Lab tab!

> 🛠 **Try it (10 min, hands on).** Generate the KopiKu files (`python3 labs/shared/shopgen.py --out data`) and treat `data/orders.csv` as a delivery from a partner. Write all three steps in one script, `load_orders.py`.
> 1. With the `csv` module count the rows and the distinct `order_id` values. Compare with `orders_rows`, `orders_distinct` and `orders_duplicate_rows` in `data/manifest.json`.
> 2. Load the file into a SQLite table whose primary key is `order_id` (use `INSERT OR REPLACE`, SQLite's upsert command that overwrites an existing row when the primary key already exists), and print the row count.
> 3. Run the load a second time in the same script and print the row count again.
>
> **You should see:** `3634 3599` in step 1 (35 duplicate rows, as the manifest says), then `3599` and `3599` in steps 2 and 3. Also compare with `wc -l data/orders.csv`: it shows 3635, because of the header line. Counting rows at every hop is the cheapest way to prove nothing was lost.
>
> **Check it:** `python3 labs/tryit/check.py 1.6-6 ~/practice` (your script reads `data/orders.csv` relative to the folder it runs in).

:::ask An ingestion job finishes 'successfully' every night but fetched zero records for three nights. What should have caught this?
@options
a longer timeout on every request
running the job twice each night
* alerts on volume and freshness, not only errors
@why
A job can succeed and still deliver nothing. Alerting on the number of records and on the age of the newest data catches a silent source failure that an exit code never shows.
:::

## @lesson Webhook HMAC-SHA256 verification, differential extraction, S3 streaming, and declarative dlt {optional}

*(Optional modern engineering bridge — Module 2.1 introduces S3-compatible object storage in depth, while this lesson extends your core `ingest_lab.py` skills to webhooks, snapshot deltas, and `dlt`.)*

In Chapter 7 (*Ingestion*) of *Fundamentals of Data Engineering* and modern cloud pipelines (such as the *DataTalksClub Data Engineering Zoomcamp* `dlt` workshops), four production ingestion patterns bridge raw HTTP mechanics and enterprise data platforms:

**1. Push Ingestion: Webhook `HMAC-SHA256` Verification & Replay Protection.** When your service *pulls* from an API, you authenticate with your API key. When an external service (Stripe, Shopify, Midtrans, GitHub) *pushes* an event to your webhook URL (`POST /webhooks/orders`), anyone on the internet can send a fake POST request pretending to be a paid order. Production webhook receivers verify three things before accepting a payload:
1. **Cryptographic Signature (`HMAC-SHA256`):** Compute `expected = "sha256=" + hmac.new(secret.encode(), f"{timestamp}.{raw_body}".encode(), hashlib.sha256).hexdigest()`.
2. **Constant-Time Comparison (`hmac.compare_digest`):** Never use `signature == expected` (which leaks timing information byte-by-byte); always use `hmac.compare_digest(signature, expected)`.
3. **Replay Window Check:** Reject any webhook whose `timestamp` differs from current server time by more than `300 seconds` (5 minutes), so an attacker who intercepts a valid packet cannot replay it tomorrow.

**2. Snapshot vs. Differential Extraction.** Many partner systems cannot emit a change stream; instead, they drop a full daily snapshot (`customers_2026_02_02.json`). Loading full snapshots every day wastes warehouse storage and hides what actually changed. A **differential extractor** compares today's snapshot against yesterday's state by primary key (`id`) and emits only the true delta:
- **`inserts`:** Keys present today that did not exist yesterday.
- **`updates`:** Keys present in both where the payload content changed.
- **`deletes`:** Keys present yesterday that disappeared today (critical for soft-deletes!).
- **`unchanged_count`:** Keys with identical attributes (skipped so downstream tables aren't needlessly rewritten).

**3. Direct-to-Cloud Multipart Streaming (`boto3` / `gcsfs`).** In production on AWS or GCP, ingestion workers rarely write large files to local container disks (which are ephemeral and often capped at 512 MB). Instead, they stream buffers directly to S3 or GCS using multipart upload streams (`s3_client.upload_fileobj(file_like_stream, Bucket="kopiku-raw", Key="orders/dt=2026-02-02/part-000.parquet")`).

**4. Declarative Python Ingestion with `dlt` (`data load tool`).** Once you understand how to build cursor pagination, retry backoff, and schema normalization by hand using `urllib`, modern teams often use **`dlt` (`import dlt`)** in production to eliminate boilerplate while automatically handling nested JSON normalization, schema evolution alerts, and incremental watermark state across DuckDB, BigQuery, Snowflake, and S3:

```python
import dlt

@dlt.resource(name="orders", write_disposition="merge", primary_key="order_id")
def kopiku_orders_source(
    updated_after=dlt.sources.incremental("updated_at", initial_value="2026-01-01T00:00:00Z")
):
    # Yields pages of JSON records starting from the last committed high-water mark
    for page in paginate_orders_api(since=updated_after.last_value):
        yield page

# One-line load into local DuckDB for tests, or swap destination="bigquery" / "snowflake" in prod!
pipeline = dlt.pipeline(pipeline_name="kopiku_ingest", destination="duckdb", dataset_name="raw_kopiku")
load_info = pipeline.run(kopiku_orders_source())
```

> 🛠 **Try it (20 min, Python — First-Law Webhook Security & Differential Extraction Lab).** Create `~/practice/webhook_diff.py` and implement two functions:
> 1. `verify_webhook_batch(events, secret, now_ts, tolerance_sec=300)`: each event in `events` is a dict `{"event_id": str, "timestamp": int, "body": str, "signature": str}` where a valid signature is `"sha256=" + hmac_sha256(secret, f"{timestamp}.{body}")`. Using `hmac.compare_digest`, validate each event:
>    - If `abs(now_ts - event["timestamp"]) > tolerance_sec`, append `{"event_id": ..., "reason": "stale_timestamp"}` to `rejected`.
>    - Else if the signature does not match, append `{"event_id": ..., "reason": "invalid_signature"}` to `rejected`.
>    - Else if `event_id` was already accepted earlier in the batch, skip it (idempotent deduplication).
>    - Otherwise parse `json.loads(event["body"])` and append it to `accepted`.
>    - Return `{"accepted": accepted, "rejected": rejected}`.
> 2. `compute_snapshot_diff(prev_rows, curr_rows, pk="id")`: given yesterday's list of dicts and today's list of dicts, return `{"inserts": [...], "updates": [...], "deletes": [...], "unchanged_count": int}` where `inserts` and `updates` are lists of current row dicts sorted by `row[pk]`, and `deletes` is a sorted list of deleted primary key values (`row[pk]`).
>
> **Check it:** `python3 labs/tryit/check.py 1.6-7 ~/practice`

:::drill python Is the webhook real?
A service pushes events to your webhook and signs each body: the signature is the HMAC-SHA256 of the body, keyed with a shared secret, as hex. Write `verify_signature(body, secret, signature)`: all three are strings. Return `True` only when the signature matches. Compare with `hmac.compare_digest`, which is safe against timing attacks.
@starter
import hmac
# write your function below this line

@check
defines("verify_signature") ## Define verify_signature(body, secret, signature).
verify_signature("x", "s", hmac.new(b"s", b"x", "sha256").hexdigest()) == True ## A correct signature is accepted.
verify_signature("x", "s", "0" * 64) == False ## A wrong signature is rejected.
verify_signature("x!", "s", hmac.new(b"s", b"x", "sha256").hexdigest()) == False ## The body was changed: rejected.
verify_signature("x", "other", hmac.new(b"s", b"x", "sha256").hexdigest()) == False ## The wrong secret: rejected.
@hint
Encode both `secret` and `body` to UTF-8 bytes, compute the SHA-256 HMAC hex digest with `hmac.new(..., "sha256").hexdigest()`, and compare it against `signature` using `hmac.compare_digest`.
@solution
import hmac
def verify_signature(body, secret, signature):
    expected = hmac.new(secret.encode("utf-8"), body.encode("utf-8"), "sha256").hexdigest()
    return hmac.compare_digest(expected, signature)
:::

## @part Other ways data arrives

## @lesson Database drivers, file drops, EDI and data sharing {optional}
Chapter 7 of *Fundamentals of Data Engineering* lists the ways data reaches a platform. This module covered APIs, files and webhooks; four more come up in real jobs, especially in banking, retail and logistics.

**1. A direct database connection: ODBC and JDBC.** When you read a source database with `psycopg` or SQLAlchemy, a **driver** turns your query into the database's network protocol. **ODBC** (for C and most languages) and **JDBC** (for Java, and so for Spark) are the standard driver interfaces: Spark's `spark.read.jdbc(...)`, Power BI, SSIS and Data Factory all connect through them. The same rules as for APIs apply: read from a **replica**, not the primary that serves customers; pull in pages or ranges, not one giant `SELECT *`; and for anything big or frequent, prefer change data capture (Module 3.2) to repeated full reads.

**2. File drops over SFTP.** Many partners still deliver a nightly file to an **SFTP** server (file transfer over SSH): a bank statement, a supplier's price list, a payment provider's settlement report. The partner writes the file, you collect it. The traps are the ones from Lesson 6 of this module, plus three of their own: wait until the file is complete (partners often upload `x.csv.tmp` and rename it, or send a `.done` marker file), never process the same file twice (keep a list of processed names and checksums), and know who to call when the file does not arrive. Authenticate with an SSH key, not a password.

**3. EDI: business documents between companies.** **Electronic Data Interchange** is how large companies have exchanged purchase orders, invoices and shipping notices since long before APIs. An EDI file is text made of **segments** ending in `~`, whose **elements** are separated by `*`. In the US standard ANSI X12, a purchase order is transaction set **850**: `BEG` holds the order number and date, each `PO1` is one line (quantity, unit, price, product code), `CTT` states how many lines there are, and `SE` states how many segments the document has. Those two counts are the file's own checksum: a parser that does not compare them will load a truncated order without noticing. (Europe and much of Asia use UN/EDIFACT, with different segment names and the same idea.)

**4. Data sharing.** Instead of copying data to a partner, some platforms let the provider **share** a live table: the consumer queries it in their own account, the provider pays for storage and the consumer for compute, and nothing is exported. Snowflake Secure Data Sharing, Delta Sharing (Databricks, an open protocol) and BigQuery's Analytics Hub work this way. It removes the file drop entirely, but it only works when both sides use a platform that supports it.

> 🛠 **Try it (20 min, Python).** Write `parse_850(path)` that reads `labs/shared/edi/po_850.edi`, splits it into segments and elements, and returns the order number and date (from `BEG`), the lines (from each `PO1`: line number, quantity, unit, unit price, product code, line total) and the order total. Then make it check the file against itself: the number in `CTT` must equal the number of `PO1` lines, and the number in `SE` must equal the segments from `ST` to `SE`, both included. Run it on `po_850.edi` and on `po_850_broken.edi`.
>
> **You should see:** order `PO-2026-0042` dated `20260115` with three lines, `BEAN-ARABICA-1KG` `1700000`, `CUP-PAPER-12OZ` `60000` and `MILK-OAT-CASE` `1200000`, total `2960000`, and both checks passing (`3` lines, `7` segments). The broken file still parses without an error, but the cup line is gone: `2` lines found where `CTT` says `3`, and `6` segments where `SE` says `7`. Without the checks you would have loaded an order of `2900000` and nobody would know.

:::ask In an EDI file, `PO*1001*20260105~` is one segment. What are the `*` and the `~`?
@options
* `*` separates elements; `~` ends the segment
`*` ends the segment; `~` separates the elements
both are comments that the reader ignores
@why
EDI is text made of segments that end in `~`, whose elements are separated by `*`. The first element names the kind of segment, here a purchase order.
:::

## @lesson Visual flow tools: Apache NiFi, Talend and SSIS {optional}
Not every pipeline is written as code. Some teams draw it: boxes on a canvas, joined by arrows, each box doing one small job. **Apache NiFi**, **Talend** and Microsoft's **SSIS** are examples. In the job-market sample of Module 2.6, SSIS and Talend are named in roughly 6% and 5% of postings, mostly at older or larger companies, so you may well inherit one. You do not need to master them. You need to read them, and to know when drawing beats coding and when it does not.

### The idea: processors on a canvas

In NiFi each box is a **processor** with one job: fetch a file, convert JSON to CSV, filter, write to a database. Arrows are **connections**, and each connection is a small **queue** that holds the data items waiting for the next box. A processor reports a result by an arrow's name, usually **success** or **failure**, and you draw where each one goes: successes to the next step, failures to a place where someone can look at them.

The same idea in code is a chain of functions. The code version is what you already write; the tool adds a canvas, scheduling and a record of where every item has been.

:::drill python A flow in a few lines
Write `run_flow(processors, records)`: `processors` is a list of functions, `records` a list of values. Each record goes through the processors in order. A processor can return a new record; return `None` to **filter** the record out silently; or **raise an error**, which sends that record to the failure list. Return `(done, failed)`: the records that came through all processors (in input order), and the records that raised an error (as they were when the error happened, in input order).
@starter
# write your function below this line

@check
defines("run_flow") ## Define run_flow(processors, records).
run_flow([lambda r: r * 2, lambda r: r + 1], [1, 2]) == ([3, 5], []) ## Two processors in a row.
run_flow([lambda r: r if r > 1 else None], [1, 2, 3]) == ([2, 3], []) ## None filters a record out, without a failure.
run_flow([lambda r: 10 // r], [1, 0, 5]) == ([10, 2], [0]) ## 10 // 0 raises: that record goes to the failure list.
run_flow([], [1, 2]) == ([1, 2], []) ## No processors: everything passes.
@hint
Loop over the records. Inside, `try:` loop over the processors; if one returns `None`, stop with that record; `except Exception:` append the current value to `failed`. Use a `for ... else` or a flag to know whether the record finished.
@solution
def run_flow(processors, records):
    done, failed = [], []
    for record in records:
        value = record
        try:
            dropped = False
            for processor in processors:
                value = processor(value)
                if value is None:
                    dropped = True
                    break
        except Exception:
            failed.append(value)
            continue
        if not dropped:
            done.append(value)
    return done, failed
:::

### What these tools are good at

- **Many ready-made connectors.** Reading from an FTP folder, a message queue, a database and an API are processors you drag in, not code you write.
- **Seeing the flow.** A new colleague can follow the arrows. Many tools also record **data provenance** (where each item came from and what happened to it) and apply **back pressure** (a full queue makes the upstream box wait instead of overflowing).
- **Fast first versions** for teams without much programming experience.

### Where they hurt

- **Review and testing.** The flow is stored as a large generated file, so moving one box can look like a big change, and a pull request is hard to read. Testing one processor in isolation is awkward compared with calling a Python function.
- **Logic that is not a straight line.** Heavy branching, loops and custom rules get tangled on a canvas and are shorter as code.
- **Copy and paste.** Teams copy a flow and change a detail, and soon dozens of nearly identical flows exist with no single place to fix a bug.

The usual compromise: let the tool do **movement** (collecting and delivering data between systems) and keep **business logic** in code or SQL that you can test and review (Modules 1.2 and 2.3).

:::ask Why is a change to a visual flow often hard to review in a pull request?
@options
visual tools never keep any history of their changes
* it is a large generated file, so diffs look huge
reviewers are not allowed to open the canvas of a flow
@why
The canvas is a picture for humans, but Git sees the generated file behind it. Moving one box can rewrite many lines, so a reviewer cannot tell what really changed. That is why many teams keep tested logic in code and let the visual tool only move data.
:::

:::ask A team must collect files from ten different partners (FTP, email and APIs) and drop them into one folder, with nothing complicated to compute. Which choice is most sensible?
@options
* a visual flow tool with ready-made connectors
a streaming cluster, because every pipeline should be real-time
write ten separate custom programs, because code is always better
@why
Collecting and delivering files is movement, not logic, and that is where visual tools with many connectors save time. Ten hand-written programs repeat the same work, and a streaming cluster is far more than this job needs.
:::

> 🛠 **Try it (15 min, paper).** Draw the KopiKu nightly job as boxes and arrows: read `orders.csv`, drop rows with a bad `total_idr`, add the customer's city from `customers.csv`, write to a table. On each box write which arrow it has for success and which for failure, and say where the failures go. Then mark which boxes you would rather write as tested code.
>
> **You should see:** four boxes in a line with a second arrow leaving the box that drops rows, pointing to a "rejected rows" place that someone reads (Module 2.5). The box that adds the city is data movement; the rule that decides what a bad total is belongs in tested code. If failures just vanish, add the place for them: a pipeline without a failure arrow loses data silently.

## @lab Lab: ingest from a flaky API, safely
Build the core of an ingestion job against a **fake HTTP API running on your own computer** (started by the tests; no internet or account is needed): request building and authentication, retries with exponential backoff and `Retry-After`, cursor and offset pagination, an atomic checkpoint, flattening, schema-drift detection, and an incremental, idempotent load that lands JSON Lines. The tests (37) check every behaviour, including a simulated crash between writing the file and saving the checkpoint.

### @steps
> **Already completed Practice Pauses 1–5?** You have already implemented `labs/mod-1-6/ingest_lab.py`! Jump straight to Step 6's crash-order experiment and Step 7 (`python3 scripts/prove.py mod-1-6`).

1. Read `labs/mod-1-6/ingest_lab.py` and then the first 70 lines of `test_lab.py` to see the fake API (it is ordinary Python: a small HTTP server in a thread). `ApiError` is provided.
2. Work in file order and run the tests after EACH function (install `pytest` once with `pip install -r labs/mod-1-6/requirements.txt` if needed):

```bash
pip install -r labs/mod-1-6/requirements.txt   # once, to install pytest
pytest labs/mod-1-6/test_lab.py -v
pytest labs/mod-1-6/test_lab.py -v -k "GetJson or Pagination"      # one group at a time
```

3. **Requests and retries first.** Implement `build_request` and `backoff_delay`, then `get_json`. Before you run the tests, write on paper the list of waits you expect for the sequence "500, 503, then success", and for "429 with Retry-After 7, then 429 with Retry-After 2, then success".
4. **Pagination.** Implement the cursor loop first, then the offset loop. Run `fetch_all_offset` against a data set whose size is an exact multiple of the page size and count the requests.
5. **Checkpoint, flatten, drift.** These are small and pure. For `Checkpoint.save`, explain in one sentence what could go wrong if you wrote the file directly.
6. **The incremental load.** Write it last. Before you run `test_a_crash_before_the_checkpoint_is_repaired_by_rerunning`, explain why your order of steps makes it pass. Then deliberately swap steps 5 and 6 and watch which test fails.
7. **Prove your work.** With all 37 tests passing in your terminal, run `python3 scripts/prove.py mod-1-6` to generate the proof code for the **Proof** box on this lab page.

### @files
- labs/mod-1-6/ingest_lab.py :: Your working file: implement the TODO functions and the Checkpoint class :: starter
- labs/mod-1-6/test_lab.py :: The 37 tests, including the fake HTTP API :: test
- labs/mod-1-6/fakeapi.py :: A small practice API for the Try it exercises (run it in a second terminal) :: config
- labs/tryit/check.py :: Checks your Try it exercises, for example: python3 labs/tryit/check.py 1.6-3 ~/practice :: config
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

### Which of these failures should a client NOT retry?
- [ ] 503 Service Unavailable, because the server is overloaded and may be able to answer a little later
- [ ] 500 Internal Server Error, since a temporary fault on the server often disappears on the next try
- [ ] A connection timeout, because the network or server may have been briefly unavailable
- [x] 401 Unauthorized, because the credentials are wrong and the same request will fail again

> Retry temporary problems (429, 5xx, connection errors). Errors that mean "your request is wrong" (400, 401, 403, 404) will not change by waiting.

### Why does exponential backoff wait 1, 2, 4, 8 seconds instead of a fixed second each time?
- [ ] A doubling wait uses less memory in the client program than a wait of the same length every time
- [x] A struggling server gets more time to recover, and backoff with jitter keeps clients from colliding
- [ ] The HTTP standard requires that the waits are powers of two, and servers reject other waiting times
- [ ] It guarantees that the request succeeds on the fourth attempt, so no further retries are ever needed

> Increasing waits reduce pressure on a failing service. Adding random jitter spreads out clients that failed together. A retry limit and a loud failure are still needed.

### In a newest-first feed, 3 orders arrive after you read page 1 with offset pagination. What can happen on page 2?
- [ ] Nothing, since offsets are fixed numbers that always point to the same records, whatever is inserted
- [x] Some rows slide down into the next page and appear a second time, so the result contains duplicates
- [ ] The server closes the connection, because a client may not read a feed while rows arrive
- [ ] The next page comes back empty, because new records make the earlier offsets invalid for all clients

> Inserts shift later offsets. In Lesson 3's example 25 original orders were fetched as 28 rows (with 3 duplicates). Cursor (keyset) pagination avoids this.

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
