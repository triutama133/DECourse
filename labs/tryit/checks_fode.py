"""Checks for the Fundamentals of Data Engineering (Reis & Housley) Try-It exercises:
- 1.4-1: Data Vault 2.0 Hub, Link & Satellite Builder with Deterministic SHA-256 Hash Keys (datavault.py)
- 2.5-1: PII Salted Hashing, GDPR Right-to-Be-Forgotten Erasure & MDM Golden Record Resolution (privacy_gate.py)
- 2.6-1: Brownfield Strangler Reconciliation, Semantic Layer Metric Parity & Idempotent Reverse ETL (strangler_reverse_etl.py)
Used by check.py; not meant to be run directly.
"""
import hashlib
import importlib.util
import sys
from pathlib import Path

from check import exercise


def load_module(ctx, filename, mod_name):
    path = ctx.work / filename
    spec = importlib.util.spec_from_file_location(mod_name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def sha256_hex(val):
    return hashlib.sha256(val.encode("utf-8")).hexdigest()


def run_hidden(ctx, fn, args, kwargs, expected, canon, text, hint):
    """Second pass: data the learner never sees, built to break the usual shortcuts. Compares the whole result."""
    try:
        got = fn(*args, **kwargs)
    except Exception as e:
        ctx.fail(text, f"your function crashed on the hidden data: {type(e).__name__}: {e}")
        return
    try:
        same = canon(got) == canon(expected)
    except Exception:
        same = False
    ctx.check(same, text, hint)


def _dv_oracle(events, record_source):
    norm = lambda v: str(v).strip().upper()
    hubs_c, hubs_o, links, sat, last = {}, {}, {}, [], {}
    for ev in sorted(events, key=lambda e: str(e["load_ts"])):
        cid, oid, ts = norm(ev["customer_id"]), norm(ev["order_id"]), str(ev["load_ts"])
        hc, ho, hl = sha256_hex(cid), sha256_hex(oid), sha256_hex(f"{cid}|{oid}")
        hubs_c.setdefault(hc, {"hk_customer": hc, "customer_id": cid, "load_ts": ts, "record_source": record_source})
        hubs_o.setdefault(ho, {"hk_order": ho, "order_id": oid, "load_ts": ts, "record_source": record_source})
        links.setdefault(hl, {"hk_link": hl, "hk_customer": hc, "hk_order": ho, "load_ts": ts, "record_source": record_source})
        hd = sha256_hex(f"{norm(ev['city'])}|{norm(ev['tier'])}")
        if last.get(hc) != hd:
            last[hc] = hd
            sat.append({"hk_customer": hc, "hash_diff": hd, "load_ts": ts, "record_source": record_source})
    return {"hub_customer": list(hubs_c.values()), "hub_order": list(hubs_o.values()), "link_customer_order": list(links.values()), "sat_customer": sat}


def _dv_canon(res):
    pick = lambda rows, keys: sorted(tuple(str(r.get(k)) for k in keys) for r in rows)
    return (pick(res["hub_customer"], ["hk_customer", "customer_id", "load_ts", "record_source"]),
            pick(res["hub_order"], ["hk_order", "order_id", "load_ts", "record_source"]),
            pick(res["link_customer_order"], ["hk_link", "hk_customer", "hk_order", "load_ts", "record_source"]),
            pick(res["sat_customer"], ["hk_customer", "hash_diff", "load_ts", "record_source"]))


def _privacy_oracle(records, erasure_emails, salt):
    import re
    erase = {str(e).strip().lower() for e in erasure_emails}
    audit, groups = [], {}
    for rec in records:
        em = str(rec["email"]).strip().lower()
        if em in erase:
            audit.append(str(rec["source_id"]))
            continue
        tok = sha256_hex(f"{salt}:{em}")
        digits = re.sub(r"\D+", "", str(rec.get("phone", "")))
        masked = f"***-***-{digits[-4:]}" if len(digits) >= 4 else "***-***-****"
        g = groups.setdefault(tok, {"pii_token": tok, "source_ids": [], "updated_at": ""})
        g["source_ids"].append(str(rec["source_id"]))
        if str(rec["updated_at"]) >= str(g["updated_at"]):
            g.update(city=rec["city"], tier=rec["tier"], updated_at=rec["updated_at"], phone_masked=masked)
    golden = []
    for tok in sorted(groups):
        g = groups[tok]
        g["source_ids"] = sorted(set(g["source_ids"]))
        golden.append(g)
    return {"golden_records": golden, "erased_audit": sorted(audit)}


def _privacy_canon(res):
    keys = ["pii_token", "phone_masked", "city", "tier", "updated_at", "source_ids"]
    return ([tuple(str(r.get(k)) for k in keys) + (tuple(sorted(r.keys())),) for r in res["golden_records"]], list(res["erased_audit"]))


def _strangler_oracle(orders, legacy, sync_date):
    sem, ltv = {}, {}
    for o in orders:
        dt = str(o["order_date"])
        sem.setdefault(dt, 0)
        if str(o.get("status", "")).strip().lower() in {"paid", "shipped", "delivered"}:
            net = int(o["gross_idr"]) - int(o["discount_idr"]) - int(o["tax_idr"])
            sem[dt] += net
            ltv[str(o["customer_id"])] = ltv.get(str(o["customer_id"]), 0) + net
    drift = [{"date": d, "legacy_idr": legacy.get(d, 0), "semantic_idr": sem.get(d, 0), "delta_idr": sem.get(d, 0) - legacy.get(d, 0)}
             for d in sorted(set(sem) | set(legacy)) if sem.get(d, 0) != legacy.get(d, 0)]
    pay = [{"customer_id": c, "net_ltv_idr": v, "tier_action": "VIP_UPGRADE" if v >= 200000 else "STANDARD_SYNC",
            "idempotency_key": sha256_hex(f"{c}:{sync_date}:{v}")} for c, v in sorted(ltv.items()) if v > 0]
    return {"semantic_daily": sem, "drift_report": drift, "reverse_etl_payloads": pay}


def _strangler_canon(res):
    return (dict(res["semantic_daily"]),
            [tuple(str(d.get(k)) for k in ["date", "legacy_idr", "semantic_idr", "delta_idr"]) for d in res["drift_report"]],
            [tuple(str(p.get(k)) for k in ["customer_id", "net_ltv_idr", "tier_action", "idempotency_key"]) for p in res["reverse_etl_payloads"]])


# ------------------------------------------------------------------------------------------------------------ 1.4-1
@exercise(
    "1.4-1",
    "build Data Vault 2.0 hubs, link and satellite with deterministic SHA-256 hash keys",
    ["datavault.py"],
    [
        "Normalise every business key before hashing: convert to string, strip whitespace, and convert to UPPERCASE. Build link keys by joining the normalised customer_id and order_id with a pipe '|' before hashing.",
        "A Hub stores one row per unique business key (keep the earliest load_ts seen for that business key). A Link stores one row per unique (customer_id, order_id) pair.",
        "A Satellite stores descriptive attributes (city, tier) with a hash_diff = sha256(UPPER(city) + '|' + UPPER(tier)). Only append a new satellite row for a customer when their hash_diff changes from their most recent satellite entry!",
    ],
)
def ex_1_4_1(ctx):
    if not ctx.need_files(["datavault.py"]):
        return
    try:
        mod = load_module(ctx, "datavault.py", "user_datavault")
    except Exception as e:
        ctx.fail("datavault.py imports cleanly", str(e))
        return

    fn = getattr(mod, "build_data_vault", None)
    if not callable(fn):
        ctx.fail("build_data_vault(events, record_source) function exists in datavault.py")
        return

    sample_events = [
        {"customer_id": " c-101 ", "order_id": "o-5001", "city": "Jakarta", "tier": "Silver", "load_ts": "2026-01-01T10:00:00"},
        {"customer_id": "C-101", "order_id": "O-5002", "city": "Jakarta", "tier": "Silver", "load_ts": "2026-01-02T10:00:00"},
        {"customer_id": "C-101", "order_id": "O-5003", "city": "Bandung", "tier": "Gold", "load_ts": "2026-01-05T10:00:00"},
        {"customer_id": "c-202", "order_id": "o-5004", "city": "Surabaya", "tier": "Bronze", "load_ts": "2026-01-03T09:00:00"},
    ]
    try:
        res = fn(sample_events, record_source="kopiku_oms")
    except Exception as e:
        ctx.fail("build_data_vault runs on sample events", str(e))
        return

    ctx.check(
        isinstance(res, dict) and {"hub_customer", "hub_order", "link_customer_order", "sat_customer"}.issubset(res.keys()),
        "returns a dict with keys: hub_customer, hub_order, link_customer_order, sat_customer",
    )
    if not isinstance(res, dict):
        return

    hk_c101 = sha256_hex("C-101")
    hk_c202 = sha256_hex("C-202")
    hub_c = res.get("hub_customer", [])
    ctx.check(len(hub_c) == 2, "hub_customer deduplicates business keys regardless of case/whitespace (2 unique customers)", f"got {len(hub_c)} rows")
    c101_rows = [r for r in hub_c if r.get("hk_customer") == hk_c101]
    ctx.check(
        len(c101_rows) == 1 and c101_rows[0].get("customer_id") == "C-101" and c101_rows[0].get("load_ts") == "2026-01-01T10:00:00" and c101_rows[0].get("record_source") == "kopiku_oms",
        "hub_customer stores sha256(UPPER(TRIM(customer_id))) as hk_customer, normalised customer_id, earliest load_ts, and record_source",
    )

    hub_o = res.get("hub_order", [])
    ctx.check(
        len(hub_o) == 4 and any(r.get("hk_order") == sha256_hex("O-5001") and r.get("order_id") == "O-5001" for r in hub_o),
        "hub_order stores 4 unique orders with deterministic hk_order",
    )

    links = res.get("link_customer_order", [])
    expected_lhk = sha256_hex("C-101|O-5001")
    ctx.check(
        len(links) == 4 and any(r.get("hk_link") == expected_lhk and r.get("hk_customer") == hk_c101 and r.get("hk_order") == sha256_hex("O-5001") for r in links),
        "link_customer_order builds hk_link = sha256('C-101|O-5001') and links hk_customer to hk_order",
    )

    sat = res.get("sat_customer", [])
    c101_sat = [r for r in sat if r.get("hk_customer") == hk_c101]
    ctx.check(
        len(c101_sat) == 2 and len(sat) == 3,
        "sat_customer is append-only on change: skips unchanged duplicate state on 2026-01-02 and records new state on 2026-01-05 (3 total satellite rows)",
        f"got {len(c101_sat)} rows for C-101 and {len(sat)} total rows",
    )
    expected_hdiff = sha256_hex("BANDUNG|GOLD")
    ctx.check(
        any(r.get("hash_diff") == expected_hdiff and str(r.get("city")).strip().upper() == "BANDUNG" and str(r.get("tier")).strip().upper() == "GOLD" for r in c101_sat),
        "sat_customer computes hash_diff = sha256('UPPER(city)|UPPER(tier)') accurately",
    )

    hidden = [
        {"customer_id": "k-9", "order_id": "x-3", "city": "Bandung", "tier": "Gold", "load_ts": "2026-03-04T08:00:00"},
        {"customer_id": "K-9", "order_id": "X-1", "city": "Jakarta", "tier": "Silver", "load_ts": "2026-03-01T08:00:00"},
        {"customer_id": " k-9", "order_id": "x-4", "city": " jakarta ", "tier": "silver", "load_ts": "2026-03-06T08:00:00"},
        {"customer_id": "K-9", "order_id": "X-2", "city": "Jakarta", "tier": "Silver", "load_ts": "2026-03-02T08:00:00"},
        {"customer_id": "M-1", "order_id": "X-5", "city": "Medan", "tier": "Bronze", "load_ts": "2026-03-05T08:00:00"},
        {"customer_id": "M-1", "order_id": "x-5", "city": "Medan", "tier": "Bronze", "load_ts": "2026-03-07T08:00:00"},
    ]
    run_hidden(ctx, fn, (hidden,), {"record_source": "pos_v2"}, _dv_oracle(hidden, "pos_v2"), _dv_canon,
               "hidden data (events out of order, a customer who goes back to an earlier state, a repeated order, another record_source) gives the right hubs, link and satellite",
               "process events in load_ts order, keep each hub's first load_ts, compare with the LATEST satellite state only, and use the record_source you were given")


# ------------------------------------------------------------------------------------------------------------ 2.5-1
@exercise(
    "2.5-1",
    "salted PII pseudonymization, GDPR erasure and MDM golden record resolution",
    ["privacy_gate.py"],
    [
        "Never hash PII without a secret salt: unsalted SHA-256 on emails or phone numbers can be reversed with a dictionary rainbow table. Compute sha256((salt + ':' + email.strip().lower()).encode('utf-8')).hexdigest().",
        "For the Right to Be Forgotten: a record whose normalised email is in the erasure list never reaches the output; its source_id goes in the audit list instead.",
        "For Master Data Management (MDM) Golden Record entity resolution: group surviving records by their salted email token, pick the latest updated_at for tier/city, and merge all distinct source_ids into a sorted list.",
    ],
)
def ex_2_5_1(ctx):
    if not ctx.need_files(["privacy_gate.py"]):
        return
    try:
        mod = load_module(ctx, "privacy_gate.py", "user_privacy_gate")
    except Exception as e:
        ctx.fail("privacy_gate.py imports cleanly", str(e))
        return

    fn = getattr(mod, "process_privacy_and_mdm", None)
    if not callable(fn):
        ctx.fail("process_privacy_and_mdm(records, erasure_emails, salt) exists in privacy_gate.py")
        return

    raw_records = [
        {"source_id": "stripe_1", "email": " Budi@Example.com ", "phone": "+628123456789", "city": "Jakarta", "tier": "Silver", "updated_at": "2026-01-02T10:00:00"},
        {"source_id": "crm_99", "email": "budi@example.com", "phone": "0812-3456-789", "city": "Bandung", "tier": "Gold", "updated_at": "2026-01-10T12:00:00"},
        {"source_id": "pos_7", "email": "delete_me@example.com", "phone": "+628999888777", "city": "Medan", "tier": "Bronze", "updated_at": "2026-01-05T08:00:00"},
        {"source_id": "web_4", "email": "sari@kopiku.id", "phone": "+628111222333", "city": "Surabaya", "tier": "Gold", "updated_at": "2026-01-08T09:00:00"},
    ]
    salt = "prod-secret-salt-2026"
    try:
        out = fn(raw_records, erasure_emails=["DELETE_ME@example.com"], salt=salt)
    except Exception as e:
        ctx.fail("process_privacy_and_mdm runs on test dataset", str(e))
        return

    ctx.check(
        isinstance(out, dict) and {"golden_records", "erased_audit"}.issubset(out.keys()),
        "returns a dict with keys 'golden_records' and 'erased_audit'",
    )
    if not isinstance(out, dict):
        return

    erased = out.get("erased_audit", [])
    ctx.check(
        erased == ["pos_7"],
        "GDPR Right-to-Be-Forgotten erases matching records case-insensitively and logs their source_id in erased_audit",
        f"got erased_audit={erased}",
    )

    golden = out.get("golden_records", [])
    ctx.check(len(golden) == 2, "MDM resolves 3 surviving rows into 2 unique Golden Records by email identity", f"got {len(golden)} golden records")

    expected_budi_token = sha256_hex(f"{salt}:budi@example.com")
    budi = next((r for r in golden if r.get("pii_token") == expected_budi_token), None)
    ctx.check(budi is not None, "computes salted SHA-256 pii_token = sha256(salt + ':' + lower(trim(email)))")
    if budi:
        ctx.check(
            "email" not in budi and "phone" not in budi and "budi@example.com" not in str(budi),
            "strips raw plaintext email and phone from the Golden Record (zero PII leak)",
        )
        ctx.check(
            budi.get("phone_masked") == "***-***-6789",
            "masks phone number to last 4 digits '***-***-6789'",
            f"got phone_masked={budi.get('phone_masked')}",
        )
        ctx.check(
            budi.get("city") == "Bandung" and budi.get("tier") == "Gold" and budi.get("source_ids") == ["crm_99", "stripe_1"],
            "MDM survivorship picks latest updated_at attributes (Bandung, Gold) and sorted source_ids ['crm_99', 'stripe_1']",
            f"got {budi}",
        )

    hidden = [
        {"source_id": "app_3", "email": "RINA@mail.id", "phone": "0811-000-4321", "city": "Bogor", "tier": "Gold", "updated_at": "2026-04-09T00:00:00"},
        {"source_id": "crm_1", "email": " rina@mail.id", "phone": "+62 811 000 1111", "city": "Depok", "tier": "Silver", "updated_at": "2026-04-01T00:00:00"},
        {"source_id": "crm_1", "email": "rina@mail.id ", "phone": "+62 811 000 1111", "city": "Depok", "tier": "Silver", "updated_at": "2026-04-02T00:00:00"},
        {"source_id": "pos_2", "email": "Gone@Mail.id", "phone": "0812", "city": "Solo", "tier": "Bronze", "updated_at": "2026-04-03T00:00:00"},
        {"source_id": "app_8", "email": "gone@mail.id", "phone": "0813-9", "city": "Solo", "tier": "Bronze", "updated_at": "2026-04-04T00:00:00"},
        {"source_id": "web_5", "email": "eko@mail.id", "phone": "12", "city": "Malang", "tier": "Bronze", "updated_at": "2026-04-05T00:00:00"},
    ]
    run_hidden(ctx, fn, (hidden,), {"erasure_emails": ["  gone@MAIL.id "], "salt": "s3cr3t"}, _privacy_oracle(hidden, ["  gone@MAIL.id "], "s3cr3t"), _privacy_canon,
               "hidden data (a person erased from two systems, the same source_id twice, the newest record first, a phone with under 4 digits) gives the right golden records and audit",
               "every erased record goes in the audit, source_ids are unique and sorted, the newest updated_at wins whatever the input order, and a short phone becomes ***-***-****")


# ------------------------------------------------------------------------------------------------------------ 2.6-1
@exercise(
    "2.6-1",
    "brownfield strangler fig reconciliation, semantic metric parity and idempotent Reverse ETL",
    ["strangler_reverse_etl.py"],
    [
        "In a Semantic Layer, define net_revenue_idr once: only count orders with status in ('paid', 'shipped', 'delivered') and compute gross_idr - discount_idr - tax_idr.",
        "In a Brownfield Strangler migration, compare the legacy pipeline's daily output against your new Semantic Layer output and report any date where they diverge.",
        "For Reverse ETL to CRM: generate a deterministic idempotency_key = sha256(f'{customer_id}:{sync_date}:{net_ltv_idr}') and suppress any customer whose net_ltv_idr <= 0 to prevent runaway feedback loops.",
    ],
)
def ex_2_6_1(ctx):
    if not ctx.need_files(["strangler_reverse_etl.py"]):
        return
    try:
        mod = load_module(ctx, "strangler_reverse_etl.py", "user_strangler")
    except Exception as e:
        ctx.fail("strangler_reverse_etl.py imports cleanly", str(e))
        return

    fn = getattr(mod, "run_strangler_and_reverse_etl", None)
    if not callable(fn):
        ctx.fail("run_strangler_and_reverse_etl(orders, legacy_daily_totals, sync_date) exists in strangler_reverse_etl.py")
        return

    orders = [
        {"order_id": "1", "customer_id": "C1", "order_date": "2026-02-01", "status": "delivered", "gross_idr": 200000, "discount_idr": 20000, "tax_idr": 18000},
        {"order_id": "2", "customer_id": "C1", "order_date": "2026-02-01", "status": "refunded", "gross_idr": 100000, "discount_idr": 0, "tax_idr": 10000},
        {"order_id": "3", "customer_id": "C2", "order_date": "2026-02-01", "status": "paid", "gross_idr": 150000, "discount_idr": 10000, "tax_idr": 14000},
        {"order_id": "4", "customer_id": "C3", "order_date": "2026-02-02", "status": "cancelled", "gross_idr": 300000, "discount_idr": 0, "tax_idr": 30000},
        {"order_id": "5", "customer_id": "C2", "order_date": "2026-02-02", "status": "shipped", "gross_idr": 100000, "discount_idr": 5000, "tax_idr": 9500},
    ]
    # Legacy script mistakenly included refunded orders and forgot to subtract tax on 2026-02-01!
    legacy_daily = {
        "2026-02-01": 420000,  # semantic truth is (200k-20k-18k) + (150k-10k-14k) = 162000 + 126000 = 288000
        "2026-02-02": 85500,   # matches semantic truth (100k-5k-9.5k = 85500)
    }

    try:
        res = fn(orders, legacy_daily, sync_date="2026-02-02")
    except Exception as e:
        ctx.fail("run_strangler_and_reverse_etl executes without error", str(e))
        return

    ctx.check(
        isinstance(res, dict) and {"semantic_daily", "drift_report", "reverse_etl_payloads"}.issubset(res.keys()),
        "returns a dict with keys: semantic_daily, drift_report, reverse_etl_payloads",
    )
    if not isinstance(res, dict):
        return

    sem = res.get("semantic_daily", {})
    ctx.check(
        sem == {"2026-02-01": 288000, "2026-02-02": 85500},
        "semantic_daily computes canonical Net Revenue (excluding refunded/cancelled, subtracting discount & tax)",
        f"got semantic_daily={sem}",
    )

    drift = res.get("drift_report", [])
    ctx.check(
        len(drift) == 1 and drift[0].get("date") == "2026-02-01" and drift[0].get("legacy_idr") == 420000 and drift[0].get("semantic_idr") == 288000 and drift[0].get("delta_idr") == -132000,
        "drift_report flags 2026-02-01 where legacy brownfield output drifted from semantic truth by -132000",
        f"got drift_report={drift}",
    )

    payloads = res.get("reverse_etl_payloads", [])
    ctx.check(
        len(payloads) == 2 and [p.get("customer_id") for p in payloads] == ["C1", "C2"],
        "reverse_etl_payloads includes active customers sorted by customer_id and excludes C3 (0 net revenue) to prevent feedback loops",
        f"got payloads={payloads}",
    )
    if len(payloads) == 2:
        c2 = payloads[1]
        expected_key = sha256_hex("C2:2026-02-02:211500")
        ctx.check(
            c2.get("net_ltv_idr") == 211500 and c2.get("idempotency_key") == expected_key and c2.get("tier_action") == "VIP_UPGRADE",
            "computes customer C2 net_ltv_idr=211500, tier_action='VIP_UPGRADE' (>=200000), and deterministic idempotency_key",
            f"got C2 payload={c2}",
        )

    hidden_orders = [
        {"order_id": "a", "customer_id": "Z9", "order_date": "2026-03-02", "status": " Delivered ", "gross_idr": 220000, "discount_idr": 0, "tax_idr": 20000},
        {"order_id": "b", "customer_id": "A1", "order_date": "2026-03-01", "status": "PAID", "gross_idr": 50000, "discount_idr": 60000, "tax_idr": 0},
        {"order_id": "c", "customer_id": "B2", "order_date": "2026-03-03", "status": "cancelled", "gross_idr": 90000, "discount_idr": 0, "tax_idr": 9000},
        {"order_id": "d", "customer_id": "C3", "order_date": "2026-03-01", "status": "shipped", "gross_idr": 110000, "discount_idr": 0, "tax_idr": 10000},
        {"order_id": "e", "customer_id": "D4", "order_date": "2026-03-01", "status": "paid", "gross_idr": 10000, "discount_idr": 5000, "tax_idr": 5000},
    ]
    hidden_legacy = {"2026-03-01": 90000, "2026-03-02": 200000, "2026-02-28": 75000}
    run_hidden(ctx, fn, (hidden_orders, hidden_legacy), {"sync_date": "2026-03-04"},
               _strangler_oracle(hidden_orders, hidden_legacy, "2026-03-04"), _strangler_canon,
               "hidden data (untidy status text, a day with only cancelled orders, a day only the legacy system has, negative, zero and exactly 200000 LTV) gives the right three outputs",
               "normalise status, keep every order date (even at 0), compare every date either side has, send only customers with LTV above 0, and VIP starts at 200000")


# ------------------------------------------------------------------------------------------------------------ 3.4-1
@exercise(
    "3.4-1",
    "declarative IaC drift planner, VPC CIDR & egress cost auditor, and synchronous chain SLA/RPO calculator",
    ["cloud_architect.py"],
    [
        "Collect every resource name from both sides, in sorted order. For each name, ask three questions: is it missing from what exists, missing from what you want, or present in both but different?",
        "Python's ipaddress module can split a network into smaller ones and tell you how many addresses each holds; lesson 3 says how many of those AWS keeps for itself. With data spread evenly over several zones, think about which share of the traffic stays in a node's own zone.",
        "Availabilities of services that must all answer multiply. Downtime is the share of the month that is missing. To compare a backup interval with an RPO, put both in the same unit first.",
    ],
)
def ex_3_4_1(ctx):
    if not ctx.need_files(["cloud_architect.py"]):
        return
    try:
        mod = load_module(ctx, "cloud_architect.py", "user_cloud_arch")
    except Exception as e:
        ctx.fail("cloud_architect.py imports cleanly", str(e))
        return

    fn_plan = getattr(mod, "plan_iac_diff", None)
    fn_vpc = getattr(mod, "audit_vpc_and_egress", None)
    fn_sla = getattr(mod, "chain_sla_and_rpo", None)
    if not (callable(fn_plan) and callable(fn_vpc) and callable(fn_sla)):
        ctx.fail("plan_iac_diff, audit_vpc_and_egress, and chain_sla_and_rpo exist in cloud_architect.py")
        return

    desired = {
        "raw-bucket": {"encryption": True, "versioning": True},
        "curated-bucket": {"encryption": True, "versioning": False},
        "etl-role": {"policy": "read-raw"},
    }
    actual = {
        "raw-bucket": {"encryption": False, "versioning": True},
        "old-bucket": {"encryption": True},
        "etl-role": {"policy": "read-raw"},
    }
    try:
        diff1 = fn_plan(desired, actual)
        diff2 = fn_plan(desired, desired)
    except Exception as e:
        ctx.fail("plan_iac_diff executes without error", str(e))
        return

    ctx.check(
        list(diff1) == [("create", "curated-bucket"), ("destroy", "old-bucket"), ("update", "raw-bucket")] and list(diff2) == [],
        "plan_iac_diff returns sorted [('create', 'curated-bucket'), ('destroy', 'old-bucket'), ('update', 'raw-bucket')] and [] when idempotent",
        f"got diff1={diff1}, diff2={diff2}",
    )

    try:
        v1 = fn_vpc("10.0.0.0/16", 20, 20000, 3, 5000, False)
        v2 = fn_vpc("10.0.0.0/16", 24, 20000, 1, 5000, True)
    except Exception as e:
        ctx.fail("audit_vpc_and_egress executes without error", str(e))
        return

    ctx.check(
        isinstance(v1, dict) and v1.get("num_subnets") == 16 and v1.get("usable_ips_per_subnet") == 4091,
        "audit_vpc_and_egress splits 10.0.0.0/16 into 16 /20 subnets with 4091 usable AWS IPs each (5 reserved)",
        f"got v1={v1}",
    )
    ctx.check(
        isinstance(v1, dict) and v1.get("monthly_cross_az_usd") == 8000.0 and v1.get("monthly_nat_s3_usd") == 6750.0 and v1.get("monthly_endpoint_savings_usd") == 6750.0,
        "audit_vpc_and_egress computes 30-day cross-AZ shuffle cost ($8000.0) and NAT gateway S3 fee ($6750.0)",
        f"got v1={v1}",
    )
    ctx.check(
        isinstance(v2, dict) and v2.get("num_subnets") == 256 and v2.get("usable_ips_per_subnet") == 251 and v2.get("monthly_cross_az_usd") == 0.0 and v2.get("monthly_nat_s3_usd") == 0.0 and v2.get("monthly_endpoint_savings_usd") == 6750.0,
        "audit_vpc_and_egress handles single-AZ shuffle ($0.0) and active S3 Gateway Endpoint ($0.0 NAT fee, $6750.0 saved)",
        f"got v2={v2}",
    )

    try:
        s1 = fn_sla(3, 0.999, 6, 15)
        s2 = fn_sla(5, 0.999, 0.25, 15)
    except Exception as e:
        ctx.fail("chain_sla_and_rpo executes without error", str(e))
        return

    ctx.check(
        isinstance(s1, dict) and s1.get("combined_sla") == 0.997003 and s1.get("monthly_downtime_min") == 129.5 and s1.get("needs_continuous_cdc") is True,
        "chain_sla_and_rpo computes 3-service chain SLA (0.997003 -> 129.5 min downtime/mo) and flags 6h backup > 15m RPO as requiring CDC",
        f"got s1={s1}",
    )
    ctx.check(
        isinstance(s2, dict) and s2.get("combined_sla") == 0.99501 and s2.get("monthly_downtime_min") == 215.6 and s2.get("needs_continuous_cdc") is False,
        "chain_sla_and_rpo computes 5-service chain SLA (0.99501 -> 215.6 min downtime/mo) and 15m backup meeting 15m RPO",
        f"got s2={s2}",
    )

