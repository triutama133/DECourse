#!/usr/bin/env python3
"""Lab 1.4 helper (provided): load the cleaned KopiKu data into SQLite "staging" tables.

    python3 labs/mod-1-4/stage.py data warehouse.db

Staging tables (already cleaned, one row per real-world thing):
    stg_customers(customer_id, full_name, email, city, signup_date, tier)      city may be NULL
    stg_products(product_id, name, category, origin, roast_level, price_idr)
    stg_orders(order_id, customer_id, order_ts, status, payment_method, total_idr)
    stg_order_items(order_id, line_no, product_id, qty, unit_price_idr)
    stg_customer_changes(customer_id, city, tier, effective_ts)                each row = new state from effective_ts

Timestamps are ISO text "YYYY-MM-DDTHH:MM:SS". You build the star schema from these in warehouse.sql.
Note: some orders belong to a customer_id that does not exist in stg_customers (real data has orphans).
"""
import csv
import sqlite3
import sys
from datetime import datetime
from pathlib import Path


def _total(raw):
    t = (raw or "").strip()
    if t.lower().startswith("rp"):
        t = t[2:].strip().replace(".", "")
    try:
        return int(t)
    except ValueError:
        return None


def _ts(raw):
    t = (raw or "").strip()
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%d/%m/%Y %H:%M"):
        try:
            return datetime.strptime(t, fmt).isoformat(timespec="seconds")
        except ValueError:
            pass
    return None


def rows(path):
    with open(path, newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f)


def build_staging(data_dir, con):
    data_dir = Path(data_dir)
    con.executescript("""
        DROP TABLE IF EXISTS stg_customers; DROP TABLE IF EXISTS stg_products; DROP TABLE IF EXISTS stg_orders;
        DROP TABLE IF EXISTS stg_order_items; DROP TABLE IF EXISTS stg_customer_changes;
        CREATE TABLE stg_customers (customer_id INTEGER PRIMARY KEY, full_name TEXT, email TEXT, city TEXT, signup_date TEXT, tier TEXT);
        CREATE TABLE stg_products (product_id INTEGER PRIMARY KEY, name TEXT, category TEXT, origin TEXT, roast_level TEXT, price_idr INTEGER);
        CREATE TABLE stg_orders (order_id INTEGER PRIMARY KEY, customer_id INTEGER, order_ts TEXT, status TEXT, payment_method TEXT, total_idr INTEGER);
        CREATE TABLE stg_order_items (order_id INTEGER, line_no INTEGER, product_id INTEGER, qty INTEGER, unit_price_idr INTEGER, PRIMARY KEY (order_id, line_no));
        CREATE TABLE stg_customer_changes (customer_id INTEGER, city TEXT, tier TEXT, effective_ts TEXT);
    """)
    seen = set()
    for r in rows(data_dir / "customers.csv"):
        cid = int(r["customer_id"])
        if cid in seen:
            continue
        seen.add(cid)
        con.execute("INSERT INTO stg_customers VALUES (?,?,?,?,?,?)",
                    (cid, r["full_name"].strip(), r["email"].strip().lower(), r["city"].strip() or None, r["signup_date"], r["tier"]))
    for r in rows(data_dir / "products.csv"):
        con.execute("INSERT INTO stg_products VALUES (?,?,?,?,?,?)",
                    (int(r["product_id"]), r["name"], r["category"], r["origin"], r["roast_level"], int(r["price_idr"])))
    seen = set()
    for r in rows(data_dir / "orders.csv"):
        oid, total, ts = int(r["order_id"]), _total(r["total_idr"]), _ts(r["order_ts"])
        if oid in seen or total is None or total <= 0 or ts is None:
            continue
        seen.add(oid)
        con.execute("INSERT INTO stg_orders VALUES (?,?,?,?,?,?)",
                    (oid, int(r["customer_id"]), ts, r["status"].strip().lower(), r["payment_method"].strip(), total))
    for r in rows(data_dir / "order_items.csv"):
        if int(r["order_id"]) in seen:
            con.execute("INSERT INTO stg_order_items VALUES (?,?,?,?,?)",
                        (int(r["order_id"]), int(r["line_no"]), int(r["product_id"]), int(r["qty"]), int(r["unit_price_idr"])))
    for r in rows(data_dir / "customer_changes.csv"):
        con.execute("INSERT INTO stg_customer_changes VALUES (?,?,?,?)",
                    (int(r["customer_id"]), r["city"].strip() or None, r["tier"], r["effective_ts"]))
    con.commit()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    db = sqlite3.connect(sys.argv[2])
    build_staging(sys.argv[1], db)
    n = {t: db.execute(f"SELECT count(*) FROM {t}").fetchone()[0] for t in
         ("stg_customers", "stg_products", "stg_orders", "stg_order_items", "stg_customer_changes")}
    print("staged:", n)
