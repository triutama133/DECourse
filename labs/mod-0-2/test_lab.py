"""Tests for Lab 0.2.   pytest labs/mod-0-2/test_lab.py -v"""
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

lab = labtools.load(__file__, "pipeline.py")
DATA, MANIFEST = labtools.shop_data()
VALID_STATUSES = {"paid", "shipped", "delivered", "cancelled", "refunded"}
ISO_TS_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$")


_RESULT = {}


def cleaning_result():
    """Run the learner's clean_orders once and share the result. A plain function, not a pytest fixture: when
    clean_orders is not written yet, every test using it shows FAILED with the reason, instead of ERROR at setup
    (a word a beginner has never met)."""
    if "r" not in _RESULT:
        rows = lab.load_orders(DATA / "orders.csv")
        clean, rejected = lab.clean_orders(rows)
        _RESULT["r"] = (rows, clean, rejected)
    return _RESULT["r"]


class TestParsers:
    def test_parse_total(self):
        assert lab.parse_total("150000") == 150000
        assert lab.parse_total("Rp 1.250.000") == 1250000
        assert lab.parse_total("-45000") == -45000
        assert lab.parse_total("abc") is None
        assert lab.parse_total("") is None

    def test_parse_ts(self):
        assert lab.parse_ts("2026-01-31T14:03:00") == "2026-01-31T14:03:00"
        assert lab.parse_ts("31/01/2026 14:03") == "2026-01-31T14:03:00"
        assert lab.parse_ts("yesterday") is None


class TestCleaning:
    def test_no_row_is_lost_or_invented(self):
        rows, clean, rejected = cleaning_result()
        assert len(clean) + len(rejected) == len(rows)

    def test_each_order_appears_once(self):
        _, clean, _ = cleaning_result()
        ids = [o["order_id"] for o in clean]
        assert len(ids) == len(set(ids))

    def test_only_unrecoverable_orders_are_dropped(self):
        _, clean, _ = cleaning_result()
        # every distinct order survives except the ones whose total was turned negative
        expected = MANIFEST["orders_distinct"] - MANIFEST["orders_planted"]["negative_total"]
        assert len(clean) == expected

    def test_values_are_normalised(self):
        _, clean, _ = cleaning_result()
        for o in clean:
            assert isinstance(o["total_idr"], int)
            assert o["total_idr"] > 0
            assert o["status"] in VALID_STATUSES
            assert ISO_TS_RE.match(o["order_ts"]), f"bad timestamp format: {o['order_ts']!r}"

    def test_every_rejection_has_a_reason(self):
        _, _, rejected = cleaning_result()
        for r in rejected:
            assert r["reason"]
            assert "row" in r


class TestRevenue:
    def test_daily_revenue_matches_ground_truth(self):
        _, clean, _ = cleaning_result()
        assert lab.daily_revenue(clean) == MANIFEST["daily_revenue_after_rejecting_negative"]
