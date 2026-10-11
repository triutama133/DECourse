"""Tests for Lab 2.5.   pip install -r labs/mod-2-5/requirements.txt && pytest labs/mod-2-5 -v"""
import csv
import datetime as dt
import json
import re
import shutil
import sys
from collections import Counter
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

lab = labtools.load(__file__, "quality.py")
LAB = labtools.lab_dir(__file__)
CONTRACT = LAB / "contracts" / "orders.yaml"
DATA, MANIFEST = labtools.shop_data()
NOW = dt.datetime(2026, 1, 31, 1, 0)

GOOD = {"order_id": "1001", "customer_id": "7", "order_ts": "2026-01-05T10:00:00", "status": "paid",
        "payment_method": "card", "total_idr": "150000"}


@pytest.fixture(scope="module")
def contract():
    return lab.load_contract(CONTRACT)


def row(**kw):
    return {**GOOD, **kw}


# ---------------- the contract file (yours) ----------------
class TestContractFile:
    def test_identity_and_sla(self, contract):
        assert contract["name"] == "orders" and contract["version"] and contract["owner"]
        assert contract["sla"] == {"freshness_hours": 24, "max_reject_rate": 0.10}

    def test_fields_are_declared_exactly(self, contract):
        fields = {f["name"]: f for f in contract["fields"]}
        assert [f["name"] for f in contract["fields"]] == ["order_id", "customer_id", "order_ts", "status", "payment_method", "total_idr"]
        assert all(f.get("required") is True for f in fields.values())
        assert fields["order_id"]["type"] == "integer" and fields["order_id"].get("unique") is True and fields["order_id"]["minimum"] == 1
        assert fields["customer_id"]["type"] == "integer" and fields["customer_id"]["minimum"] == 1
        assert fields["order_ts"]["type"] == "timestamp"
        assert fields["status"]["allowed"] == ["paid", "shipped", "delivered", "cancelled", "refunded"]
        assert fields["payment_method"]["allowed"] == ["card", "bank_transfer", "ewallet", "cod"]
        assert fields["total_idr"]["type"] == "integer" and fields["total_idr"]["minimum"] == 1


# ---------------- row validation ----------------
class TestValidateRows:
    def test_a_good_row_passes(self, contract):
        valid, bad = lab.validate_rows([GOOD], contract)
        assert valid == [GOOD] and bad == []

    @pytest.mark.parametrize("change,message", [
        ({"total_idr": "Rp 1.250.000"}, "total_idr: wrong type"),
        ({"total_idr": "-5000"}, "total_idr: below minimum 1"),
        ({"total_idr": ""}, "total_idr: missing"),
        ({"order_ts": "31/01/2026 14:03"}, "order_ts: wrong type"),
        ({"order_ts": "2026-13-45T10:00:00"}, "order_ts: wrong type"),
        ({"status": "PAID"}, "status: not an allowed value"),
        ({"payment_method": "barter"}, "payment_method: not an allowed value"),
        ({"customer_id": "0"}, "customer_id: below minimum 1"),
        ({"order_id": "abc"}, "order_id: wrong type"),
    ])
    def test_each_rule_is_enforced_with_a_clear_message(self, contract, change, message):
        valid, bad = lab.validate_rows([row(**change)], contract)
        assert not valid and len(bad) == 1
        assert any(e.startswith(message) for e in bad[0]["errors"]), bad[0]["errors"]
        assert bad[0]["row"] == row(**change)

    def test_all_problems_of_a_row_are_reported(self, contract):
        _, bad = lab.validate_rows([row(status="X", total_idr="-1")], contract)
        assert len(bad[0]["errors"]) == 2

    def test_duplicates_are_rejected_but_only_after_a_valid_first_row(self, contract):
        rows = [row(order_id="5", status="WRONG"), row(order_id="5"), row(order_id="5"), row(order_id="6")]
        valid, bad = lab.validate_rows(rows, contract)
        assert [r["order_id"] for r in valid] == ["5", "6"]
        assert [b["errors"] for b in bad][1] == ["order_id: duplicate"]
        assert len(bad) == 2

    def test_counts_on_the_real_file_match_an_independent_check(self, contract):
        rows = list(csv.DictReader(open(DATA / "orders.csv", newline="")))
        valid, bad = lab.validate_rows(rows, contract)
        iso = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$")
        ok_status = {"paid", "shipped", "delivered", "cancelled", "refunded"}
        seen, expect_valid = set(), 0
        for r in rows:
            fine = (iso.match(r["order_ts"]) and r["status"] in ok_status and r["payment_method"] in {"card", "bank_transfer", "ewallet", "cod"}
                    and re.fullmatch(r"\d+", r["total_idr"]) and int(r["total_idr"]) >= 1 and int(r["customer_id"]) >= 1)
            if fine and r["order_id"] not in seen:
                seen.add(r["order_id"])
                expect_valid += 1
        assert len(valid) == expect_valid and len(valid) + len(bad) == len(rows)
        assert len({r["order_id"] for r in valid}) == len(valid)


# ---------------- the small checks ----------------
class TestSmallChecks:
    def test_schema_drift(self, contract):
        cols = ["order_id", "customer_id", "order_ts", "status", "payment_method", "total_idr"]
        assert lab.check_schema(cols, contract) == {"missing": [], "unexpected": []}
        renamed = [c if c != "total_idr" else "total_amount" for c in cols] + ["coupon"]
        assert lab.check_schema(renamed, contract) == {"missing": ["total_idr"], "unexpected": ["total_amount", "coupon"]}

    def test_freshness(self):
        now = dt.datetime(2026, 1, 31, 12, 0)
        assert lab.check_freshness(dt.datetime(2026, 1, 31, 6, 0), now, 24) == {"ok": True, "age_hours": 6.0}
        assert lab.check_freshness(dt.datetime(2026, 1, 30, 11, 0), now, 24) == {"ok": False, "age_hours": 25.0}

    def test_volume_anomaly_flags_a_drop_and_a_spike_but_not_normal_noise(self):
        history = [118, 121, 119, 122, 120, 117, 123, 120, 119, 121, 118, 122, 120, 121]
        assert lab.volume_anomaly(history, 121)["anomaly"] is False
        assert lab.volume_anomaly(history, 90)["anomaly"] is True       # a 25% drop
        assert lab.volume_anomaly(history, 190)["anomaly"] is True      # a spike

    def test_volume_anomaly_is_robust_to_one_old_outlier(self):
        history = [120] * 13 + [1200]                                   # one bad day in the history
        result = lab.volume_anomaly(history, 120)
        assert result["anomaly"] is False and result["median"] == 120
        assert lab.volume_anomaly(history, 400)["anomaly"] is True      # a mean/stdev rule would let this pass

    def test_band_never_collapses_to_zero_width(self):
        r = lab.volume_anomaly([100] * 14, 100)
        assert r["anomaly"] is False and r["low"] < 100 < r["high"]

    def test_distribution_shift(self):
        same = {"paid": 50, "shipped": 50}
        assert lab.distribution_shift(same, {"paid": 5, "shipped": 5}) == 0
        assert lab.distribution_shift({"a": 10}, {"b": 10}) == 1
        assert lab.distribution_shift({"paid": 80, "cancelled": 20}, {"paid": 60, "cancelled": 40}) == 0.2


# ---------------- the whole gate ----------------
@pytest.fixture()
def feed(tmp_path):
    d = tmp_path / "feed"
    d.mkdir()
    shutil.copy(DATA / "orders.csv", d / "orders.csv")
    return d


def rewrite(feed, fn):
    with open(feed / "orders.csv", newline="") as f:
        reader = csv.DictReader(f)
        header, rows = reader.fieldnames, list(reader)
    header, rows = fn(header, rows)
    with open(feed / "orders.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header)
        w.writeheader()
        w.writerows(rows)


class TestRunGate:
    def gate(self, feed, tmp_path, now=NOW):
        return lab.run_gate(feed, CONTRACT, now, tmp_path / "out")

    def test_the_normal_feed_passes_and_writes_both_files(self, feed, tmp_path):
        report = self.gate(feed, tmp_path)
        assert report["status"] == "pass", report
        c = report["checks"]["contract"]
        assert c["rows"] == 3634 and c["valid"] + c["quarantined"] == 3634 and 0.05 < c["reject_rate"] < 0.09
        out = tmp_path / "out"
        assert len((out / "orders_valid.ndjson").read_text().splitlines()) == c["valid"]
        q = [json.loads(l) for l in (out / "quarantine.ndjson").read_text().splitlines()]
        assert len(q) == c["quarantined"] and all({"row", "errors"} <= set(x) for x in q)
        assert set(report["checks"]) == {"schema", "contract", "freshness", "volume"}

    def test_a_renamed_column_stops_everything(self, feed, tmp_path):
        rewrite(feed, lambda h, r: ([c if c != "total_idr" else "total_amount" for c in h], [{("total_amount" if k == "total_idr" else k): v for k, v in x.items()} for x in r]))
        report = self.gate(feed, tmp_path)
        assert report["status"] == "fail" and report["reason"] == "schema drift"
        assert report["checks"]["schema"]["missing"] == ["total_idr"]
        assert "contract" not in report["checks"], "stop at the first failure"

    def test_a_feed_that_is_mostly_broken_fails_on_reject_rate(self, feed, tmp_path):
        def corrupt(h, rows):
            for i, r in enumerate(rows):
                if i % 4 == 0:
                    r["total_idr"] = "Rp " + r["total_idr"]
            return h, rows
        rewrite(feed, corrupt)
        report = self.gate(feed, tmp_path)
        assert report["status"] == "fail" and report["reason"] == "reject rate above the contract limit"

    def test_stale_data_fails(self, feed, tmp_path):
        report = self.gate(feed, tmp_path, now=NOW + dt.timedelta(days=3))
        assert report["status"] == "fail" and report["reason"] == "data is stale"

    def test_a_volume_drop_on_the_last_day_warns(self, feed, tmp_path):
        def drop(h, rows):
            last = [r for r in rows if r["order_ts"].startswith("2026-01-30")]
            gone = {id(r) for i, r in enumerate(last) if i % 5 in (0, 1)}  # remove 40% of that day
            return h, [r for r in rows if id(r) not in gone]
        rewrite(feed, drop)
        report = self.gate(feed, tmp_path)
        assert report["status"] == "warn" and report["reason"] == "volume anomaly on the latest day"
        assert report["checks"]["volume"]["anomaly"] is True and report["checks"]["volume"]["day"] == "2026-01-30"
