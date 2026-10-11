#!/usr/bin/env python3
"""Deterministic data generator for the KopiKu course scenario.

KopiKu is a (fictional) Indonesian online shop selling specialty coffee beans.
Every lab in the course uses this data. It is deliberately a little dirty,
the way real data is: duplicates, odd formats, late events, orphan keys.

Standard library only, so it runs on a fresh Python install.

    python shopgen.py --out data                  # default: 1,000 customers, 30 days
    python shopgen.py --out data --customers 5000 --days 90 --seed 7

Writes to --out:
    customers.csv        one row per customer (some duplicated)
    products.csv         the catalogue
    orders.csv           order headers
    order_items.csv      order lines
    events.ndjson        website click events, one JSON object per line
    customer_changes.csv customer attribute changes over time (for SCD / CDC labs)
    manifest.json        ground truth about what was planted, used by lab tests
"""
import argparse
import csv
import json
import random
from datetime import datetime, timedelta
from pathlib import Path

CITIES = ["Jakarta", "Bandung", "Surabaya", "Yogyakarta", "Medan", "Denpasar", "Makassar", "Semarang"]
TIERS = ["Bronze", "Silver", "Gold"]
PAYMENTS = ["card", "bank_transfer", "ewallet", "cod"]
STATUSES = ["paid", "shipped", "delivered", "cancelled", "refunded"]
ORIGINS = ["Gayo", "Toraja", "Kintamani", "Flores", "Java Preanger", "Mandheling"]
ROASTS = ["light", "medium", "dark"]
FIRST = ["Budi", "Siti", "Agus", "Dewi", "Rina", "Andi", "Wulan", "Fajar", "Maya", "Rizky", "Putri", "Dimas"]
LAST = ["Santoso", "Wijaya", "Pratama", "Lestari", "Hidayat", "Saputra", "Kusuma", "Nugroho", "Wahyuni", "Setiawan"]
EVENT_TYPES = ["page_view", "page_view", "page_view", "add_to_cart", "checkout", "purchase"]
PAGES = ["/", "/beans", "/beans/gayo", "/beans/toraja", "/cart", "/checkout", "/blog/brewing"]
DEVICES = ["mobile", "mobile", "desktop", "tablet"]


def build(out: Path, seed: int, n_customers: int, days: int, start: str):
    rnd = random.Random(seed)
    out.mkdir(parents=True, exist_ok=True)
    t0 = datetime.fromisoformat(start)
    manifest = {"seed": seed, "start": start, "days": days}

    # ---- products ----
    products = []
    for pid in range(1, 25):
        origin = ORIGINS[(pid - 1) % len(ORIGINS)]
        roast = ROASTS[(pid - 1) % len(ROASTS)]
        products.append({
            "product_id": pid, "name": f"{origin} {roast} 250g", "category": "beans",
            "origin": origin, "roast_level": roast, "price_idr": 65000 + 5000 * (pid % 9),
        })
    with open(out / "products.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(products[0])); w.writeheader(); w.writerows(products)

    # ---- customers ----
    customers = []
    for cid in range(1, n_customers + 1):
        name = f"{rnd.choice(FIRST)} {rnd.choice(LAST)}"
        email = f"{name.lower().replace(' ', '.')}{cid}@example.com"
        customers.append({
            "customer_id": cid, "full_name": name, "email": email,
            "city": rnd.choice(CITIES), "signup_date": (t0 - timedelta(days=rnd.randint(1, 400))).date().isoformat(),
            "tier": rnd.choices(TIERS, weights=[70, 22, 8])[0],
        })
    dirty_customers = [dict(c) for c in customers]
    n_missing_city = n_messy_email = 0
    for c in dirty_customers:
        r = rnd.random()
        if r < 0.02:
            c["city"] = ""; n_missing_city += 1
        elif r < 0.04:
            c["email"] = "  " + c["email"].upper() + " "; n_messy_email += 1
    dup_customers = rnd.sample(dirty_customers, max(1, n_customers // 100))
    dirty_customers.extend(dict(c) for c in dup_customers)
    rnd.shuffle(dirty_customers)
    with open(out / "customers.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(customers[0])); w.writeheader(); w.writerows(dirty_customers)
    manifest.update(customers_distinct=n_customers, customers_rows=len(dirty_customers),
                    customers_missing_city=n_missing_city, customers_messy_email=n_messy_email)

    # ---- orders + items ----
    orders, items = [], []
    oid = 1000
    for day in range(days):
        n_today = int(n_customers * 0.12) + rnd.randint(-5, 5)
        for _ in range(max(n_today, 1)):
            oid += 1
            cust = rnd.choice(customers)
            ts = t0 + timedelta(days=day, seconds=rnd.randint(0, 86399))
            lines = []
            for ln in range(1, rnd.randint(1, 3) + 1):
                p = rnd.choice(products)
                qty = rnd.randint(1, 3)
                lines.append((ln, p["product_id"], qty, p["price_idr"]))
                items.append({"order_id": oid, "line_no": ln, "product_id": p["product_id"], "qty": qty, "unit_price_idr": p["price_idr"]})
            total = sum(q * pr for _, _, q, pr in lines)
            orders.append({
                "order_id": oid, "customer_id": cust["customer_id"], "order_ts": ts.isoformat(timespec="seconds"),
                "status": rnd.choices(STATUSES, weights=[10, 15, 60, 10, 5])[0],
                "payment_method": rnd.choice(PAYMENTS), "total_idr": total,
            })
    clean_orders = [dict(o) for o in orders]
    n_orders_distinct = len(orders)
    revenue_clean = sum(o["total_idr"] for o in orders if o["status"] not in ("cancelled", "refunded"))

    dirty_orders = [dict(o) for o in orders]
    planted = {"status_case": 0, "bad_ts_format": 0, "formatted_total": 0, "negative_total": 0, "orphan_customer": 0}
    revenue_by_day = {}
    for o in orders:
        if o["status"] not in ("cancelled", "refunded"):
            revenue_by_day[o["order_ts"][:10]] = revenue_by_day.get(o["order_ts"][:10], 0) + o["total_idr"]
    for o in dirty_orders:
        r = rnd.random()
        if r < 0.03:
            o["status"] = rnd.choice([o["status"].upper(), o["status"].title()]); planted["status_case"] += 1
        elif r < 0.04:
            d = datetime.fromisoformat(o["order_ts"]); o["order_ts"] = d.strftime("%d/%m/%Y %H:%M"); planted["bad_ts_format"] += 1
        elif r < 0.05:
            o["total_idr"] = "Rp {:,}".format(o["total_idr"]).replace(",", "."); planted["formatted_total"] += 1
        elif r < 0.055:
            # a negative total is unrecoverable: its revenue is lost to a correct pipeline too
            if o["status"] not in ("cancelled", "refunded"):
                revenue_by_day[o["order_ts"][:10]] -= o["total_idr"]
            o["total_idr"] = -abs(o["total_idr"]); planted["negative_total"] += 1
        elif r < 0.06:
            o["customer_id"] = n_customers + rnd.randint(1, 50); planted["orphan_customer"] += 1
    dup_orders = rnd.sample(dirty_orders, max(1, len(dirty_orders) // 100))
    dirty_orders.extend(dict(o) for o in dup_orders)
    rnd.shuffle(dirty_orders)
    with open(out / "orders.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(orders[0])); w.writeheader(); w.writerows(dirty_orders)
    with open(out / "order_items.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(items[0])); w.writeheader(); w.writerows(items)
    manifest.update(orders_distinct=n_orders_distinct, orders_rows=len(dirty_orders), order_items_rows=len(items),
                    orders_duplicate_rows=len(dup_orders), orders_planted=planted,
                    revenue_clean_idr_before_dirt=revenue_clean,
                    daily_revenue_after_rejecting_negative=dict(sorted(revenue_by_day.items())))

    # ---- events (clickstream) ----
    events = []
    n_events = n_customers * days * 3
    for i in range(n_events):
        ts = t0 + timedelta(days=rnd.randint(0, days - 1), seconds=rnd.randint(0, 86399))
        uid = rnd.randint(1, n_customers) if rnd.random() > 0.15 else None
        events.append({"event_id": f"e{i:08d}", "user_id": uid, "event_time": ts.isoformat(timespec="seconds"),
                       "event_type": rnd.choice(EVENT_TYPES), "page": rnd.choice(PAGES), "device": rnd.choice(DEVICES)})
    events.sort(key=lambda e: e["event_time"])
    n_anonymous = sum(1 for e in events if e["user_id"] is None)
    lines = [json.dumps(e) for e in events]
    n_malformed = max(1, len(lines) // 100)
    for idx in rnd.sample(range(len(lines)), n_malformed):
        lines[idx] = lines[idx][:-5]  # truncated JSON
    dup_idx = rnd.sample(range(len(lines)), max(1, len(lines) // 100))
    lines.extend(lines[i] for i in dup_idx)
    # out of order: shuffle a slice of lines so some arrive late
    for _ in range(len(lines) // 50):
        a, b = rnd.randrange(len(lines)), rnd.randrange(len(lines))
        lines[a], lines[b] = lines[b], lines[a]
    with open(out / "events.ndjson", "w") as f:
        f.write("\n".join(lines) + "\n")
    manifest.update(events_distinct=n_events, events_lines=len(lines), events_malformed=n_malformed,
                    events_anonymous=n_anonymous)

    # ---- customer changes (city/tier moves) ----
    changes = []
    for c in rnd.sample(customers, max(3, n_customers // 10)):
        city, tier = c["city"], c["tier"]
        for k in range(rnd.randint(1, 3)):
            city = rnd.choice([x for x in CITIES if x != city])
            if rnd.random() < 0.3:
                tier = rnd.choice(TIERS)
            changes.append({"customer_id": c["customer_id"], "city": city, "tier": tier,
                            "effective_ts": (t0 + timedelta(days=rnd.randint(0, days - 1), seconds=rnd.randint(0, 86399))).isoformat(timespec="seconds")})
    changes.sort(key=lambda r: (r["customer_id"], r["effective_ts"]))
    with open(out / "customer_changes.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["customer_id", "city", "tier", "effective_ts"]); w.writeheader(); w.writerows(changes)
    manifest.update(customer_changes_rows=len(changes))

    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="data", type=Path)
    ap.add_argument("--seed", default=42, type=int)
    ap.add_argument("--customers", default=1000, type=int)
    ap.add_argument("--days", default=30, type=int)
    ap.add_argument("--start", default="2026-01-01")
    a = ap.parse_args()
    m = build(a.out, a.seed, a.customers, a.days, a.start)
    print(f"Wrote KopiKu data to {a.out}/ ({m['orders_rows']} order rows, {m['events_lines']} event lines)")


if __name__ == "__main__":
    main()
