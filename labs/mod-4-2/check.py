#!/usr/bin/env python3
"""Checks your work in Capstone 4.2 (Fault-Tolerant Incremental API Ingestion & Checkpointing).

    python3 labs/mod-4-2/check.py ~/seismic --step 1          # raw data profiling (profile.json)
    python3 labs/mod-4-2/check.py ~/seismic --step 2          # baseline incremental ingestion contract
    python3 labs/mod-4-2/check.py ~/seismic --step 3          # stateful watermarking & crash recovery
    python3 labs/mod-4-2/check.py ~/seismic --step 4          # network resilience (HTTP 429 & 503)
    python3 labs/mod-4-2/check.py ~/seismic --step 5          # DLQ, CDC upsert & historical backfill
    python3 labs/mod-4-2/check.py ~/seismic --step all        # all steps (proof code)
    python3 labs/mod-4-2/check.py ~/seismic --step 2 --hint 1 # hints (levels 1, 2, 3)

~/seismic is YOUR workspace folder holding pipeline.py and profile.json.
Needs: pip install duckdb pyarrow
"""
import argparse
import copy
import datetime
import http.server
import json
import os
import shutil
import socketserver
import subprocess
import sys
import threading
import time
import urllib.parse
from pathlib import Path

try:
    import duckdb
except ImportError:
    print("duckdb is not installed in this Python. Activate your virtual environment and run:  pip install duckdb pyarrow")
    sys.exit(1)

HERE = Path(__file__).resolve().parent
SEED_FILE = HERE / "data" / "earthquakes_seed.json"
RUN_TIMEOUT = 120

# ---------------------------------------------------------------------------------------------------------------- hints
HINTS = {
    1: [
        "Load earthquakes_seed.json using Python json.load(). Iterate through features to inspect properties and geometry.",
        "Look closely at properties['mag'], properties['time'], properties['status'], properties['tsunami'], and geometry['coordinates'].",
        "Every key is one pass over the features list: len(), max(), min(), a sum with a condition. For the event id, find the feature with the largest magnitude and read its id. Depth is the third coordinate."
    ],
    2: [
        "Parse arguments with argparse: subcommands ingest, backfill, and status. Remember to extract coords correctly: longitude is coords[0], latitude is coords[1]!",
        "In GeoJSON, coordinates are ordered [longitude, latitude, depth]. Swapping them will place quakes in the wrong hemisphere and fail validation.",
        "Use DuckDB: duckdb.connect(db_path). Execute CREATE TABLE IF NOT EXISTS events (...) with event_id as PRIMARY KEY. Handle re-runs idempotently."
    ],
    3: [
        "Store high_watermark_epoch_ms in state.json: the largest properties.updated (epoch ms) you have committed. On the next run ask the API only for events updated after it (the updatedafter parameter, ISO-8601 in UTC).",
        "To make state writes crash-safe: write state to state.json.tmp first, then use os.replace(tmp, state.json). Never write state until the batch data is safely committed to DuckDB. A reading overlap of one second before the watermark is harmless because the upsert makes re-reads idempotent.",
        "If a crash happens mid-run, state.json will point to the previous committed batch. On restart, the upsert logic ensures no duplicate rows are created."
    ],
    4: [
        "In your HTTP fetch helper, catch HTTPError. If e.code == 429, inspect e.headers.get('Retry-After'). Sleep float(retry_after) seconds and retry.",
        "For 5xx server errors (500, 502, 503, 504), use exponential backoff: base * (2 ** attempt). For fatal 4xx (e.g. 400 Bad Request), exit with code 2 immediately.",
        "Wrap the fetch in a retry loop (e.g. up to 3 or 4 attempts). Only raise or exit with code 2 if max retries are exhausted."
    ],
    5: [
        "For DLQ: check latitude in [-90, 90], longitude in [-180, 180], id is non-empty, and time >= 0. Write bad records to <output-dir>/dlq/rejected.jsonl.",
        "For CDC Upsert: in DuckDB, deduplicate incoming batch using ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY updated_epoch_ms DESC). Delete older rows in events where incoming updated_epoch_ms >= existing updated_epoch_ms, then insert.",
        "For backfill: query starttime and endtime, upsert into DuckDB, write bad records to DLQ, accept --state-file but NEVER write to it. An older revision of an event must not overwrite a newer one."
    ]
}

# ---------------------------------------------------------------------------------------------------------------- truth
def truth():
    if not SEED_FILE.is_file():
        raise FileNotFoundError(f"Missing {SEED_FILE}. Run: python3 labs/mod-4-2/fetch_data.py")
    raw = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    feats = raw.get("features", [])
    mags = [f["properties"]["mag"] for f in feats if f["properties"].get("mag") is not None]
    depths = [f["geometry"]["coordinates"][2] for f in feats if f.get("geometry") and len(f["geometry"].get("coordinates", [])) >= 3]
    times = [f["properties"]["time"] for f in feats]
    noto = [f["id"] for f in feats if f["properties"].get("mag") == 7.5][0]
    
    return {
        "profile": {
            "total_features": len(feats),
            "max_magnitude": max(mags),
            "min_magnitude": min(mags),
            "tsunami_alert_count": sum(1 for f in feats if f["properties"].get("tsunami") == 1),
            "max_depth_km": round(max(depths), 3),
            "min_depth_km": round(min(depths), 3),
            "min_time_epoch_ms": min(times),
            "max_time_epoch_ms": max(times),
            "noto_peninsula_event_id": noto
        }
    }

# ---------------------------------------------------------------------------------------------------------------- reporting
passed = failed = 0

def check(name, ok, hint=""):
    global passed, failed
    if ok:
        passed += 1
        print(f"PASS  {name}")
    else:
        failed += 1
        print(f"FAIL  {name}" + (f"\n      hint: {hint}" if hint else ""))
    return ok

def close(a, b, tol=0.01):
    try:
        return abs(float(a) - float(b)) <= tol
    except (TypeError, ValueError):
        return False

# ---------------------------------------------------------------------------------------------------------------- mock server
class MockUSGSServer:
    def __init__(self, features):
        self.all_features = sorted(features, key=lambda f: f["properties"]["time"])
        self.active_features = copy.deepcopy(self.all_features)
        self.server = None
        self.thread = None
        self.port = 0
        self.chaos_429 = False
        self.chaos_503_count = 0
        self.chaos_fatal_400 = False
        self.chaos_disconnect = False
        self.fail_after_pages = None   # after this many served pages every request is disconnected
        self.pages_served = 0
        self.lock_db_path = None       # hold an exclusive DuckDB lock on this file while the first page is being answered
        self.lock_conn = None
        self.lock_taken = False
        self.retry_after = 2
        self.req_count = 0
        self.events = []               # (monotonic time, kind) of every request: kind is 429, 503, 400, ok or drop

    def start(self):
        handler_cls = self._make_handler()
        self.server = socketserver.TCPServer(("127.0.0.1", 0), handler_cls)
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def release_lock(self):
        if self.lock_conn is not None:
            try:
                self.lock_conn.close()
            finally:
                self.lock_conn = None

    def stop(self):
        self.release_lock()
        if self.server:
            self.server.shutdown()
            self.server.server_close()

    @property
    def url(self):
        return f"http://127.0.0.1:{self.port}/fdsnws/event/1/query"

    def _make_handler(self):
        outer = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, format, *args):
                pass  # suppress HTTP logs during tests

            def do_GET(self):
                outer.req_count += 1
                now = time.monotonic()
                parsed = urllib.parse.urlparse(self.path)
                params = dict(urllib.parse.parse_qsl(parsed.query))

                if outer.chaos_fatal_400:
                    outer.events.append((now, 400))
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(b'{"error": "Bad Request: malformed parameter"}')
                    return

                if outer.chaos_429:
                    outer.chaos_429 = False  # trigger once
                    outer.events.append((now, 429))
                    self.send_response(429)
                    self.send_header("Retry-After", str(outer.retry_after))
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(b'{"error": "Rate limit exceeded"}')
                    return

                if outer.chaos_503_count > 0:
                    outer.chaos_503_count -= 1
                    outer.events.append((now, 503))
                    self.send_response(503)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(b'{"error": "Service temporarily unavailable"}')
                    return

                if outer.fail_after_pages is not None and outer.pages_served >= outer.fail_after_pages:
                    outer.events.append((now, "drop"))
                    self.close_connection = True
                    return

                if outer.chaos_disconnect:
                    outer.chaos_disconnect = False
                    # Abruptly close socket to simulate mid-flight crash
                    self.close_connection = True
                    return

                # Filter features. Times without a zone are UTC (this fixes a bug in which the machine's own time zone leaked in).
                def epoch_ms(text):
                    dt = datetime.datetime.fromisoformat(text.replace("Z", "+00:00"))
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=datetime.timezone.utc)
                    return int(dt.timestamp() * 1000)

                feats = outer.active_features
                for key, field, keep in (("starttime", "time", lambda v, e: v >= e), ("endtime", "time", lambda v, e: v <= e),
                                         ("updatedafter", "updated", lambda v, e: v > e)):
                    if key in params:
                        try:
                            e = epoch_ms(params[key])
                        except Exception:
                            continue
                        feats = [f for f in feats if keep(f["properties"].get(field) or f["properties"]["time"], e)]

                offset = max(1, int(params.get("offset", 1)))
                limit = max(1, int(params.get("limit", 100)))

                start_idx = offset - 1
                end_idx = start_idx + limit
                page = feats[start_idx:end_idx]

                resp = {
                    "type": "FeatureCollection",
                    "metadata": {
                        "generated": int(time.time() * 1000),
                        "count": len(page),
                        "total": len(feats)
                    },
                    "features": page
                }

                if outer.lock_db_path is not None and not outer.lock_taken and page:
                    outer.lock_taken = True
                    try:
                        outer.lock_conn = duckdb.connect(str(outer.lock_db_path))
                    except Exception:
                        outer.lock_conn = None   # the pipeline keeps the database open all the time: the test is not applicable
                outer.pages_served += 1
                outer.events.append((now, "ok"))
                data = json.dumps(resp).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

        return Handler


def prepared(features):
    """Copies of features published one hour after they happened (updated = time + 1 h), so that revision time and event time differ
    but keep the same order. A watermark built on the wrong field is therefore visible."""
    out = copy.deepcopy(features)
    for f in out:
        f["properties"]["updated"] = f["properties"]["time"] + 3_600_000
    return out


# ---------------------------------------------------------------------------------------------------------------- runner
def run_cmd(cmd, cwd=None, timeout=RUN_TIMEOUT):
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    return p.returncode, p.stdout, p.stderr


# ---------------------------------------------------------------------------------------------------------------- step verifications
def step_1(ws):
    print("\n--- Step 1: Raw data profiling (profile.json) ---")
    pfile = ws / "profile.json"
    if not check("profile.json exists in workspace", pfile.is_file(), "Create profile.json in your workspace with the nine keys from the lab steps"):
        return
    try:
        user_prof = json.loads(pfile.read_text(encoding="utf-8"))
    except Exception as e:
        check("profile.json is valid JSON", False, f"JSON error: {e}")
        return

    # The expected values are deliberately NOT printed: finding them in the data is the exercise.
    exp = truth()["profile"]
    tolerance = {"max_magnitude": 0.01, "min_magnitude": 0.01, "max_depth_km": 0.1, "min_depth_km": 0.1}
    for key, want in exp.items():
        got = user_prof.get(key)
        if isinstance(want, str):
            ok = got == want
        elif key in tolerance:
            ok = close(got, want, tolerance[key])
        else:
            ok = isinstance(got, (int, float)) and not isinstance(got, bool) and got == want
        check(f"profile.json: {key}", ok, "missing" if key not in user_prof else
              "your value does not match the data; re-check how you count or which field you read (and its units)")


def step_2(ws, pipe):
    print("\n--- Step 2: Baseline ingestion contract & pagination ---")
    raw = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    features = prepared(raw["features"][:300])
    server = MockUSGSServer(features)
    server.start()

    test_out = ws / "test_run_step2"
    shutil.rmtree(test_out, ignore_errors=True)
    state_file = test_out / "state.json"

    try:
        rc, out, err = run_cmd([
            sys.executable, str(pipe), "ingest",
            "--api-url", server.url,
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--batch-size", "100"
        ])
        check("pipeline.py ingest exits with code 0", rc == 0, f"Error: {err}")
        check("state.json was created", state_file.is_file(), "Write state checkpoint to --state-file")

        db_path = test_out / "warehouse.duckdb"
        check("warehouse.duckdb exists", db_path.is_file(), "Create warehouse.duckdb inside --output-dir")

        if db_path.is_file():
            conn = duckdb.connect(str(db_path))
            cnt = conn.execute("SELECT count(*) FROM events").fetchone()[0]
            check("warehouse contains all 300 served events", cnt == 300, f"The server holds 300 events, the warehouse has {cnt}: did you read every page?")

            lat_bad = conn.execute("SELECT count(*) FROM events WHERE latitude < -90 OR latitude > 90").fetchone()[0]
            check("coordinate ordering correct (latitude between -90 and 90)", lat_bad == 0, "Remember: coords[0] is longitude, coords[1] is latitude!")

            cols = [r[0] for r in conn.execute("DESCRIBE events").fetchall()]
            for req in ["event_id", "time_utc", "latitude", "longitude", "depth_km", "magnitude", "status", "updated_epoch_ms"]:
                check(f"column '{req}' present in events table", req in cols, f"Add {req} column")
            conn.close()

        rc2, out2, err2 = run_cmd([
            sys.executable, str(pipe), "ingest",
            "--api-url", server.url,
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--batch-size", "100"
        ])
        check("re-running ingest exits with code 0", rc2 == 0, f"Error: {err2}")
        if db_path.is_file():
            conn = duckdb.connect(str(db_path))
            cnt2 = conn.execute("SELECT count(*) FROM events").fetchone()[0]
            check("re-running ingest causes 0 duplicate rows", cnt2 == 300, f"Expected the same number of rows as after the first run, got {cnt2}")
            conn.close()
    finally:
        server.stop()
        shutil.rmtree(test_out, ignore_errors=True)


def step_3(ws, pipe):
    print("\n--- Step 3: Stateful watermarking & crash recovery ---")
    raw = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    raw_feats = prepared(sorted(raw["features"], key=lambda f: f["properties"]["time"]))
    server = MockUSGSServer(raw_feats[:300])
    server.start()

    test_out = ws / "test_run_step3"
    shutil.rmtree(test_out, ignore_errors=True)
    state_file = test_out / "state.json"

    try:
        rc1, _, err1 = run_cmd([
            sys.executable, str(pipe), "ingest",
            "--api-url", server.url,
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--batch-size", "100"
        ])
        check("initial sync exits with code 0", rc1 == 0, f"Error: {err1}")
        if not check("state.json was created", state_file.is_file(), "Write state checkpoint to --state-file"):
            return
        state1 = json.loads(state_file.read_text(encoding="utf-8"))
        wm1 = state1.get("high_watermark_epoch_ms", 0)
        check("high_watermark_epoch_ms recorded in state.json", wm1 > 0, "Record high_watermark_epoch_ms")
        check("the watermark is the largest 'updated' timestamp that was committed", wm1 == max(f["properties"]["updated"] for f in raw_feats[:300]),
              "The watermark follows properties.updated (revision time), not only the event time")

        # 100 newer events appear; an incremental run must fetch only what changed since the watermark
        server.active_features = raw_feats[:400]
        n_before = server.req_count
        rc, _, err = run_cmd([
            sys.executable, str(pipe), "ingest",
            "--api-url", server.url,
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--batch-size", "100"
        ])
        check("incremental sync completes cleanly", rc == 0, f"Error: {err}")
        db_path = test_out / "warehouse.duckdb"
        conn = duckdb.connect(str(db_path))
        cnt = conn.execute("SELECT count(*) FROM events").fetchone()[0]
        check("warehouse has 400 events after incremental sync", cnt == 400, f"Expected 400, got {cnt}")
        conn.close()
        check("the incremental run asked the API only for changes (it did not re-read all 400 events)", server.req_count - n_before <= 2,
              f"{server.req_count - n_before} requests for 100 new events at a page size of 100: pass updatedafter so the server filters")

        state2 = json.loads(state_file.read_text(encoding="utf-8"))
        wm2 = state2.get("high_watermark_epoch_ms", 0)
        check("high_watermark advanced after incremental sync", wm2 > wm1, "Advance the watermark to the highest committed 'updated'")

        # crash test: the server drops the connection after the first page of the next sync
        server.active_features = raw_feats[:450]
        server.fail_after_pages = server.pages_served + 1
        rc_crash, _, _ = run_cmd([
            sys.executable, str(pipe), "ingest",
            "--api-url", server.url,
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--batch-size", "25"
        ])
        check("pipeline terminates on socket disconnect", rc_crash != 0, "Crash should return non-zero code")
        try:
            json.loads(state_file.read_text(encoding="utf-8"))
            state_ok = True
        except Exception:
            state_ok = False
        check("state.json is not corrupted after crash", state_ok, "Use atomic file swap for state.json")
        conn = duckdb.connect(str(db_path))
        max_upd = conn.execute("SELECT max(updated_epoch_ms) FROM events").fetchone()[0]
        conn.close()
        wm_crash = json.loads(state_file.read_text(encoding="utf-8")).get("high_watermark_epoch_ms", 0) if state_ok else 0
        check("after the crash the checkpoint is not ahead of the data in the warehouse", wm_crash <= max_upd,
              "state.json says more is done than DuckDB contains: commit the data first, then the checkpoint")

        # resume after the connection is restored
        server.fail_after_pages = None
        rc_res, _, err_res = run_cmd([
            sys.executable, str(pipe), "ingest",
            "--api-url", server.url,
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--batch-size", "25"
        ])
        check("pipeline resumes successfully after recovery", rc_res == 0, f"Error: {err_res}")
        conn = duckdb.connect(str(db_path))
        cnt_res = conn.execute("SELECT count(*), count(DISTINCT event_id) FROM events").fetchone()
        conn.close()
        check("warehouse has all 450 events with zero duplicates and zero gaps", cnt_res == (450, 450), f"rows / distinct ids: {cnt_res}; expected (450, 450)")
    finally:
        server.stop()
        shutil.rmtree(test_out, ignore_errors=True)

    # commit order: the warehouse refuses the write (locked by the checker); the checkpoint must not move
    server = MockUSGSServer(raw_feats[:200])
    test_out = ws / "test_run_step3_order"
    shutil.rmtree(test_out, ignore_errors=True)
    state_file = test_out / "state.json"
    test_out.mkdir(parents=True, exist_ok=True)
    server.lock_db_path = test_out / "warehouse.duckdb"
    server.start()
    try:
        rc, _, _ = run_cmd([sys.executable, str(pipe), "ingest", "--api-url", server.url, "--output-dir", str(test_out),
                            "--state-file", str(state_file), "--batch-size", "50"])
        if server.lock_conn is None:
            check("checkpoint order test (not applicable: your pipeline keeps the database open the whole time)", True)
        else:
            moved = state_file.is_file() and json.loads(state_file.read_text(encoding="utf-8")).get("high_watermark_epoch_ms", 0) > 0
            check("when the warehouse write fails the pipeline stops with an error", rc != 0, "A failed database write must not be ignored")
            check("... and the checkpoint did NOT advance (data is committed before the checkpoint)", not moved,
                  "state.json advanced although the data never reached DuckDB: this loses data forever after a crash")
            server.release_lock()
            server.lock_db_path = None
            rc2, _, err2 = run_cmd([sys.executable, str(pipe), "ingest", "--api-url", server.url, "--output-dir", str(test_out),
                                    "--state-file", str(state_file), "--batch-size", "50"])
            conn = duckdb.connect(str(test_out / "warehouse.duckdb"))
            n = conn.execute("SELECT count(*) FROM events").fetchone()[0]
            conn.close()
            check("after the lock is released the next run loads all 200 events", rc2 == 0 and n == 200, f"exit {rc2}, rows {n}. {err2[-200:]}")
    finally:
        server.stop()
        shutil.rmtree(test_out, ignore_errors=True)


def step_4(ws, pipe):
    print("\n--- Step 4: Network resilience & rate limits (429 & 503) ---")
    raw = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    features = prepared(raw["features"][:100])
    server = MockUSGSServer(features)
    server.start()

    test_out = ws / "test_run_step4"
    shutil.rmtree(test_out, ignore_errors=True)
    state_file = test_out / "state.json"

    try:
        server.chaos_429 = True
        server.retry_after = 2
        server.chaos_503_count = 2

        rc, out, err = run_cmd([
            sys.executable, str(pipe), "ingest",
            "--api-url", server.url,
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--batch-size", "50"
        ])
        check("pipeline recovers from HTTP 429 and 503 retries", rc == 0, f"Failed: {err}")
        times = [t for t, kind in server.events]
        kinds = [kind for t, kind in server.events]
        gap = None
        if 429 in kinds:
            i = kinds.index(429)
            if i + 1 < len(times):
                gap = times[i + 1] - times[i]
        check("after a 429 it waited at least as long as the Retry-After header asked (2 s)", gap is not None and gap >= 1.8,
              f"the next request came {gap:.2f} s after the 429" if gap is not None else "no request followed the 429")
        check("... but did not wait unreasonably long", gap is not None and gap <= 20, "Retry-After said 2 seconds")
        i503 = [i for i, k in enumerate(kinds) if k == 503]
        gaps503 = [times[i + 1] - times[i] for i in i503 if i + 1 < len(times)]
        check("after 503 errors it paused before retrying (backoff)", len(gaps503) >= 1 and all(g >= 0.5 for g in gaps503),
              f"gaps between a 503 and the next request: {[round(g, 2) for g in gaps503]}")

        db_path = test_out / "warehouse.duckdb"
        if db_path.is_file():
            conn = duckdb.connect(str(db_path))
            cnt = conn.execute("SELECT count(*) FROM events").fetchone()[0]
            check("all 100 events ingested despite network transient errors", cnt == 100, f"Got {cnt}")
            conn.close()

        server.chaos_fatal_400 = True
        n_before = server.req_count
        rc_fatal, _, _ = run_cmd([
            sys.executable, str(pipe), "ingest",
            "--api-url", server.url,
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--batch-size", "50"
        ])
        check("fatal HTTP 400 exits with status code 2", rc_fatal == 2, f"Expected exit code 2, got {rc_fatal}")
        check("a fatal 4xx is not retried", server.req_count - n_before <= 1, f"{server.req_count - n_before} requests were sent; a 400 will never succeed")
    finally:
        server.stop()
        shutil.rmtree(test_out, ignore_errors=True)


def step_5(ws, pipe):
    print("\n--- Step 5: DLQ, CDC upsert & historical backfill ---")
    raw = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    base_feats = prepared(raw["features"][:50])

    toxic_feats = [
        {"type": "Feature", "id": "bad_lat_1", "properties": {"mag": 3.0, "time": 1704100000000}, "geometry": {"type": "Point", "coordinates": [-120.0, 125.0, 10.0]}},
        {"type": "Feature", "id": "bad_lon_1", "properties": {"mag": 3.0, "time": 1704101000000}, "geometry": {"type": "Point", "coordinates": [-220.0, 35.0, 10.0]}},
        {"type": "Feature", "id": "", "properties": {"mag": 3.0, "time": 1704102000000}, "geometry": {"type": "Point", "coordinates": [-120.0, 35.0, 10.0]}},
        {"type": "Feature", "id": "bad_geom_1", "properties": {"mag": 3.0, "time": 1704103000000}, "geometry": None},
        {"type": "Feature", "id": "bad_time_1", "properties": {"mag": 3.0, "time": -1000}, "geometry": {"type": "Point", "coordinates": [-120.0, 35.0, 10.0]}}
    ]
    for t in toxic_feats:
        t["properties"]["updated"] = max(f["properties"]["updated"] for f in base_feats) + 1
    server = MockUSGSServer(base_feats + toxic_feats)
    server.start()

    test_out = ws / "test_run_step5"
    shutil.rmtree(test_out, ignore_errors=True)
    state_file = test_out / "state.json"

    try:
        rc, _, err = run_cmd([
            sys.executable, str(pipe), "ingest",
            "--api-url", server.url,
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--batch-size", "100"
        ])
        check("pipeline completes ingestion with DLQ isolation", rc == 0, f"Error: {err}")

        db_path = test_out / "warehouse.duckdb"
        if not check("warehouse.duckdb exists", db_path.is_file(), "Create warehouse.duckdb inside --output-dir"):
            return
        conn = duckdb.connect(str(db_path))
        clean_count = conn.execute("SELECT count(*) FROM events").fetchone()[0]
        check("warehouse received exactly the 50 valid events", clean_count == 50, f"The server sent 55 events, 5 of them toxic; the warehouse has {clean_count}")
        conn.close()

        dlq_file = test_out / "dlq" / "rejected.jsonl"
        check("dlq/rejected.jsonl exists", dlq_file.is_file(), "Route rejected records to dlq/rejected.jsonl")
        if dlq_file.is_file():
            dlq_lines = [json.loads(l) for l in dlq_file.read_text(encoding="utf-8").strip().splitlines() if l.strip()]
            check("the DLQ contains exactly the 5 toxic records", len(dlq_lines) == 5, f"The DLQ has {len(dlq_lines)} records")
            check("every DLQ item has error_code, failed_at and the raw_payload", all("error_code" in i and "failed_at" in i and "raw_payload" in i for i in dlq_lines),
                  "Add error_code, failed_at and raw_payload to each DLQ item")
            check("reconciliation: valid + rejected = 55 records received", clean_count + len(dlq_lines) == 55, "A record was lost silently")

        # CDC: 10 existing events were revised upstream after everything else (their 'updated' is now the newest)
        newest = max(f["properties"]["updated"] for f in base_feats)
        revised_feats = copy.deepcopy(base_feats[:10])
        for i, rf in enumerate(revised_feats):
            rf["properties"]["mag"] = 9.9
            rf["properties"]["status"] = "reviewed"
            rf["properties"]["updated"] = newest + 1000 * (i + 1)
        server.active_features = base_feats + revised_feats[:0] + [f for f in revised_feats] + toxic_feats
        # the server keeps one version of each event: replace the old versions by the revised ones
        by_id = {f["id"]: f for f in base_feats}
        for rf in revised_feats:
            by_id[rf["id"]] = rf
        server.active_features = sorted(list(by_id.values()) + toxic_feats, key=lambda f: f["properties"]["time"])
        rc_cdc, _, _ = run_cmd([
            sys.executable, str(pipe), "ingest",
            "--api-url", server.url,
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--batch-size", "50"
        ])
        check("CDC revision ingestion succeeds", rc_cdc == 0, "CDC run failed")
        conn = duckdb.connect(str(db_path))
        cnt_cdc = conn.execute("SELECT count(*) FROM events").fetchone()[0]
        check("CDC update did not create duplicate rows (still 50 rows)", cnt_cdc == 50, f"Expected 50, got {cnt_cdc}")
        updated_mag_count = conn.execute("SELECT count(*) FROM events WHERE magnitude = 9.9 AND status = 'reviewed'").fetchone()[0]
        check("CDC updated rows reflect new magnitude (9.9) and reviewed status", updated_mag_count == 10,
              f"{updated_mag_count} of 10 revised events were updated: revisions of old events are found by their 'updated' time, not their event time")
        conn.close()

        # Backfill: history, plus a stale replay of an event that was revised since; --state-file is passed and must stay byte-identical
        if not check("state.json exists before backfill", state_file.is_file(), "state.json must exist"):
            return
        state_pre = state_file.read_bytes()

        hist_feats = []
        for i, f in enumerate(raw["features"][100:150]):
            hf = copy.deepcopy(f)
            hf["id"] = f"hist_{i}_{hf['id']}"
            hf["properties"]["time"] = 1702641600000 + i * 1000  # 2023-12-15
            hf["properties"]["updated"] = hf["properties"]["time"]
            hist_feats.append(hf)
        server.active_features = hist_feats
        rc_bf, _, err_bf = run_cmd([
            sys.executable, str(pipe), "backfill",
            "--api-url", server.url,
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--start", "2023-12-01",
            "--end", "2023-12-31",
            "--batch-size", "100"
        ])
        check("pipeline backfill exits with code 0", rc_bf == 0, f"Error: {err_bf}")
        conn = duckdb.connect(str(db_path))
        cnt_bf = conn.execute("SELECT count(*) FROM events").fetchone()[0]
        conn.close()
        check("warehouse has 100 total events after backfill", cnt_bf == 100, f"Expected 100, got {cnt_bf}")
        check("CRITICAL: backfill left state.json byte-for-byte unchanged", state_file.read_bytes() == state_pre,
              "Backfill must NOT alter the production checkpoint: it receives --state-file but must only leave it alone")

        stale = copy.deepcopy(base_feats[0])
        stale["properties"]["mag"] = 1.1
        stale["properties"]["updated"] = stale["properties"]["time"]          # older than the revision already stored
        server.active_features = [stale] + copy.deepcopy(base_feats[10:15])
        rc_st, _, err_st = run_cmd([
            sys.executable, str(pipe), "backfill",
            "--api-url", server.url,
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--start", "2024-01-01",
            "--end", "2024-01-09",
            "--batch-size", "100"
        ])
        check("a backfill that replays an older version of an event exits with code 0", rc_st == 0, f"Error: {err_st}")
        conn = duckdb.connect(str(db_path))
        row = conn.execute("SELECT magnitude FROM events WHERE event_id = ?", [stale["id"]]).fetchone()
        n_all = conn.execute("SELECT count(*) FROM events").fetchone()[0]
        conn.close()
        check("an older revision never overwrites a newer one (magnitude stays 9.9)", row is not None and row[0] == 9.9, f"magnitude is now {row[0] if row else None}")
        check("... and the replay created no duplicate rows", n_all == 100, f"{n_all} rows")
    finally:
        server.stop()
        shutil.rmtree(test_out, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description="Checker for Capstone 4.2")
    parser.add_argument("workspace", help="Path to your workspace folder (e.g. ~/seismic)")
    parser.add_argument("--step", required=True, choices=["1", "2", "3", "4", "5", "all"], help="Step to check")
    parser.add_argument("--hint", type=int, choices=[1, 2, 3], help="Hint level (1=nudge, 2=explanation, 3=detailed)")
    args = parser.parse_args()

    step_num = None if args.step == "all" else int(args.step)
    if args.hint:
        target_step = step_num or 1
        print(f"\n[HINT level {args.hint} for Step {target_step}]:")
        print(HINTS[target_step][args.hint - 1])
        return 0

    ws = Path(args.workspace).expanduser().resolve()
    if not ws.is_dir():
        print(f"Workspace directory {ws} does not exist", file=sys.stderr)
        return 1

    pipe = ws / "pipeline.py"
    if args.step != "1" and not pipe.is_file():
        print(f"Missing pipeline.py in workspace {ws}", file=sys.stderr)
        return 1

    if args.step in ("1", "all"):
        step_1(ws)
    if args.step in ("2", "all"):
        step_2(ws, pipe)
    if args.step in ("3", "all"):
        step_3(ws, pipe)
    if args.step in ("4", "all"):
        step_4(ws, pipe)
    if args.step in ("5", "all"):
        step_5(ws, pipe)

    print(f"\nSummary: {passed} passed, {failed} failed")
    if failed == 0 and args.step == "all":
        print("\nAll checks PASSED! You have built a fault-tolerant, stateful incremental ingestion pipeline.")
        return 0
    return 1 if failed > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
