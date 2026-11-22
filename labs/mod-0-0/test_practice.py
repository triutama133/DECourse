"""Tests for Lab 0.0, Part A (plain code, no functions).

    pytest labs/mod-0-0/test_practice.py -v                 all steps
    pytest labs/mod-0-0/test_practice.py -k Step1 -v        one step

How the checker works: it runs your practice.py from top to bottom, with its own numbers in place of the INPUTS
(several different data sets), and then looks at the variables your code made. A failing line says which variable
is wrong, what it should be, what it is, and for which input.
"""
import contextlib
import io
import sys
import traceback
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

PATH = labtools.lab_dir(__file__) / "practice.py"
END_MARKER = "# ===== END OF INPUTS"

ORDERS = [
    {"order_id": "1001", "customer_id": "7", "status": "paid", "total_idr": "150000"},
    {"order_id": "1002", "customer_id": "3", "status": "cancelled", "total_idr": "90000"},
    {"order_id": "1003", "customer_id": "7", "status": "paid", "total_idr": "25000"},
    {"order_id": "1004", "customer_id": "5", "status": "delivered", "total_idr": "60000"},
]
DEFAULT = dict(
    amount=1250000,
    row1={"order_id": "1001", "status": "paid", "total_idr": "150000"},
    row2={"order_id": "1002", "status": "paid", "total_idr": "90000"},
    orders=ORDERS,
    ids_seen=[7, 3, 7, 5],
    signed_amount=-45000,
    totals=[150000, 25000],
    items=[1, 2, 3, 4, 5],
    batch_size=2,
)


STEP_HEADER = "# ----------------------------------------------------------------"
STEP_OF = {  # which step makes which variable
    "formatted": 1, "two_totals": 1,
    "order_count": 2, "first_status": 2, "last_total": 2, "unique_ids": 2,
    "signed_text": 3, "average": 3,
    "status_counts": 4, "revenue": 4, "customer_ids": 4, "batches": 4,
}


class Run:
    """The variables after running practice.py, and the error (if any) that each step stopped with."""

    def __init__(self):
        self.values = {}
        self.errors = {}  # step number -> message


def run(**changes):
    """Run the learner's practice.py with the inputs below (the defaults, with `changes` on top).

    The file runs one step at a time, so a mistake in Step 4 does not hide that Steps 1 to 3 are fine."""
    source = PATH.read_text(encoding="utf-8")
    if END_MARKER not in source:
        pytest.fail("The marker line '# ===== END OF INPUTS =====' is missing from practice.py. Put it back: the checker needs it.", pytrace=False)
    inputs = {**DEFAULT, **changes}
    override = "".join(f"{name} = {value!r}\n" for name, value in inputs.items())
    source = source.replace(END_MARKER, override + END_MARKER, 1)
    lines = source.splitlines(keepends=True)
    headers = [i for i, line in enumerate(lines) if line.startswith(STEP_HEADER)]  # Step 1..4, then "Your results"
    bounds = [0] + headers + [len(lines)]
    steps = len(headers) - 1  # the block after the last step only prints the results
    result, namespace = Run(), {"__name__": "practice"}
    result.values = namespace
    for number in range(len(bounds) - 1):  # 0 is the INPUTS part, 1..steps are the steps
        start, end = bounds[number], bounds[number + 1]
        code = "\n" * start + "".join(lines[start:end])  # blank lines first, so error messages show the real line numbers
        try:
            with contextlib.redirect_stdout(io.StringIO()):  # the file prints its results; the checker does not need them
                exec(compile(code, str(PATH), "exec"), namespace)
        except Exception as error:  # noqa: BLE001 - whatever the learner's code raised, show it kindly
            line = next((f.lineno for f in reversed(traceback.extract_tb(error.__traceback__)) if f.filename == str(PATH)), None)
            where = f" at line {line}" if line else ""
            if number == 0:
                pytest.fail(f"The INPUTS part of practice.py stopped{where} with {type(error).__name__}: {error}", pytrace=False)
            if number <= steps:
                result.errors[number] = f"Your code for Step {number} stopped{where} of practice.py with {type(error).__name__}: {error}"
    return result


def value(result, name):
    """The learner's variable `name`, or a clear failure when its step crashed or the variable is missing."""
    step = STEP_OF[name]
    if step in result.errors:
        pytest.fail(result.errors[step], pytrace=False)
    if name not in result.values:
        pytest.fail(f"`{name}` is missing: practice.py should make a variable with that name.", pytrace=False)
    return result.values[name]


def check(result, name, expected, when=""):
    got = value(result, name)
    if got != expected or type(got) is not type(expected):
        suffix = f" when {when}" if when else ""
        pytest.fail(f"`{name}` should be {expected!r}{suffix}, but it is {got!r}", pytrace=False)


class TestStep1Types:
    def test_amount_is_written_with_dots(self):
        for amount, text in [(1250000, "Rp 1.250.000"), (999, "Rp 999"), (1000, "Rp 1.000"), (0, "Rp 0"), (7500000, "Rp 7.500.000")]:
            check(run(amount=amount), "formatted", text, f"amount is {amount}")

    def test_totals_are_added_as_numbers_not_glued_as_text(self):
        check(run(), "two_totals", 240000, "the totals are '150000' and '90000'")
        row1, row2 = {**DEFAULT["row1"], "total_idr": "250"}, {**DEFAULT["row2"], "total_idr": "100"}
        check(run(row1=row1, row2=row2), "two_totals", 350, "the totals are '250' and '100'")

    def test_a_number_is_not_text(self):
        # the two kinds of value: formatted is TEXT (str), two_totals is a NUMBER (int)
        result = run()
        for name, kind, word in (("formatted", str, "text (str)"), ("two_totals", int, "a number (int)")):
            got = value(result, name)
            if not isinstance(got, kind) or isinstance(got, bool):
                pytest.fail(f"`{name}` should be {word}, but it is {got!r}", pytrace=False)


class TestStep2Collections:
    def test_order_count(self):
        check(run(), "order_count", 4, "there are 4 orders")
        check(run(orders=ORDERS[:2]), "order_count", 2, "there are 2 orders")

    def test_status_of_the_first_order(self):
        check(run(), "first_status", "paid")
        check(run(orders=ORDERS[1:]), "first_status", "cancelled", "the first order is order 1002")

    def test_total_of_the_last_order_is_a_number(self):
        check(run(), "last_total", 60000, "the last order is 1004")
        check(run(orders=ORDERS[:3]), "last_total", 25000, "the last order is 1003")

    def test_different_ids_once_smallest_first(self):
        check(run(), "unique_ids", [3, 5, 7], "ids_seen is [7, 3, 7, 5]")
        check(run(ids_seen=[4, 4, 9, 1, 9]), "unique_ids", [1, 4, 9], "ids_seen is [4, 4, 9, 1, 9]")


class TestStep3Decisions:
    def test_negative_amount_has_the_minus_first(self):
        for amount, text in [(-45000, "-Rp 45.000"), (-1234567, "-Rp 1.234.567"), (-5, "-Rp 5")]:
            check(run(signed_amount=amount), "signed_text", text, f"signed_amount is {amount}")

    def test_positive_amount_has_no_minus(self):
        for amount, text in [(500, "Rp 500"), (2000000, "Rp 2.000.000"), (0, "Rp 0")]:
            check(run(signed_amount=amount), "signed_text", text, f"signed_amount is {amount}")

    def test_average_of_some_numbers(self):
        check(run(), "average", 87500.0, "totals is [150000, 25000]")
        check(run(totals=[100, 200, 300]), "average", 200.0, "totals is [100, 200, 300]")
        check(run(totals=[10]), "average", 10.0, "totals is [10]")

    def test_average_of_nothing_is_none_not_an_error(self):
        # None is only right when there is nothing to average: a list with one number must still give its average
        check(run(totals=[4]), "average", 4.0, "totals is [4]")
        check(run(totals=[]), "average", None, "totals is empty")


class TestStep4Loops:
    def test_orders_counted_per_status(self):
        check(run(), "status_counts", {"paid": 2, "cancelled": 1, "delivered": 1})
        more = ORDERS + [{"order_id": "1005", "customer_id": "9", "status": "refunded", "total_idr": "40000"},
                         {"order_id": "1006", "customer_id": "3", "status": "paid", "total_idr": "10000"}]
        check(run(orders=more), "status_counts", {"paid": 3, "cancelled": 1, "delivered": 1, "refunded": 1}, "there are 6 orders")

    def test_revenue_skips_cancelled_and_refunded(self):
        check(run(), "revenue", 235000, "order 1002 is cancelled")
        more = ORDERS + [{"order_id": "1005", "customer_id": "9", "status": "refunded", "total_idr": "40000"},
                         {"order_id": "1006", "customer_id": "3", "status": "shipped", "total_idr": "10000"}]
        check(run(orders=more), "revenue", 245000, "orders 1002 (cancelled) and 1005 (refunded) do not count")

    def test_customer_ids_are_numbers_each_once(self):
        check(run(), "customer_ids", [3, 5, 7])
        more = ORDERS + [{"order_id": "1005", "customer_id": "12", "status": "paid", "total_idr": "1000"},
                         {"order_id": "1006", "customer_id": "5", "status": "paid", "total_idr": "1000"}]
        check(run(orders=more), "customer_ids", [3, 5, 7, 12], "there are 6 orders")

    def test_items_cut_into_batches(self):
        check(run(), "batches", [[1, 2], [3, 4], [5]], "items is [1, 2, 3, 4, 5] and batch_size is 2")
        check(run(items=[1, 2, 3, 4, 5, 6, 7], batch_size=3), "batches", [[1, 2, 3], [4, 5, 6], [7]], "batch_size is 3 and items has 7 numbers")
        check(run(items=[8, 9], batch_size=5), "batches", [[8, 9]], "items has only 2 numbers and batch_size is 5")
