#!/usr/bin/env python3
"""Capstone 4.1: your taxi pipeline. Copy this file into your own workspace folder (for example ~/taxi) and build it there.

    python pipeline.py --trips yellow_tripdata_2024-01.parquet --zones taxi_zone_lookup.csv --out OUT

Everything you must produce is described in the lesson "The contract" and in the five steps of the lab. This file only gives you the command
line and the list of the 19 columns of the raw file. The rest is yours. Run  python3 labs/mod-4-1/check.py ~/taxi --step N  after each step.

Exit codes: 0 = the delivery was processed; 2 = a quality gate refused the delivery (and NOTHING in --out changed); anything else = a crash.
"""
import argparse
import json  # noqa: F401
import sys  # noqa: F401

import duckdb  # noqa: F401

RAW_COLUMNS = ["VendorID", "tpep_pickup_datetime", "tpep_dropoff_datetime", "passenger_count", "trip_distance", "RatecodeID",
               "store_and_fwd_flag", "PULocationID", "DOLocationID", "payment_type", "fare_amount", "extra", "mta_tax", "tip_amount",
               "tolls_amount", "improvement_surcharge", "total_amount", "congestion_surcharge", "Airport_fee"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--trips", required=True, help="the delivery: a Parquet file with the 19 raw columns")
    ap.add_argument("--zones", required=True, help="taxi_zone_lookup.csv")
    ap.add_argument("--out", required=True, help="the output folder")
    args = ap.parse_args()

    # TODO step 2: remove identical duplicate rows, label the first broken rule of each row, write OUT/clean/trips.parquet,
    #              OUT/rejected/trips_rejected.parquet and OUT/quality_report.json
    # TODO step 3: build OUT/warehouse.duckdb with dim_zone, dim_date, dim_payment and fact_trip
    # TODO step 4: add mart_daily and mart_top_routes to the same DuckDB file
    # TODO step 5: quality gates (exit code 2), and write the output so that a failed or repeated run is safe
    print(f"not implemented yet: would process {args.trips} into {args.out}", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
