"""Reference solution for Lab 2.1."""
import math
from pathlib import Path

import duckdb
import polars as pl
import pyarrow.parquet as pq


def to_parquet(csv_path, parquet_path, row_group_size=100_000):
    """CSV -> Parquet with zstd compression and the requested row group size."""
    src = str(csv_path).replace("'", "''")   # COPY ... TO cannot take a bound parameter for the path
    dst = str(parquet_path).replace("'", "''")
    duckdb.connect().execute(
        f"COPY (SELECT * FROM read_csv('{src}', header = true)) TO '{dst}' "
        f"(FORMAT PARQUET, COMPRESSION zstd, ROW_GROUP_SIZE {int(row_group_size)})"
    )


def revenue_by_month_roast_duckdb(data_dir):
    d = Path(data_dir)
    sql = f"""
        SELECT strftime(o.order_ts, '%Y-%m') AS month, p.roast_level, CAST(SUM(i.qty * i.unit_price_idr) AS BIGINT) AS revenue
        FROM read_parquet('{d / "order_items.parquet"}') i
        JOIN read_parquet('{d / "orders.parquet"}') o ON o.order_id = i.order_id
        JOIN read_parquet('{d / "products.parquet"}') p ON p.product_id = i.product_id
        GROUP BY 1, 2
        ORDER BY 1, 2
    """
    return [tuple(r) for r in duckdb.sql(sql).fetchall()]


def revenue_by_month_roast_polars(data_dir):
    d = Path(data_dir)
    items = pl.scan_parquet(d / "order_items.parquet")
    orders = pl.scan_parquet(d / "orders.parquet")
    products = pl.scan_parquet(d / "products.parquet")
    out = (
        items.join(orders, on="order_id")
        .join(products, on="product_id")
        .with_columns(
            month=pl.col("order_ts").dt.strftime("%Y-%m"),
            line=pl.col("qty") * pl.col("unit_price_idr"),
        )
        .group_by("month", "roast_level")
        .agg(pl.col("line").sum().alias("revenue"))
        .sort("month", "roast_level")
        .collect()
    )
    return [tuple(r) for r in out.iter_rows()]


def row_groups_to_read(parquet_path, column, lo, hi):
    """Indices of row groups that MIGHT contain `column` values in [lo, hi], judged only from footer statistics."""
    meta = pq.ParquetFile(parquet_path).metadata
    col_idx = next(i for i in range(meta.num_columns) if meta.row_group(0).column(i).path_in_schema == column)
    keep = []
    for g in range(meta.num_row_groups):
        stats = meta.row_group(g).column(col_idx).statistics
        if stats is None or not stats.has_min_max:
            keep.append(g)  # no statistics: cannot skip safely
        elif stats.max >= lo and stats.min <= hi:
            keep.append(g)
    return keep
