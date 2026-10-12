#!/usr/bin/env python3
"""Checks your work in Capstone 4.3 (Real-Time Event Streaming, Watermarks & Late Data Handling).

    python3 labs/mod-4-3/check.py ~/fleet --step 1          # raw stream profiling (profile.json)
    python3 labs/mod-4-3/check.py ~/fleet --step 2          # baseline tumbling event-time windows
    python3 labs/mod-4-3/check.py ~/fleet --step 3          # watermark progression & late event DLQ
    python3 labs/mod-4-3/check.py ~/fleet --step 4          # consumer offset checkpointing & recovery
    python3 labs/mod-4-3/check.py ~/fleet --step 5          # sliding windows (overlapping buckets)
    python3 labs/mod-4-3/check.py ~/fleet --step all        # all steps (proof code)
    python3 labs/mod-4-3/check.py ~/fleet --step 2 --hint 1 # hints (levels 1, 2, 3)

~/fleet is YOUR workspace folder holding stream_processor.py and profile.json.
Needs: pip install duckdb pyarrow
"""
import argparse
import copy
import datetime
import json
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

try:
    import duckdb
except ImportError:
    print("duckdb is not installed in this Python. Activate your virtual environment and run:  pip install duckdb pyarrow")
    sys.exit(1)

HERE = Path(__file__).resolve().parent
SEED_FILE = HERE / "data" / "events_seed.jsonl"
RUN_TIMEOUT = 120

# ---------------------------------------------------------------------------------------------------------------- hints
HINTS = {
    1: [
        "Load events_seed.jsonl line by line using json.loads(). Track event_time, vehicle_id, and zone_id.",
        "For out_of_order_count: count how many lines have event_time < the event_time of the immediately preceding line in the file.",
        "Check zone_id counts using collections.Counter to find the busiest zone and its event count."
    ],
    2: [
        "Parse arguments with argparse: --input-stream, --output-dir, --state-file, --window-size, --watermark-delay, and optional --window-slide.",
        "For tumbling windows: window start is math.floor(ts / window_size) * window_size, and window end is start + window_size.",
        "Connect to DuckDB: CREATE TABLE IF NOT EXISTS windowed_metrics (window_start TIMESTAMP, window_end TIMESTAMP, zone_id INTEGER, total_trips BIGINT, total_passengers BIGINT, total_fare DOUBLE, avg_fare DOUBLE, emitted_at TIMESTAMP, PRIMARY KEY (window_start, window_end, zone_id)). Upsert or replace idempotently."
    ],
    3: [
        "Track high watermark: watermark = max(watermark, event_time - watermark_delay). Watermark must only move forward monotonically.",
        "A window [start, end) closes and evicts when window_end <= watermark. Any late-arriving event whose candidate windows are all <= watermark is dropped.",
        "Append dropped late events to <output-dir>/dlq/late_events.jsonl with fields: error_code ('LATE_EVENT'), event_id, event_time, dropped_at, and raw_payload."
    ],
    4: [
        "Check state-file at the start: read last_offset. Skip lines with index <= last_offset to resume seamlessly from crash.",
        "Write state-file atomically: write JSON to state_file.tmp first, then use os.replace(tmp, state_file) to prevent half-written corruptions.",
        "Rely on DuckDB primary keys or batch staging deletes so that replaying already processed events never creates duplicate window metric rows."
    ],
    5: [
        "For sliding windows (--window-slide), an event at ts falls into all windows starting at k * slide where k * slide <= ts < k * slide + size.",
        "First k: math.floor((ts - size + slide) / slide); last k: math.floor(ts / slide). Iterate over range(k_min, k_max + 1).",
        "Add the event's trip, fare, and passenger counts to each overlapping window bucket independently before checking watermark evictions."
    ]
}

# ---------------------------------------------------------------------------------------------------------------- truth
def truth():
    if not SEED_FILE.is_file():
        raise FileNotFoundError(f"Missing {SEED_FILE}. Run: python3 labs/mod-4-3/fetch_data.py")
    lines = [json.loads(l) for l in SEED_FILE.read_text(encoding="utf-8").strip().splitlines() if l.strip()]
    times = [x["event_time"] for x in lines]
    vehicles = set(x["vehicle_id"] for x in lines)
    
    ooo_cnt = sum(1 for i in range(1, len(lines)) if lines[i]["event_time"] < lines[i - 1]["event_time"])
    
    from collections import Counter
    zone_counts = Counter(x["zone_id"] for x in lines)
    busiest_zone, busiest_count = zone_counts.most_common(1)[0]
    
    return {
        "profile": {
            "total_stream_events": len(lines),
            "min_event_time": min(times),
            "max_event_time": max(times),
            "distinct_vehicles": len(vehicles),
            "out_of_order_count": ooo_cnt,
            "busiest_zone_id": busiest_zone,
            "busiest_zone_event_count": busiest_count
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

# ---------------------------------------------------------------------------------------------------------------- runner
def run_cmd(cmd, cwd=None, timeout=RUN_TIMEOUT):
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    return p.returncode, p.stdout, p.stderr

# ---------------------------------------------------------------------------------------------------------------- step verifications
def step_1(ws):
    print("\n--- Step 1: Raw stream profiling (profile.json) ---")
    pfile = ws / "profile.json"
    if not check("profile.json exists in workspace", pfile.is_file(), "Create profile.json in your workspace"):
        return
    try:
        user_prof = json.loads(pfile.read_text(encoding="utf-8"))
    except Exception as e:
        check("profile.json is valid JSON", False, f"JSON error: {e}")
        return

    exp = truth()["profile"]
    check("total_stream_events is correct (1000)", user_prof.get("total_stream_events") == exp["total_stream_events"], f"Expected {exp['total_stream_events']}")
    check("min_event_time is correct (1704067266)", user_prof.get("min_event_time") == exp["min_event_time"], f"Expected {exp['min_event_time']}")
    check("max_event_time is correct (1704091951)", user_prof.get("max_event_time") == exp["max_event_time"], f"Expected {exp['max_event_time']}")
    check("distinct_vehicles is correct (50)", user_prof.get("distinct_vehicles") == exp["distinct_vehicles"], f"Expected {exp['distinct_vehicles']}")
    check("out_of_order_count is correct (346)", user_prof.get("out_of_order_count") == exp["out_of_order_count"], f"Expected {exp['out_of_order_count']}")
    check("busiest_zone_id is correct (186)", user_prof.get("busiest_zone_id") == exp["busiest_zone_id"], f"Expected {exp['busiest_zone_id']}")
    check("busiest_zone_event_count is correct (116)", user_prof.get("busiest_zone_event_count") == exp["busiest_zone_event_count"], f"Expected {exp['busiest_zone_event_count']}")


def step_2(ws, proc):
    print("\n--- Step 2: Baseline tumbling event-time windows ---")
    test_out = ws / "test_run_step2"
    shutil.rmtree(test_out, ignore_errors=True)
    test_out.mkdir(parents=True, exist_ok=True)
    
    # Create clean slice of 200 events
    raw_lines = [l for l in SEED_FILE.read_text(encoding="utf-8").strip().splitlines() if l.strip()][:200]
    slice_file = test_out / "stream_slice.jsonl"
    slice_file.write_text("\n".join(raw_lines) + "\n", encoding="utf-8")
    state_file = test_out / "offsets.json"
    
    try:
        rc, out, err = run_cmd([
            sys.executable, str(proc),
            "--input-stream", str(slice_file),
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--window-size", "300",
            "--watermark-delay", "120"
        ])
        check("stream_processor.py exits with code 0", rc == 0, f"Error: {err}")
        
        db_path = test_out / "warehouse.duckdb"
        check("warehouse.duckdb exists in output dir", db_path.is_file(), "Create warehouse.duckdb")
        
        if db_path.is_file():
            conn = duckdb.connect(str(db_path))
            tbls = [r[0] for r in conn.execute("SHOW TABLES").fetchall()]
            check("table windowed_metrics exists", "windowed_metrics" in tbls, "CREATE TABLE windowed_metrics")
            
            if "windowed_metrics" in tbls:
                cols = [r[0] for r in conn.execute("DESCRIBE windowed_metrics").fetchall()]
                for req in ["window_start", "window_end", "zone_id", "total_trips", "total_passengers", "total_fare", "avg_fare"]:
                    check(f"column '{req}' present in windowed_metrics", req in cols, f"Add {req} column")
                
                # Verify window duration: exactly 300s
                dur_diff = conn.execute("""
                    SELECT count(*) FROM windowed_metrics
                    WHERE epoch(window_end) - epoch(window_start) != 300
                """).fetchone()[0]
                check("all window durations are exactly 300 seconds", dur_diff == 0, "Window duration must equal --window-size")
                
                # Check total trips across all windows == 200
                trips_sum = conn.execute("SELECT sum(total_trips) FROM windowed_metrics").fetchone()[0]
                check("total trips in windows matches input slice (200)", trips_sum == 200, f"Expected 200, got {trips_sum}")
                
                # Check fare sum matches raw slice
                expected_fare = sum(json.loads(l)["fare_amount"] for l in raw_lines)
                actual_fare = conn.execute("SELECT sum(total_fare) FROM windowed_metrics").fetchone()[0]
                check("total fare matches input slice", close(actual_fare, expected_fare, tol=1.0), f"Expected ~{expected_fare}, got {actual_fare}")
                
                # Check avg_fare calculation
                bad_avg = conn.execute("""
                    SELECT count(*) FROM windowed_metrics
                    WHERE total_trips > 0 AND abs(avg_fare - round(total_fare / total_trips, 2)) > 0.05
                """).fetchone()[0]
                check("avg_fare equals total_fare / total_trips", bad_avg == 0, "avg_fare must be correctly rounded")
            conn.close()
        
        # Test idempotency: re-running on same stream should produce 0 duplicates
        rc2, out2, err2 = run_cmd([
            sys.executable, str(proc),
            "--input-stream", str(slice_file),
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--window-size", "300",
            "--watermark-delay", "120"
        ])
        check("re-running stream processor exits with code 0", rc2 == 0, f"Error: {err2}")
        if db_path.is_file():
            conn = duckdb.connect(str(db_path))
            trips_sum2 = conn.execute("SELECT sum(total_trips) FROM windowed_metrics").fetchone()[0]
            check("re-running processor causes 0 duplicate records (total trips still 200)", trips_sum2 == 200, f"Expected 200, got {trips_sum2}")
            conn.close()
    finally:
        shutil.rmtree(test_out, ignore_errors=True)


def step_3(ws, proc):
    print("\n--- Step 3: Watermark progression & late event DLQ ---")
    test_out = ws / "test_run_step3"
    shutil.rmtree(test_out, ignore_errors=True)
    test_out.mkdir(parents=True, exist_ok=True)
    
    # Controlled event sequence with deliberate late arrivals:
    # window_size = 300, delay = 120
    # Window A: [1704067200, 1704067500)
    # Window B: [1704067500, 1704067800)
    # Window C: [1704067800, 1704068100)
    events = [
        # Normal in-order events in Window A
        {"event_id": "e_01", "vehicle_id": "taxi_01", "event_time": 1704067250, "zone_id": 100, "fare_amount": 20.0, "trip_distance": 3.0, "passenger_count": 1},
        {"event_id": "e_02", "vehicle_id": "taxi_02", "event_time": 1704067300, "zone_id": 100, "fare_amount": 25.0, "trip_distance": 4.0, "passenger_count": 2},
        # Normal events in Window B
        {"event_id": "e_03", "vehicle_id": "taxi_03", "event_time": 1704067600, "zone_id": 100, "fare_amount": 30.0, "trip_distance": 5.0, "passenger_count": 1},
        # Advance watermark to: 1704067950 - 120 = 1704067830.
        # This closes Window A (1704067500 <= 1704067830) AND Window B (1704067800 <= 1704067830)!
        {"event_id": "e_04", "vehicle_id": "taxi_04", "event_time": 1704067950, "zone_id": 100, "fare_amount": 40.0, "trip_distance": 6.0, "passenger_count": 2},
        # Late event arriving now for Window A: event_time 1704067280 (Window A end is 1704067500 <= watermark 1704067830) -> DROPPED TO DLQ!
        {"event_id": "e_late_01", "vehicle_id": "taxi_05", "event_time": 1704067280, "zone_id": 100, "fare_amount": 99.0, "trip_distance": 1.0, "passenger_count": 1},
        # Out-of-order event for Window C: event_time 1704067850 (Window C end is 1704068100 > watermark 1704067830) -> ACCEPTED!
        {"event_id": "e_ooo_valid", "vehicle_id": "taxi_06", "event_time": 1704067850, "zone_id": 100, "fare_amount": 15.0, "trip_distance": 2.0, "passenger_count": 1},
    ]
    
    stream_file = test_out / "controlled_stream.jsonl"
    stream_file.write_text("\n".join(json.dumps(e) for e in events) + "\n", encoding="utf-8")
    state_file = test_out / "offsets.json"
    
    try:
        rc, out, err = run_cmd([
            sys.executable, str(proc),
            "--input-stream", str(stream_file),
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--window-size", "300",
            "--watermark-delay", "120"
        ])
        check("stream processor exits with code 0 on late data stream", rc == 0, f"Error: {err}")
        
        # Check DLQ exists
        dlq_file = test_out / "dlq" / "late_events.jsonl"
        check("dlq/late_events.jsonl exists", dlq_file.is_file(), "Write late events to <output-dir>/dlq/late_events.jsonl")
        
        if dlq_file.is_file():
            dlq_lines = [json.loads(l) for l in dlq_file.read_text(encoding="utf-8").strip().splitlines() if l.strip()]
            check("exactly 1 late event routed to DLQ", len(dlq_lines) == 1, f"Expected 1, got {len(dlq_lines)}")
            if dlq_lines:
                late_rec = dlq_lines[0]
                check("DLQ record has error_code 'LATE_EVENT'", late_rec.get("error_code") == "LATE_EVENT", "Set error_code to LATE_EVENT")
                check("DLQ record matches e_late_01 event_id", late_rec.get("event_id") == "e_late_01", f"Expected e_late_01, got {late_rec.get('event_id')}")
        
        # Check warehouse contains valid accepted events and NOT the late event
        db_path = test_out / "warehouse.duckdb"
        if db_path.is_file():
            conn = duckdb.connect(str(db_path))
            total_trips = conn.execute("SELECT sum(total_trips) FROM windowed_metrics").fetchone()[0]
            # Total events = 6, 1 late dropped => 5 valid trips
            check("warehouse contains exactly 5 accepted events (late event not counted)", total_trips == 5, f"Expected 5, got {total_trips}")
            
            # Check Window A fare: e_01 (20) + e_02 (25) = 45 (NOT 45 + 99 = 144)
            win_a_fare = conn.execute("""
                SELECT total_fare FROM windowed_metrics
                WHERE epoch(window_start) = 1704067200 AND zone_id = 100
            """).fetchone()
            win_a_fare_val = win_a_fare[0] if win_a_fare else 0.0
            check("Window A total_fare is 45.0 (excluded late $99 fare)", close(win_a_fare_val, 45.0), f"Expected 45.0, got {win_a_fare_val}")
            
            # Check Window C received e_ooo_valid: e_04 (40) + e_ooo_valid (15) = 55
            win_c_fare = conn.execute("""
                SELECT total_fare FROM windowed_metrics
                WHERE epoch(window_start) = 1704067800 AND zone_id = 100
            """).fetchone()
            win_c_fare_val = win_c_fare[0] if win_c_fare else 0.0
            check("Window C accepted out-of-order event e_ooo_valid ($55 total)", close(win_c_fare_val, 55.0), f"Expected 55.0, got {win_c_fare_val}")
            conn.close()
    finally:
        shutil.rmtree(test_out, ignore_errors=True)


def step_4(ws, proc):
    print("\n--- Step 4: Consumer offset checkpointing & recovery ---")
    test_out = ws / "test_run_step4"
    shutil.rmtree(test_out, ignore_errors=True)
    test_out.mkdir(parents=True, exist_ok=True)
    
    raw_lines = [l for l in SEED_FILE.read_text(encoding="utf-8").strip().splitlines() if l.strip()][:300]
    part1_lines = raw_lines[:150]
    part1_file = test_out / "stream_part1.jsonl"
    part1_file.write_text("\n".join(part1_lines) + "\n", encoding="utf-8")
    state_file = test_out / "offsets.json"
    
    try:
        # Phase 1: Process part 1 (150 events)
        rc1, _, err1 = run_cmd([
            sys.executable, str(proc),
            "--input-stream", str(part1_file),
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--window-size", "300",
            "--watermark-delay", "120"
        ])
        check("stream processor part 1 exits with code 0", rc1 == 0, f"Error: {err1}")
        check("offsets.json exists after part 1", state_file.is_file(), "Create state-file")
        
        if not state_file.is_file():
            return
        
        st1 = json.loads(state_file.read_text(encoding="utf-8"))
        check("last_offset recorded as 150", st1.get("last_offset") == 150, f"Expected 150, got {st1.get('last_offset')}")
        check("high_watermark recorded in state file", st1.get("high_watermark") is not None, "Save high_watermark in state")
        
        db_path = test_out / "warehouse.duckdb"
        conn = duckdb.connect(str(db_path))
        trips1 = conn.execute("SELECT sum(total_trips) FROM windowed_metrics").fetchone()[0]
        check("initial trips in DuckDB == 150", trips1 == 150, f"Expected 150, got {trips1}")
        conn.close()
        
        # Phase 2: Resume stream processor with full stream of 300 events
        # Processor should skip the first 150 lines and process lines 151-300
        full_file = test_out / "stream_full.jsonl"
        full_file.write_text("\n".join(raw_lines) + "\n", encoding="utf-8")
        
        rc2, _, err2 = run_cmd([
            sys.executable, str(proc),
            "--input-stream", str(full_file),
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--window-size", "300",
            "--watermark-delay", "120"
        ])
        check("stream processor resumed stream exits with code 0", rc2 == 0, f"Error: {err2}")
        
        st2 = json.loads(state_file.read_text(encoding="utf-8"))
        check("last_offset advanced to 300 upon completion", st2.get("last_offset") == 300, f"Expected 300, got {st2.get('last_offset')}")
        
        conn = duckdb.connect(str(db_path))
        trips2 = conn.execute("SELECT sum(total_trips) FROM windowed_metrics").fetchone()[0]
        check("DuckDB total trips after resumption is exactly 300 (0 duplicate rows)", trips2 == 300, f"Expected 300, got {trips2}")
        conn.close()
    finally:
        shutil.rmtree(test_out, ignore_errors=True)


def step_5(ws, proc):
    print("\n--- Step 5: Sliding windows (overlapping buckets) ---")
    test_out = ws / "test_run_step5"
    shutil.rmtree(test_out, ignore_errors=True)
    test_out.mkdir(parents=True, exist_ok=True)
    
    # 50 events slice
    raw_lines = [l for l in SEED_FILE.read_text(encoding="utf-8").strip().splitlines() if l.strip()][:50]
    slice_file = test_out / "stream_slice.jsonl"
    slice_file.write_text("\n".join(raw_lines) + "\n", encoding="utf-8")
    state_file = test_out / "offsets.json"
    
    try:
        # Run with window_size = 300, window_slide = 60
        rc, out, err = run_cmd([
            sys.executable, str(proc),
            "--input-stream", str(slice_file),
            "--output-dir", str(test_out),
            "--state-file", str(state_file),
            "--window-size", "300",
            "--window-slide", "60",
            "--watermark-delay", "120"
        ])
        check("sliding window stream run exits with code 0", rc == 0, f"Error: {err}")
        
        db_path = test_out / "warehouse.duckdb"
        check("warehouse.duckdb exists for sliding windows", db_path.is_file(), "Create warehouse.duckdb")
        
        if db_path.is_file():
            conn = duckdb.connect(str(db_path))
            
            # Verify window duration is 300s
            bad_dur = conn.execute("""
                SELECT count(*) FROM windowed_metrics
                WHERE epoch(window_end) - epoch(window_start) != 300
            """).fetchone()[0]
            check("all sliding windows have duration 300 seconds", bad_dur == 0, "Window duration must be 300s")
            
            # Verify window starts are multiples of 60s
            bad_slide = conn.execute("""
                SELECT count(*) FROM windowed_metrics
                WHERE (epoch(window_start) % 60) != 0
            """).fetchone()[0]
            check("all sliding window starts align to 60-second boundaries", bad_slide == 0, "Window starts must align to slide interval")
            
            # For window_size = 300 and slide = 60, each event falls into exactly 300 / 60 = 5 overlapping windows!
            # Total trips in DuckDB must equal 50 * 5 = 250 trips.
            total_trips = conn.execute("SELECT sum(total_trips) FROM windowed_metrics").fetchone()[0]
            check("total trips in sliding windows equals 5x raw events (250 trips)", total_trips == 250, f"Expected 250 (50 events * 5 windows), got {total_trips}")
            
            # Total fare in sliding windows must equal 5x the raw total fare
            raw_fare = sum(json.loads(l)["fare_amount"] for l in raw_lines)
            expected_sliding_fare = raw_fare * 5.0
            actual_sliding_fare = conn.execute("SELECT sum(total_fare) FROM windowed_metrics").fetchone()[0]
            check("total fare in sliding windows equals 5x raw fare", close(actual_sliding_fare, expected_sliding_fare, tol=2.0), f"Expected ~{expected_sliding_fare}, got {actual_sliding_fare}")
            conn.close()
    finally:
        shutil.rmtree(test_out, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description="Checker for Capstone 4.3")
    parser.add_argument("workspace", help="Path to your workspace folder (e.g. ~/fleet)")
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

    proc = ws / "stream_processor.py"
    if args.step != "1" and not proc.is_file():
        # Fallback to pipeline.py if learner named it pipeline.py
        if (ws / "pipeline.py").is_file():
            proc = ws / "pipeline.py"
        else:
            print(f"Missing stream_processor.py in workspace {ws}", file=sys.stderr)
            return 1

    if args.step in ("1", "all"):
        step_1(ws)
    if args.step in ("2", "all"):
        step_2(ws, proc)
    if args.step in ("3", "all"):
        step_3(ws, proc)
    if args.step in ("4", "all"):
        step_4(ws, proc)
    if args.step in ("5", "all"):
        step_5(ws, proc)

    print(f"\nSummary: {passed} passed, {failed} failed")
    if failed == 0 and args.step == "all":
        print("\nAll checks PASSED! You have built a resilient real-time streaming engine with watermarks and late data handling.")
        return 0
    return 1 if failed > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
