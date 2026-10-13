"""Debug drill for Lab 0.0 (lesson 8). Run it:   python3 labs/mod-0-0/debug_me.py

Three small functions below each contain ONE bug. The script runs a few checks on each and prints PASS or FAIL.
Fix them one at a time with the routine from the lesson: read the error from the bottom, reproduce with the smallest input,
inspect the value just before the failing line (print(type(x), x)). Do not rewrite a function from scratch: find the bug.
When you are done, write one sentence per bug: what was the clue that led you to it?
"""


def average_total(orders):
    """Average of the order totals as a number; None when there are no orders. Totals are text like "150000"."""
    total = 0
    for order in orders:
        total += order["total_idr"]
    return total / len(orders)


def paid_ids(orders):
    """The order_id of every order whose status is "paid", in the original order."""
    ids = []
    for order in orders:
        if order["status"] == "paid":
            ids.append(order["order_id"])
        return ids


def first_word(text):
    """The first word of a sentence; an empty string for blank text."""
    return text.split()[1]


# ------------------------------------------------------------------ the checks (you do not need to edit anything below)
def attempt(name, checks):
    try:
        for expected, call in checks:
            got = call()
            assert got == expected, f"expected {expected!r}, got {got!r}"
        print(f"PASS  {name}")
        return True
    except Exception as e:  # noqa: BLE001
        print(f"FAIL  {name}: {type(e).__name__}: {e}")
        return False


orders = [{"order_id": "1", "status": "paid", "total_idr": "100"}, {"order_id": "2", "status": "cancelled", "total_idr": "300"},
          {"order_id": "3", "status": "paid", "total_idr": "200"}]
results = [
    attempt("average_total", [(200.0, lambda: average_total(orders)), (None, lambda: average_total([]))]),
    attempt("paid_ids", [(["1", "3"], lambda: paid_ids(orders)), ([], lambda: paid_ids([]))]),
    attempt("first_word", [("Gayo", lambda: first_word("Gayo Medium 250g")), ("", lambda: first_word("   "))]),
]
print("all three fixed" if all(results) else f"{results.count(False)} still to fix")
