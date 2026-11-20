"""Reference solution for Try-It 2.6-1: Brownfield Strangler Reconciliation, Semantic Layer & Reverse ETL."""
import hashlib

VALID_STATUSES = {"paid", "shipped", "delivered"}


def run_strangler_and_reverse_etl(orders, legacy_daily_totals, sync_date):
    semantic_daily = {}
    customer_ltv = {}

    for o in orders:
        dt = str(o["order_date"])
        semantic_daily.setdefault(dt, 0)
        status = str(o.get("status", "")).strip().lower()
        if status in VALID_STATUSES:
            net = int(o["gross_idr"]) - int(o["discount_idr"]) - int(o["tax_idr"])
            semantic_daily[dt] += net
            cid = str(o["customer_id"])
            customer_ltv[cid] = customer_ltv.get(cid, 0) + net

    drift_report = []
    for dt in sorted(set(semantic_daily) | set(legacy_daily_totals)):
        sem_val = semantic_daily.get(dt, 0)
        leg_val = legacy_daily_totals.get(dt, 0)
        if sem_val != leg_val:
            drift_report.append({
                "date": dt,
                "legacy_idr": leg_val,
                "semantic_idr": sem_val,
                "delta_idr": sem_val - leg_val,
            })

    reverse_etl_payloads = []
    for cid in sorted(customer_ltv):
        ltv = customer_ltv[cid]
        if ltv <= 0:
            continue
        idem_key = hashlib.sha256(f"{cid}:{sync_date}:{ltv}".encode("utf-8")).hexdigest()
        reverse_etl_payloads.append({
            "customer_id": cid,
            "net_ltv_idr": ltv,
            "tier_action": "VIP_UPGRADE" if ltv >= 200000 else "STANDARD_SYNC",
            "idempotency_key": idem_key,
        })

    return {
        "semantic_daily": semantic_daily,
        "drift_report": drift_report,
        "reverse_etl_payloads": reverse_etl_payloads,
    }
