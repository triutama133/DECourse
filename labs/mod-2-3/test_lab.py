"""Tests for Lab 2.3 (a dbt project).   pip install -r labs/mod-2-3/requirements.txt && pytest labs/mod-2-3 -v

The tests copy YOUR project (labs/mod-2-3/kopiku_dbt) to a temporary folder, load the raw KopiKu tables into a
temporary DuckDB file, run `dbt build`, then simulate a later load and run `dbt build` again.
Every business number is compared with an independent SQL calculation straight from the raw tables.
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import duckdb
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import load_raw  # noqa: E402

PROJECT = labtools.lab_dir(__file__) / "kopiku_dbt"
DATA, MANIFEST = labtools.shop_data()

EXPECTED_DAILY = """
WITH latest AS (SELECT * FROM (SELECT *, row_number() OVER (PARTITION BY order_id ORDER BY _loaded_at DESC) rn FROM raw.orders) WHERE rn = 1),
ok AS (SELECT order_id::BIGINT AS oid,
              coalesce(try_strptime(order_ts, '%Y-%m-%dT%H:%M:%S'), try_strptime(order_ts, '%d/%m/%Y %H:%M')) AS ts,
              lower(trim(status)) AS st,
              try_cast(replace(regexp_replace(total_idr, '^\\s*[Rr][Pp]\\s*', ''), '.', '') AS BIGINT) AS tot
       FROM latest)
SELECT CAST(ts AS DATE) AS d,
       count(DISTINCT CASE WHEN st NOT IN ('cancelled', 'refunded') THEN oid END) AS o,
       coalesce(sum(CASE WHEN st NOT IN ('cancelled', 'refunded') THEN i.qty::INT * i.unit_price_idr::BIGINT END), 0) AS rev
FROM ok JOIN raw.order_items i ON i.order_id::BIGINT = ok.oid
WHERE tot > 0 AND ts IS NOT NULL
GROUP BY 1 ORDER BY 1
"""


def dbt_exe():
    for cand in (Path(sys.executable).parent / "dbt", shutil.which("dbt")):
        if cand and Path(cand).exists():
            return str(cand)
    pytest.skip("dbt executable not found; pip install -r labs/mod-2-3/requirements.txt")


def run_dbt(project, db, *args):
    env = {**os.environ, "KOPIKU_DB": str(db), "DBT_SEND_ANONYMOUS_USAGE_STATS": "false", "DO_NOT_TRACK": "1"}
    res = subprocess.run([dbt_exe(), *args, "--project-dir", str(project), "--profiles-dir", str(project)],
                         capture_output=True, text=True, env=env, cwd=project)
    results = json.loads((project / "target" / "run_results.json").read_text()) if (project / "target" / "run_results.json").exists() else {}
    return res, results


@pytest.fixture(scope="module")
def world(tmp_path_factory):
    base = tmp_path_factory.mktemp("dbt")
    proj, db = base / "kopiku_dbt", base / "kopiku.duckdb"
    shutil.copytree(PROJECT, proj, ignore=shutil.ignore_patterns("target", "logs", "dbt_packages", "*.duckdb"))
    load_raw.load_initial(db, DATA)
    first, first_results = run_dbt(proj, db, "build")
    out = {"proj": proj, "db": db, "first": first, "first_results": first_results}
    return out


@pytest.fixture(scope="module")
def after_second_load(world):
    summary = load_raw.simulate_next_load(world["db"], DATA)
    second, second_results = run_dbt(world["proj"], world["db"], "build")
    return {**world, "summary": summary, "second": second, "second_results": second_results}


def q(world, sql):
    con = duckdb.connect(str(world["db"]), read_only=True)
    try:
        return con.execute(sql).fetchall()
    finally:
        con.close()


def daily(rows):
    return [(d, int(o), int(r)) for d, o, r in rows]


# ---------------- first load ----------------
class TestFirstBuild:
    def test_dbt_build_succeeds(self, world):
        r = world["first"]
        assert r.returncode == 0, (r.stdout + r.stderr)[-1500:]

    def test_staging_orders_is_one_clean_row_per_order(self, world):
        rows = q(world, "SELECT count(*), count(DISTINCT order_id), min(total_idr), count(*) FILTER (WHERE order_ts IS NULL), "
                        "count(*) FILTER (WHERE status <> lower(trim(status))) FROM stg_orders")[0]
        n, distinct, min_total, null_ts, bad_status = rows
        expected = q(world, """SELECT count(DISTINCT order_id) FROM (
            SELECT order_id,
                   try_cast(replace(regexp_replace(total_idr, '^\\s*[Rr][Pp]\\s*', ''), '.', '') AS BIGINT) AS tot,
                   coalesce(try_strptime(order_ts, '%Y-%m-%dT%H:%M:%S'), try_strptime(order_ts, '%d/%m/%Y %H:%M')) AS ts
            FROM raw.orders) WHERE tot > 0 AND ts IS NOT NULL""")[0][0]
        assert n == distinct == expected
        assert min_total > 0 and null_ts == 0 and bad_status == 0

    def test_staging_customers_is_one_row_per_customer_with_null_for_missing_city(self, world):
        n, distinct, nulls, empties = q(world, "SELECT count(*), count(DISTINCT customer_id), count(*) FILTER (WHERE city IS NULL), count(*) FILTER (WHERE city = '') FROM stg_customers")[0]
        assert n == distinct == MANIFEST["customers_distinct"]
        assert nulls > 0 and empties == 0

    def test_fact_grain_and_arithmetic(self, world):
        n, distinct = q(world, "SELECT count(*), count(DISTINCT (order_id, line_no)) FROM fct_order_items")[0]
        assert n == distinct
        expected = q(world, "SELECT count(*) FROM stg_order_items WHERE order_id IN (SELECT order_id FROM stg_orders)")[0][0]
        assert n == expected
        assert q(world, "SELECT count(*) FROM fct_order_items WHERE line_total_idr <> qty * unit_price_idr")[0][0] == 0

    def test_dimension_has_no_null_city(self, world):
        assert q(world, "SELECT count(*) FROM dim_customers WHERE city IS NULL")[0][0] == 0
        assert q(world, "SELECT count(*) FROM dim_customers WHERE city = 'Unknown'")[0][0] > 0

    def test_daily_revenue_matches_an_independent_calculation(self, world):
        assert daily(q(world, "SELECT order_date, orders, revenue_idr FROM fct_daily_revenue ORDER BY 1")) == daily(q(world, EXPECTED_DAILY))

    def test_the_data_quality_tests_exist_and_pass(self, world):
        tests = {r["unique_id"]: r["status"] for r in world["first_results"].get("results", []) if r["unique_id"].startswith("test.")}
        names = " ".join(tests)
        for needle in ("unique_stg_orders_order_id", "not_null_stg_orders_order_id", "accepted_values_stg_orders_status",
                       "unique_stg_customers_customer_id", "unique_dim_customers_customer_id", "relationships_fct_order_items",
                       "unique_fct_daily_revenue_order_date"):
            assert needle in names, f"missing test: {needle}"
        assert any(not n.split(".")[2].startswith(("unique_", "not_null_", "accepted_values_", "relationships_")) for n in tests), \
            "add one singular test in tests/"
        assert "fail" not in set(tests.values()) and "error" not in set(tests.values())

    def test_orphan_customers_are_flagged_by_a_warning_not_a_failure(self, world):
        rel = {u: s for u, s in ((r["unique_id"], r["status"]) for r in world["first_results"].get("results", [])) if "relationships_fct_order_items" in u}
        assert rel and set(rel.values()) == {"warn"}, "the relationships test should run with severity: warn and report the orphans"


# ---------------- a later load ----------------
class TestSecondLoad:
    def test_second_build_succeeds(self, after_second_load):
        r = after_second_load["second"]
        assert r.returncode == 0, (r.stdout + r.stderr)[-1500:]

    def test_the_second_run_really_ran_incrementally(self, after_second_load):
        res = [r for r in after_second_load["second_results"]["results"] if r["unique_id"] == "model.kopiku.fct_daily_revenue"]
        assert res and "_loaded_at >" in res[0]["compiled_code"], "the incremental branch (is_incremental) did not run"

    def test_incremental_result_equals_a_full_recalculation(self, after_second_load):
        got = daily(q(after_second_load, "SELECT order_date, orders, revenue_idr FROM fct_daily_revenue ORDER BY 1"))
        assert got == daily(q(after_second_load, EXPECTED_DAILY)), \
            "late changes to old orders must update the OLD days too, not only add new days"
        assert any(str(d) == "2026-01-31" for d, _, _ in got), "the new day must appear"

    def test_staging_took_the_latest_version_of_changed_orders(self, after_second_load):
        changed = q(after_second_load, "SELECT count(*) FROM stg_orders WHERE status IN ('refunded', 'cancelled') AND _loaded_at > TIMESTAMP '2026-02-01'")[0][0]
        assert changed >= after_second_load["summary"]["status_changes"]

    def test_snapshot_keeps_history_of_customers_who_moved(self, after_second_load):
        total, current = q(after_second_load, "SELECT count(*), count(*) FILTER (WHERE dbt_valid_to IS NULL) FROM snapshots.customers_snapshot")[0]
        moved = after_second_load["summary"]["customers_moved"]
        assert current == MANIFEST["customers_distinct"]
        assert total == MANIFEST["customers_distinct"] + moved
