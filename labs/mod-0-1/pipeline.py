"""Lab 0.1: clean the KopiKu orders file.

Run the tests:   python labs/mod-0-1/test_lab.py -v
Generate data:   python labs/shared/shopgen.py --out data
"""
import csv


def load_orders(path):
    """Read orders.csv into a list of dicts. Every value is a string. (Provided.)"""
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def parse_total(raw):
    """Turn a raw total into an int number of rupiah, or None if it cannot be understood.

    Real examples from the file:  "150000"   "Rp 1.250.000"   "-45000"   ""   "abc"
    """
    raise NotImplementedError("TODO: implement parse_total")


def parse_ts(raw):
    """Return the timestamp as ISO text "YYYY-MM-DDTHH:MM:SS", or None if unreadable.

    Two formats occur in the file:  "2026-01-31T14:03:00"   and   "31/01/2026 14:03"
    """
    raise NotImplementedError("TODO: implement parse_ts")


def clean_orders(rows):
    """Return (clean, rejected).

    clean:    list of dicts with order_id (int), customer_id (int), order_ts (ISO text),
              status (lower-case, stripped), payment_method, total_idr (int > 0)
    rejected: list of {"row": <original row>, "reason": <short text>} for every row you drop.
              Duplicates (same order_id as an earlier row) are rejected, keeping the first.
    """
    raise NotImplementedError("TODO: implement clean_orders")


def daily_revenue(clean):
    """Return {"YYYY-MM-DD": revenue_in_rupiah}. Cancelled and refunded orders earn nothing."""
    raise NotImplementedError("TODO: implement daily_revenue")


if __name__ == "__main__":
    import sys
    rows = load_orders(sys.argv[1] if len(sys.argv) > 1 else "data/orders.csv")
    clean, rejected = clean_orders(rows)
    print(f"{len(rows)} rows in, {len(clean)} clean, {len(rejected)} rejected")
    for day, total in sorted(daily_revenue(clean).items())[:5]:
        print(day, f"Rp {total:,}")
