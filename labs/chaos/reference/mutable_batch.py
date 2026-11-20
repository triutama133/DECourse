"""Reference fix for the mutable_batch chaos drill (scripts/chaos_drill.py). Try the drill yourself before reading this."""

def transform_batch(raw_rows, accepted=None, rejected=None):
    if accepted is None:
        accepted = []
    if rejected is None:
        rejected = []
    for r in raw_rows:
        oid = str(r.get("order_id", ""))
        try:
            amt = int(r["total_idr"])
        except (ValueError, TypeError, KeyError):
            rejected.append({"order_id": oid, "reason": "bad_total"})
            continue
        if amt < 0:
            rejected.append({"order_id": oid, "reason": "negative_total"})
            continue
        accepted.append({"order_id": oid, "total_idr": amt})
    return {"accepted": accepted, "rejected": rejected}
