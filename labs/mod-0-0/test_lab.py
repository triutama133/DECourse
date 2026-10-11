"""Tests for Lab 0.0.   pip install pytest && pytest labs/mod-0-0/test_lab.py -v"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

lab = labtools.load(__file__, "basics.py")


def order(i, cid, status, total):
    return {"order_id": str(i), "customer_id": str(cid), "status": status, "total_idr": str(total)}


ORDERS = [
    order(1, 7, "paid", 150000),
    order(2, 3, "delivered", 80000),
    order(3, 7, "cancelled", 999999),
    order(4, 5, "paid", 120000),
    order(5, 3, "refunded", 50000),
    order(6, 3, "paid", 40000),
]


class TestFormatRupiah:
    def test_adds_dots_between_thousands(self):
        assert lab.format_rupiah(1250000) == "Rp 1.250.000"

    def test_small_numbers_have_no_dots(self):
        assert lab.format_rupiah(500) == "Rp 500"
        assert lab.format_rupiah(0) == "Rp 0"

    def test_negative_numbers_put_the_minus_first(self):
        assert lab.format_rupiah(-45000) == "-Rp 45.000"

    def test_returns_text_not_a_number(self):
        assert isinstance(lab.format_rupiah(10), str)


class TestSafeInt:
    def test_plain_and_padded_numbers(self):
        assert lab.safe_int("42") == 42
        assert lab.safe_int("  42 ") == 42
        assert lab.safe_int("-45000") == -45000

    def test_impossible_text_gives_the_default(self):
        assert lab.safe_int("abc") is None
        assert lab.safe_int("") is None
        assert lab.safe_int("Rp 1.250.000") is None

    def test_a_custom_default(self):
        assert lab.safe_int("abc", 0) == 0
        assert lab.safe_int("7", 0) == 7

    def test_accepts_a_number_too(self):
        assert lab.safe_int(12) == 12


class TestTotalRevenue:
    def test_skips_cancelled_and_refunded(self):
        assert lab.total_revenue(ORDERS) == 150000 + 80000 + 120000 + 40000

    def test_no_orders_is_zero(self):
        assert lab.total_revenue([]) == 0

    def test_returns_a_number_not_text(self):
        assert isinstance(lab.total_revenue(ORDERS), int)


class TestCountByStatus:
    def test_counts_each_status(self):
        assert lab.count_by_status(ORDERS) == {"paid": 3, "delivered": 1, "cancelled": 1, "refunded": 1}

    def test_empty(self):
        assert lab.count_by_status([]) == {}


class TestUniqueCustomerIds:
    def test_sorted_numbers_without_repeats(self):
        assert lab.unique_customer_ids(ORDERS) == [3, 5, 7]

    def test_are_ints_not_text(self):
        assert all(isinstance(x, int) for x in lab.unique_customer_ids(ORDERS))


class TestSplitValid:
    ROWS = [order(1, 1, "paid", 100), order(2, 1, "paid", "Rp 1.250.000"), order(3, 2, "paid", -5), order(4, 2, "paid", ""), order(5, 3, "paid", 0)]

    def test_splits_in_order(self):
        valid, invalid = lab.split_valid(self.ROWS)
        assert [o["order_id"] for o in valid] == ["1", "5"]
        assert [o["order_id"] for o in invalid] == ["2", "3", "4"]

    def test_nothing_is_lost(self):
        valid, invalid = lab.split_valid(self.ROWS)
        assert len(valid) + len(invalid) == len(self.ROWS)

    def test_returns_two_lists(self):
        result = lab.split_valid([])
        assert result == ([], [])


class TestAverageTotal:
    def test_average(self):
        assert lab.average_total([order(1, 1, "paid", 100), order(2, 1, "paid", 200)]) == pytest.approx(150.0)

    def test_no_orders_is_none_not_an_error(self):
        assert lab.average_total([]) is None


class TestTopCustomers:
    def test_ranks_by_total_spent(self):
        # customer 7: 150000+999999, customer 3: 80000+50000+40000, customer 5: 120000
        assert lab.top_customers(ORDERS, 2) == [(7, 1149999), (3, 170000)]

    def test_ties_go_to_the_smaller_id(self):
        rows = [order(1, 9, "paid", 100), order(2, 4, "paid", 100), order(3, 6, "paid", 100)]
        assert lab.top_customers(rows, 3) == [(4, 100), (6, 100), (9, 100)]

    def test_asking_for_more_than_exist(self):
        assert len(lab.top_customers(ORDERS, 10)) == 3


class TestBatches:
    def test_chunks_keep_order(self):
        assert lab.batches([1, 2, 3, 4, 5], 2) == [[1, 2], [3, 4], [5]]

    def test_exact_fit_and_empty(self):
        assert lab.batches([1, 2, 3, 4], 2) == [[1, 2], [3, 4]]
        assert lab.batches([], 3) == []

    def test_does_not_change_the_input(self):
        items = [1, 2, 3]
        lab.batches(items, 2)
        assert items == [1, 2, 3]


class TestAddToBatch:
    def test_starts_a_new_list(self):
        assert lab.add_to_batch("a") == ["a"]

    def test_never_remembers_previous_calls(self):
        lab.add_to_batch("a")
        lab.add_to_batch("b")
        assert lab.add_to_batch("c") == ["c"]

    def test_extends_without_changing_the_original(self):
        original = ["a", "b"]
        result = lab.add_to_batch("c", original)
        assert result == ["a", "b", "c"]
        assert original == ["a", "b"]


class TestReadOrders:
    def test_reads_rows_as_dicts_of_text(self, tmp_path):
        f = tmp_path / "orders.csv"
        f.write_text("order_id,customer_id,status,total_idr\n1,7,paid,150000\n2,3,paid,Rp 80.000\n", encoding="utf-8")
        rows = lab.read_orders(f)
        assert rows == [
            {"order_id": "1", "customer_id": "7", "status": "paid", "total_idr": "150000"},
            {"order_id": "2", "customer_id": "3", "status": "paid", "total_idr": "Rp 80.000"},
        ]

    def test_handles_accents_and_empty_file_body(self, tmp_path):
        f = tmp_path / "o.csv"
        f.write_text("order_id,note\n1,café\n", encoding="utf-8")
        assert lab.read_orders(f)[0]["note"] == "café"
        g = tmp_path / "e.csv"
        g.write_text("order_id,note\n", encoding="utf-8")
        assert lab.read_orders(g) == []
