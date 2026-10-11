"""Reference solution for Lab 0.0."""
import csv

CANCELLED = {"cancelled", "refunded"}


def format_rupiah(amount):
    sign = "-" if amount < 0 else ""
    digits = f"{abs(amount):,}".replace(",", ".")
    return f"{sign}Rp {digits}"


def safe_int(text, default=None):
    try:
        return int(str(text).strip())
    except ValueError:
        return default


def total_revenue(orders):
    total = 0
    for order in orders:
        if order["status"] in CANCELLED:
            continue
        total += int(order["total_idr"])
    return total


def count_by_status(orders):
    counts = {}
    for order in orders:
        status = order["status"]
        counts[status] = counts.get(status, 0) + 1
    return counts


def unique_customer_ids(orders):
    ids = set()
    for order in orders:
        ids.add(int(order["customer_id"]))
    return sorted(ids)


def split_valid(orders):
    valid, invalid = [], []
    for order in orders:
        total = safe_int(order["total_idr"])
        if total is None or total < 0:
            invalid.append(order)
        else:
            valid.append(order)
    return valid, invalid


def average_total(orders):
    if not orders:
        return None
    return sum(int(o["total_idr"]) for o in orders) / len(orders)


def top_customers(orders, n):
    spent = {}
    for order in orders:
        cid = int(order["customer_id"])
        spent[cid] = spent.get(cid, 0) + int(order["total_idr"])
    ranked = sorted(spent.items(), key=lambda pair: (-pair[1], pair[0]))
    return ranked[:n]


def batches(items, size):
    result = []
    for start in range(0, len(items), size):
        result.append(items[start:start + size])
    return result


def add_to_batch(order, batch=None):
    if batch is None:
        batch = []
    return batch + [order]


def read_orders(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))
