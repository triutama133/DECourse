#!/usr/bin/env python3
"""Reference solution for Capstone 4.3: Real-Time Event Streaming, Watermarks & Late Data Handling.

Consumes streaming telemetry events, performs event-time windowing (tumbling and sliding),
tracks watermarks with allowed lateness delays, routes dropped late events to DLQ,
emits closed windows idempotently to DuckDB, and commits stream offsets atomically.
"""
import argparse
import datetime
import json
import math
import os
import sys
from pathlib import Path

try:
    import duckdb
except ImportError:
    print("duckdb is required. Run: pip install duckdb pyarrow", file=sys.stderr)
    sys.exit(1)


def get_window_starts(ts, size, slide):
    """Return list of start timestamps for all windows of length `size` and step `slide` containing `ts`."""
    if slide is None or slide <= 0:
        slide = size
    # A window starts at k * slide.
    # It contains ts if: k * slide <= ts < k * slide + size
    # => ts - size < k * slide <= ts
    # => (ts - size) / slide < k <= ts / slide
    # First k: math.floor((ts - size + slide) / slide)
    # Last k: math.floor(ts / slide)
    k_min = math.floor((ts - size + slide) / slide)
    k_max = math.floor(ts / slide)
    return [k * slide for k in range(k_min, k_max + 1)]


def ensure_warehouse(conn):
    conn.execute("""
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
        )
    """)


def load_state(state_file):
    if not state_file:
        return {}
    p = Path(state_file)
    if not p.is_file():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_state_atomic(state_file, state_data):
    if not state_file:
        return
    p = Path(state_file)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(state_data, indent=2), encoding="utf-8")
    tmp.replace(p)


def write_late_events(output_dir, late_records):
    if not late_records:
        return
    dlq_dir = Path(output_dir) / "dlq"
    dlq_dir.mkdir(parents=True, exist_ok=True)
    dlq_file = dlq_dir / "late_events.jsonl"
    with open(dlq_file, "a", encoding="utf-8") as f:
        for r in late_records:
            f.write(json.dumps(r) + "\n")


def emit_windows_to_duckdb(conn, windows_to_emit):
    """Upsert closed windows into DuckDB windowed_metrics table."""
    if not windows_to_emit:
        return 0
    now_utc = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    
    rows = []
    for ((start_ts, end_ts, zone_id), stats) in windows_to_emit.items():
        dt_start = datetime.datetime.fromtimestamp(start_ts, tz=datetime.timezone.utc).replace(tzinfo=None)
        dt_end = datetime.datetime.fromtimestamp(end_ts, tz=datetime.timezone.utc).replace(tzinfo=None)
        trips = stats["trips"]
        passengers = stats["passengers"]
        total_fare = round(stats["total_fare"], 2)
        avg_fare = round(total_fare / trips, 2) if trips > 0 else 0.0
        rows.append((dt_start, dt_end, int(zone_id), int(trips), int(passengers), total_fare, avg_fare, now_utc))
    
    conn.execute("CREATE TEMP TABLE IF NOT EXISTS batch_windows AS SELECT * FROM windowed_metrics WHERE 1=0")
    conn.execute("DELETE FROM batch_windows")
    conn.executemany("INSERT INTO batch_windows VALUES (?, ?, ?, ?, ?, ?, ?, ?)", rows)
    
    # Delete existing rows with same (window_start, window_end, zone_id)
    conn.execute("""
        DELETE FROM windowed_metrics
        WHERE (window_start, window_end, zone_id) IN (
            SELECT window_start, window_end, zone_id FROM batch_windows
        )
    """)
    conn.execute("INSERT INTO windowed_metrics SELECT * FROM batch_windows")
    return len(rows)


def run_stream(args):
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    db_path = out_dir / "warehouse.duckdb"
    conn = duckdb.connect(str(db_path))
    ensure_warehouse(conn)
    
    state = load_state(args.state_file)
    last_offset = state.get("last_offset", 0)
    watermark = state.get("high_watermark")
    if watermark is None:
        watermark = -math.inf
    total_processed = state.get("total_events_processed", 0)
    total_late = state.get("total_late_events_dropped", 0)
    total_emitted = state.get("total_windows_emitted", 0)
    
    window_size = args.window_size
    window_slide = args.window_slide or window_size
    delay = args.watermark_delay
    
    # In-memory window state: (start_ts, end_ts, zone_id) -> {trips, passengers, total_fare}
    window_state = {}
    raw_open = state.get("open_windows", {})
    for k_str, val in raw_open.items():
        parts = [int(x) for x in k_str.split("_")]
        window_state[(parts[0], parts[1], parts[2])] = val
    evicted_windows = set()
    
    stream_file = Path(args.input_stream)
    if not stream_file.is_file():
        print(f"Error: input stream file {stream_file} not found", file=sys.stderr)
        sys.exit(1)
    
    lines = stream_file.read_text(encoding="utf-8").strip().splitlines()
    
    current_offset = 0
    late_records = []
    
    for idx, line in enumerate(lines, start=1):
        if idx <= last_offset:
            # Skip already committed offsets on resumption
            continue
        
        current_offset = idx
        if not line.strip():
            continue
        
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        
        ts = event["event_time"]
        zone_id = event["zone_id"]
        fare = float(event["fare_amount"])
        passengers = int(event["passenger_count"])
        
        # Advance watermark candidate: max(watermark, newest_event_time - delay)
        # Note: In streaming systems, watermark updates monotonically
        new_watermark = max(watermark, ts - delay)
        
        # Determine candidate windows
        starts = get_window_starts(ts, window_size, window_slide)
        valid_window_found = False
        
        for s in starts:
            end_ts = s + window_size
            win_key = (s, end_ts, zone_id)
            
            # Check if this window is already closed by current watermark
            if end_ts <= watermark:
                # Window already closed / evicted!
                continue
            
            valid_window_found = True
            if win_key not in window_state:
                window_state[win_key] = {"trips": 0, "passengers": 0, "total_fare": 0.0}
            
            window_state[win_key]["trips"] += 1
            window_state[win_key]["passengers"] += passengers
            window_state[win_key]["total_fare"] += fare
        
        if not valid_window_found:
            # Event is too late: all its windows are already closed
            total_late += 1
            late_records.append({
                "error_code": "LATE_EVENT",
                "event_id": event["event_id"],
                "event_time": ts,
                "current_watermark": watermark if watermark != -math.inf else None,
                "dropped_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "raw_payload": event
            })
        
        total_processed += 1
        watermark = new_watermark
        
        # Check if any open windows can now be closed and emitted
        to_emit = {}
        for win_key, stats in list(window_state.items()):
            start_ts, end_ts, _ = win_key
            if end_ts <= watermark:
                to_emit[win_key] = stats
                del window_state[win_key]
                evicted_windows.add((start_ts, end_ts))
        
        if to_emit:
            emitted_cnt = emit_windows_to_duckdb(conn, to_emit)
            total_emitted += emitted_cnt
        
        if late_records:
            write_late_events(out_dir, late_records)
            late_records.clear()
        
        # Commit checkpoint
        save_state_atomic(args.state_file, {
            "last_offset": current_offset,
            "high_watermark": watermark if watermark != -math.inf else None,
            "total_events_processed": total_processed,
            "total_late_events_dropped": total_late,
            "total_windows_emitted": total_emitted,
            "open_windows": {f"{k[0]}_{k[1]}_{k[2]}": v for k, v in window_state.items()}
        })
    
    # End-of-stream flush: flush remaining open windows to DuckDB so they are visible,
    # and persist checkpoint with true watermark and open_windows
    if window_state:
        emitted_cnt = emit_windows_to_duckdb(conn, window_state)
        total_emitted += emitted_cnt
        save_state_atomic(args.state_file, {
            "last_offset": current_offset,
            "high_watermark": watermark if watermark != -math.inf else None,
            "total_events_processed": total_processed,
            "total_late_events_dropped": total_late,
            "total_windows_emitted": total_emitted,
            "open_windows": {f"{k[0]}_{k[1]}_{k[2]}": v for k, v in window_state.items()}
        })
    
    conn.close()
    print(f"Stream complete: {total_processed} events processed, {total_late} late dropped, {total_emitted} windows emitted.")
    return 0


def main():
    parser = argparse.ArgumentParser(description="Real-Time Event Stream Windowed Processor")
    parser.add_argument("--input-stream", required=True, help="Path to input jsonl event stream")
    parser.add_argument("--output-dir", required=True, help="Destination directory for duckdb & dlq")
    parser.add_argument("--state-file", required=True, help="Path to offset state checkpoint json")
    parser.add_argument("--window-size", type=int, default=300, help="Window length in seconds (default 300)")
    parser.add_argument("--window-slide", type=int, default=None, help="Window slide step in seconds (default: tumbling)")
    parser.add_argument("--watermark-delay", type=int, default=120, help="Allowed lateness delay in seconds (default 120)")
    
    args = parser.parse_args()
    return run_stream(args)


if __name__ == "__main__":
    sys.exit(main())
