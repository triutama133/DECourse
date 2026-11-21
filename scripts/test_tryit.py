#!/usr/bin/env python3
"""Tests the "Try it" checkers (labs/tryit): every reference solution must PASS, and every deliberately wrong version (a mutant) must FAIL.

    python3 scripts/test_tryit.py            # all exercises
    python3 scripts/test_tryit.py 1.6-4      # one exercise

A checker that accepts a wrong answer is worse than no checker, so each mutant here is a realistic mistake a learner could make.
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECK = ROOT / "labs" / "tryit" / "check.py"
REF = ROOT / "labs" / "tryit" / "reference"

# id -> (reference folder, [(mutant name, file, old text, new text), ...]); the new text may contain nothing (a deletion)
MUTANTS = {
    "1.6-2": ("1.6", [
        ("no Authorization header", "try_http.py", 'headers={"Authorization": "Bearer learner-token"}', "headers={}"),
        ("never tries without the header", "try_http.py", "try:\n    urllib.request.urlopen(URL)\nexcept urllib.error.HTTPError as e:\n    print(e.code)\n", ""),
        ("wrong page size", "try_http.py", "limit=3", "limit=2"),
        ("uses requests", "try_http.py", "import json\n", "import json\nimport requests\n"),
        ("does not print the ids", "try_http.py", "print(resp.status, [o[\"id\"] for o in body[\"data\"]])", "print(resp.status)"),
    ]),
    "1.6-3": ("1.6", [
        ("no /arrive", "cursor_all.py", '        get("/arrive?n=3")\n', "        pass\n"),
        ("/arrive before the first page", "cursor_all.py", "ids, cursor, first = [], None, True\n", 'ids, cursor, first = [], None, False\nget("/arrive?n=3")\n'),
        ("stops after the first page", "cursor_all.py", "    if cursor is None:\n        break", "    break"),
        ("wrong page size", "cursor_all.py", "limit=10", "limit=5"),
        ("always waits 2 seconds", "limited.py", 'wait = float(e.headers["Retry-After"])', "wait = 2.0"),
        ("does not wait", "limited.py", "time.sleep(wait)\n", ""),
        ("no retry", "limited.py", "    with urllib.request.urlopen(req) as r:\n        print(r.status)\n", ""),
    ]),
    "1.6-4": ("1.6", [
        ("checkpoint saved before the data", "load.py",
         '    cursor = page["next_cursor"]\n    save_checkpoint(cursor)\n    time.sleep(1)\n',
         '    cursor = page["next_cursor"]\n    save_checkpoint(cursor)\n    time.sleep(1)\n'),   # placeholder, replaced below
        ("never saves the checkpoint", "load.py", "    save_checkpoint(cursor)\n", ""),
        ("ignores the checkpoint at start-up", "load.py", 'cursor = json.load(open("checkpoint.json"))["cursor"] if os.path.exists("checkpoint.json") else None', "cursor = None"),
        ("duplicates when it restarts", "load.py", '            if o["id"] not in seen:\n                out.write', '            if True:\n                out.write'),
        ("wrong page size", "load.py", "limit=5", "limit=10"),
        ("checkpoint is not a cursor", "load.py", 'json.dump({"cursor": cursor}, f)', 'json.dump({"page": 1}, f)'),
    ]),
    "1.6-5": ("1.6", [
        ("separator is a dot", "flat.py", 'out.update(flatten(value, name + "_"))', 'out.update(flatten(value, name + "."))'),
        ("list is not turned into text", "flat.py", "out[name] = json.dumps(value)", "out[name] = value"),
        ("changes the record it was given", "flat.py", "    out = {}\n", "    out = {}\n    record['touched'] = True\n"),
        ("only one level deep", "flat.py", 'out.update(flatten(value, name + "_"))', 'out.update({f"{name}_{k}": v for k, v in value.items()})'),
        ("reports fields that are in only one record", "flat.py", "for k in old if k in new and", "for k in old if"),
        ("compares values instead of types", "flat.py", "type(old[k]) is not type(new[k])", "old[k] != new[k]"),
    ]),
    "1.3-9": ("1.3", [
        ("level from IS NULL instead of GROUPING", "rollup.py", "GROUPING(c.city) + GROUPING(o.payment_method) AS level", "(c.city IS NULL)::INT + (o.payment_method IS NULL)::INT AS level"),
        ("level with a two-argument GROUPING (bit mask)", "rollup.py", "GROUPING(c.city) + GROUPING(o.payment_method) AS level", "GROUPING(c.city, o.payment_method) AS level"),
        ("ROLLUP columns in the wrong order", "rollup.py", "GROUP BY ROLLUP (c.city, o.payment_method)", "GROUP BY ROLLUP (o.payment_method, c.city)"),
        ("all order statuses, not only delivered", "rollup.py", "WHERE o.status = 'delivered'\n", ""),
        ("ROLLUP instead of CUBE", "rollup.py", "GROUP BY CUBE (status, payment_method)", "GROUP BY ROLLUP (status, payment_method)"),
        ("grouping set of the pair instead of the two separate ones", "rollup.py", "GROUPING SETS ((c.tier), (o.payment_method))", "GROUPING SETS ((c.tier, o.payment_method))"),
        ("plain GROUP BY, no subtotals", "rollup.py", "GROUP BY CUBE (status, payment_method)", "GROUP BY status, payment_method"),
        ("a variable is missing", "rollup.py", "TIER_OR_METHOD =", "OTHER_NAME ="),
    ]),
    "1.6-6": ("1.6", [
        ("no primary key", "load_orders.py", "order_id INTEGER PRIMARY KEY", "order_id INTEGER"),
        ("plain INSERT", "load_orders.py", "INSERT OR REPLACE", "INSERT"),
        ("loads only once", "load_orders.py", "load()\nload()\n", "load()\n"),
        ("counts the file lines twice", "load_orders.py", "print(len(rows), len({r[\"order_id\"] for r in rows}))", "print(len(rows), len(rows))"),
    ]),
    "1.4-1": ("1.4", [
        ("does not uppercase business keys", "datavault.py", "return str(val).strip().upper()", "return str(val).strip()"),
        ("appends duplicate satellite rows when unchanged", "datavault.py", "if last_customer_diff.get(hk_c) != hdiff:", "if True:"),
        ("wrong link hash separator", "datavault.py", 'hk_l = _sha256(f"{cid}|{oid}")', 'hk_l = _sha256(f"{cid}-{oid}")'),
        ("does not sort the events by load_ts", "datavault.py", 'sorted_events = sorted(events, key=lambda e: str(e["load_ts"]))', "sorted_events = list(events)"),
        ("hub keeps the last load_ts, not the first", "datavault.py", "        if hk_c not in hub_customer:\n            hub_customer[hk_c] = {", "        if True:\n            hub_customer[hk_c] = {"),
        ("hash_diff without normalising city and tier", "datavault.py", 'hdiff = _sha256(f"{_norm(city)}|{_norm(tier)}")', 'hdiff = _sha256(f"{city}|{tier}")'),
        ("ignores the record_source it was given", "datavault.py", '                "record_source": record_source,\n            }\n\n        if hk_o', '                "record_source": "kopiku_oms",\n            }\n\n        if hk_o'),
        ("skips any state seen before (A->B->A loses a row)", "datavault.py", "        if last_customer_diff.get(hk_c) != hdiff:\n            last_customer_diff[hk_c] = hdiff", "        if hdiff not in last_customer_diff.setdefault(hk_c, set()):\n            last_customer_diff[hk_c].add(hdiff)"),
    ]),
    "2.5-1": ("2.5", [
        ("unsalted SHA-256 PII hash", "privacy_gate.py", 'f"{salt}:{norm_email}"', "norm_email"),
        ("ignores GDPR erasure list", "privacy_gate.py", "if norm_email in erase_set:", "if False:"),
        ("keeps older MDM record instead of latest", "privacy_gate.py", 'if str(rec["updated_at"]) >= str(g["updated_at"]):', "if False:"),
        ("raw email left in the golden record", "privacy_gate.py", '"pii_token": token,', '"pii_token": token, "email": rec["email"],'),
        ("erasure list not normalised", "privacy_gate.py", "erase_set = {str(e).strip().lower() for e in erasure_emails}", "erase_set = set(erasure_emails)"),
        ("phone not masked", "privacy_gate.py", 'masked_phone = f"***-***-{digits[-4:]}" if len(digits) >= 4 else "***-***-****"', "masked_phone = digits"),
        ("source_ids not deduplicated", "privacy_gate.py", 'g["source_ids"] = sorted(set(g["source_ids"]))', 'g["source_ids"] = sorted(g["source_ids"])'),
        ("audit logs the email, not the id", "privacy_gate.py", 'erased_audit.append(str(rec["source_id"]))', "erased_audit.append(norm_email)"),
    ]),
    "2.6-1": ("2.6", [
        ("counts refunded orders in semantic net revenue", "strangler_reverse_etl.py", 'VALID_STATUSES = {"paid", "shipped", "delivered"}', 'VALID_STATUSES = {"paid", "shipped", "delivered", "refunded"}'),
        ("forgets to subtract tax in semantic layer", "strangler_reverse_etl.py", '- int(o["tax_idr"])', ""),
        ("non-deterministic idempotency key", "strangler_reverse_etl.py", 'f"{cid}:{sync_date}:{ltv}"', 'f"{cid}"'),
        ("status not normalised", "strangler_reverse_etl.py", 'status = str(o.get("status", "")).strip().lower()', 'status = str(o.get("status", ""))'),
        ("ignores dates only the legacy system has", "strangler_reverse_etl.py", "for dt in sorted(set(semantic_daily) | set(legacy_daily_totals)):", "for dt in sorted(semantic_daily):"),
        ("sends customers with zero or negative LTV", "strangler_reverse_etl.py", "        if ltv <= 0:\n            continue\n", ""),
        ("VIP from above 200000 instead of 200000", "strangler_reverse_etl.py", "if ltv >= 200000", "if ltv > 200000"),
        ("drops days with no valid order", "strangler_reverse_etl.py", "        semantic_daily.setdefault(dt, 0)\n", ""),
    ]),
    "3.4-1": ("3.4", [
        ("forgets AWS 5 reserved IPs per subnet", "cloud_architect.py", "(2 ** (32 - int(new_prefix))) - 5", "(2 ** (32 - int(new_prefix)))"),
        ("charges NAT fee even when S3 Gateway Endpoint is enabled", "cloud_architect.py", "0.0 if has_s3_endpoint else savings", "savings"),
        ("adds service SLAs instead of multiplying synchronous chain", "cloud_architect.py", "float(service_sla) ** int(num_services)", "float(service_sla)"),
    ]),
    "1.6-7": ("1.6", [
        ("does not reject stale webhook timestamps", "webhook_diff.py", "if abs(int(now_ts) - ts) > int(tolerance_sec):", "if False:"),
        ("accepts forged HMAC signatures", "webhook_diff.py", "if not hmac.compare_digest(sig, expected_sig):", "if False:"),
        ("does not deduplicate retry event_ids", "webhook_diff.py", "if eid in seen_ids:\n            continue", "if False:\n            continue"),
        ("misses deleted primary keys in snapshot diff", "webhook_diff.py", "deletes = sorted(k for k in prev_map if k not in curr_map)", "deletes = []"),
        ("compares signatures with == (not constant time)", "webhook_diff.py", "if not hmac.compare_digest(sig, expected_sig):", "if sig != expected_sig:"),
        ("signs the body without the timestamp", "webhook_diff.py", 'f"{ts}.{body}".encode("utf-8")', 'body.encode("utf-8")'),
        ("counts unchanged rows as updates", "webhook_diff.py", "elif curr_map[k] != prev_map[k]:", "elif True:"),
        ("dedups before checking the signature (forged retry blocks the real one)", "webhook_diff.py", "        if abs(int(now_ts) - ts) > int(tolerance_sec):", "        if eid in seen_ids:\n            continue\n        seen_ids.add(eid)\n        if abs(int(now_ts) - ts) > int(tolerance_sec):"),
    ]),
    "3.5-1": ("3.5", [
        ("allows future feature updates into point-in-time ASOF join", "feature_store.py", "if u[\"updated_at\"] <= pred_ts", "if True"),
        ("picks oldest feature update instead of latest ASOF", "feature_store.py", "best = max(candidates, key=lambda u: u[\"updated_at\"])", "best = min(candidates, key=lambda u: u[\"updated_at\"])"),
        ("fails to detect leaked request IDs", "feature_store.py", "leaked_request_ids.append(rid)", "pass"),
        ("strict < excludes an update at the prediction moment", "feature_store.py", 'if u["updated_at"] <= pred_ts]', 'if u["updated_at"] < pred_ts]'),
        ("flags future updates even when the value did not change", "feature_store.py", 'if (latest["risk_score"], latest["tx_count_24h"]) != (pit_risk, pit_tx):', "if True:"),
        ("online store keeps the first update, not the latest", "feature_store.py", 'if eid not in online_store or ts >= online_store[eid]["updated_at"]:', "if eid not in online_store:"),
    ]),
}

# equivalent answers that a checker must ACCEPT: id -> [(name, file, old, new)]
EQUIVALENTS = {
    "1.4-1": [
        ("satellite keeps city and tier upper-cased", "datavault.py", 'city = str(ev["city"]).strip()\n        tier = str(ev["tier"]).strip()',
         'city = str(ev["city"]).strip().upper()\n        tier = str(ev["tier"]).strip().upper()'),
        ("sorts with a stable two-key sort", "datavault.py", 'sorted(events, key=lambda e: str(e["load_ts"]))', 'sorted(events, key=lambda e: (str(e["load_ts"]), 0))'),
    ],
    "2.5-1": [
        ("sorts the records by updated_at first", "privacy_gate.py", "    for rec in records:\n", '    for rec in sorted(records, key=lambda r: str(r["updated_at"])):\n'),
    ],
    "2.6-1": [
        ("normalises status with casefold", "strangler_reverse_etl.py", '.strip().lower()', '.strip().casefold()'),
    ],
    "1.3-9": [
        ("CUBE written as the four GROUPING SETS it stands for", "rollup.py", "GROUP BY CUBE (status, payment_method)",
         "GROUP BY GROUPING SETS ((status, payment_method), (status), (payment_method), ())"),
        ("ROLLUP written as GROUPING SETS", "rollup.py", "GROUP BY ROLLUP (c.city, o.payment_method)",
         "GROUP BY GROUPING SETS ((c.city, o.payment_method), (c.city), ())"),
        ("level from a CASE over GROUPING", "rollup.py", "GROUPING(c.city) + GROUPING(o.payment_method) AS level",
         "CASE WHEN GROUPING(c.city) = 1 THEN 2 WHEN GROUPING(o.payment_method) = 1 THEN 1 ELSE 0 END AS level"),
    ],
}

# the one mutant that needs a reordering rather than a substitution
CHECKPOINT_FIRST = '''
seen = set()
if os.path.exists("out.jsonl"):
    seen = {json.loads(l)["id"] for l in open("out.jsonl") if l.strip()}
cursor = json.load(open("checkpoint.json"))["cursor"] if os.path.exists("checkpoint.json") else None
while True:
    page = get("/orders?limit=5" + (f"&cursor={cursor}" if cursor else ""))
    cursor = page["next_cursor"]
    save_checkpoint(cursor)
    time.sleep(1)
    with open("out.jsonl", "a") as out:
        for o in page["data"]:
            if o["id"] not in seen:
                out.write(json.dumps(o) + "\\n")
                seen.add(o["id"])
    if cursor is None:
        break
'''


def run_check(ident, folder):
    p = subprocess.run([sys.executable, str(CHECK), ident, str(folder)], capture_output=True, text=True, timeout=300)
    return p.returncode, p.stdout


def main(argv):
    import importlib.util
    has_duckdb = importlib.util.find_spec("duckdb") is not None
    wanted = argv or sorted(MUTANTS)
    bad = 0
    for ident in wanted:
        if ident == "1.3-9" and not has_duckdb:
            print("1.3-9  skipped (duckdb not installed in current Python)")
            continue
        refdir, mutants = MUTANTS[ident]
        code, out = run_check(ident, REF / refdir)
        print(f"{ident}  reference  {'PASS' if code == 0 else 'FAIL  <-- should pass'}")
        if code != 0:
            bad += 1
            print(out)
        for name, fname, old, new in mutants:
            tmp = Path(tempfile.mkdtemp(prefix="tryit-mut-"))
            try:
                for f in (REF / refdir).glob("*.py"):
                    shutil.copy(f, tmp / f.name)
                text = (tmp / fname).read_text()
                if name == "checkpoint saved before the data":
                    head = text.split("seen = set()")[0]
                    mutated = head.rstrip("\n") + "\n\n" + CHECKPOINT_FIRST.lstrip("\n")
                else:
                    assert old in text, f"{ident}: '{old[:40]}' not found in {fname}"
                    mutated = text.replace(old, new, 1)
                (tmp / fname).write_text(mutated)
                code, out = run_check(ident, tmp)
                caught = code != 0
                print(f"{ident}  mutant: {name:48} {'caught' if caught else 'NOT CAUGHT  <-- the checker accepted a wrong answer'}")
                if not caught:
                    bad += 1
            finally:
                shutil.rmtree(tmp, ignore_errors=True)
        for name, fname, old, new in EQUIVALENTS.get(ident, []):
            tmp = Path(tempfile.mkdtemp(prefix="tryit-eq-"))
            try:
                for f in (REF / refdir).glob("*.py"):
                    shutil.copy(f, tmp / f.name)
                text = (tmp / fname).read_text()
                assert old in text, f"{ident}: '{old[:40]}' not found in {fname}"
                (tmp / fname).write_text(text.replace(old, new, 1))
                code, out = run_check(ident, tmp)
                print(f"{ident}  equivalent: {name:46} {'accepted' if code == 0 else 'REJECTED  <-- a correct answer was refused'}")
                if code != 0:
                    bad += 1
                    print(out)
            finally:
                shutil.rmtree(tmp, ignore_errors=True)
    print("\nAll good." if not bad else f"\n{bad} problem(s).")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
