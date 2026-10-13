import csv
import sqlite3

with open("data/orders.csv", newline="") as f:
    rows = list(csv.DictReader(f))
print(len(rows), len({r["order_id"] for r in rows}))

con = sqlite3.connect("kopiku.db")
con.execute("DROP TABLE IF EXISTS orders")
con.execute("CREATE TABLE orders (order_id INTEGER PRIMARY KEY, customer_id TEXT, order_ts TEXT, status TEXT, payment_method TEXT, total_idr TEXT)")


def load():
    con.executemany("INSERT OR REPLACE INTO orders VALUES (?, ?, ?, ?, ?, ?)",
                    [(r["order_id"], r["customer_id"], r["order_ts"], r["status"], r["payment_method"], r["total_idr"]) for r in rows])
    con.commit()
    print(con.execute("SELECT count(*) FROM orders").fetchone()[0])


load()
load()
