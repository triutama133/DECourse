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
        "The largest earthquake in the seed file is the M 7.5 Noto Peninsula event in Japan on 2024-01-01. Check its feature id."
    ],
    2: [
        "Parse arguments with argparse: subcommands ingest, backfill, and status. Remember to extract coords correctly: longitude is coords[0], latitude is coords[1]!",
        "In GeoJSON, coordinates are ordered [longitude, latitude, depth]. Swapping them will place quakes in the wrong hemisphere and fail validation.",
        "Use DuckDB: duckdb.connect(db_path). Execute CREATE TABLE IF NOT EXISTS events (...) with event_id as PRIMARY KEY. Handle re-runs idempotently."
    ],
    3: [
        "Store high_watermark_epoch_ms in state.json. When querying args.api_url with starttime, convert watermark + 1 ms to ISO-8601 UTC.",
        "To make state writes crash-safe: write state to state.json.tmp first, then use os.replace(tmp, state.json). Never write state until the batch data is safely on disk.",
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
        "For backfill: query starttime and endtime, upsert into DuckDB, write bad records to DLQ, but DO NOT modify or advance high_watermark in state.json!"
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
        self.req_count = 0

    def start(self):
        handler_cls = self._make_handler()
        self.server = socketserver.TCPServer(("127.0.0.1", 0), handler_cls)
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def stop(self):
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
                parsed = urllib.parse.urlparse(self.path)
                params = dict(urllib.parse.parse_qsl(parsed.query))

                if outer.chaos_fatal_400:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(b'{"error": "Bad Request: malformed parameter"}')
                    return

                if outer.chaos_429:
                    outer.chaos_429 = False  # trigger once
                    self.send_response(429)
                    self.send_header("Retry-After", "1")
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(b'{"error": "Rate limit exceeded"}')
                    return

                if outer.chaos_503_count > 0:
                    outer.chaos_503_count -= 1
                    self.send_response(503)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(b'{"error": "Service temporarily unavailable"}')
                    return

                if outer.chaos_disconnect:
                    outer.chaos_disconnect = False
                    # Abruptly close socket to simulate mid-flight crash
                    self.close_connection = True
                    return

                # Filter features
                feats = outer.active_features
                if "starttime" in params:
                    st_str = params["starttime"]
                    try:
                        st_dt = datetime.datetime.fromisoformat(st_str.replace("Z", "+00:00"))
                        st_epoch = int(st_dt.timestamp() * 1000)
                        feats = [f for f in feats if f["properties"]["time"] >= st_epoch]
                    except Exception:
                        pass

                if "endtime" in params:
                    et_str = params["endtime"]
                    try:
                        et_dt = datetime.datetime.fromisoformat(et_str.replace("Z", "+00:00"))
                        et_epoch = int(et_dt.timestamp() * 1000)
                        feats = [f for f in feats if f["properties"]["time"] <= et_epoch]
                    except Exception:
                        pass

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

                data = json.dumps(resp).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

        return Handler


# ---------------------------------------------------------------------------------------------------------------- runner
def run_cmd(cmd, cwd=None, timeout=RUN_TIMEOUT):
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    return p.returncode, p.stdout, p.stderr


# ---------------------------------------------------------------------------------------------------------------- step verifications
def step_1(ws):
    print("\n--- Step 1: Raw data profiling (profile.json) ---")
    pfile = ws / "profile.json"
    if not check("profile.json exists in workspace", pfile.is_file(), "Create profile.json in your workspace"):
        return
    try:
        user_prof = json.loads(pfile.read_text(encoding="utf-8"))
    except Exception as e:
        check("profile.json is valid JSON", False, f"JSON error: {e}")
        return

    exp = truth()["profile"]
    check("total_features is correct (513)", user_prof.get("total_features") == exp["total_features"], f"Expected {exp['total_features']}")
    check("max_magnitude is correct (7.5)", close(user_prof.get("max_magnitude"), exp["max_magnitude"]), f"Expected {exp['max_magnitude']}")
    check("min_magnitude is correct (2.5)", close(user_prof.get("min_magnitude"), exp["min_magnitude"]), f"Expected {exp['min_magnitude']}")
    check("tsunami_alert_count is correct (3)", user_prof.get("tsunami_alert_count") == exp["tsunami_alert_count"], f"Expected {exp['tsunami_alert_count']}")
    check("max_depth_km matches seed (~659.94 km)", close(user_prof.get("max_depth_km"), exp["max_depth_km"], tol=0.1), f"Expected ~{exp['max_depth_km']}")
    check("min_depth_km matches seed (0.0 km)", close(user_prof.get("min_depth_km"), exp["min_depth_km"], tol=0.1), f"Expected {exp['min_depth_km']}")
    check("min_time_epoch_ms matches seed", user_prof.get("min_time_epoch_ms") == exp["min_time_epoch_ms"], f"Expected {exp['min_time_epoch_ms']}")
    check("max_time_epoch_ms matches seed", user_prof.get("max_time_epoch_ms") == exp["max_time_epoch_ms"], f"Expected {exp['max_time_epoch_ms']}")
    check("noto_peninsula_event_id is 'us6000m0xl'", user_prof.get("noto_peninsula_event_id") == exp["noto_peninsula_event_id"], "Find the feature ID of the M 7.5 quake in Japan")


def step_2(ws, pipe):
    print("\n--- Step 2: Baseline ingestion contract & pagination ---")
    raw = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    features = raw["features"][:300]
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
            check("warehouse contains exactly 300 events", cnt == 300, f"Expected 300, got {cnt}")
            
            # Check coordinate ordering: latitude must be in [-90, 90], longitude in [-180, 180]
            lat_bad = conn.execute("SELECT count(*) FROM events WHERE latitude < -90 OR latitude > 90").fetchone()[0]
            check("coordinate ordering correct (latitude between -90 and 90)", lat_bad == 0, "Remember: coords[0] is longitude, coords[1] is latitude!")
            
            # Check required columns
            cols = [r[0] for r in conn.execute("DESCRIBE events").fetchall()]
            for req in ["event_id", "time_utc", "latitude", "longitude", "depth_km", "magnitude", "status"]:
                check(f"column '{req}' present in events table", req in cols, f"Add {req} column")
            conn.close()
        
        # Test idempotency on re-run
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
            check("re-running ingest causes 0 duplicate rows (still 300 rows)", cnt2 == 300, f"Expected 300, got {cnt2}")
            conn.close()
    finally:
        server.stop()
        shutil.rmtree(test_out, ignore_errors=True)


def step_3(ws, pipe):
    print("\n--- Step 3: Stateful watermarking & crash recovery ---")
    raw = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    raw_feats = sorted(raw["features"], key=lambda f: f["properties"]["time"])
    features = raw_feats[:300]
    server = MockUSGSServer(features)
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
        
        # 2. Add 100 newer events
        server.active_features = raw_feats[:400]
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
        
        state2 = json.loads(state_file.read_text(encoding="utf-8"))
        wm2 = state2.get("high_watermark_epoch_ms", 0)
        check("high_watermark advanced after incremental sync", wm2 > wm1, "Advance watermark to highest event time")
        
        # 3. Crash test: server disconnects during next sync
        server.active_features = raw_feats[:450]
        server.chaos_disconnect = True
        rc_crash, _, _ = run_cmd([
            sys.executable, str(pipe), "ingest",
            "--api-url", server.url,
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--batch-size", "25"
        ])
        check("pipeline terminates on socket disconnect", rc_crash != 0, "Crash should return non-zero code")
        check("state.json is not corrupted after crash", state_file.is_file(), "Use atomic file swap for state.json")
        
        # 4. Resume after connection restored
        server.chaos_disconnect = False
        rc_res, _, err_res = run_cmd([
            sys.executable, str(pipe), "ingest",
            "--api-url", server.url,
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--batch-size", "25"
        ])
        check("pipeline resumes successfully after recovery", rc_res == 0, f"Error: {err_res}")
        conn = duckdb.connect(str(db_path))
        cnt_res = conn.execute("SELECT count(*) FROM events").fetchone()[0]
        check("warehouse has exactly 450 events with zero duplicates", cnt_res == 450, f"Expected 450, got {cnt_res}")
        conn.close()
    finally:
        server.stop()
        shutil.rmtree(test_out, ignore_errors=True)


def step_4(ws, pipe):
    print("\n--- Step 4: Network resilience & rate limits (429 & 503) ---")
    raw = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    features = raw["features"][:100]
    server = MockUSGSServer(features)
    server.start()
    
    test_out = ws / "test_run_step4"
    shutil.rmtree(test_out, ignore_errors=True)
    state_file = test_out / "state.json"
    
    try:
        # Trigger 429 and 503 retries
        server.chaos_429 = True
        server.chaos_503_count = 2
        
        t0 = time.time()
        rc, out, err = run_cmd([
            sys.executable, str(pipe), "ingest",
            "--api-url", server.url,
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--batch-size", "50"
        ])
        dur = time.time() - t0
        check("pipeline recovers from HTTP 429 and 503 retries", rc == 0, f"Failed: {err}")
        check("backoff sleep was applied during retries", dur >= 1.0, f"Took {dur:.1f}s, expected backoff pause")
        
        db_path = test_out / "warehouse.duckdb"
        if db_path.is_file():
            conn = duckdb.connect(str(db_path))
            cnt = conn.execute("SELECT count(*) FROM events").fetchone()[0]
            check("all 100 events ingested despite network transient errors", cnt == 100, f"Got {cnt}")
            conn.close()
        
        # Test fatal 400 error handling
        server.chaos_fatal_400 = True
        rc_fatal, _, _ = run_cmd([
            sys.executable, str(pipe), "ingest",
            "--api-url", server.url,
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--batch-size", "50"
        ])
        check("fatal HTTP 400 exits with status code 2", rc_fatal == 2, f"Expected exit code 2, got {rc_fatal}")
    finally:
        server.stop()
        shutil.rmtree(test_out, ignore_errors=True)


def step_5(ws, pipe):
    print("\n--- Step 5: DLQ, CDC upsert & historical backfill ---")
    raw = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    base_feats = copy.deepcopy(raw["features"][:50])
    
    # Create 5 corrupted records for DLQ
    toxic_feats = [
        {"type": "Feature", "id": "bad_lat_1", "properties": {"mag": 3.0, "time": 1704100000000}, "geometry": {"type": "Point", "coordinates": [-120.0, 125.0, 10.0]}},
        {"type": "Feature", "id": "bad_lon_1", "properties": {"mag": 3.0, "time": 1704101000000}, "geometry": {"type": "Point", "coordinates": [-220.0, 35.0, 10.0]}},
        {"type": "Feature", "id": "", "properties": {"mag": 3.0, "time": 1704102000000}, "geometry": {"type": "Point", "coordinates": [-120.0, 35.0, 10.0]}},
        {"type": "Feature", "id": "bad_geom_1", "properties": {"mag": 3.0, "time": 1704103000000}, "geometry": None},
        {"type": "Feature", "id": "bad_time_1", "properties": {"mag": 3.0, "time": -1000}, "geometry": {"type": "Point", "coordinates": [-120.0, 35.0, 10.0]}}
    ]
    test_batch = base_feats + toxic_feats
    server = MockUSGSServer(test_batch)
    server.start()
    
    test_out = ws / "test_run_step5"
    shutil.rmtree(test_out, ignore_errors=True)
    state_file = test_out / "state.json"
    
    try:
        # 1. Ingest batch with corrupted items
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
        check("warehouse received 50 clean events", clean_count == 50, f"Expected 50, got {clean_count}")
        conn.close()
        
        dlq_file = test_out / "dlq" / "rejected.jsonl"
        check("dlq/rejected.jsonl exists", dlq_file.is_file(), "Route rejected records to dlq/rejected.jsonl")
        if dlq_file.is_file():
            dlq_lines = [json.loads(l) for l in dlq_file.read_text(encoding="utf-8").strip().splitlines() if l.strip()]
            check("DLQ contains exactly 5 rejected records", len(dlq_lines) == 5, f"Expected 5, got {len(dlq_lines)}")
            for item in dlq_lines:
                check("DLQ item contains error_code and failed_at", "error_code" in item and "failed_at" in item, "Add error_code and failed_at to DLQ item")
        
        # 2. CDC revision test: 10 existing events updated upstream
        revised_feats = copy.deepcopy(base_feats[:10])
        for rf in revised_feats:
            rf["properties"]["mag"] = 9.9
            rf["properties"]["status"] = "reviewed"
            rf["properties"]["updated"] = (rf["properties"].get("updated") or rf["properties"]["time"]) + 5000000
        
        server.active_features = revised_feats
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
        check("CDC updated rows reflect new magnitude (9.9) and reviewed status", updated_mag_count == 10, f"Expected 10, got {updated_mag_count}")
        conn.close()
        
        # 3. Backfill test: backfill historical range
        if not check("state.json exists before backfill", state_file.is_file(), "state.json must exist"):
            return
        state_pre = json.loads(state_file.read_text(encoding="utf-8"))
        wm_pre = state_pre.get("high_watermark_epoch_ms")
        
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
            "--start", "2023-12-01",
            "--end", "2023-12-31",
            "--batch-size", "100"
        ])
        check("pipeline backfill exits with code 0", rc_bf == 0, f"Error: {err_bf}")
        conn = duckdb.connect(str(db_path))
        cnt_bf = conn.execute("SELECT count(*) FROM events").fetchone()[0]
        check("warehouse has 100 total events after backfill", cnt_bf == 100, f"Expected 100, got {cnt_bf}")
        conn.close()
        
        state_post = json.loads(state_file.read_text(encoding="utf-8"))
        wm_post = state_post.get("high_watermark_epoch_ms")
        check("CRITICAL: backfill did not modify production high-watermark", wm_pre == wm_post, "Backfill must NOT alter state.json high-watermark!")
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
