"""Count KopiKu orders by status.

    python summarize.py data/orders.csv

Output: one line per status, "<status> <count>", sorted by status. The format looks like this
(the numbers here are only illustrative):
    cancelled 123
    delivered 456

Rules:
  - count each order_id once (the file contains duplicate rows)
  - statuses are compared lower-case and stripped, so "PAID" and "paid" are the same
"""
import argparse
import csv
from collections import Counter


def main():
    parser = argparse.ArgumentParser(description="Count KopiKu orders by status")
    parser.add_argument("path", help="path to orders.csv")
    args = parser.parse_args()

    # TODO: read args.path with the csv module, skip repeated order_id values,
    #       count statuses (lower-case, stripped) and print them sorted.
    raise NotImplementedError("write the counting logic")


if __name__ == "__main__":
    main()
