"""Reference solution: count KopiKu orders by status."""
import argparse
import csv
from collections import Counter


def main():
    parser = argparse.ArgumentParser(description="Count KopiKu orders by status")
    parser.add_argument("path", help="path to orders.csv")
    args = parser.parse_args()

    seen = set()
    counts = Counter()
    with open(args.path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["order_id"] in seen:
                continue
            seen.add(row["order_id"])
            counts[row["status"].strip().lower()] += 1

    for status, n in sorted(counts.items()):
        print(f"{status} {n}")


if __name__ == "__main__":
    main()
