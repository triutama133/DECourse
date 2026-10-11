"""(Provided, do not edit.) Makes the messy KopiKu orders file you clean in Lab 1.5.

    from orders_data import make_orders, make_customers
    csv_text, truth = make_orders()          # csv_text: what the export looks like, truth: the correct answer in plain Python

Write the text to a file to explore it in a notebook or a Python session:

    python3 -c "from orders_data import make_orders; open('orders_raw.csv','w').write(make_orders()[0])"

What is wrong with the file, on purpose (this is what real exports look like):
  - country is written " id", "Id", "ID " ...;  product has stray spaces and capitals          -> normalise
  - some lines are repeated exactly (the exporter retried)                                    -> one row per order_id
  - some order_date cells are not dates ("yesterday", "2026-02-30", empty)                      -> unusable rows
  - some quantity cells are empty, some unit_price_idr cells are "-"                             -> unusable rows
  - customer_id looks like a number but has leading zeros ("00042"); some ids are not in the customer list
"""
import csv
import io
import random
from datetime import date, timedelta

COUNTRIES = ["ID", "SG", "MY", "TH"]
PRODUCTS = {"espresso": 25000, "latte": 32000, "cold brew": 35000, "beans 1kg": 180000, "filter": 28000}
STATUSES = ["paid", "paid", "paid", "refunded", "cancelled"]
START = date(2026, 1, 1)
DAYS = 90
CUSTOMERS_KNOWN = 200      # 00001..00200 are in the customer list
CUSTOMERS_SEEN = 220       # orders also mention 00201..00220, which are NOT in the list


def make_customers(seed=7):
    """Customer list (a list of dicts): customer_id, name, tier, signup_date (ISO text)."""
    rng = random.Random(seed + 1)
    return [{"customer_id": f"{i:05d}", "name": f"Customer {i}", "tier": rng.choice(["gold", "silver", "bronze"]),
             "signup_date": (START - timedelta(days=rng.randint(30, 900))).isoformat()} for i in range(1, CUSTOMERS_KNOWN + 1)]


def make_orders(n=2000, seed=7):
    """Return (csv_text, truth). `truth` is a list of the CORRECT clean rows (dicts) after the cleaning rules in the lab."""
    rng = random.Random(seed)
    columns = ["order_id", "customer_id", "order_date", "country", "product", "quantity", "unit_price_idr", "status"]
    raw_rows, truth = [], []
    for i in range(1, n + 1):
        day = START + timedelta(days=rng.randrange(DAYS))
        country = rng.choices(COUNTRIES, weights=[5, 3, 2, 2])[0]
        product = rng.choice(list(PRODUCTS))
        quantity = rng.randint(1, 5)
        price = PRODUCTS[product] + rng.choice([0, 0, 0, 1000, -1000])
        row = {"order_id": f"O{i:06d}", "customer_id": f"{rng.randint(1, CUSTOMERS_SEEN):05d}", "order_date": day.isoformat(),
               "country": country, "product": product, "quantity": quantity, "unit_price_idr": price, "status": rng.choice(STATUSES)}
        good = True
        r = rng.random()
        if r < 0.015:
            row["order_date"] = rng.choice(["yesterday", "2026-02-30", ""]); good = False
        elif r < 0.035:
            row["quantity"] = ""; good = False
        elif r < 0.05:
            row["unit_price_idr"] = "-"; good = False
        if good:
            truth.append({**row, "order_date": day, "quantity": quantity, "unit_price_idr": float(price)})
        shown = dict(row)
        shown["country"] = rng.choice([country, country.lower(), " " + country, country.capitalize() + " "])
        shown["product"] = rng.choice([product, product.upper(), " " + product, product.title() + " "])
        raw_rows.append(shown)
        if rng.random() < 0.04:                      # the exporter retried: the same line appears twice
            raw_rows.append(dict(shown))
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=columns, lineterminator="\n")
    w.writeheader()
    w.writerows(raw_rows)
    return buf.getvalue(), truth
