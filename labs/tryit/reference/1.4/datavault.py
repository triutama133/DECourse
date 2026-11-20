"""Reference solution for Try-It 1.4-1: Data Vault 2.0 Hub, Link & Satellite builder."""
import hashlib


def _sha256(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _norm(val):
    return str(val).strip().upper()


def build_data_vault(events, record_source="kopiku_oms"):
    hub_customer = {}
    hub_order = {}
    links = {}
    sat_customer = []
    last_customer_diff = {}

    sorted_events = sorted(events, key=lambda e: str(e["load_ts"]))
    for ev in sorted_events:
        cid = _norm(ev["customer_id"])
        oid = _norm(ev["order_id"])
        city = str(ev["city"]).strip()
        tier = str(ev["tier"]).strip()
        ts = str(ev["load_ts"])

        hk_c = _sha256(cid)
        hk_o = _sha256(oid)
        hk_l = _sha256(f"{cid}|{oid}")

        if hk_c not in hub_customer:
            hub_customer[hk_c] = {
                "hk_customer": hk_c,
                "customer_id": cid,
                "load_ts": ts,
                "record_source": record_source,
            }

        if hk_o not in hub_order:
            hub_order[hk_o] = {
                "hk_order": hk_o,
                "order_id": oid,
                "load_ts": ts,
                "record_source": record_source,
            }

        if hk_l not in links:
            links[hk_l] = {
                "hk_link": hk_l,
                "hk_customer": hk_c,
                "hk_order": hk_o,
                "load_ts": ts,
                "record_source": record_source,
            }

        hdiff = _sha256(f"{_norm(city)}|{_norm(tier)}")
        if last_customer_diff.get(hk_c) != hdiff:
            last_customer_diff[hk_c] = hdiff
            sat_customer.append({
                "hk_customer": hk_c,
                "city": city,
                "tier": tier,
                "hash_diff": hdiff,
                "load_ts": ts,
                "record_source": record_source,
            })

    return {
        "hub_customer": list(hub_customer.values()),
        "hub_order": list(hub_order.values()),
        "link_customer_order": list(links.values()),
        "sat_customer": sat_customer,
    }
