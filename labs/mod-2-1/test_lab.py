"""Tests for Lab 2.1.   pip install -r labs/mod-2-1/requirements.txt && pytest labs/mod-2-1 -v"""
import csv
import math
import sqlite3
import sys
from pathlib import Path

import duckdb
import pyarrow.parquet as pq
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "mod-1-4"))
import labtools  # noqa: E402
import stage  # noqa: E402

lab = labtools.load(__file__, "analytics.py")
DATA, MANIFEST = labtools.shop_data()


@pytest.fixture(scope="module")
def staging():
    con = sqlite3.connect(":memory:")
    stage.build_staging(DATA, con)
    return con


@pytest.fixture(scope="module")
def parquet_dir(tmp_path_factory, staging):
    """Write the clean tables as CSV, then convert them with YOUR to_parquet."""
    d = tmp_path_factory.mktemp("lake")
    for table, name in (("stg_orders", "orders"), ("stg_order_items", "order_items"), ("stg_products", "products")):
        cur = staging.execute(f"SELECT * FROM {table}")
        with open(d / f"{name}.csv", "w", newline="") as f:
            w = csv.writer(f)
            w.writerow([c[0] for c in cur.description])
            w.writerows(cur.fetchall())
        lab.to_parquet(d / f"{name}.csv", d / f"{name}.parquet")
    return d


@pytest.fixture(scope="module")
def expected(staging):
    rows = staging.execute("""
        SELECT strftime('%Y-%m', o.order_ts), p.roast_level, SUM(i.qty * i.unit_price_idr)
        FROM stg_order_items i JOIN stg_orders o ON o.order_id = i.order_id JOIN stg_products p ON p.product_id = i.product_id
        GROUP BY 1, 2 ORDER BY 1, 2""").fetchall()
    return [tuple(r) for r in rows]


# ---------- part 1: writing Parquet ----------
class TestToParquet:
    def test_row_counts_survive_the_conversion(self, parquet_dir, staging):
        for name, table in (("orders", "stg_orders"), ("order_items", "stg_order_items"), ("products", "stg_products")):
            n = pq.ParquetFile(parquet_dir / f"{name}.parquet").metadata.num_rows
            assert n == staging.execute(f"SELECT count(*) FROM {table}").fetchone()[0]

    def test_uses_zstd_compression(self, parquet_dir):
        meta = pq.ParquetFile(parquet_dir / "order_items.parquet").metadata
        assert meta.row_group(0).column(0).compression == "ZSTD"

    def test_types_are_inferred_not_left_as_text(self, parquet_dir):
        schema = pq.ParquetFile(parquet_dir / "order_items.parquet").schema_arrow
        assert str(schema.field("qty").type).startswith("int")
        assert "timestamp" in str(pq.ParquetFile(parquet_dir / "orders.parquet").schema_arrow.field("order_ts").type)

    def test_small_row_groups_are_honoured(self, tmp_path):
        src = tmp_path / "n.csv"
        src.write_text("id,v\n" + "\n".join(f"{i},{i * 2}" for i in range(20_000)))
        lab.to_parquet(src, tmp_path / "small.parquet", row_group_size=4096)
        lab.to_parquet(src, tmp_path / "big.parquet")
        assert pq.ParquetFile(tmp_path / "small.parquet").metadata.num_row_groups >= 4
        assert pq.ParquetFile(tmp_path / "big.parquet").metadata.num_row_groups == 1


# ---------- part 2: two engines, one answer ----------
class TestEngines:
    def test_duckdb_result_matches_the_independent_calculation(self, parquet_dir, expected):
        assert lab.revenue_by_month_roast_duckdb(parquet_dir) == expected

    def test_polars_result_matches_too(self, parquet_dir, expected):
        assert lab.revenue_by_month_roast_polars(parquet_dir) == expected

    def test_revenue_is_an_int_not_a_float(self, parquet_dir):
        assert all(isinstance(r[2], int) for r in lab.revenue_by_month_roast_duckdb(parquet_dir))


# ---------- part 3: predicate pushdown by hand ----------
@pytest.fixture(scope="module")
def event_files(tmp_path_factory):
    d = tmp_path_factory.mktemp("events")
    con = duckdb.connect()
    con.execute("""CREATE TABLE ev AS SELECT i AS event_id, 1767225600 + (i // 50) AS event_ts, (hash(i) % 1000)::INT AS customer_id
                   FROM range(1000000) t(i)""")
    con.execute(f"COPY (SELECT * FROM ev ORDER BY event_ts) TO '{d}/sorted.parquet' (FORMAT PARQUET, ROW_GROUP_SIZE 50000)")
    con.execute(f"COPY (SELECT * FROM ev ORDER BY hash(event_id)) TO '{d}/shuffled.parquet' (FORMAT PARQUET, ROW_GROUP_SIZE 50000)")
    return d


class TestPushdown:
    LO, HI = 1767225600 + 4000, 1767225600 + 4300  # about 15,000 rows

    def rows_in_groups(self, path, groups):
        pf = pq.ParquetFile(path)
        t = pf.read_row_groups(groups, columns=["event_ts"]) if groups else None
        return 0 if t is None else sum(1 for v in t.column("event_ts").to_pylist() if self.LO <= v <= self.HI)

    def truth(self, path):
        return duckdb.sql(f"SELECT count(*) FROM read_parquet('{path}') WHERE event_ts BETWEEN {self.LO} AND {self.HI}").fetchone()[0]

    def test_never_skips_a_group_that_holds_matching_rows(self, event_files):
        for name in ("sorted", "shuffled"):
            p = event_files / f"{name}.parquet"
            assert self.rows_in_groups(p, lab.row_groups_to_read(p, "event_ts", self.LO, self.HI)) == self.truth(p)

    def test_sorted_data_lets_you_skip_almost_everything(self, event_files):
        p = event_files / "sorted.parquet"
        total = pq.ParquetFile(p).metadata.num_row_groups
        needed = lab.row_groups_to_read(p, "event_ts", self.LO, self.HI)
        assert 1 <= len(needed) <= 3 and total >= 15

    def test_shuffled_data_makes_the_statistics_useless(self, event_files):
        p = event_files / "shuffled.parquet"
        total = pq.ParquetFile(p).metadata.num_row_groups
        assert len(lab.row_groups_to_read(p, "event_ts", self.LO, self.HI)) >= total * 0.9
