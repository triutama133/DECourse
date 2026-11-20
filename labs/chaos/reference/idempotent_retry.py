"""Reference fix for the idempotent_retry chaos drill (scripts/chaos_drill.py). Try the drill yourself before reading this."""

def load_daily_orders(existing_rows, incoming_batch):
    by_id = {}
    for r in list(existing_rows) + list(incoming_batch):
        oid = str(r["order_id"]).strip()
        by_id[oid] = {
            "order_id": oid,
            "status": str(r.get("status", "")).strip().lower(),
            "total_idr": int(r["total_idr"]),
        }
    deduped = [by_id[k] for k in sorted(by_id)]
    revenue = sum(
        r["total_idr"]
        for r in deduped
        if r["status"] not in {"cancelled", "refunded"}
    )
    return {"rows": deduped, "net_revenue_idr": revenue}
