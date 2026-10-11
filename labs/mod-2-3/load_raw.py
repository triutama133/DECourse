#!/usr/bin/env python3
"""Lab 2.3 helper (provided): put the KopiKu CSVs into a DuckDB database as RAW tables, and simulate a later load.

    python3 labs/mod-2-3/load_raw.py data kopiku.duckdb            # initial load
    python3 labs/mod-2-3/load_raw.py data kopiku.duckdb --next     # a second, later load (run after your first dbt build)

Raw tables (schema "raw"): everything is TEXT, exactly as delivered, plus _loaded_at (when the row arrived).
They are APPEND-ONLY: an update to an order or a customer arrives as a NEW row with a later _loaded_at.
    raw.customers, raw.products, raw.orders, raw.order_items, raw.customer_changes
"""
import csv
import sys
from pathlib import Path

import duckdb

FIRST_LOAD = "2026-02-01 00:00:00"
NEXT_LOAD = "2026-02-02 00:00:00"
TABLES = {"customers": "customers.csv", "products": "products.csv", "orders": "orders.csv",
          "order_items": "order_items.csv", "customer_changes": "customer_changes.csv"}


def _read(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_initial(db_path, data_dir):
    con = duckdb.connect(str(db_path))
    con.execute("CREATE SCHEMA IF NOT EXISTS raw")
    for table, filename in TABLES.items():
        rows = _read(Path(data_dir) / filename)
        cols = list(rows[0].keys())
        con.execute(f"DROP TABLE IF EXISTS raw.{table}")
        con.execute(f"CREATE TABLE raw.{table} ({', '.join(c + ' VARCHAR' for c in cols)}, _loaded_at TIMESTAMP)")
        con.executemany(f"INSERT INTO raw.{table} VALUES ({', '.join('?' for _ in cols)}, TIMESTAMP '{FIRST_LOAD}')",
                        [[r[c] for c in cols] for r in rows])
    con.close()


def simulate_next_load(db_path, data_dir):
    """A later load: 50 new orders on a NEW day, 20 recent orders whose status changed (arriving as new rows),
    and 5 customers who moved city and changed tier. Returns a summary of what was added."""
    con = duckdb.connect(str(db_path))
    last_id = con.execute("SELECT max(order_id::BIGINT) FROM raw.orders").fetchone()[0]
    customers = [r[0] for r in con.execute("SELECT DISTINCT customer_id FROM raw.customers ORDER BY customer_id::BIGINT LIMIT 60").fetchall()]
    new_ids = list(range(last_id + 1, last_id + 51))
    for k, oid in enumerate(new_ids):
        con.execute("INSERT INTO raw.orders VALUES (?,?,?,?,?,?,?)",
                    [str(oid), customers[k % len(customers)], f"2026-01-31T{9 + k % 12:02d}:{k % 60:02d}:00", "paid", "card", str(100000 + k * 1000), NEXT_LOAD])
        con.execute("INSERT INTO raw.order_items VALUES (?,?,?,?,?,TIMESTAMP '%s')" % NEXT_LOAD, [str(oid), "1", "1", "2", str(50000 + k * 500)])
    recent = con.execute("""SELECT DISTINCT order_id FROM raw.orders
                            WHERE try_strptime(order_ts, '%Y-%m-%dT%H:%M:%S') >= TIMESTAMP '2026-01-25 00:00:00'
                              AND lower(trim(status)) IN ('delivered', 'paid')
                            ORDER BY order_id::BIGINT LIMIT 20""").fetchall()
    changed = []
    for k, (oid,) in enumerate(recent):
        new_status = "refunded" if k % 2 == 0 else "cancelled"
        base = con.execute("SELECT customer_id, order_ts, payment_method, total_idr FROM raw.orders WHERE order_id = ? ORDER BY _loaded_at LIMIT 1", [oid]).fetchone()
        con.execute("INSERT INTO raw.orders VALUES (?,?,?,?,?,?,?)", [oid, base[0], base[1], new_status, base[2], base[3], NEXT_LOAD])
        changed.append(oid)
    moved = []
    for cid in customers[:5]:
        r = con.execute("SELECT * FROM raw.customers WHERE customer_id = ? ORDER BY _loaded_at LIMIT 1", [cid]).fetchone()
        con.execute("INSERT INTO raw.customers VALUES (?,?,?,?,?,?,?)", [r[0], r[1], r[2], "Medan" if r[3] != "Medan" else "Denpasar", r[4], "Gold", NEXT_LOAD])
        moved.append(cid)
    con.close()
    return {"new_orders": len(new_ids), "status_changes": len(changed), "customers_moved": len(moved)}


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    if "--next" in sys.argv:
        print(simulate_next_load(sys.argv[2], sys.argv[1]))
    else:
        load_initial(sys.argv[2], sys.argv[1])
        print("raw tables loaded into", sys.argv[2])
