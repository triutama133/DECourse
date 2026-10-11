"""Reference solution for Lab 0.1."""
import csv
from datetime import datetime

VALID_STATUSES = {"paid", "shipped", "delivered", "cancelled", "refunded"}
NO_REVENUE = {"cancelled", "refunded"}


def load_orders(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def parse_total(raw):
    text = (raw or "").strip()
    if text.lower().startswith("rp"):
        text = text[2:].strip().replace(".", "")  # "Rp 1.250.000" -> "1250000"
    try:
        return int(text)
    except ValueError:
        return None


def parse_ts(raw):
    text = (raw or "").strip()
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%d/%m/%Y %H:%M"):
        try:
            return datetime.strptime(text, fmt).isoformat(timespec="seconds")
        except ValueError:
            continue
    return None


def clean_orders(rows):
    clean, rejected, seen = [], [], set()
    for row in rows:
        order_id = row["order_id"].strip()
        if order_id in seen:
            rejected.append({"row": row, "reason": "duplicate"})
            continue
        seen.add(order_id)
        total = parse_total(row["total_idr"])
        if total is None:
            rejected.append({"row": row, "reason": "bad_total"})
            continue
        if total <= 0:
            rejected.append({"row": row, "reason": "non_positive_total"})
            continue
        ts = parse_ts(row["order_ts"])
        if ts is None:
            rejected.append({"row": row, "reason": "bad_timestamp"})
            continue
        clean.append({
            "order_id": int(order_id), "customer_id": int(row["customer_id"]), "order_ts": ts,
            "status": row["status"].strip().lower(), "payment_method": row["payment_method"].strip(),
            "total_idr": total,
        })
    return clean, rejected


def daily_revenue(clean):
    revenue = {}
    for o in clean:
        if o["status"] in NO_REVENUE:
            continue
        day = o["order_ts"][:10]
        revenue[day] = revenue.get(day, 0) + o["total_idr"]
    return revenue
