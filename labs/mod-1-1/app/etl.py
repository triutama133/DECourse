"""Tiny ETL job that you will containerise: counts KopiKu orders per status.

    python etl.py /data/orders.csv
"""
import csv
import sys
from collections import Counter

from tabulate import tabulate


def main(path):
    seen, counts = set(), Counter()
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["order_id"] in seen:
                continue
            seen.add(row["order_id"])
            counts[row["status"].strip().lower()] += 1
    print(tabulate(sorted(counts.items()), headers=["status", "orders"]))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python etl.py <orders.csv>")
    main(sys.argv[1])
