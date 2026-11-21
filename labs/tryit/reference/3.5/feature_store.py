def build_feature_store_views(prediction_requests, feature_updates):
    online_store = {}
    by_entity = {}

    for upd in feature_updates:
        eid = str(upd["entity_id"])
        ts = int(upd["updated_at"])
        rec = {
            "risk_score": int(upd["risk_score"]),
            "tx_count_24h": int(upd["tx_count_24h"]),
            "updated_at": ts,
        }
        by_entity.setdefault(eid, []).append(rec)
        if eid not in online_store or ts >= online_store[eid]["updated_at"]:
            online_store[eid] = rec

    offline_training_rows = []
    leaked_request_ids = []

    for req in sorted(prediction_requests, key=lambda r: str(r["request_id"])):
        rid = str(req["request_id"])
        eid = str(req["entity_id"])
        pred_ts = int(req["prediction_ts"])

        candidates = [u for u in by_entity.get(eid, []) if u["updated_at"] <= pred_ts]
        if candidates:
            best = max(candidates, key=lambda u: u["updated_at"])
            pit_risk = best["risk_score"]
            pit_tx = best["tx_count_24h"]
            pit_ts = best["updated_at"]
        else:
            pit_risk = 0
            pit_tx = 0
            pit_ts = None

        offline_training_rows.append({
            "request_id": rid,
            "entity_id": eid,
            "prediction_ts": pred_ts,
            "risk_score": pit_risk,
            "tx_count_24h": pit_tx,
            "feature_ts": pit_ts,
        })

        latest = online_store.get(eid)
        if latest and latest["updated_at"] > pred_ts:
            if (latest["risk_score"], latest["tx_count_24h"]) != (pit_risk, pit_tx):
                leaked_request_ids.append(rid)

    return {
        "offline_training_rows": offline_training_rows,
        "online_store": online_store,
        "leaked_request_ids": sorted(leaked_request_ids),
    }
