"""Tests for Lab 1.2.   pytest labs/mod-1-2 -v     (needs: pip install -r labs/mod-1-2/requirements.txt)"""
import csv
import inspect
import json
import logging
import sys
import tracemalloc
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

etl = labtools.load(__file__, "etl.py")
DATA, MANIFEST = labtools.shop_data()
ORDERS = DATA / "orders.csv"

GOOD = {"order_id": "1001", "customer_id": "7", "order_ts": "2026-01-05T10:00:00",
        "status": "paid", "payment_method": "card", "total_idr": "150000"}


def row(**changes):
    return {**GOOD, **changes}


# ---------- the model ----------
class TestOrderRow:
    def test_accepts_a_clean_row(self):
        o = etl.validate(GOOD)
        assert (o.order_id, o.total_idr, o.status) == (1001, 150000, "paid")

    @pytest.mark.parametrize("raw,expected", [("PAID", "paid"), (" Shipped ", "shipped"), ("Delivered", "delivered")])
    def test_status_is_normalised(self, raw, expected):
        assert etl.validate(row(status=raw)).status == expected

    @pytest.mark.parametrize("raw,expected", [("Rp 1.250.000", 1250000), ("150000", 150000), ("Rp 95.000", 95000)])
    def test_total_accepts_rupiah_text(self, raw, expected):
        assert etl.validate(row(total_idr=raw)).total_idr == expected

    @pytest.mark.parametrize("raw", ["31/01/2026 14:03", "2026-01-31T14:03:00"])
    def test_both_timestamp_formats(self, raw):
        assert etl.validate(row(order_ts=raw)).order_ts.isoformat() == "2026-01-31T14:03:00"

    @pytest.mark.parametrize("field,bad", [
        ("total_idr", "-5000"), ("total_idr", "0"), ("total_idr", "abc"), ("order_id", "0"), ("customer_id", ""),
        ("status", "teleported"), ("payment_method", "barter"), ("order_ts", "yesterday"),
    ])
    def test_rejects_bad_values(self, field, bad):
        with pytest.raises(etl.ValidationError):
            etl.validate(row(**{field: bad}))


# ---------- streaming ----------
class TestStreaming:
    def test_read_orders_is_a_lazy_generator(self):
        assert inspect.isgeneratorfunction(etl.read_orders)
        first = next(etl.read_orders(ORDERS))
        assert "order_id" in first

    def test_memory_stays_flat_on_a_big_file(self, tmp_path):
        big = tmp_path / "big.csv"
        with open(big, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["order_id", "customer_id", "order_ts", "status", "payment_method", "total_idr"])
            for i in range(1, 120_001):
                w.writerow([i, i % 900 + 1, "2026-01-05T10:00:00", "paid", "card", 100000 + i])
        tracemalloc.start()
        stats = etl.run(big, tmp_path / "out.ndjson", tmp_path / "q.ndjson")
        _, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        assert stats.valid == 120_000
        assert peak < 30 * 1024 * 1024, f"peak memory {peak / 1e6:.0f} MB: do not hold all rows in memory"


# ---------- the pipeline ----------
@pytest.fixture(scope="module")
def result(tmp_path_factory):
    d = tmp_path_factory.mktemp("run")
    stats = etl.run(ORDERS, d / "clean.ndjson", d / "quarantine.ndjson")
    return stats, d


class TestRun:
    def test_counts_match_the_ground_truth(self, result):
        stats, _ = result
        distinct_ok = MANIFEST["orders_distinct"] - MANIFEST["orders_planted"]["negative_total"]
        assert stats.read == MANIFEST["orders_rows"]
        assert stats.valid == distinct_ok
        assert stats.read == stats.valid + stats.duplicates + stats.invalid

    def test_output_has_one_valid_json_object_per_order(self, result):
        stats, d = result
        lines = (d / "clean.ndjson").read_text().splitlines()
        assert len(lines) == stats.valid
        objs = [json.loads(l) for l in lines]
        assert len({o["order_id"] for o in objs}) == len(objs)
        assert all(o["total_idr"] > 0 and o["status"] == o["status"].lower() for o in objs)
        assert all(l == json.dumps(json.loads(l), sort_keys=True) for l in lines[:50])

    def test_quarantine_explains_every_rejection(self, result):
        stats, d = result
        q = [json.loads(l) for l in (d / "quarantine.ndjson").read_text().splitlines()]
        assert len(q) == stats.rejected
        assert all(set(r) == {"row", "reason", "raw"} for r in q)
        assert any(r["reason"] == "duplicate" for r in q)
        assert any(r["reason"].startswith("total_idr") for r in q)

    def test_running_twice_gives_identical_files(self, tmp_path):
        etl.run(ORDERS, tmp_path / "a.ndjson", tmp_path / "qa.ndjson")
        etl.run(ORDERS, tmp_path / "b.ndjson", tmp_path / "qb.ndjson")
        assert (tmp_path / "a.ndjson").read_bytes() == (tmp_path / "b.ndjson").read_bytes()
        assert (tmp_path / "qa.ndjson").read_bytes() == (tmp_path / "qb.ndjson").read_bytes()

    def test_a_failed_run_keeps_the_previous_good_output(self, tmp_path):
        out, q = tmp_path / "clean.ndjson", tmp_path / "q.ndjson"
        etl.run(ORDERS, out, q)
        good = out.read_bytes()
        with pytest.raises(OSError):
            etl.run(tmp_path / "missing.csv", out, q)
        assert out.read_bytes() == good
        assert not list(tmp_path.glob("*.tmp")), "temporary files must be cleaned up"

    def test_logs_a_summary_line(self, tmp_path, caplog):
        with caplog.at_level(logging.INFO, logger="kopiku_etl"):
            stats = etl.run(ORDERS, tmp_path / "o.ndjson", tmp_path / "q.ndjson")
        text = " ".join(r.getMessage() for r in caplog.records)
        assert f"valid={stats.valid}" in text and f"read={stats.read}" in text


# ---------- the command line ----------
class TestMain:
    def test_exit_0_when_reject_rate_is_acceptable(self, tmp_path):
        assert etl.main([str(ORDERS), str(tmp_path / "o"), str(tmp_path / "q"), "--max-reject-rate", "0.10"]) == 0

    def test_exit_1_when_too_many_rows_are_rejected(self, tmp_path):
        assert etl.main([str(ORDERS), str(tmp_path / "o"), str(tmp_path / "q"), "--max-reject-rate", "0.001"]) == 1

    def test_exit_2_when_input_is_missing(self, tmp_path):
        assert etl.main([str(tmp_path / "nope.csv"), str(tmp_path / "o"), str(tmp_path / "q")]) == 2
