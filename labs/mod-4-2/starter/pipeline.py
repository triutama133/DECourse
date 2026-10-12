#!/usr/bin/env python3
"""Capstone 4.2: Fault-Tolerant Incremental API Ingestion & Checkpointing.

Copy this file into your workspace folder (e.g. ~/seismic) and build it there:
    python pipeline.py ingest --api-url URL --output-dir OUT --state-file OUT/state.json
    python pipeline.py backfill --api-url URL --output-dir OUT --start YYYY-MM-DD --end YYYY-MM-DD
    python pipeline.py status --output-dir OUT --state-file OUT/state.json

Check your work after every step:
    python3 labs/mod-4-2/check.py ~/seismic --step 1
    ...
    python3 labs/mod-4-2/check.py ~/seismic --step all

Exit codes:
    0 = sync / backfill completed successfully
    2 = fatal non-retryable error (e.g. HTTP 400 Bad Request, state preserved)
    anything else = crash
"""
import argparse
import json  # noqa: F401
import os  # noqa: F401
import sys
import time  # noqa: F401
import urllib.request  # noqa: F401
from pathlib import Path  # noqa: F401

try:
    import duckdb  # noqa: F401
except ImportError:
    print("duckdb is required. Run: pip install duckdb pyarrow", file=sys.stderr)
    sys.exit(1)


def run_ingest(args):
    # TODO Step 2: Fetch paginated GeoJSON from args.api_url with limit and offset.
    #              Store records into <args.output_dir>/warehouse.duckdb (table events).
    #              Extract latitude = coords[1], longitude = coords[0], depth = coords[2].
    # TODO Step 3: Implement watermark-based state persistence in args.state_file.
    #              Ensure atomic write (write to .tmp and replace) so crash mid-sync never corrupts state.
    #              high_watermark_epoch_ms = the largest properties.updated you have COMMITTED; resume with the updatedafter parameter.
    # TODO Step 4: Add HTTP retry loop with exponential backoff on HTTP 429 (Retry-After) and 5xx.
    #              On fatal HTTP 400 or auth error, exit with code 2.
    # TODO Step 5: Route invalid records (bad coords, missing ID, invalid time) to <args.output_dir>/dlq/rejected.jsonl.
    #              Upsert existing records in DuckDB: replace if incoming updated_epoch_ms >= existing.
    print("not implemented yet: ingest", file=sys.stderr)
    sys.exit(1)


def run_backfill(args):
    # TODO Step 5: Backfill historical events between args.start and args.end into warehouse.duckdb.
    #              CRITICAL: Do NOT alter or advance the production high-watermark in args.state_file!
    print("not implemented yet: backfill", file=sys.stderr)
    sys.exit(1)


def run_status(args):
    # TODO: Print current state and record counts
    print("not implemented yet: status", file=sys.stderr)
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Seismic Data Incremental Ingestion Pipeline")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    p_ingest = subparsers.add_parser("ingest")
    p_ingest.add_argument("--api-url", required=True, help="Base API URL")
    p_ingest.add_argument("--output-dir", required=True, help="Target storage directory")
    p_ingest.add_argument("--state-file", required=True, help="Path to state.json checkpoint")
    p_ingest.add_argument("--batch-size", type=int, default=100, help="Page limit")
    
    p_backfill = subparsers.add_parser("backfill")
    p_backfill.add_argument("--api-url", required=True, help="Base API URL")
    p_backfill.add_argument("--output-dir", required=True, help="Target storage directory")
    p_backfill.add_argument("--state-file", default=None, help="Production checkpoint: accepted but NEVER modified by a backfill")
    p_backfill.add_argument("--start", required=True, help="Start date (YYYY-MM-DD)")
    p_backfill.add_argument("--end", required=True, help="End date (YYYY-MM-DD)")
    p_backfill.add_argument("--batch-size", type=int, default=100, help="Page limit")
    
    p_status = subparsers.add_parser("status")
    p_status.add_argument("--output-dir", required=True, help="Target storage directory")
    p_status.add_argument("--state-file", required=True, help="Path to state.json checkpoint")
    
    args = parser.parse_args()
    if args.command == "ingest":
        return run_ingest(args)
    elif args.command == "backfill":
        return run_backfill(args)
    elif args.command == "status":
        return run_status(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())

