"""Tests for Lab 0.1.   python labs/mod-0-1/test_lab.py -v"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

lab = labtools.load(__file__, "pipeline.py")
DATA, MANIFEST = labtools.shop_data()


class TestParsers(unittest.TestCase):
    def test_parse_total(self):
        self.assertEqual(lab.parse_total("150000"), 150000)
        self.assertEqual(lab.parse_total("Rp 1.250.000"), 1250000)
        self.assertEqual(lab.parse_total("-45000"), -45000)
        self.assertIsNone(lab.parse_total("abc"))
        self.assertIsNone(lab.parse_total(""))

    def test_parse_ts(self):
        self.assertEqual(lab.parse_ts("2026-01-31T14:03:00"), "2026-01-31T14:03:00")
        self.assertEqual(lab.parse_ts("31/01/2026 14:03"), "2026-01-31T14:03:00")
        self.assertIsNone(lab.parse_ts("yesterday"))


class TestCleaning(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = lab.load_orders(DATA / "orders.csv")
        cls.clean, cls.rejected = lab.clean_orders(cls.rows)

    def test_no_row_is_lost_or_invented(self):
        self.assertEqual(len(self.clean) + len(self.rejected), len(self.rows))

    def test_each_order_appears_once(self):
        ids = [o["order_id"] for o in self.clean]
        self.assertEqual(len(ids), len(set(ids)))

    def test_only_unrecoverable_orders_are_dropped(self):
        # every distinct order survives except the ones whose total was turned negative
        expected = MANIFEST["orders_distinct"] - MANIFEST["orders_planted"]["negative_total"]
        self.assertEqual(len(self.clean), expected)

    def test_values_are_normalised(self):
        for o in self.clean:
            self.assertIsInstance(o["total_idr"], int)
            self.assertGreater(o["total_idr"], 0)
            self.assertIn(o["status"], {"paid", "shipped", "delivered", "cancelled", "refunded"})
            self.assertRegex(o["order_ts"], r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$")

    def test_every_rejection_has_a_reason(self):
        for r in self.rejected:
            self.assertTrue(r["reason"])
            self.assertIn("row", r)


class TestRevenue(unittest.TestCase):
    def test_daily_revenue_matches_ground_truth(self):
        clean, _ = lab.clean_orders(lab.load_orders(DATA / "orders.csv"))
        self.assertEqual(lab.daily_revenue(clean), MANIFEST["daily_revenue_after_rejecting_negative"])


if __name__ == "__main__":
    unittest.main()
