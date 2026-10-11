"""Tests for Lab 1.4 (star schema).   python labs/mod-1-4/test_lab.py -v     Standard library only."""
import sqlite3
import sys
import unittest
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

LAB = labtools.lab_dir(__file__)
DATA, MANIFEST = labtools.shop_data()
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import stage  # noqa: E402

FAR = "9999-12-31T00:00:00"


def build():
    con = sqlite3.connect(":memory:")
    stage.build_staging(DATA, con)
    con.executescript((LAB / "warehouse.sql").read_text())
    return con


class StarSchemaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.con = build()

    def q(self, sql, *args):
        return self.con.execute(sql, args).fetchall()

    def one(self, sql, *args):
        return self.q(sql, *args)[0][0]

    # ---------- dim_date ----------
    def test_dim_date_has_no_gaps_and_flags_weekends(self):
        lo, hi = self.q("SELECT date(MIN(order_ts)), date(MAX(order_ts)) FROM stg_orders")[0]
        days = self.one("SELECT CAST(julianday(?) - julianday(?) AS INTEGER) + 1", hi, lo)
        self.assertEqual(self.one("SELECT count(*) FROM dim_date"), days)
        self.assertEqual(self.one("SELECT count(DISTINCT date_key) FROM dim_date"), days)
        self.assertEqual(self.one("SELECT min(full_date) FROM dim_date"), lo)
        self.assertEqual(self.one("SELECT max(full_date) FROM dim_date"), hi)
        bad = self.one("SELECT count(*) FROM dim_date WHERE is_weekend <> (strftime('%w', full_date) IN ('0','6'))")
        self.assertEqual(bad, 0)
        self.assertEqual(self.one("SELECT day_name FROM dim_date WHERE full_date = '2026-01-01'"), "Thursday")

    # ---------- dim_product ----------
    def test_dim_product_one_row_per_product(self):
        self.assertEqual(self.one("SELECT count(*) FROM dim_product"), self.one("SELECT count(*) FROM stg_products"))
        self.assertEqual(self.one("SELECT count(DISTINCT product_sk) FROM dim_product"), self.one("SELECT count(*) FROM dim_product"))

    # ---------- dim_customer (SCD Type 2) ----------
    def test_customer_versions_cover_every_customer_and_change(self):
        n = self.one("SELECT count(*) FROM dim_customer WHERE customer_sk <> -1")
        expected = self.one("SELECT count(*) FROM stg_customers") + self.one("SELECT count(*) FROM stg_customer_changes")
        self.assertEqual(n, expected)

    def test_surrogate_keys_are_unique(self):
        self.assertEqual(self.one("SELECT count(DISTINCT customer_sk) FROM dim_customer"), self.one("SELECT count(*) FROM dim_customer"))

    def test_versions_are_contiguous_with_one_current_row(self):
        by_customer = defaultdict(list)
        for cid, vf, vt, cur in self.q("SELECT customer_id, valid_from, valid_to, is_current FROM dim_customer WHERE customer_sk <> -1 ORDER BY customer_id, valid_from"):
            by_customer[cid].append((vf, vt, cur))
        for cid, vs in by_customer.items():
            for a, b in zip(vs, vs[1:]):
                self.assertEqual(a[1], b[0], f"customer {cid}: valid_to of a version must equal valid_from of the next")
            self.assertEqual(vs[-1][1], FAR)
            self.assertEqual([c for _, _, c in vs], [0] * (len(vs) - 1) + [1], f"customer {cid}: only the last version is current")

    def test_missing_city_is_unknown_not_null(self):
        self.assertEqual(self.one("SELECT count(*) FROM dim_customer WHERE city IS NULL"), 0)
        self.assertGreater(self.one("SELECT count(*) FROM dim_customer WHERE city = 'Unknown' AND customer_sk <> -1"), 0)

    def test_unknown_member_exists(self):
        row = self.q("SELECT customer_id, city, tier, valid_from, valid_to, is_current FROM dim_customer WHERE customer_sk = -1")
        self.assertEqual(row, [(-1, "Unknown", "Unknown", "1900-01-01T00:00:00", FAR, 1)])

    # ---------- fact table ----------
    def test_fact_grain_is_one_row_per_order_line(self):
        self.assertEqual(self.one("SELECT count(*) FROM fact_order_items"), self.one("SELECT count(*) FROM stg_order_items"))
        self.assertEqual(self.one("SELECT count(*) FROM (SELECT DISTINCT order_id, line_no FROM fact_order_items)"),
                         self.one("SELECT count(*) FROM fact_order_items"))

    def test_line_total_and_revenue_reconcile_with_the_source(self):
        self.assertEqual(self.one("SELECT sum(line_total_idr) FROM fact_order_items"),
                         self.one("SELECT sum(qty * unit_price_idr) FROM stg_order_items"))
        self.assertEqual(self.one("SELECT count(*) FROM fact_order_items WHERE line_total_idr <> qty * unit_price_idr"), 0)

    def test_every_foreign_key_resolves_and_none_is_null(self):
        for col, dim in (("date_key", "dim_date"), ("customer_sk", "dim_customer"), ("product_sk", "dim_product")):
            self.assertEqual(self.one(f"SELECT count(*) FROM fact_order_items WHERE {col} IS NULL"), 0, f"{col} has NULLs")
            self.assertEqual(self.one(f"SELECT count(*) FROM fact_order_items f LEFT JOIN {dim} d ON d.{col} = f.{col} WHERE d.{col} IS NULL"), 0,
                             f"{col} has values missing from {dim}")

    def test_orphan_customers_map_to_the_unknown_member(self):
        orphan_lines = self.one("""SELECT count(*) FROM stg_order_items i JOIN stg_orders o ON o.order_id = i.order_id
                                   WHERE o.customer_id NOT IN (SELECT customer_id FROM stg_customers)""")
        self.assertGreater(orphan_lines, 0)
        self.assertEqual(self.one("SELECT count(*) FROM fact_order_items WHERE customer_sk = -1"), orphan_lines)

    def test_each_fact_points_at_the_customer_version_valid_at_order_time(self):
        bad = self.one("""SELECT count(*) FROM fact_order_items f
                          JOIN stg_orders o ON o.order_id = f.order_id
                          JOIN dim_customer c ON c.customer_sk = f.customer_sk
                          WHERE NOT (o.order_ts >= c.valid_from AND o.order_ts < c.valid_to)""")
        self.assertEqual(bad, 0)
        same_customer = self.one("""SELECT count(*) FROM fact_order_items f JOIN stg_orders o ON o.order_id = f.order_id
                                    JOIN dim_customer c ON c.customer_sk = f.customer_sk
                                    WHERE c.customer_id <> o.customer_id AND c.customer_sk <> -1""")
        self.assertEqual(same_customer, 0)

    def test_revenue_by_tier_at_time_of_purchase_matches_an_independent_calculation(self):
        # Independent calculation in Python, not using the dimension tables.
        base = {cid: tier for cid, tier in self.q("SELECT customer_id, tier FROM stg_customers")}
        changes = defaultdict(list)
        for cid, tier, ts in self.q("SELECT customer_id, tier, effective_ts FROM stg_customer_changes ORDER BY effective_ts"):
            changes[cid].append((ts, tier))
        expected = defaultdict(int)
        orders = {oid: (cid, ts) for oid, cid, ts in self.q("SELECT order_id, customer_id, order_ts FROM stg_orders")}
        for oid, qty, price in self.q("SELECT order_id, qty, unit_price_idr FROM stg_order_items"):
            cid, ts = orders[oid]
            if cid not in base:
                tier = "Unknown"
            else:
                tier = base[cid]
                for eff, t in changes[cid]:
                    if eff <= ts:
                        tier = t
            expected[tier] += qty * price
        got = dict(self.q("SELECT c.tier, sum(f.line_total_idr) FROM fact_order_items f JOIN dim_customer c ON c.customer_sk = f.customer_sk GROUP BY c.tier"))
        self.assertEqual(got, dict(expected))


if __name__ == "__main__":
    unittest.main()
