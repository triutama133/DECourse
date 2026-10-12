#!/usr/bin/env python3
"""Capstone 4.3: Real-Time Event Streaming, Watermarks & Late Data Handling.

Copy this file into your workspace folder (e.g. ~/fleet) and build it there:
    python stream_processor.py --input-stream STREAM.jsonl --output-dir OUT --state-file OUT/offsets.json --window-size 300 --watermark-delay 120

Check your work after every step:
    python3 labs/mod-4-3/check.py ~/fleet --step 1
    ...
    python3 labs/mod-4-3/check.py ~/fleet --step all

Exit codes:
    0 = stream processed successfully
    anything else = error / crash
"""
import argparse
import datetime  # noqa: F401
import json  # noqa: F401
import math  # noqa: F401
import os  # noqa: F401
import sys
from pathlib import Path  # noqa: F401

try:
    import duckdb  # noqa: F401
except ImportError:
    print("duckdb is required. Run: pip install duckdb pyarrow", file=sys.stderr)
    sys.exit(1)


def get_window_starts(ts, size, slide):
    """Return list of start timestamps for all windows of length `size` and step `slide` containing `ts`.
    
    # TODO Step 2 & 5: Compute window start boundaries containing timestamp `ts`.
    # For tumbling windows (slide == size or slide is None), an event belongs to exactly 1 window:
    #   k = floor(ts / size) * size
    # For sliding windows (slide < size), an event belongs to multiple overlapping windows:
    #   k in [floor((ts - size + slide) / slide), floor(ts / slide)]
    """
    raise NotImplementedError("TODO: implement get_window_starts")


def run_stream(args):
    # TODO Step 2: Ingest jsonl streaming events, calculate tumbling event-time windows (e.g. 300s),
    #              and store aggregated metrics into <args.output_dir>/warehouse.duckdb (table windowed_metrics).
    #              Metrics per window and zone: total_trips, total_passengers, total_fare, avg_fare.
    # TODO Step 3: Implement watermark tracking with allowed lateness delay:
    #              watermark = max(watermark, event_time - args.watermark_delay)
    #              Evict closed windows when window_end <= watermark.
    #              Drop late events arriving after their window is already closed and route them
    #              to <args.output_dir>/dlq/late_events.jsonl.
    # TODO Step 4: Implement consumer offset checkpointing in args.state_file.
    #              Write offsets atomically (tmp file + atomic rename) and ensure idempotent resumption.
    # TODO Step 5: Support sliding windows when --window-slide is specified (e.g. size 300s, slide 60s).
    print("not implemented yet: stream processor", file=sys.stderr)
    sys.exit(1)


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
