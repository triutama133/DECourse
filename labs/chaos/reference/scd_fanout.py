"""Reference fix for the scd_fanout chaos drill (scripts/chaos_drill.py). Try the drill yourself before reading this."""

def join_orders_to_scd2(orders, customer_versions):
    revenue_by_tier = {}
    matched_rows = 0
    for o in orders:
        ts = str(o["order_ts"])
        amt = int(o["total_idr"])
        tier = "Unknown"
        for cv in customer_versions:
            if (
                o["customer_id"] == cv["customer_id"]
                and str(cv["valid_from"]) <= ts < str(cv["valid_to"])
            ):
                tier = cv["tier"]
                break
        revenue_by_tier[tier] = revenue_by_tier.get(tier, 0) + amt
        matched_rows += 1
    return {"matched_rows": matched_rows, "revenue_by_tier": revenue_by_tier}
