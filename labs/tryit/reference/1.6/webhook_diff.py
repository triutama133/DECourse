import hashlib
import hmac
import json


def verify_webhook_batch(events, secret, now_ts, tolerance_sec=300):
    accepted = []
    rejected = []
    seen_ids = set()

    for ev in events:
        eid = str(ev["event_id"])
        ts = int(ev["timestamp"])
        body = str(ev["body"])
        sig = str(ev["signature"])

        if abs(int(now_ts) - ts) > int(tolerance_sec):
            rejected.append({"event_id": eid, "reason": "stale_timestamp"})
            continue

        expected_sig = "sha256=" + hmac.new(
            secret.encode("utf-8"),
            f"{ts}.{body}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(sig, expected_sig):
            rejected.append({"event_id": eid, "reason": "invalid_signature"})
            continue

        if eid in seen_ids:
            continue
        seen_ids.add(eid)
        accepted.append(json.loads(body))

    return {"accepted": accepted, "rejected": rejected}


def compute_snapshot_diff(prev_rows, curr_rows, pk="id"):
    prev_map = {r[pk]: r for r in prev_rows}
    curr_map = {r[pk]: r for r in curr_rows}

    inserts = []
    updates = []
    unchanged_count = 0

    for k in sorted(curr_map):
        if k not in prev_map:
            inserts.append(curr_map[k])
        elif curr_map[k] != prev_map[k]:
            updates.append(curr_map[k])
        else:
            unchanged_count += 1

    deletes = sorted(k for k in prev_map if k not in curr_map)

    return {
        "inserts": inserts,
        "updates": updates,
        "deletes": deletes,
        "unchanged_count": unchanged_count,
    }
