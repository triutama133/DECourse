"""Tests for Lab 2.4.   pip install -r labs/mod-2-4/requirements.txt && pytest labs/mod-2-4 -v"""
import csv
import json
import sys
from datetime import datetime
from pathlib import Path

import pytest
from dagster import materialize

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

lab = labtools.load(__file__, "orchestration.py")
DATA, MANIFEST = labtools.shop_data()


def truth_for(day):
    """Independent calculation of one day, straight from the CSV."""
    seen, orders = set(), []
    for r in csv.DictReader(open(DATA / "orders.csv", newline="")):
        ts = None
        for fmt in ("%Y-%m-%dT%H:%M:%S", "%d/%m/%Y %H:%M"):
            try:
                ts = datetime.strptime(r["order_ts"].strip(), fmt)
                break
            except ValueError:
                pass
        t = r["total_idr"].strip()
        t = t[2:].strip().replace(".", "") if t.lower().startswith("rp") else t
        try:
            total = int(t)
        except ValueError:
            continue
        if ts is None or total <= 0 or ts.date().isoformat() != day or r["order_id"] in seen:
            continue
        seen.add(r["order_id"])
        orders.append((int(r["order_id"]), r["status"].strip().lower(), total))
    counted = [o for o in orders if o[1] not in ("cancelled", "refunded")]
    return {"all": len(orders), "orders": len(counted), "revenue_idr": sum(o[2] for o in counted)}


@pytest.fixture()
def paths(tmp_path):
    return lab.Paths(data_dir=str(DATA), warehouse_dir=str(tmp_path / "wh"))


def run(assets, paths, partition_key=None, **kw):
    return materialize(assets, partition_key=partition_key, resources={"paths": paths}, raise_on_error=False, **kw)


class TestDefinitions:
    def test_partitions_are_the_30_days_of_january(self):
        keys = lab.daily.get_partition_keys()
        assert len(keys) == 30 and keys[0] == "2026-01-01" and keys[-1] == "2026-01-30"

    def test_the_schedule_runs_at_2am_jakarta_time(self):
        s = lab.defs.resolve_schedule_def("daily_kopiku_schedule") if hasattr(lab.defs, "resolve_schedule_def") else lab.defs.get_schedule_def("daily_kopiku_schedule")
        assert s.cron_schedule == "0 2 * * *" and s.execution_timezone == "Asia/Jakarta"

    def test_the_daily_asset_retries_transient_failures(self):
        policy = lab.daily_orders.op.retry_policy
        assert policy is not None and policy.max_retries >= 1

    def test_paths_are_a_resource_not_hard_coded(self, paths, tmp_path):
        assert run([lab.daily_orders], paths, "2026-01-02").success
        assert (tmp_path / "wh").exists()


class TestDailyOrders:
    def test_one_partition_is_materialised_and_correct(self, paths, tmp_path):
        res = run([lab.daily_orders], paths, "2026-01-05")
        assert res.success
        f = tmp_path / "wh" / "daily_orders" / "date=2026-01-05" / "orders.ndjson"
        rows = [json.loads(l) for l in f.read_text().splitlines()]
        assert len(rows) == truth_for("2026-01-05")["all"]
        assert [r["order_id"] for r in rows] == sorted(r["order_id"] for r in rows)
        assert all(set(r) == {"order_id", "order_ts", "status", "total_idr"} and r["total_idr"] > 0 for r in rows)
        assert all(r["order_ts"].startswith("2026-01-05") for r in rows)

    def test_running_the_same_partition_twice_gives_the_same_file(self, paths, tmp_path):
        f = tmp_path / "wh" / "daily_orders" / "date=2026-01-05" / "orders.ndjson"
        run([lab.daily_orders], paths, "2026-01-05")
        first = f.read_bytes()
        run([lab.daily_orders], paths, "2026-01-05")
        assert f.read_bytes() == first
        assert len(list(f.parent.iterdir())) == 1, "no leftover temporary files"

    def test_a_missing_input_fails_loudly(self, tmp_path):
        bad = lab.Paths(data_dir=str(tmp_path / "nope"), warehouse_dir=str(tmp_path / "wh"))
        assert not run([lab.daily_orders], bad, "2026-01-05").success

    def test_the_unique_ids_check_runs_and_passes(self, paths):
        res = run([lab.daily_orders, lab.daily_orders_has_unique_ids], paths, "2026-01-05")
        evals = res.get_asset_check_evaluations()
        assert any(e.check_name == "daily_orders_has_unique_ids" and e.passed for e in evals)


class TestBackfillAndReport:
    DAYS = [f"2026-01-{d:02d}" for d in range(1, 8)]

    def test_backfill_a_week_then_build_the_report(self, paths, tmp_path):
        for day in self.DAYS:
            assert run([lab.daily_orders, lab.daily_revenue], paths, day).success
        res = run([lab.revenue_report, lab.revenue_is_never_negative], paths)
        assert res.success
        lines = (tmp_path / "wh" / "revenue_report.csv").read_text().splitlines()
        assert lines[0] == "date,orders,revenue_idr" and len(lines) == 8
        for line in lines[1:]:
            day, orders, revenue = line.split(",")
            t = truth_for(day)
            assert (int(orders), int(revenue)) == (t["orders"], t["revenue_idr"]), day
        assert any(e.check_name == "revenue_is_never_negative" and e.passed for e in res.get_asset_check_evaluations())

    def test_backfilling_again_does_not_double_count(self, paths, tmp_path):
        for _ in range(2):
            for day in self.DAYS[:3]:
                run([lab.daily_orders, lab.daily_revenue], paths, day)
        run([lab.revenue_report], paths)
        assert len((tmp_path / "wh" / "revenue_report.csv").read_text().splitlines()) == 4
