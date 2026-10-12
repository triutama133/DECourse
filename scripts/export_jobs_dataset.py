#!/usr/bin/env python3
"""Export real Indonesian job postings dataset from Supabase TalentHub.

Usage:
    python3 scripts/export_jobs_dataset.py
    python3 scripts/export_jobs_dataset.py --output data/jobs --limit 5000
    python3 scripts/export_jobs_dataset.py --active-only

Reads Supabase credentials from .env and fetches records in paginated batches.
Saves to data/jobs/raw_jobs.jsonl and data/jobs/raw_jobs.parquet (if pyarrow/duckdb available).
"""
import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_env(env_path: Path) -> dict:
    env = {}
    if not env_path.is_file():
        return env
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip("'\"")
    return env


def fetch_batch(base_url: str, api_key: str, offset: int, limit: int, active_only: bool = False) -> list:
    params = [
        ("select", "id,job_title,company,platform,job_url,description,job_desk,requirements,is_active,last_checked,status_reason,created_at,category,salary,source"),
        ("order", "id.asc"),
        ("limit", str(limit)),
        ("offset", str(offset)),
    ]
    if active_only:
        params.append(("is_active", "eq.true"))

    query_str = urllib.parse.urlencode(params)
    url = f"{base_url.rstrip('/')}/rest/v1/jobs?{query_str}"

    req = urllib.request.Request(
        url,
        headers={
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
            "User-Agent": "DataForge-Course-Exporter/1.0",
        },
    )

    max_retries = 3
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            if attempt == max_retries - 1:
                raise RuntimeError(f"Failed to fetch batch offset={offset}: {e}") from e
            time.sleep(2 ** attempt)
    return []


def get_total_count(base_url: str, api_key: str, active_only: bool = False) -> int:
    query = "?select=id" + ("&is_active=eq.true" if active_only else "")
    url = f"{base_url.rstrip('/')}/rest/v1/jobs{query}"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Range": "0-0",
            "Prefer": "count=exact",
        },
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        crange = resp.headers.get("Content-Range")
        if crange and "/" in crange:
            return int(crange.split("/")[-1])
    return 0


def main():
    parser = argparse.ArgumentParser(description="Export real job vacancies from Supabase to local dataset.")
    parser.add_argument("--output", "-o", default="data/jobs", help="Target output folder (default: data/jobs)")
    parser.add_argument("--batch-size", type=int, default=1000, help="Batch pagination size (default: 1000)")
    parser.add_argument("--limit", type=int, default=None, help="Max total rows to fetch (default: all)")
    parser.add_argument("--active-only", action="store_true", help="Fetch only active job postings (is_active=True)")
    args = parser.parse_args()

    env = load_env(ROOT / ".env")
    base_url = env.get("talenthub_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    api_key = (
        env.get("talenthub_SUPABASE_SERVICE_ROLE_KEY")
        or env.get("talenthub_PUBLIC_SUPABASE_ANON_KEY")
        or os.environ.get("SUPABASE_KEY")
    )

    if not base_url or not api_key:
        print("ERROR: Supabase URL and Key not found in .env or environment variables.")
        print("Expected talenthub_PUBLIC_SUPABASE_URL and talenthub_SUPABASE_SERVICE_ROLE_KEY in .env")
        sys.exit(1)

    print(f"Connecting to Supabase at: {base_url}")
    total_in_db = get_total_count(base_url, api_key, active_only=args.active_only)
    target_count = min(total_in_db, args.limit) if args.limit else total_in_db
    print(f"Total matching jobs in database: {total_in_db:,}")
    print(f"Target rows to export: {target_count:,} (batch size: {args.batch_size})")

    out_dir = ROOT / args.output
    out_dir.mkdir(parents=True, exist_ok=True)
    jsonl_path = out_dir / "raw_jobs.jsonl"
    parquet_path = out_dir / "raw_jobs.parquet"

    offset = 0
    all_rows = []
    t0 = time.time()

    with open(jsonl_path, "w", encoding="utf-8") as jsonl_file:
        while offset < target_count:
            batch_limit = min(args.batch_size, target_count - offset)
            batch = fetch_batch(base_url, api_key, offset=offset, limit=batch_limit, active_only=args.active_only)
            if not batch:
                break

            for row in batch:
                jsonl_file.write(json.dumps(row, ensure_ascii=False) + "\n")
                all_rows.append(row)

            offset += len(batch)
            pct = (offset / target_count) * 100
            print(f"  [{offset:,}/{target_count:,}] ({pct:5.1f}%) fetched... ({time.time() - t0:.1f}s elapsed)")

            if len(batch) < batch_limit:
                break

    dt = time.time() - t0
    jsonl_size_mb = jsonl_path.stat().st_size / (1024 * 1024)
    print(f"\nSUCCESS: Exported {len(all_rows):,} rows in {dt:.1f}s")
    print(f"  JSONL saved: {jsonl_path} ({jsonl_size_mb:.2f} MB)")

    # Attempt Parquet export
    parquet_saved = False
    try:
        import pyarrow as pa
        import pyarrow.parquet as pq

        table = pa.Table.from_pylist(all_rows)
        pq.write_table(table, parquet_path, compression="zstd")
        parquet_size_mb = parquet_path.stat().st_size / (1024 * 1024)
        print(f"  Parquet saved: {parquet_path} ({parquet_size_mb:.2f} MB, compressed with ZSTD)")
        parquet_saved = True
    except ImportError:
        try:
            import duckdb

            con = duckdb.connect()
            con.execute(f"COPY (SELECT * FROM read_json_auto('{jsonl_path}')) TO '{parquet_path}' (FORMAT PARQUET, COMPRESSION ZSTD)")
            parquet_size_mb = parquet_path.stat().st_size / (1024 * 1024)
            print(f"  Parquet saved: {parquet_path} ({parquet_size_mb:.2f} MB, DuckDB ZSTD)")
            parquet_saved = True
        except ImportError:
            print("  Note: pyarrow/duckdb not found in environment; skipped parquet conversion.")

    # Data profiling quick metrics
    active_count = sum(1 for r in all_rows if r.get("is_active"))
    with_salary = sum(1 for r in all_rows if r.get("salary"))
    print("\nDataset Summary:")
    print(f"  - Active jobs: {active_count:,} ({active_count / len(all_rows) * 100:.1f}%)")
    print(f"  - Jobs with salary string: {with_salary:,} ({with_salary / len(all_rows) * 100:.1f}%)")
    if parquet_saved:
        print(f"\nQuick DuckDB query example:")
        print(f"  duckdb -c \"SELECT platform, count(*), count(salary) FROM '{parquet_path}' GROUP BY 1;\"")


if __name__ == "__main__":
    main()
