"""Lab 1.6: ingest data from an HTTP API correctly (standard library only, no internet needed).

The tests start a small fake API on your own computer (see test_lab.py: it can answer 429 and 500 on purpose), so you practise
pagination, retries, checkpoints and idempotent landing exactly as you would against a real service.
Work in order and run the tests after each:    pytest labs/mod-1-6/test_lab.py -v
"""
import json  # noqa: F401
import os  # noqa: F401
import tempfile  # noqa: F401
import time  # noqa: F401
import urllib.error  # noqa: F401
import urllib.parse  # noqa: F401
import urllib.request  # noqa: F401
from datetime import datetime, timezone  # noqa: F401


class ApiError(Exception):
    """(Provided.) An HTTP error from the API. `status` is the HTTP status code, or 0 for a connection problem."""

    def __init__(self, status, message=""):
        super().__init__(f"HTTP {status}: {message}")
        self.status = status


def build_request(url, token, params=None):
    """Build a urllib.request.Request for GET url?query.   (lesson 2)

    - Query parameters whose value is None are dropped; the rest are URL-encoded with urllib.parse.urlencode, SORTED by name
      (so the URL is the same every time). No parameters: no "?" at all.
    - Headers: "Authorization": f"Bearer {token}" and "Accept": "application/json".
    """
    raise NotImplementedError("TODO: implement build_request")


def backoff_delay(attempt, base=1.0, cap=30.0):
    """Exponential backoff: how long to wait before retry number `attempt` (1, 2, 3 ...): min(cap, base * 2 ** (attempt - 1)).   (lesson 3)"""
    raise NotImplementedError("TODO: implement backoff_delay")


def get_json(url, token, params=None, retries=3, sleep=time.sleep, timeout=10):
    """GET a URL and return the parsed JSON.   (lesson 3: retries, backoff, rate limits)

    Make at most 1 + `retries` attempts, using build_request and urllib.request.urlopen(..., timeout=timeout).
      - HTTP 429 or any 5xx, or a connection problem (urllib.error.URLError, TimeoutError, ConnectionError): wait, then try again.
        The wait is the number of seconds in a 429's "Retry-After" header when it is present and numeric, otherwise backoff_delay(attempt).
        Wait by calling sleep(seconds) (it is a parameter, so tests do not really sleep). Do NOT sleep after the last attempt.
      - Any other 4xx (401, 404 ...): never retry; raise ApiError(status, reason) at once.
      - When every attempt failed raise the last ApiError (a connection problem is ApiError(0, str(error))).
    """
    raise NotImplementedError("TODO: implement get_json")


def fetch_all_cursor(url, token, since=None, limit=100, **kw):
    """Read every page of a cursor-paginated endpoint and return all records in one list.   (lesson 3: pagination)

    Page request parameters: limit, cursor (None on the first page) and updated_since (the `since` value, None = leave out).
    The response is {"data": [...], "next_cursor": "..." or None}. Stop when next_cursor is missing or None.
    Pass **kw (retries, sleep, timeout) on to get_json.
    """
    raise NotImplementedError("TODO: implement fetch_all_cursor")


def fetch_all_offset(url, token, limit=100, **kw):
    """Read every page of an offset-paginated endpoint (parameters limit and offset; the response is {"data": [...]}).

    Start at offset 0, move on by `limit`, and stop after the first page that has FEWER than `limit` records.   (lesson 3)
    """
    raise NotImplementedError("TODO: implement fetch_all_offset")


class Checkpoint:
    """Remembers how far we have loaded (a "high-water mark") in a small JSON file.   (lesson 4: incremental loads)

    - load(): the saved value, or None if the file does not exist yet.
    - save(value): write {"value": value} to the file ATOMICALLY: write a temporary file in the same folder, then os.replace() it over the real file,
      so a crash never leaves a half-written checkpoint. Create the folder if needed.
    """

    def __init__(self, path):
        raise NotImplementedError("TODO: implement Checkpoint")

    def load(self):
        raise NotImplementedError("TODO: implement Checkpoint.load")

    def save(self, value):
        raise NotImplementedError("TODO: implement Checkpoint.save")


def flatten_record(record, sep="_"):
    """Turn a nested dict into one flat dict, so it can become a table row.   (lesson 5)

    {"id": 1, "customer": {"name": "Sari", "address": {"city": "Jakarta"}}}  ->  {"id": 1, "customer_name": "Sari", "customer_address_city": "Jakarta"}
    A list stays ONE column, as JSON text with sorted keys: json.dumps(value, sort_keys=True). Other values are kept as they are (None too).
    """
    raise NotImplementedError("TODO: implement flatten_record")


def detect_schema_drift(expected, records):
    """Compare incoming flat records with the schema you expect.   (lesson 5: schema drift)

    `expected` is {column: type_name} such as {"id": "int", "total_idr": "int"}; type names are Python names (type(value).__name__).
    Return {"new_columns": sorted list of columns that appear in the records but not in `expected`,
            "missing_columns": sorted list of expected columns that appear in NO record,
            "type_changes": {column: (expected_type, sorted list of types seen)}} for expected columns whose non-None values include a type other than the expected one.
    None values are ignored when looking at types.
    """
    raise NotImplementedError("TODO: implement detect_schema_drift")


def incremental_load(url, token, checkpoint_path, landing_dir, run_id, today, **kw):
    """One incremental run, landing raw data as JSON lines.   (lessons 4 and 6)

    1. since = Checkpoint(checkpoint_path).load()
    2. records = fetch_all_cursor(url, token, since=since, **kw)
    3. No records: return {"fetched": 0, "written": None, "checkpoint": since} and change nothing.
    4. Otherwise keep ONE record per id (the one with the greatest updated_at), sorted by (updated_at, id).
    5. Write them to landing_dir/dt=<today>/orders_<run_id>.jsonl, one JSON object per line (json.dumps(..., sort_keys=True)), each record with three extra
       keys: "_run_id" (run_id), "_source" (url) and "_ingested_at" (the current UTC time as an ISO string). Write to a temporary file in that folder first
       and os.replace() it, so the file is complete or absent, and running again with the same run_id overwrites the same file (idempotent).
    6. ONLY AFTER the file is in place, save the new checkpoint: the greatest updated_at of the records.
    Return {"fetched": number of records the API returned, "written": the file path, "checkpoint": the new checkpoint}.
    If anything fails before step 6 the checkpoint must stay as it was, so the next run fetches the same data again.
    """
    raise NotImplementedError("TODO: implement incremental_load")
