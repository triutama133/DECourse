#!/usr/bin/env python3
"""Capstone 4.1 reference solution (try on your own first!).

    python pipeline.py --trips yellow_tripdata_2024-01.parquet --zones taxi_zone_lookup.csv --out OUT
"""
import argparse
import json
import os
import shutil
import sys
from pathlib import Path

import duckdb

RAW_COLUMNS = ["VendorID", "tpep_pickup_datetime", "tpep_dropoff_datetime", "passenger_count", "trip_distance", "RatecodeID",
               "store_and_fwd_flag", "PULocationID", "DOLocationID", "payment_type", "fare_amount", "extra", "mta_tax", "tip_amount",
               "tolls_amount", "improvement_surcharge", "total_amount", "congestion_surcharge", "Airport_fee"]
MAX_REJECT_RATE = 0.05
REASONS = ["pickup_outside_month", "dropoff_not_after_pickup", "trip_too_long", "non_positive_total", "implausible_distance"]

REASON_SQL = """CASE
  WHEN tpep_pickup_datetime < TIMESTAMP '2024-01-01' OR tpep_pickup_datetime >= TIMESTAMP '2024-02-01' THEN 'pickup_outside_month'
  WHEN tpep_dropoff_datetime <= tpep_pickup_datetime THEN 'dropoff_not_after_pickup'
  WHEN tpep_dropoff_datetime - tpep_pickup_datetime > INTERVAL 24 HOUR THEN 'trip_too_long'
  WHEN total_amount <= 0 THEN 'non_positive_total'
  WHEN trip_distance > 100 THEN 'implausible_distance'
END"""

PAYMENT_SQL = """CASE payment_type WHEN 0 THEN 'Flex Fare' WHEN 1 THEN 'Credit card' WHEN 2 THEN 'Cash' WHEN 3 THEN 'No charge'
  WHEN 4 THEN 'Dispute' WHEN 5 THEN 'Unknown' WHEN 6 THEN 'Voided' ELSE 'Unknown' END"""
RATE_SQL = """CASE RatecodeID WHEN 1 THEN 'Standard' WHEN 2 THEN 'JFK' WHEN 3 THEN 'Newark' WHEN 4 THEN 'Nassau/Westchester'
  WHEN 5 THEN 'Negotiated' WHEN 6 THEN 'Group ride' ELSE 'Unknown' END"""
PAYMENT_METHODS = ["Flex Fare", "Credit card", "Cash", "No charge", "Dispute", "Unknown", "Voided"]


def lit(path):
    """A path as a SQL string literal."""
    return "'" + str(path).replace("'", "''") + "'"


def fail(reason, **details):
    """A failed quality gate: report on stderr, change NOTHING in the output folder, exit with code 2."""
    print(json.dumps({"status": "failed", "failure": reason, **details}), file=sys.stderr)
    sys.exit(2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--trips", required=True)
    ap.add_argument("--zones", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    out = Path(a.out)

    con = duckdb.connect()
    con.execute(f"CREATE VIEW raw AS SELECT * FROM read_parquet({lit(a.trips)})")
    have = [r[0] for r in con.execute("DESCRIBE raw").fetchall()]
    missing = [c for c in RAW_COLUMNS if c not in have]
    if missing:
        fail("missing_columns", missing=missing)
    rows_in = con.execute("SELECT count(*) FROM raw").fetchone()[0]
    if rows_in == 0:
        fail("empty_delivery")

    # 1. one copy of every identical row; 2. label rows that break a rule (first matching rule wins)
    con.execute(f"CREATE TABLE flagged AS SELECT *, {REASON_SQL} AS reject_reason FROM (SELECT DISTINCT * FROM raw)")
    rows_dedup = con.execute("SELECT count(*) FROM flagged").fetchone()[0]
    by_reason = dict(con.execute("SELECT reject_reason, count(*) FROM flagged WHERE reject_reason IS NOT NULL GROUP BY 1").fetchall())
    rows_rejected = sum(by_reason.values())
    reject_rate = rows_rejected / rows_dedup
    if reject_rate > MAX_REJECT_RATE:
        fail("too_many_rejected", reject_rate=round(reject_rate, 4), limit=MAX_REJECT_RATE)

    # everything below is written into a temporary folder and swapped in at the end, so a crash never leaves half an output
    tmp = out.with_name(out.name + f".tmp{os.getpid()}")
    if tmp.exists():
        shutil.rmtree(tmp)
    (tmp / "clean").mkdir(parents=True)
    (tmp / "rejected").mkdir()

    con.execute(f"COPY (SELECT * EXCLUDE (reject_reason), reject_reason FROM flagged WHERE reject_reason IS NOT NULL) "
                f"TO {lit(tmp / 'rejected' / 'trips_rejected.parquet')} (FORMAT parquet)")
    con.execute(f"""
        CREATE TABLE clean AS
        SELECT hash({", ".join(RAW_COLUMNS)}) AS trip_id,
               CAST(VendorID AS INTEGER) AS vendor_id,
               tpep_pickup_datetime AS pickup_at,
               tpep_dropoff_datetime AS dropoff_at,
               CAST(passenger_count AS INTEGER) AS passenger_count,
               trip_distance AS trip_distance_miles,
               {RATE_SQL} AS rate_code,
               CAST(PULocationID AS INTEGER) AS pickup_zone_id,
               CAST(DOLocationID AS INTEGER) AS dropoff_zone_id,
               {PAYMENT_SQL} AS payment_method,
               fare_amount, tip_amount, tolls_amount, total_amount,
               date_diff('second', tpep_pickup_datetime, tpep_dropoff_datetime) / 60.0 AS trip_minutes,
               CAST(tpep_pickup_datetime AS DATE) AS pickup_date
        FROM flagged WHERE reject_reason IS NULL""")
    con.execute(f"COPY clean TO {lit(tmp / 'clean' / 'trips.parquet')} (FORMAT parquet)")
    rows_clean = con.execute("SELECT count(*) FROM clean").fetchone()[0]

    # warehouse: a small star schema plus two marts
    wh = duckdb.connect(str(tmp / "warehouse.duckdb"))
    wh.execute(f"CREATE TABLE clean AS SELECT * FROM read_parquet({lit(tmp / 'clean' / 'trips.parquet')})")
    wh.execute(f"""CREATE TABLE dim_zone AS SELECT CAST(LocationID AS INTEGER) AS zone_id, Borough AS borough, Zone AS zone, service_zone
                  FROM read_csv({lit(a.zones)}, header = true)""")
    wh.execute("""CREATE TABLE dim_date AS
                  SELECT CAST(strftime(d, '%Y%m%d') AS INTEGER) AS date_key, CAST(d AS DATE) AS date, dayname(d) AS day_of_week,
                         isodow(d) >= 6 AS is_weekend
                  FROM (SELECT unnest(generate_series(min(pickup_date), max(pickup_date), INTERVAL 1 DAY)) AS d FROM clean)""")
    values = ", ".join(f"({i}, {lit(m)})" for i, m in enumerate(PAYMENT_METHODS, start=1))
    wh.execute(f"CREATE TABLE dim_payment AS SELECT * FROM (VALUES {values}) AS t(payment_key, payment_method)")
    wh.execute("""CREATE TABLE fact_trip AS
                  SELECT c.trip_id, CAST(strftime(c.pickup_date, '%Y%m%d') AS INTEGER) AS pickup_date_key, c.pickup_zone_id, c.dropoff_zone_id,
                         p.payment_key, c.passenger_count, c.trip_distance_miles, c.trip_minutes, c.fare_amount, c.tip_amount, c.total_amount
                  FROM clean c JOIN dim_payment p USING (payment_method)""")
    wh.execute("""CREATE TABLE mart_daily AS
                  SELECT pickup_date, count(*) AS trips, sum(total_amount) AS revenue,
                         round(100 * sum(tip_amount) FILTER (WHERE payment_method = 'Credit card')
                                   / sum(fare_amount) FILTER (WHERE payment_method = 'Credit card'), 2) AS avg_tip_pct
                  FROM clean GROUP BY pickup_date ORDER BY pickup_date""")
    wh.execute("""CREATE TABLE mart_top_routes AS
                  SELECT r.pickup_zone_id, r.dropoff_zone_id, pz.zone AS pickup_zone, dz.zone AS dropoff_zone, r.trips, r.avg_minutes
                  FROM (SELECT pickup_zone_id, dropoff_zone_id, count(*) AS trips, round(avg(trip_minutes), 1) AS avg_minutes
                        FROM clean GROUP BY 1, 2 ORDER BY trips DESC, pickup_zone_id, dropoff_zone_id LIMIT 10) r
                  JOIN dim_zone pz ON pz.zone_id = r.pickup_zone_id JOIN dim_zone dz ON dz.zone_id = r.dropoff_zone_id
                  ORDER BY r.trips DESC, r.pickup_zone_id, r.dropoff_zone_id""")
    wh.execute("DROP TABLE clean")
    wh.close()

    report = {"status": "passed", "rows_in": rows_in, "duplicates_removed": rows_in - rows_dedup, "rows_rejected": rows_rejected,
              "rows_clean": rows_clean, "reject_rate": round(reject_rate, 4), "rejected_by_reason": {r: by_reason.get(r, 0) for r in REASONS}}
    (tmp / "quality_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    old = out.with_name(out.name + f".old{os.getpid()}")
    if out.exists():
        out.rename(old)
    tmp.rename(out)
    if old.exists():
        shutil.rmtree(old)
    print(json.dumps(report))


if __name__ == "__main__":
    main()
