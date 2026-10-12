#!/usr/bin/env python3
"""Checks your work in Capstone 4.1 (NYC taxi pipeline), one step at a time.

    python3 labs/mod-4-1/check.py ~/taxi --step 1          # your profile.json
    python3 labs/mod-4-1/check.py ~/taxi --step 2          # clean and rejected data
    python3 labs/mod-4-1/check.py ~/taxi --step 3          # the star schema
    python3 labs/mod-4-1/check.py ~/taxi --step 4          # the marts
    python3 labs/mod-4-1/check.py ~/taxi --step 5          # reruns, duplicate delivery, quality gates
    python3 labs/mod-4-1/check.py ~/taxi --step all        # everything (this is what the proof code runs)
    python3 labs/mod-4-1/check.py ~/taxi --step 2 --hint 1 # a hint for step 2 (levels 1, 2, 3: the higher, the closer to the answer)

~/taxi is YOUR workspace folder: it holds your pipeline.py and your profile.json. The checker runs your pipeline.py on the real data and on
broken deliveries it makes itself, and compares what comes out with answers it computes independently from the raw file.
It prints PASS or FAIL per requirement and, for a failure, a short hint. Needs: pip install duckdb pyarrow
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

try:
    import duckdb
except ImportError:
    print("duckdb is not installed in this Python. Activate your virtual environment and run:  pip install duckdb pyarrow")
    sys.exit(1)

HERE = Path(__file__).resolve().parent
TRIPS = HERE / "data" / "yellow_tripdata_2024-01.parquet"
ZONES = HERE / "data" / "taxi_zone_lookup.csv"
RAW_COLUMNS = ["VendorID", "tpep_pickup_datetime", "tpep_dropoff_datetime", "passenger_count", "trip_distance", "RatecodeID",
               "store_and_fwd_flag", "PULocationID", "DOLocationID", "payment_type", "fare_amount", "extra", "mta_tax", "tip_amount",
               "tolls_amount", "improvement_surcharge", "total_amount", "congestion_surcharge", "Airport_fee"]
RUN_TIMEOUT = 900

# ---------------------------------------------------------------------------------------------------------------- hints
HINTS = {
    1: ["DuckDB can query a Parquet file directly:  SELECT count(*) FROM 'yellow_tripdata_2024-01.parquet'.  Start with DESCRIBE to see the columns.",
        "Every number in profile.json is one query over the RAW file: a count with a WHERE condition, a COUNT(DISTINCT ...), or a GROUP BY with ORDER BY count DESC LIMIT 1. Read the definition of each key in the lesson again.",
        "Example:  SELECT count(*) FROM 'file.parquet' WHERE tpep_dropoff_datetime <= tpep_pickup_datetime.  For the busiest zone: SELECT PULocationID, count(*) c FROM ... GROUP BY 1 ORDER BY c DESC LIMIT 1. Write the answers as JSON numbers."],
    2: ["Work in this order: drop identical duplicate rows, label the FIRST rule every row breaks, then split into clean and rejected. Write the rule order on paper before you code.",
        "In SQL, a CASE expression returns the first WHEN that matches, which is exactly 'the first rule wins'. The rejected file keeps the 19 original columns plus reject_reason. Compare your counts per reason with step 1: a row that breaks two rules is counted once here.",
        "hash(col1, col2, ...) gives a deterministic 64-bit trip_id. COPY (SELECT ...) TO 'file.parquet' (FORMAT parquet) writes a Parquet file. payment_method and rate_code are CASE expressions over the codes in the lesson; date_diff('second', a, b) / 60.0 gives minutes."],
    3: ["Build the dimensions first, then the fact table with only ids and measures. fact_trip has exactly one row per clean trip.",
        "dim_date: one row per calendar day from the first to the last pickup date (generate_series), is_weekend from isodow(date) >= 6. dim_payment: seven rows, one per payment method name. dim_zone comes straight from the zone CSV (rename the columns).",
        "Open a DuckDB FILE with duckdb.connect('OUT/warehouse.duckdb') and use CREATE TABLE ... AS SELECT .... Join the clean trips to dim_payment on payment_method to get payment_key, and compute date_key as pickup date written as YYYYMMDD."],
    4: ["The marts are GROUP BYs over the clean trips. Use exactly the definitions in the lesson.",
        "Group routes by the two zone ids, never by zone names: two different zone ids can share a name (Corona, ids 56 and 57). Break ties by pickup_zone_id, then dropoff_zone_id, so the top 10 is the same every run.",
        "avg_tip_pct = 100 * SUM(tip_amount) / SUM(fare_amount) over the 'Credit card' rows only: SUM(tip_amount) FILTER (WHERE payment_method = 'Credit card'). Round to 2 decimals. Take the zone names from dim_zone."],
    5: ["Think about what happens when the same file arrives twice, when a column disappears, and when most rows are broken. Decide which runs may change the output folder and which must leave it exactly as it was.",
        "Check the gates BEFORE writing anything. Build the new output in a temporary folder next to --out and rename it into place only at the very end, then delete the old one. Deduplicate before you apply the rules and compute the reject rate on the deduplicated rows.",
        "A failed gate: print one JSON line on stderr and call sys.exit(2). Gates: a required column missing, zero rows, or reject_rate above 0.05. SELECT DISTINCT * removes identical rows; rows_in - rows after DISTINCT is duplicates_removed."],
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


# ---------------------------------------------------------------------------------------------------------------- truth (computed from the raw file)
REASON_CASE = """CASE
  WHEN tpep_pickup_datetime < TIMESTAMP '2024-01-01' OR tpep_pickup_datetime >= TIMESTAMP '2024-02-01' THEN 'pickup_outside_month'
  WHEN tpep_dropoff_datetime <= tpep_pickup_datetime THEN 'dropoff_not_after_pickup'
  WHEN tpep_dropoff_datetime - tpep_pickup_datetime > INTERVAL 24 HOUR THEN 'trip_too_long'
  WHEN total_amount <= 0 THEN 'non_positive_total'
  WHEN trip_distance > 100 THEN 'implausible_distance'
END"""
_truth = {}


def truth():
    if _truth:
        return _truth
    con = duckdb.connect()
    con.execute(f"CREATE VIEW raw AS SELECT * FROM read_parquet('{TRIPS}')")
    con.execute(f"CREATE TABLE flagged AS SELECT *, {REASON_CASE} AS reason FROM (SELECT DISTINCT * FROM raw)")
    one = lambda sql: con.execute(sql).fetchone()
    t = _truth
    t["profile"] = {
        "rows_total": one("SELECT count(*) FROM raw")[0],
        "pickup_outside_month": one("SELECT count(*) FROM raw WHERE tpep_pickup_datetime < TIMESTAMP '2024-01-01' OR tpep_pickup_datetime >= TIMESTAMP '2024-02-01'")[0],
        "dropoff_not_after_pickup": one("SELECT count(*) FROM raw WHERE tpep_dropoff_datetime <= tpep_pickup_datetime")[0],
        "null_passenger_count": one("SELECT count(*) FROM raw WHERE passenger_count IS NULL")[0],
        "non_positive_total": one("SELECT count(*) FROM raw WHERE total_amount <= 0")[0],
        "distance_over_100": one("SELECT count(*) FROM raw WHERE trip_distance > 100")[0],
        "distinct_pickup_zones": one("SELECT count(DISTINCT PULocationID) FROM raw")[0],
        "busiest_pickup_zone_id": one("SELECT PULocationID FROM raw GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1")[0],
        "cash_trips_with_tip": one("SELECT count(*) FROM raw WHERE payment_type = 2 AND tip_amount > 0")[0],
    }
    t["rows_dedup"] = one("SELECT count(*) FROM flagged")[0]
    t["by_reason"] = dict(con.execute("SELECT reason, count(*) FROM flagged WHERE reason IS NOT NULL GROUP BY 1").fetchall())
    t["rows_rejected"] = sum(t["by_reason"].values())
    t["rows_clean"] = t["rows_dedup"] - t["rows_rejected"]
    pay = ("CASE payment_type WHEN 0 THEN 'Flex Fare' WHEN 1 THEN 'Credit card' WHEN 2 THEN 'Cash' WHEN 3 THEN 'No charge' WHEN 4 THEN 'Dispute' "
           "WHEN 5 THEN 'Unknown' WHEN 6 THEN 'Voided' ELSE 'Unknown' END")
    rate = ("CASE RatecodeID WHEN 1 THEN 'Standard' WHEN 2 THEN 'JFK' WHEN 3 THEN 'Newark' WHEN 4 THEN 'Nassau/Westchester' WHEN 5 THEN 'Negotiated' "
            "WHEN 6 THEN 'Group ride' ELSE 'Unknown' END")
    con.execute(f"""CREATE TABLE clean AS SELECT CAST(PULocationID AS INTEGER) pu, CAST(DOLocationID AS INTEGER) do_, {pay} AS payment, {rate} AS rate,
                    passenger_count, fare_amount, tip_amount, total_amount, CAST(tpep_pickup_datetime AS DATE) AS d,
                    date_diff('second', tpep_pickup_datetime, tpep_dropoff_datetime) / 60.0 AS minutes FROM flagged WHERE reason IS NULL""")
    t["sum_total"] = one("SELECT sum(total_amount) FROM clean")[0]
    t["sum_minutes"] = one("SELECT sum(minutes) FROM clean")[0]
    t["null_passengers_clean"] = one("SELECT count(*) FROM clean WHERE passenger_count IS NULL")[0]
    t["payment"] = dict(con.execute("SELECT payment, count(*) FROM clean GROUP BY 1").fetchall())
    t["rate"] = dict(con.execute("SELECT rate, count(*) FROM clean GROUP BY 1").fetchall())
    t["daily"] = {str(d): (n, rev, tip) for d, n, rev, tip in con.execute(
        """SELECT d, count(*), sum(total_amount),
                  round(100 * sum(tip_amount) FILTER (WHERE payment = 'Credit card') / sum(fare_amount) FILTER (WHERE payment = 'Credit card'), 2)
           FROM clean GROUP BY d""").fetchall()}
    t["routes"] = con.execute("""SELECT pu, do_, count(*) AS trips, round(avg(minutes), 1) FROM clean GROUP BY 1, 2
                                 ORDER BY trips DESC, pu, do_ LIMIT 10""").fetchall()
    zones = duckdb.connect().execute(f"SELECT CAST(LocationID AS INTEGER), Zone FROM read_csv('{ZONES}', header = true)").fetchall()
    t["zone_names"] = dict(zones)
    t["zone_count"] = len(zones)
    t["days"] = sorted(t["daily"])
    return t


# ---------------------------------------------------------------------------------------------------------------- running the learner's pipeline
def run_pipeline(ws, trips, out, label):
    t0 = time.time()
    try:
        p = subprocess.run([sys.executable, str(ws / "pipeline.py"), "--trips", str(trips), "--zones", str(ZONES), "--out", str(out)],
                           cwd=str(ws), capture_output=True, text=True, timeout=RUN_TIMEOUT)
    except subprocess.TimeoutExpired:
        return {"code": 124, "stderr": f"timed out after {RUN_TIMEOUT} s", "stdout": "", "secs": RUN_TIMEOUT}
    return {"code": p.returncode, "stdout": p.stdout, "stderr": p.stderr, "secs": time.time() - t0}


def tail(text, n=6):
    lines = [l for l in (text or "").strip().splitlines() if l.strip()]
    return " | ".join(lines[-n:])[:600]


def classes(con, sql):
    out = {}
    for name, typ, *_ in con.execute(f"DESCRIBE {sql}").fetchall():
        t = typ.upper()
        out[name] = ("int" if any(k in t for k in ("INT",)) and "INTERVAL" not in t else "float" if any(k in t for k in ("DOUBLE", "FLOAT", "DECIMAL", "REAL"))
                     else "timestamp" if "TIMESTAMP" in t else "date" if t == "DATE" else "text" if "VARCHAR" in t else "bool" if t == "BOOLEAN" else t.lower())
    return out


def tree_hash(folder):
    h = hashlib.sha256()
    for p in sorted(Path(folder).rglob("*")):
        if p.is_file():
            h.update(str(p.relative_to(folder)).encode())
            with open(p, "rb") as f:
                for block in iter(lambda: f.read(1 << 20), b""):
                    h.update(block)
    return h.hexdigest()


def fingerprint(out):
    """What a finished output folder contains, in numbers: used to compare runs with each other."""
    con = duckdb.connect(str(out / "warehouse.duckdb"), read_only=True)
    fact = con.execute("SELECT count(*), count(DISTINCT trip_id), round(sum(total_amount), 2), bit_xor(hash(trip_id)) FROM fact_trip").fetchone()
    clean = duckdb.connect().execute(f"SELECT count(*), round(sum(total_amount), 2), bit_xor(hash(trip_id)) FROM read_parquet('{out / 'clean' / 'trips.parquet'}')").fetchone()
    con.close()
    return (fact, clean)


# ---------------------------------------------------------------------------------------------------------------- steps
def step1(ws):
    print("\n== Step 1: profile the raw data (profile.json)")
    f = ws / "profile.json"
    if not check("profile.json exists in your workspace", f.is_file(), f"create {f} with the nine keys from the lesson"):
        return
    try:
        got = json.loads(f.read_text(encoding="utf-8"))
    except Exception as e:
        check("profile.json is valid JSON", False, str(e))
        return
    for key, want in truth()["profile"].items():
        ok = key in got and isinstance(got[key], (int, float)) and not isinstance(got[key], bool) and got[key] == want
        check(f"profile.json: {key}", ok, "missing" if key not in got else f"your value {got[key]!r} is not what the raw file gives; re-read the definition and re-run your query")


def base_run(ws, ctx):
    if "base" in ctx:
        return ctx["base"]
    if not (ws / "pipeline.py").is_file():
        check("pipeline.py exists in your workspace", False, f"create {ws / 'pipeline.py'} (start from labs/mod-4-1/starter/pipeline.py)")
        ctx["base"] = None
        return None
    r = run_pipeline(ws, TRIPS, ctx["out"], "base")
    ok = check(f"pipeline.py runs on the January file and exits with code 0 ({r['secs']:.0f} s)", r["code"] == 0,
               f"exit code {r['code']}. Last output: {tail(r['stderr'] or r['stdout'])}")
    ctx["base"] = r if ok else None
    return ctx["base"]


CLEAN_COLS = {"trip_id": "any", "vendor_id": "int", "pickup_at": "timestamp", "dropoff_at": "timestamp", "passenger_count": "int",
              "trip_distance_miles": "float", "rate_code": "text", "pickup_zone_id": "int", "dropoff_zone_id": "int", "payment_method": "text",
              "fare_amount": "float", "tip_amount": "float", "tolls_amount": "float", "total_amount": "float", "trip_minutes": "float",
              "pickup_date": "date"}


def step2(ws, ctx):
    print("\n== Step 2: clean data, rejected data and the quality report")
    if not base_run(ws, ctx):
        return
    out, t = ctx["out"], truth()
    clean_f, rej_f, rep_f = out / "clean" / "trips.parquet", out / "rejected" / "trips_rejected.parquet", out / "quality_report.json"
    check("OUT/clean/trips.parquet exists", clean_f.is_file(), "write the cleaned trips as Parquet at exactly this path")
    check("OUT/rejected/trips_rejected.parquet exists", rej_f.is_file(), "write the rejected rows as Parquet at exactly this path")
    check("OUT/quality_report.json exists", rep_f.is_file(), "write the report as JSON at exactly this path")
    con = duckdb.connect()
    if clean_f.is_file():
        src = f"read_parquet('{clean_f}')"
        cls = classes(con, f"SELECT * FROM {src}")
        check("clean: exactly the 16 columns of the contract", set(cls) == set(CLEAN_COLS),
              f"missing {sorted(set(CLEAN_COLS) - set(cls))}, unexpected {sorted(set(cls) - set(CLEAN_COLS))}")
        bad = [c for c, k in CLEAN_COLS.items() if c in cls and k != "any" and cls[c] != k]
        check("clean: column types are right (ints, doubles, timestamps, text, date)", not bad, "wrong type for " + ", ".join(f"{c} ({cls[c]})" for c in bad))
        if set(CLEAN_COLS) <= set(cls):
            n, uniq, nulls = con.execute(f"SELECT count(*), count(DISTINCT trip_id), count(*) - count(trip_id) FROM {src}").fetchone()
            check(f"clean: {t['rows_clean']:,} rows", n == t["rows_clean"], f"you have {n:,}; expected {t['rows_clean']:,} after removing duplicates and rejected rows")
            check("clean: trip_id is never empty and unique", nulls == 0 and uniq == n, f"{n - uniq:,} duplicate ids and {nulls} empty ids")
            viol = con.execute(f"""SELECT count(*) FROM {src} WHERE pickup_at < TIMESTAMP '2024-01-01' OR pickup_at >= TIMESTAMP '2024-02-01'
                                   OR dropoff_at <= pickup_at OR trip_minutes > 24 * 60 OR total_amount <= 0 OR trip_distance_miles > 100""").fetchone()[0]
            check("clean: no row breaks any rule", viol == 0, f"{viol:,} rows in the clean file still break a rule")
            s = con.execute(f"SELECT sum(total_amount), sum(trip_minutes), count(*) FILTER (WHERE passenger_count IS NULL) FROM {src}").fetchone()
            check("clean: total_amount adds up to the expected revenue", close(s[0], t["sum_total"], 1.0), f"sum is {s[0]:,.2f}, expected {t['sum_total']:,.2f}")
            check("clean: trip_minutes is computed correctly", close(s[1], t["sum_minutes"], 5.0), f"sum is {s[1]:,.1f}, expected {t['sum_minutes']:,.1f}")
            check("clean: an unknown passenger_count stays NULL (it is not turned into 0 or 1)", s[2] == t["null_passengers_clean"],
                  f"{s[2]:,} NULLs, expected {t['null_passengers_clean']:,}")
            pay = dict(con.execute(f"SELECT payment_method, count(*) FROM {src} GROUP BY 1").fetchall())
            check("clean: payment_method names follow the lesson's table", pay == t["payment"], f"yours: {dict(sorted(pay.items()))}")
            rate = dict(con.execute(f"SELECT rate_code, count(*) FROM {src} GROUP BY 1").fetchall())
            check("clean: rate_code names follow the lesson's table", rate == t["rate"], f"yours: {dict(sorted(rate.items()))}")
    if rej_f.is_file():
        src = f"read_parquet('{rej_f}')"
        cols = set(classes(con, f"SELECT * FROM {src}"))
        check("rejected: the 19 original columns plus reject_reason", cols == set(RAW_COLUMNS) | {"reject_reason"},
              f"missing {sorted((set(RAW_COLUMNS) | {'reject_reason'}) - cols)}, unexpected {sorted(cols - set(RAW_COLUMNS) - {'reject_reason'})}")
        if "reject_reason" in cols:
            got = dict(con.execute(f"SELECT reject_reason, count(*) FROM {src} GROUP BY 1").fetchall())
            check("rejected: the number of rows per reason is right (the FIRST rule a row breaks wins)", got == t["by_reason"],
                  f"yours: {dict(sorted(got.items()))}; expected {dict(sorted(t['by_reason'].items()))}")
    if rep_f.is_file():
        try:
            rep = json.loads(rep_f.read_text(encoding="utf-8"))
        except Exception as e:
            check("quality_report.json is valid JSON", False, str(e))
            return
        keys = ["status", "rows_in", "duplicates_removed", "rows_rejected", "rows_clean", "reject_rate", "rejected_by_reason"]
        check("quality_report.json has the seven keys of the contract", all(k in rep for k in keys), f"missing {[k for k in keys if k not in rep]}")
        if all(k in rep for k in keys):
            ok = (rep["status"] == "passed" and rep["rows_in"] == t["profile"]["rows_total"] and rep["duplicates_removed"] == 0
                  and rep["rows_rejected"] == t["rows_rejected"] and rep["rows_clean"] == t["rows_clean"] and close(rep["reject_rate"], t["rows_rejected"] / t["rows_dedup"], 0.0005))
            check("quality_report.json: the numbers are right and reconcile (rows_in - duplicates = clean + rejected)", ok, f"your report: {rep}")
            check("quality_report.json: rejected_by_reason matches", {k: v for k, v in rep["rejected_by_reason"].items() if v} == t["by_reason"],
                  f"yours: {rep['rejected_by_reason']}")


def step3(ws, ctx):
    print("\n== Step 3: the star schema in OUT/warehouse.duckdb")
    if not base_run(ws, ctx):
        return
    out, t = ctx["out"], truth()
    db = out / "warehouse.duckdb"
    if not check("OUT/warehouse.duckdb exists", db.is_file(), "create a DuckDB file at exactly this path (duckdb.connect(path))"):
        return
    con = duckdb.connect(str(db), read_only=True)
    tables = {r[0] for r in con.execute("SELECT table_name FROM information_schema.tables").fetchall()}
    need = {"dim_zone", "dim_date", "dim_payment", "fact_trip"}
    if not check("tables dim_zone, dim_date, dim_payment and fact_trip exist", need <= tables, f"missing {sorted(need - tables)}"):
        return
    want = {"dim_zone": {"zone_id", "borough", "zone", "service_zone"}, "dim_date": {"date_key", "date", "day_of_week", "is_weekend"},
            "dim_payment": {"payment_key", "payment_method"},
            "fact_trip": {"trip_id", "pickup_date_key", "pickup_zone_id", "dropoff_zone_id", "payment_key", "passenger_count", "trip_distance_miles",
                          "trip_minutes", "fare_amount", "tip_amount", "total_amount"}}
    for name, cols in want.items():
        have = {r[0] for r in con.execute(f"DESCRIBE {name}").fetchall()}
        check(f"{name}: the columns of the contract", have == cols, f"missing {sorted(cols - have)}, unexpected {sorted(have - cols)}")
    if any({r[0] for r in con.execute(f"DESCRIBE {n}").fetchall()} != c for n, c in want.items()):
        return
    n, uniq = con.execute("SELECT count(*), count(DISTINCT trip_id) FROM fact_trip").fetchone()
    check("fact_trip: one row per clean trip (the grain), trip_id unique", n == t["rows_clean"] and uniq == n,
          f"{n:,} rows and {uniq:,} distinct trip_ids; expected {t['rows_clean']:,} of each")
    check("fact_trip: total_amount adds up to the clean revenue", close(con.execute("SELECT sum(total_amount) FROM fact_trip").fetchone()[0], t["sum_total"], 1.0),
          "the fact table loses or repeats trips (check your joins: a join that repeats rows is the classic cause)")
    z = con.execute("SELECT count(*), count(DISTINCT zone_id) FROM dim_zone").fetchone()
    check("dim_zone: one row per zone id, all 265 of them", z == (t["zone_count"], t["zone_count"]), f"rows/distinct ids: {z}")
    orphans = con.execute("""SELECT
        (SELECT count(*) FROM fact_trip f LEFT JOIN dim_zone z ON z.zone_id = f.pickup_zone_id WHERE z.zone_id IS NULL),
        (SELECT count(*) FROM fact_trip f LEFT JOIN dim_zone z ON z.zone_id = f.dropoff_zone_id WHERE z.zone_id IS NULL),
        (SELECT count(*) FROM fact_trip f LEFT JOIN dim_date d ON d.date_key = f.pickup_date_key WHERE d.date_key IS NULL),
        (SELECT count(*) FROM fact_trip f LEFT JOIN dim_payment p ON p.payment_key = f.payment_key WHERE p.payment_key IS NULL)""").fetchone()
    check("referential integrity: every fact row points at a real zone, date and payment row", orphans == (0, 0, 0, 0),
          f"orphans (pickup zone, dropoff zone, date, payment): {orphans}")
    d = con.execute("SELECT count(*), min(date), max(date), count(DISTINCT date_key), count(*) FILTER (WHERE date_key != CAST(strftime(date, '%Y%m%d') AS INTEGER)) FROM dim_date").fetchone()
    check("dim_date: one row per day from 2024-01-01 to 2024-01-31, date_key is YYYYMMDD", d[0] == 31 and str(d[1]) == "2024-01-01" and str(d[2]) == "2024-01-31" and d[3] == 31 and d[4] == 0,
          f"rows={d[0]}, first={d[1]}, last={d[2]}, bad keys={d[4]}")
    wk = dict(con.execute("SELECT CAST(date AS VARCHAR), is_weekend FROM dim_date WHERE date IN (DATE '2024-01-05', DATE '2024-01-06', DATE '2024-01-07', DATE '2024-01-08')").fetchall())
    check("dim_date: is_weekend is true on Saturday and Sunday only", wk == {"2024-01-05": False, "2024-01-06": True, "2024-01-07": True, "2024-01-08": False}, f"got {wk}")
    pm = con.execute("SELECT count(*), count(DISTINCT payment_method), count(DISTINCT payment_key) FROM dim_payment").fetchone()
    check("dim_payment: seven payment methods, each with its own key", pm == (7, 7, 7), f"rows/distinct names/distinct keys: {pm}")
    got = dict(con.execute("SELECT p.payment_method, count(*) FROM fact_trip f JOIN dim_payment p USING (payment_key) GROUP BY 1").fetchall())
    check("fact_trip joined to dim_payment gives the right trips per payment method", got == t["payment"], f"yours: {dict(sorted(got.items()))}")


def step4(ws, ctx):
    print("\n== Step 4: the marts mart_daily and mart_top_routes")
    if not base_run(ws, ctx):
        return
    t = truth()
    db = ctx["out"] / "warehouse.duckdb"
    if not check("OUT/warehouse.duckdb exists", db.is_file(), "the marts live in the same DuckDB file as the star schema"):
        return
    con = duckdb.connect(str(db), read_only=True)
    tables = {r[0] for r in con.execute("SELECT table_name FROM information_schema.tables").fetchall()}
    if not check("tables mart_daily and mart_top_routes exist", {"mart_daily", "mart_top_routes"} <= tables, "create both tables in warehouse.duckdb"):
        return
    cols = [r[0] for r in con.execute("DESCRIBE mart_daily").fetchall()]
    if check("mart_daily: columns pickup_date, trips, revenue, avg_tip_pct", cols == ["pickup_date", "trips", "revenue", "avg_tip_pct"], f"you have {cols}"):
        rows = {str(d): (n, rev, tip) for d, n, rev, tip in con.execute("SELECT pickup_date, trips, revenue, avg_tip_pct FROM mart_daily").fetchall()}
        check("mart_daily: one row for each of the 31 days of January", sorted(rows) == t["days"], f"your dates: {sorted(rows)[:3]}... ({len(rows)} rows)")
        bad = [d for d in t["days"] if d in rows and rows[d][0] != t["daily"][d][0]]
        check("mart_daily: trips per day are right", not bad and len(rows) == len(t["days"]), f"wrong on {bad[:3]}" if bad else "")
        bad = [d for d in t["days"] if d in rows and not close(rows[d][1], t["daily"][d][1], 0.5)]
        check("mart_daily: revenue per day is right (sum of total_amount)", not bad and len(rows) == len(t["days"]), f"wrong on {bad[:3]}" if bad else "")
        bad = [d for d in t["days"] if d in rows and not close(rows[d][2], t["daily"][d][2], 0.011)]
        check("mart_daily: avg_tip_pct = 100 * tips / fares over credit-card trips only, rounded to 2 decimals", not bad and len(rows) == len(t["days"]),
              f"wrong on {bad[:3]}, e.g. {d_example(rows, t, bad)}" if bad else "")
    cols = [r[0] for r in con.execute("DESCRIBE mart_top_routes").fetchall()]
    if check("mart_top_routes: columns pickup_zone_id, dropoff_zone_id, pickup_zone, dropoff_zone, trips, avg_minutes",
             cols == ["pickup_zone_id", "dropoff_zone_id", "pickup_zone", "dropoff_zone", "trips", "avg_minutes"], f"you have {cols}"):
        rows = con.execute("SELECT pickup_zone_id, dropoff_zone_id, pickup_zone, dropoff_zone, trips, avg_minutes FROM mart_top_routes").fetchall()
        check("mart_top_routes: the 10 busiest routes (by zone ids), in order, ties by ids", [(r[0], r[1], r[4]) for r in rows] == [(a, b, c) for a, b, c, _ in t["routes"]],
              f"yours start with {[(r[0], r[1], r[4]) for r in rows[:3]]}; expected {[(a, b, c) for a, b, c, _ in t['routes'][:3]]}")
        check("mart_top_routes: zone names come from the zone table", all(r[2] == t["zone_names"].get(r[0]) and r[3] == t["zone_names"].get(r[1]) for r in rows),
              "pickup_zone and dropoff_zone must be the Zone text of the two ids")
        check("mart_top_routes: avg_minutes rounded to 1 decimal is right", len(rows) == 10 and all(close(r[5], e[3], 0.11) for r, e in zip(rows, t["routes"])),
              f"yours: {[r[5] for r in rows[:3]]}; expected {[e[3] for e in t['routes'][:3]]}")
    zone_trap(ws, ctx)


def zone_trap(ws, ctx):
    """A small delivery in which the zones 56 and 57 (both named 'Corona') are the busiest: grouping routes by zone NAME gives another top 10."""
    work = ctx["out"].parent
    trap = work / "delivery_zone_trap.parquet"
    duckdb.connect().execute(f"""COPY (
        SELECT * EXCLUDE (k) REPLACE (CASE WHEN k < 600 THEN 56 WHEN k < 1200 THEN 57 WHEN k < 1800 THEN 56 ELSE PULocationID END AS PULocationID,
                                      CASE WHEN k < 600 THEN 56 WHEN k < 1200 THEN 57 WHEN k < 1800 THEN 57 ELSE DOLocationID END AS DOLocationID)
        FROM (SELECT *, row_number() OVER (ORDER BY tpep_pickup_datetime, tpep_dropoff_datetime, total_amount) - 1 AS k FROM (
              SELECT * FROM read_parquet('{TRIPS}')
              WHERE tpep_pickup_datetime >= TIMESTAMP '2024-01-01' AND tpep_pickup_datetime < TIMESTAMP '2024-02-01'
                AND tpep_dropoff_datetime > tpep_pickup_datetime AND tpep_dropoff_datetime - tpep_pickup_datetime <= INTERVAL 24 HOUR
                AND total_amount > 0 AND trip_distance <= 100 ORDER BY tpep_pickup_datetime, tpep_dropoff_datetime, total_amount LIMIT 3000))
    ) TO '{trap}' (FORMAT parquet)""")
    want = duckdb.connect().execute(f"""SELECT PULocationID, DOLocationID, count(*) AS trips FROM (SELECT DISTINCT * FROM read_parquet('{trap}'))
                                        GROUP BY 1, 2 ORDER BY trips DESC, 1, 2 LIMIT 10""").fetchall()
    out2 = work / "trap_result"
    r = run_pipeline(ws, trap, out2, "trap")
    if not check("a small delivery of 3,000 trips runs through the whole pipeline", r["code"] == 0, tail(r["stderr"] or r["stdout"])):
        return
    try:
        got = [tuple(x) for x in duckdb.connect(str(out2 / "warehouse.duckdb"), read_only=True).execute(
            "SELECT pickup_zone_id, dropoff_zone_id, trips FROM mart_top_routes").fetchall()]
    except Exception as e:
        check("mart_top_routes can be read for the small delivery", False, str(e))
        return
    check("mart_top_routes groups by zone IDS, not zone names (zones 56 and 57 are both called 'Corona')", got == [tuple(x) for x in want],
          f"yours start with {got[:3]}; expected {[tuple(x) for x in want[:3]]}. Two different ids can share one name.")


def d_example(rows, t, bad):
    d = bad[0]
    return f"{d}: yours {rows[d][2]}, expected {t['daily'][d][2]}"


def step5(ws, ctx):
    print("\n== Step 5: rerun, duplicate delivery and quality gates (this step runs your pipeline several times)")
    if not base_run(ws, ctx):
        return
    out, t = ctx["out"], truth()
    work = ws / ".check"
    try:
        before = fingerprint(out)
    except Exception as e:
        check("the output of the first run can be read (steps 2 and 3 first)", False, str(e))
        return
    r = run_pipeline(ws, TRIPS, out, "rerun")
    ok = check("run it a second time into the same --out: exit code 0", r["code"] == 0, tail(r["stderr"] or r["stdout"]))
    if ok:
        check("the rerun gives exactly the same output (no appended or doubled rows: idempotent)", fingerprint(out) == before,
              f"first run {before}; second run {fingerprint(out)}")

    # the same file delivered twice inside one file
    dup = work / "delivery_twice.parquet"
    duckdb.connect().execute(f"COPY (SELECT * FROM read_parquet('{TRIPS}') UNION ALL SELECT * FROM read_parquet('{TRIPS}')) TO '{dup}' (FORMAT parquet)")
    r = run_pipeline(ws, dup, out, "twice")
    ok = check(f"a delivery in which every row appears twice is accepted ({r['secs']:.0f} s)", r["code"] == 0, tail(r["stderr"] or r["stdout"]))
    if ok:
        check("duplicates are removed: the output equals the single delivery", fingerprint(out) == before, f"single delivery {before}; doubled delivery {fingerprint(out)}")
        try:
            rep = json.loads((out / "quality_report.json").read_text(encoding="utf-8"))
            n = t["profile"]["rows_total"]
            check("quality_report.json counts the delivery honestly (rows_in = 2n, duplicates_removed = n)", rep.get("rows_in") == 2 * n and rep.get("duplicates_removed") == n,
                  f"rows_in={rep.get('rows_in')}, duplicates_removed={rep.get('duplicates_removed')}; expected {2 * n:,} and {n:,}")
        except Exception as e:
            check("quality_report.json can be read after the doubled delivery", False, str(e))

    # a delivery with a renamed column
    snap = tree_hash(out)
    bad1 = work / "delivery_renamed_column.parquet"
    duckdb.connect().execute(f"COPY (SELECT * EXCLUDE (fare_amount), fare_amount AS fare FROM read_parquet('{TRIPS}')) TO '{bad1}' (FORMAT parquet)")
    r = run_pipeline(ws, bad1, out, "renamed")
    check("a delivery whose column fare_amount is now called 'fare' is refused with exit code 2", r["code"] == 2, f"exit code {r['code']}. {tail(r['stderr'] or r['stdout'])}")
    check("... and the previous good output is left byte-for-byte untouched", tree_hash(out) == snap, "a failed run must not modify, delete or half-write anything in --out")

    # a delivery in which 40% of the rows are broken
    bad2 = work / "delivery_40_percent_broken.parquet"
    duckdb.connect().execute(f"""COPY (SELECT * REPLACE (CASE WHEN rn % 10 < 4 THEN -abs(total_amount) ELSE total_amount END AS total_amount)
                                       FROM (SELECT *, row_number() OVER () AS rn FROM read_parquet('{TRIPS}'))) TO '{bad2}' (FORMAT parquet)""")
    r = run_pipeline(ws, bad2, out, "broken")
    check("a delivery with 40% broken rows (reject rate above 5%) is refused with exit code 2", r["code"] == 2, f"exit code {r['code']}. {tail(r['stderr'] or r['stdout'])}")
    check("... and the previous good output is left byte-for-byte untouched", tree_hash(out) == snap, "the gate must run BEFORE anything is written, or build in a temp folder and swap at the end")

    # still healthy afterwards
    r = run_pipeline(ws, TRIPS, out, "after")
    ok = check("after the failed runs a good delivery still works", r["code"] == 0, tail(r["stderr"] or r["stdout"]))
    if ok:
        check("... and gives the same output as at the beginning", fingerprint(out) == before, "state from a failed run leaked into the next run")
    leftovers = sorted(p.name for p in out.parent.iterdir() if p.name != out.name and p.is_dir() and p.name.startswith(out.name))
    check("no temporary folders are left next to --out", not leftovers, f"left behind: {leftovers}; delete them when you swap the new output in")


STEPS = {1: step1, 2: step2, 3: step3, 4: step4, 5: step5}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("workspace")
    ap.add_argument("--step", default="all", help="1, 2, 3, 4, 5 or all")
    ap.add_argument("--hint", type=int, choices=[1, 2, 3], help="print a hint of this level for the chosen step instead of checking")
    ap.add_argument("--keep", action="store_true", help="keep the .check folder with the pipeline output (to look at it)")
    a = ap.parse_args()
    ws = Path(a.workspace).expanduser().resolve()
    steps = sorted(STEPS) if a.step == "all" else [int(a.step)] if a.step.isdigit() and int(a.step) in STEPS else None
    if steps is None:
        print("--step must be 1, 2, 3, 4, 5 or all")
        return 2
    if a.hint:
        for s in steps:
            print(f"Hint {a.hint} for step {s}: {HINTS[s][a.hint - 1]}\n")
        return 0
    if not ws.is_dir():
        print(f"Workspace {ws} does not exist. Create the folder and put pipeline.py (and profile.json) in it.")
        return 1
    if not TRIPS.is_file() or not ZONES.is_file():
        print("The data is missing. Run:  python3 labs/mod-4-1/fetch_data.py")
        return 1
    work = ws / ".check"
    if work.exists():
        shutil.rmtree(work)
    work.mkdir()
    ctx = {"out": work / "out"}
    t0 = time.time()
    try:
        for s in steps:
            STEPS[s](ws) if s == 1 else STEPS[s](ws, ctx)
    finally:
        if not a.keep:
            shutil.rmtree(work, ignore_errors=True)
    print(f"\n{passed} passed, {failed} failed ({time.time() - t0:.0f} s)")
    if failed:
        print("Not yet. Fix the first FAIL, run this step again, and use --hint 1 (then 2, 3) if you are stuck.")
        return 1
    print("ALL CHECKS PASSED" + ("" if a.step == "all" else f" for step {a.step}"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
