"""Lab 2.1: columnar files and engines.   Tests: pytest labs/mod-2-1 -v

Implement the four functions. Read test_lab.py first: it explains what is checked and why.
"""
from pathlib import Path

import duckdb
import polars as pl
import pyarrow.parquet as pq


def to_parquet(csv_path, parquet_path, row_group_size=100_000):
    """Convert a CSV file to Parquet: zstd compression, the given row group size, column types inferred.
    Hint: DuckDB's COPY (SELECT * FROM read_csv('...')) TO '...' (FORMAT PARQUET, COMPRESSION ..., ROW_GROUP_SIZE ...).
    Build the statement as a string: COPY ... TO does not accept a bound ? parameter for the path."""
    raise NotImplementedError("TODO: to_parquet")


def revenue_by_month_roast_duckdb(data_dir):
    """Using DuckDB SQL directly on <data_dir>/order_items.parquet, orders.parquet and products.parquet, return
    [(month 'YYYY-MM', roast_level, revenue_idr), ...] sorted by month then roast_level.
    revenue = sum(qty * unit_price_idr) over order lines; month comes from orders.order_ts. Revenue must be an int."""
    raise NotImplementedError("TODO: revenue_by_month_roast_duckdb")


def revenue_by_month_roast_polars(data_dir):
    """Same result, same shape, but with Polars LAZY (pl.scan_parquet ... .collect()). Return a list of tuples."""
    raise NotImplementedError("TODO: revenue_by_month_roast_polars")


def row_groups_to_read(parquet_path, column, lo, hi):
    """Predicate pushdown by hand. Return the indices of the row groups that MIGHT contain values of `column`
    between lo and hi (inclusive), using ONLY the min/max statistics in the Parquet footer (pyarrow metadata).
    A row group whose statistics are missing cannot be skipped. This is what an engine does before reading any data."""
    raise NotImplementedError("TODO: row_groups_to_read")
