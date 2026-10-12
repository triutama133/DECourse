#!/usr/bin/env python3
"""Reference solution for Capstone 4.2: Fault-Tolerant Incremental API Ingestion & Checkpointing.

Extracts seismic event data from USGS GeoJSON API, handles rate-limits & retries, routes bad records
to a Dead-Letter Queue (DLQ), upserts into a DuckDB lakehouse table, and commits state atomically.
"""
import argparse
import datetime
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

try:
    import duckdb
except ImportError:
    print("duckdb is required. Run: pip install duckdb pyarrow", file=sys.stderr)
    sys.exit(1)


def fetch_with_retry(url, max_retries=3, base_backoff=1.0):
    """Fetch URL with exponential backoff on HTTP 429 and 5xx errors."""
    for attempt in range(max_retries + 1):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "DataForge-DE-Course/1.0 (Capstone Ingest)"}
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read().decode("utf-8")
                return json.loads(data)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                retry_after = e.headers.get("Retry-After")
                sleep_secs = float(retry_after) if retry_after else (base_backoff * (2 ** attempt))
                time.sleep(sleep_secs)
                continue
            elif 500 <= e.code <= 599:
                if attempt < max_retries:
                    time.sleep(base_backoff * (2 ** attempt))
                    continue
                raise
            else:
                # Fatal 4xx error (e.g. 400 Bad Request)
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt < max_retries:
                time.sleep(base_backoff * (2 ** attempt))
                continue
            raise
    raise RuntimeError(f"Failed to fetch {url} after {max_retries} retries")


def validate_feature(feat):
    """Validate a GeoJSON seismic feature. Returns (is_valid, error_code, reason)."""
    if not isinstance(feat, dict):
        return False, "MALFORMED_FEATURE", "Feature is not a dictionary"
    
    event_id = feat.get("id")
    if not event_id or not str(event_id).strip():
        return False, "MISSING_EVENT_ID", "Feature missing id"
    
    geom = feat.get("geometry")
    if not geom or not isinstance(geom, dict):
        return False, "MISSING_GEOMETRY", "Missing or invalid geometry object"
    
    coords = geom.get("coordinates")
    if not coords or not isinstance(coords, (list, tuple)) or len(coords) < 2:
        return False, "INVALID_COORDINATES", "Geometry coordinates must have at least [lon, lat]"
    
    lon, lat = coords[0], coords[1]
    if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
        return False, "INVALID_COORDINATES", "Coordinates must be numbers"
    
    if lat < -90.0 or lat > 90.0:
        return False, "INVALID_COORDINATES", f"Latitude {lat} out of range [-90, 90]"
    if lon < -180.0 or lon > 180.0:
        return False, "INVALID_COORDINATES", f"Longitude {lon} out of range [-180, 180]"
    
    props = feat.get("properties") or {}
    t = props.get("time")
    if t is None or not isinstance(t, (int, float)) or t < 0:
        return False, "INVALID_TIMESTAMP", f"Invalid event time: {t}"
    
    return True, None, None


def ensure_warehouse(db_path):
    conn = duckdb.connect(str(db_path))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS events (
            event_id VARCHAR PRIMARY KEY,
            time_epoch_ms BIGINT,
            time_utc TIMESTAMP,
            updated_epoch_ms BIGINT,
            updated_utc TIMESTAMP,
            latitude DOUBLE,
            longitude DOUBLE,
            depth_km DOUBLE,
            magnitude DOUBLE,
            mag_type VARCHAR,
            place VARCHAR,
            status VARCHAR,
            tsunami INTEGER,
            significance INTEGER,
            event_type VARCHAR,
            ingested_at_utc TIMESTAMP
        )
    """)
    conn.close()


def upsert_events(db_path, records):
    """Upsert validated records into DuckDB table events.

    If event_id exists, replace only if incoming updated_epoch_ms >= existing updated_epoch_ms.
    """
    if not records:
        return 0
    conn = duckdb.connect(str(db_path))
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    
    rows = []
    for r in records:
        t_epoch = r["properties"]["time"]
        u_epoch = r["properties"].get("updated") or t_epoch
        t_utc = datetime.datetime.fromtimestamp(t_epoch / 1000.0, tz=datetime.timezone.utc)
        u_utc = datetime.datetime.fromtimestamp(u_epoch / 1000.0, tz=datetime.timezone.utc)
        coords = r["geometry"]["coordinates"]
        lon = float(coords[0])
        lat = float(coords[1])
        depth = float(coords[2]) if len(coords) > 2 and coords[2] is not None else 0.0
        props = r["properties"]
        mag = float(props["mag"]) if props.get("mag") is not None else None
        
        rows.append((
            str(r["id"]),
            int(t_epoch),
            t_utc,
            int(u_epoch),
            u_utc,
            lat,
            lon,
            depth,
            mag,
            str(props.get("magType") or ""),
            str(props.get("place") or ""),
            str(props.get("status") or ""),
            int(props.get("tsunami") or 0),
            int(props.get("sig") or 0),
            str(props.get("type") or "earthquake"),
            now_utc
        ))
    
    conn.execute("CREATE TEMP TABLE batch_events AS SELECT * FROM events WHERE 1=0")
    conn.executemany("""
        INSERT INTO batch_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)
    
    # Deduplicate within batch keeping highest updated_epoch_ms
    conn.execute("""
        CREATE TEMP TABLE dedup_batch AS
        SELECT * EXCLUDE (rn) FROM (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY updated_epoch_ms DESC) as rn
            FROM batch_events
        ) WHERE rn = 1
    """)
    
    # Delete existing rows where incoming has >= updated_epoch_ms
    conn.execute("""
        DELETE FROM events
        WHERE event_id IN (
            SELECT b.event_id FROM dedup_batch b
            JOIN events e ON b.event_id = e.event_id
            WHERE b.updated_epoch_ms >= e.updated_epoch_ms
        )
    """)
    
    # Insert from dedup_batch those that do not exist in events
    conn.execute("""
        INSERT INTO events
        SELECT * FROM dedup_batch
        WHERE event_id NOT IN (SELECT event_id FROM events)
    """)
    
    conn.close()
    return len(rows)


def write_dlq(output_dir, invalid_records):
    """Write rejected records to DLQ JSON lines file."""
    if not invalid_records:
        return 0
    dlq_dir = Path(output_dir) / "dlq"
    dlq_dir.mkdir(parents=True, exist_ok=True)
    dlq_file = dlq_dir / "rejected.jsonl"
    with open(dlq_file, "a", encoding="utf-8") as f:
        for item in invalid_records:
            f.write(json.dumps(item) + "\n")
    return len(invalid_records)


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
    """Atomically commit checkpoint state to disk."""
    if not state_file:
        return
    p = Path(state_file)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(state_data, indent=2), encoding="utf-8")
    tmp.replace(p)


def run_ingest(args):
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    db_path = out_dir / "warehouse.duckdb"
    ensure_warehouse(db_path)
    
    state = load_state(args.state_file)
    query_start_epoch = state.get("high_watermark_epoch_ms", 0)
    total_ingested = state.get("total_records_ingested", 0)
    total_dlq = state.get("total_dlq_records", 0)
    
    base_url = args.api_url
    limit = args.batch_size
    offset = 1
    new_watermark = query_start_epoch
    
    while True:
        params = {
            "format": "geojson",
            "limit": limit,
            "offset": offset,
            "orderby": "time-asc"
        }
        if query_start_epoch > 0:
            # Ask only for events CREATED OR REVISED since the last committed watermark (the 'updated' time, not the event time).
            # One second of overlap is deliberate: re-reading a few records is harmless because the upsert is idempotent.
            since = datetime.datetime.fromtimestamp((query_start_epoch - 1000) / 1000.0, tz=datetime.timezone.utc)
            params["updatedafter"] = since.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]
        
        url_parts = list(urllib.parse.urlparse(base_url))
        query = dict(urllib.parse.parse_qsl(url_parts[4]))
        query.update(params)
        url_parts[4] = urllib.parse.urlencode(query)
        req_url = urllib.parse.urlunparse(url_parts)
        
        try:
            payload = fetch_with_retry(req_url)
        except urllib.error.HTTPError as e:
            if 400 <= e.code < 500 and e.code != 429:
                print(f"FATAL: Client error HTTP {e.code} for URL {req_url}", file=sys.stderr)
                sys.exit(2)
            raise
        
        features = payload.get("features", [])
        if not features:
            break
        
        valid_records = []
        invalid_records = []
        page_watermark = new_watermark
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        for f in features:
            ok, err_code, reason = validate_feature(f)
            if ok:
                valid_records.append(f)
                feat_updated = f["properties"].get("updated") or f["properties"]["time"]
                if feat_updated > page_watermark:
                    page_watermark = feat_updated
            else:
                invalid_records.append({
                    "error_code": err_code,
                    "reason": reason,
                    "failed_at": now_iso,
                    "raw_payload": f
                })
        
        # 1. Commit records to analytical store
        if valid_records:
            upsert_events(db_path, valid_records)
            total_ingested += len(valid_records)
        
        # 2. Commit DLQ records
        if invalid_records:
            write_dlq(out_dir, invalid_records)
            total_dlq += len(invalid_records)
        
        # 3. Commit state checkpoint atomically per page (only now: the data of this page is safely in DuckDB)
        new_watermark = page_watermark
        watermark_iso = datetime.datetime.fromtimestamp(
            new_watermark / 1000.0, tz=datetime.timezone.utc
        ).isoformat() if new_watermark > 0 else None
        
        state_data = {
            "high_watermark_epoch_ms": new_watermark,
            "high_watermark_iso": watermark_iso,
            "last_sync_utc": now_iso,
            "total_records_ingested": total_ingested,
            "total_dlq_records": total_dlq
        }
        save_state_atomic(args.state_file, state_data)
        
        if len(features) < limit:
            break
        offset += len(features)
    
    print(f"Ingest complete. Total ingested: {total_ingested}, DLQ: {total_dlq}, Watermark: {new_watermark}")
    return 0


def run_backfill(args):
    """Historical backfill. It receives --state-file only so that the caller can prove it is never written: do not touch it."""
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    db_path = out_dir / "warehouse.duckdb"
    ensure_warehouse(db_path)
    
    base_url = args.api_url
    limit = args.batch_size
    offset = 1
    total_backfilled = 0
    total_dlq = 0
    
    while True:
        params = {
            "format": "geojson",
            "limit": limit,
            "offset": offset,
            "starttime": args.start,
            "endtime": args.end,
            "orderby": "time-asc"
        }
        url_parts = list(urllib.parse.urlparse(base_url))
        query = dict(urllib.parse.parse_qsl(url_parts[4]))
        query.update(params)
        url_parts[4] = urllib.parse.urlencode(query)
        req_url = urllib.parse.urlunparse(url_parts)
        
        try:
            payload = fetch_with_retry(req_url)
        except urllib.error.HTTPError as e:
            if 400 <= e.code < 500 and e.code != 429:
                print(f"FATAL: Client error HTTP {e.code} for URL {req_url}", file=sys.stderr)
                sys.exit(2)
            raise
        
        features = payload.get("features", [])
        if not features:
            break
        
        valid_records = []
        invalid_records = []
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        for f in features:
            ok, err_code, reason = validate_feature(f)
            if ok:
                valid_records.append(f)
            else:
                invalid_records.append({
                    "error_code": err_code,
                    "reason": reason,
                    "failed_at": now_iso,
                    "raw_payload": f
                })
        
        if valid_records:
            upsert_events(db_path, valid_records)
            total_backfilled += len(valid_records)
        
        if invalid_records:
            write_dlq(out_dir, invalid_records)
            total_dlq += len(invalid_records)
        
        if len(features) < limit:
            break
        offset += len(features)
    
    print(f"Backfill complete for {args.start} to {args.end}. Records: {total_backfilled}, DLQ: {total_dlq}")
    return 0


def run_status(args):
    state = load_state(args.state_file)
    out_dir = Path(args.output_dir)
    db_path = out_dir / "warehouse.duckdb"
    count = 0
    if db_path.is_file():
        conn = duckdb.connect(str(db_path))
        count = conn.execute("SELECT count(*) FROM events").fetchone()[0]
        conn.close()
    
    print(f"High Watermark Epoch: {state.get('high_watermark_epoch_ms', 'None')}")
    print(f"High Watermark ISO  : {state.get('high_watermark_iso', 'None')}")
    print(f"Warehouse Events    : {count}")
    print(f"Total DLQ Records   : {state.get('total_dlq_records', 0)}")
    return 0


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

