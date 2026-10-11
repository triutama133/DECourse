"""Reference solution for Lab 1.6: ingesting data from an HTTP API (standard library only)."""
import json
import os
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone


class ApiError(Exception):
    def __init__(self, status, message=""):
        super().__init__(f"HTTP {status}: {message}")
        self.status = status


def build_request(url, token, params=None):
    clean = {k: v for k, v in (params or {}).items() if v is not None}
    query = urllib.parse.urlencode(sorted(clean.items()))
    full = url + ("?" + query if query else "")
    return urllib.request.Request(full, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})


def backoff_delay(attempt, base=1.0, cap=30.0):
    return min(cap, base * 2 ** (attempt - 1))


def get_json(url, token, params=None, retries=3, sleep=time.sleep, timeout=10):
    """GET and parse JSON. Retry 429, 5xx and connection errors up to `retries` times; never retry other 4xx."""
    last = None
    for attempt in range(1, retries + 2):
        try:
            with urllib.request.urlopen(build_request(url, token, params), timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            last = ApiError(e.code, e.reason)
            if e.code != 429 and e.code < 500:
                raise last
            wait = None
            if e.code == 429 and e.headers.get("Retry-After"):
                try:
                    wait = float(e.headers["Retry-After"])
                except ValueError:
                    wait = None
            if wait is None:
                wait = backoff_delay(attempt)
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last = ApiError(0, str(e))
            wait = backoff_delay(attempt)
        if attempt <= retries:
            sleep(wait)
    raise last


def fetch_all_cursor(url, token, since=None, limit=100, **kw):
    records, cursor = [], None
    while True:
        page = get_json(url, token, {"limit": limit, "cursor": cursor, "updated_since": since}, **kw)
        records.extend(page["data"])
        cursor = page.get("next_cursor")
        if not cursor:
            return records


def fetch_all_offset(url, token, limit=100, **kw):
    records, offset = [], 0
    while True:
        page = get_json(url, token, {"limit": limit, "offset": offset}, **kw)["data"]
        records.extend(page)
        if len(page) < limit:
            return records
        offset += limit


class Checkpoint:
    def __init__(self, path):
        self.path = path

    def load(self):
        try:
            with open(self.path, encoding="utf-8") as f:
                return json.load(f)["value"]
        except FileNotFoundError:
            return None

    def save(self, value):
        directory = os.path.dirname(os.path.abspath(self.path))
        os.makedirs(directory, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=directory, suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump({"value": value}, f)
        os.replace(tmp, self.path)


def flatten_record(record, sep="_"):
    out = {}

    def walk(prefix, value):
        if isinstance(value, dict):
            for k, v in value.items():
                walk(f"{prefix}{sep}{k}" if prefix else k, v)
        elif isinstance(value, list):
            out[prefix] = json.dumps(value, sort_keys=True)
        else:
            out[prefix] = value

    walk("", record)
    return out


def detect_schema_drift(expected, records):
    seen_types = {}
    for rec in records:
        for col, value in rec.items():
            if value is not None:
                seen_types.setdefault(col, set()).add(type(value).__name__)
            else:
                seen_types.setdefault(col, set())
    new_columns = sorted(set(seen_types) - set(expected))
    missing = sorted(c for c in expected if c not in seen_types)
    changes = {c: (expected[c], sorted(t)) for c, t in seen_types.items() if c in expected and t and t != {expected[c]}}
    return {"new_columns": new_columns, "missing_columns": missing, "type_changes": changes}


def incremental_load(url, token, checkpoint_path, landing_dir, run_id, today, **kw):
    checkpoint = Checkpoint(checkpoint_path)
    since = checkpoint.load()
    records = fetch_all_cursor(url, token, since=since, **kw)
    if not records:
        return {"fetched": 0, "written": None, "checkpoint": since}
    latest = {}
    for r in records:
        if r["id"] not in latest or r["updated_at"] >= latest[r["id"]]["updated_at"]:
            latest[r["id"]] = r
    rows = sorted(latest.values(), key=lambda r: (r["updated_at"], r["id"]))
    folder = os.path.join(landing_dir, f"dt={today}")
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, f"orders_{run_id}.jsonl")
    fd, tmp = tempfile.mkstemp(dir=folder, suffix=".tmp")
    stamp = datetime.now(timezone.utc).isoformat()
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps({**r, "_run_id": run_id, "_source": url, "_ingested_at": stamp}, sort_keys=True) + "\n")
    os.replace(tmp, path)
    new_mark = max(r["updated_at"] for r in rows)
    checkpoint.save(new_mark)
    return {"fetched": len(records), "written": path, "checkpoint": new_mark}
