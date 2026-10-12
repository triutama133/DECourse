"""Lab 0.0: Python from zero, with KopiKu orders.

Eleven small functions. Each one practises one idea from the lessons (variables, collections, if, for, def, errors, files).
Run the tests after EACH function:   pytest labs/mod-0-0/test_lab.py -v
An order is a dict whose values are all strings, exactly as they come out of a CSV file:
    {"order_id": "1001", "customer_id": "7", "status": "paid", "total_idr": "150000"}
"""
import csv  # noqa: F401  (you need it for read_orders)

CANCELLED = {"cancelled", "refunded"}  # a set: statuses that bring in no money


def format_rupiah(amount):
    """Turn a whole number into text with dots between thousands.   (lessons 1 and 5)

    1250000 -> "Rp 1.250.000"      0 -> "Rp 0"      -45000 -> "-Rp 45.000"
    Hint: f"{n:,}" puts commas between thousands; .replace(",", ".") swaps them for dots.
    For negative numbers, separate the sign: use abs(amount) for digits, and put "-" before "Rp".
    """
    raise NotImplementedError("TODO: implement format_rupiah")


def safe_int(text, default=None):
    """Turn text into an int, or return `default` when that is impossible.   (lesson 6: try / except)

    "42" -> 42     " 42 " -> 42     "abc" -> None     "" -> None     safe_int("abc", 0) -> 0
    """
    raise NotImplementedError("TODO: implement safe_int")


def total_revenue(orders):
    """Add up total_idr (as numbers!) of every order whose status is NOT in CANCELLED.   (lessons 3 and 4: if, for)

    The values are strings: int("150000") makes the number 150000.
    """
    raise NotImplementedError("TODO: implement total_revenue")


def count_by_status(orders):
    """How many orders have each status? Return a dict such as {"paid": 3, "cancelled": 1}.   (lessons 2 and 4: dict, for)"""
    raise NotImplementedError("TODO: implement count_by_status")


def unique_customer_ids(orders):
    """The distinct customer ids as ints, smallest first, each once.   (lesson 2: set)
    
    Hint: Add int(cid) to a set to remove duplicates, then use sorted(ids) to get a sorted list.
    """
    raise NotImplementedError("TODO: implement unique_customer_ids")


def split_valid(orders):
    """Return two lists (valid, invalid). An order is INVALID when its total_idr is not a whole number or is negative.

    Use your safe_int. Order inside each list must stay the same as in `orders`.   (lessons 3, 5, 6: if, def, errors)
    """
    raise NotImplementedError("TODO: implement split_valid")


def average_total(orders):
    """The average total_idr as a float, or None when there are no orders (never divide by zero!).   (lesson 3)"""
    raise NotImplementedError("TODO: implement average_total")


def top_customers(orders, n):
    """The n customers who spent the most, as a list of (customer_id, total) tuples, biggest total first.

    customer_id is an int. If two customers have the same total, the smaller id comes first.   (lessons 2, 4: dict, for, tuple)
    Hint:
    1. Collect totals in a dict: spent[cid] = spent.get(cid, 0) + total.
    2. Sort dict items: sorted(spent.items(), key=lambda pair: (-pair[1], pair[0]))
       Here -pair[1] sorts total descending, and pair[0] breaks ties with smaller customer_id first.
    3. Slice the first n: [:n].
    """
    raise NotImplementedError("TODO: implement top_customers")


def batches(items, size):
    """Cut a list into a list of chunks of at most `size` items, keeping the order.   (lesson 4: range with a step, slicing)

    batches([1, 2, 3, 4, 5], 2) -> [[1, 2], [3, 4], [5]]      batches([], 3) -> []
    """
    raise NotImplementedError("TODO: implement batches")


def add_to_batch(order, batch=None):
    """Return a NEW list: everything in `batch` plus `order` at the end. Never change the list that was passed in,
    and never remember anything between calls.   (lesson 5: the mutable default argument trap; see the Chaos tab)

    add_to_batch("a") -> ["a"]      add_to_batch("b") -> ["b"]      add_to_batch("c", ["a", "b"]) -> ["a", "b", "c"]
    """
    raise NotImplementedError("TODO: implement add_to_batch")


def read_orders(path):
    """Read a CSV file into a list of dicts (one per row, all values strings).   (lesson 7: with, csv)

    Open with encoding="utf-8" and newline="" , and use a `with` block so the file is always closed.
    """
    raise NotImplementedError("TODO: implement read_orders")
