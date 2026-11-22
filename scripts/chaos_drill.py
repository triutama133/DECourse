#!/usr/bin/env python3
"""Chaos drill: fix a broken pipeline on your own computer.

Some modules' chaos labs have a small runnable version of their incident. `init` copies the broken script into a folder of
yours; you find and fix the bug in your editor; `verify` runs it on the incident's data and on hidden data you have not seen,
and prints a CHAOS1 code for the Chaos tab of the web app:

    python3 scripts/chaos_drill.py list
    python3 scripts/chaos_drill.py init mod-0-2 ~/df-chaos/mod-0-2
    python3 scripts/chaos_drill.py verify mod-0-2 ~/df-chaos/mod-0-2

The broken script describes the symptom, not the fix. Reference fixes live in labs/chaos/reference/: read them only after
your own fix passes. Standard library only (Python 3.8+).
"""
import argparse
import hashlib
import importlib.util
import os
import platform
import re
import shutil
import sys
import tempfile
from pathlib import Path

VERSION = "CHAOS1"
ROOT = Path(__file__).resolve().parents[1]
REF = ROOT / "labs" / "chaos" / "reference"

ARCHETYPES = {
    "mutable_batch": {
        "modules": ["mod-0-0", "mod-1-2"],
        "title": "The batch that remembered the previous batch, and the rows that vanished",
        "function": "transform_batch",
        "broken_code": '''"""Chaos drill: the batch that remembered the previous batch.

Symptom: the job calls transform_batch() once per store branch. Branch B's output contains rows from branch A.
Some orders with an unusable total (negative, or text such as "Rp 90k") disappear without a trace; others are loaded.

What must be true when you are done:
- each call returns only the rows it was given;
- every input row ends up in exactly one of the two lists: accepted (a usable total of 0 or more) or rejected;
- a rejected row keeps its order_id, so someone can follow it up.
"""

def transform_batch(raw_rows, accepted=[], rejected=[]):
    for r in raw_rows:
        try:
            amt = int(r["total_idr"])
            if amt < 0:
                pass
            accepted.append({"order_id": str(r["order_id"]), "total_idr": amt})
        except Exception:
            pass
    return {"accepted": accepted, "rejected": rejected}
''',
    },
    "idempotent_retry": {
        "modules": ["mod-0-2"],
        "title": "The Tuesday revenue that doubled",
        "function": "load_daily_orders",
        "broken_code": '''"""Chaos drill: the Tuesday revenue that doubled.

Symptom: a network timeout made the scheduler run load_daily_orders() again for the same day. Tuesday's revenue
is now about twice the usual figure, and finance also says cancelled and refunded orders should never count.

What must be true when you are done:
- running the load again with the same data changes nothing (the result of f(f(x)) equals f(x));
- an order appears once, however many times it was loaded;
- net_revenue_idr leaves out cancelled and refunded orders, however their status is written.
"""

def load_daily_orders(existing_rows, incoming_batch):
    combined = list(existing_rows) + list(incoming_batch)
    revenue = sum(int(r["total_idr"]) for r in combined)
    return {"rows": combined, "net_revenue_idr": revenue}
''',
    },
    "scd_fanout": {
        "modules": ["mod-0-3", "mod-1-4", "mod-1-5"],
        "title": "The join that multiplied the revenue",
        "function": "join_orders_to_scd2",
        "broken_code": '''"""Chaos drill: the join that multiplied the revenue.

Symptom: revenue by customer tier is too high for customers who changed tier, and the total no longer matches the
orders table. Orders from customers who are missing from the customer table have disappeared from the report.

Each customer version is valid from valid_from (included) to valid_to (not included).

What must be true when you are done:
- one order in, one row out: matched_rows equals the number of orders;
- each order gets the tier that was valid when it was placed;
- the revenue of all tiers adds up to the revenue of all orders.
"""

def join_orders_to_scd2(orders, customer_versions):
    revenue_by_tier = {}
    matched_rows = 0
    for o in orders:
        for cv in customer_versions:
            if o["customer_id"] == cv["customer_id"]:
                tier = cv["tier"]
                revenue_by_tier[tier] = revenue_by_tier.get(tier, 0) + int(o["total_idr"])
                matched_rows += 1
    return {"matched_rows": matched_rows, "revenue_by_tier": revenue_by_tier}
''',
    },
    "streaming_rag_skew": {
        "modules": ["mod-3-3", "mod-3-5"],
        "title": "The late events and the mixed embedding models",
        "function": "process_stream_and_vectors",
        "broken_code": '''"""Chaos drill: the late events and the mixed embedding models.

Symptom: a window that was already reported keeps changing when old events arrive late, some events are counted
twice after a producer retry, and search results mix vectors from two embedding models.

What must be true when you are done:
- an event older than the watermark (event_ts < watermark_ts) does not change window_sum; its event_id goes to late_dlq;
- an event_id is counted at most once (the first time it is seen);
- matching_chunks only contains chunks made with active_model.
"""

def process_stream_and_vectors(events, watermark_ts, vector_chunks, active_model):
    window_sum = 0
    late_dlq = []
    for ev in events:
        window_sum += int(ev["amount"])
    matching_chunks = [c["doc_id"] for c in vector_chunks]
    return {"window_sum": window_sum, "late_dlq": late_dlq, "matching_chunks": matching_chunks}
''',
    },
}


def get_archetype(mod_id):
    for key, spec in ARCHETYPES.items():
        if mod_id in spec["modules"]:
            return key, spec
    return None, None


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# What is compared on hidden data: only what the incident is about, so a fix written differently still passes.
def canon(key, res):
    if key == "mutable_batch":
        return (sorted((str(r["order_id"]), int(r["total_idr"])) for r in res["accepted"]), sorted(str(r["order_id"]) for r in res["rejected"]))
    if key == "idempotent_retry":
        return (sorted(str(r["order_id"]).strip() for r in res["rows"]), res["net_revenue_idr"])
    if key == "scd_fanout":
        return (res["matched_rows"], dict(res["revenue_by_tier"]))
    return (res["window_sum"], sorted(res["late_dlq"]), list(res["matching_chunks"]))


def hidden_runs(key, fn):
    """Yields (description, result) pairs on data the learner never sees. The same calls are made on the reference fix."""
    if key == "mutable_batch":
        yield "three branches in a row", [fn(b) for b in (
            [{"order_id": "A1", "total_idr": "0"}, {"order_id": "A2", "total_idr": " 125000 "}],
            [{"order_id": "B1", "total_idr": None}, {"order_id": "B2", "total_idr": "12.5"}, {"order_id": "B3", "total_idr": "-1"}],
            [{"order_id": "C1", "total_idr": 80000}, {"order_id": "C2"}],
        )]
    elif key == "idempotent_retry":
        day = [{"order_id": "105 ", "status": "paid", "total_idr": 40000}, {"order_id": "106", "status": " Refunded ", "total_idr": 70000},
               {"order_id": "105", "status": "paid", "total_idr": 40000}, {"order_id": "107", "status": "Cancelled", "total_idr": 5000},
               {"order_id": "108", "status": "shipped", "total_idr": 125000}]
        r1 = fn([], day)
        yield "a day with a repeated order and untidy statuses, loaded three times", [r1, fn(r1["rows"], day), fn(fn(r1["rows"], day)["rows"], day)]
    elif key == "scd_fanout":
        versions = [{"customer_id": 7, "tier": "Bronze", "valid_from": "2026-02-01", "valid_to": "2026-03-01"},
                    {"customer_id": 7, "tier": "Silver", "valid_from": "2026-03-01", "valid_to": "2026-04-01"},
                    {"customer_id": 7, "tier": "Gold", "valid_from": "2026-04-01", "valid_to": "9999-12-31"},
                    {"customer_id": 8, "tier": "Silver", "valid_from": "2026-02-15", "valid_to": "9999-12-31"}]
        orders = [{"order_id": 1, "customer_id": 7, "order_ts": "2026-03-01", "total_idr": 10000},
                  {"order_id": 2, "customer_id": 7, "order_ts": "2026-01-20", "total_idr": 20000},
                  {"order_id": 3, "customer_id": 8, "order_ts": "2026-02-20", "total_idr": 30000},
                  {"order_id": 4, "customer_id": 7, "order_ts": "2026-04-02", "total_idr": 40000},
                  {"order_id": 5, "customer_id": 9, "order_ts": "2026-02-20", "total_idr": 50000}]
        yield "an order on the day a version changes, an order before the first version, an unknown customer", [fn(orders, versions)]
    else:
        events = [{"event_id": "x1", "event_ts": 200, "amount": 5}, {"event_id": "x2", "event_ts": 199, "amount": 70},
                  {"event_id": "x1", "event_ts": 200, "amount": 5}, {"event_id": "x3", "event_ts": 250, "amount": 11},
                  {"event_id": "x2", "event_ts": 199, "amount": 70}]
        chunks = [{"doc_id": "p1", "model": "m-2024"}, {"doc_id": "p2", "model": "m-2025"}, {"doc_id": "p3"}, {"doc_id": "p4", "model": "m-2025"}]
        yield "an event exactly at the watermark, a late duplicate, a chunk with no model", [fn(events, 200, chunks, "m-2025")]


def run_tests(mod_id, work_dir, ref_dir=REF):
    key, spec = get_archetype(mod_id)
    script_path = Path(work_dir) / "broken_pipeline.py"
    if not script_path.is_file():
        return 0, [f"FAIL  {script_path} not found. Run `python3 scripts/chaos_drill.py init {mod_id} {work_dir}` first."]
    try:
        mod = load(script_path, "chaos_user")
    except Exception as e:
        return 0, [f"FAIL  broken_pipeline.py failed to import: {e}"]
    fn = getattr(mod, spec["function"], None)
    if not callable(fn):
        return 0, [f"FAIL  {spec['function']}() not found in broken_pipeline.py"]

    passed, msgs = 0, []

    def check(cond, text, hint=""):
        nonlocal passed
        if cond:
            passed += 1
            msgs.append(f"PASS  {text}")
        else:
            msgs.append(f"FAIL  {text}" + (f"\n      hint: {hint}" if hint else ""))

    def safe(call):
        try:
            return call(), None
        except Exception as e:
            return None, f"{type(e).__name__}: {e}"

    # 1. the incident's own data
    if key == "mutable_batch":
        b, err = safe(lambda: (fn([{"order_id": "1", "total_idr": "100000"}]),
                               fn([{"order_id": "2", "total_idr": "250000"}, {"order_id": "3", "total_idr": "-5000"}, {"order_id": "4", "total_idr": "Rp 90k"}])))
        if err:
            return 0, [f"FAIL  transform_batch crashed: {err}"]
        b1, b2 = b
        check(len(b1["accepted"]) == 1, "branch A: its one valid row is accepted")
        check([r["order_id"] for r in b2["accepted"]] == ["2"], "branch B contains only its own valid row", "what does Python do with a default value such as [] between calls?")
        check(sorted(str(r.get("order_id")) for r in b2["rejected"]) == ["3", "4"], "branch B rejects the negative and the text total, keeping their order_id", f"got rejected={b2['rejected']}")
    elif key == "idempotent_retry":
        batch = [{"order_id": "101", "status": "paid", "total_idr": 150000}, {"order_id": "102", "status": "CANCELLED", "total_idr": 90000},
                 {"order_id": "103", "status": "refunded", "total_idr": 60000}, {"order_id": "104", "status": "delivered", "total_idr": 200000}]
        r, err = safe(lambda: (lambda r1: (r1, fn(r1["rows"], batch)))(fn([], batch[:2])))
        if err:
            return 0, [f"FAIL  load_daily_orders crashed: {err}"]
        r1, r2 = r
        r3, err = safe(lambda: fn(r2["rows"], batch))
        check(len(r2["rows"]) == 4, "a retry after a partial load keeps 4 unique orders", f"got {len(r2['rows'])} rows")
        check(r2["net_revenue_idr"] == 350000, "net revenue leaves out cancelled and refunded orders (350000)", f"got {r2['net_revenue_idr']}")
        check(r3 is not None and canon(key, r3) == canon(key, r2), "a third run changes nothing", "load the same data twice and compare")
    elif key == "scd_fanout":
        versions = [{"customer_id": 1, "tier": "Silver", "valid_from": "2026-01-01", "valid_to": "2026-01-15"},
                    {"customer_id": 1, "tier": "Gold", "valid_from": "2026-01-15", "valid_to": "9999-12-31"}]
        orders = [{"order_id": 10, "customer_id": 1, "order_ts": "2026-01-10", "total_idr": 100000},
                  {"order_id": 11, "customer_id": 1, "order_ts": "2026-01-20", "total_idr": 250000},
                  {"order_id": 12, "customer_id": 999, "order_ts": "2026-01-21", "total_idr": 50000}]
        res, err = safe(lambda: fn(orders, versions))
        if err:
            return 0, [f"FAIL  join_orders_to_scd2 crashed: {err}"]
        check(res["matched_rows"] == 3, "3 orders in, 3 rows out", f"got {res['matched_rows']}")
        check(sum(res["revenue_by_tier"].values()) == 400000, "the tiers add up to the revenue of all orders (400000)", f"got {res['revenue_by_tier']}")
        check(res["revenue_by_tier"].get("Silver") == 100000 and res["revenue_by_tier"].get("Gold") == 250000, "each order gets the tier valid when it was placed", f"got {res['revenue_by_tier']}")
    else:
        events = [{"event_id": "e1", "event_ts": 105, "amount": 100}, {"event_id": "e1", "event_ts": 105, "amount": 100},
                  {"event_id": "e2", "event_ts": 80, "amount": 900}, {"event_id": "e3", "event_ts": 110, "amount": 250}]
        chunks = [{"doc_id": "d1", "model": "v1"}, {"doc_id": "d2", "model": "v2"}]
        res, err = safe(lambda: fn(events, 100, chunks, "v2"))
        if err:
            return 0, [f"FAIL  process_stream_and_vectors crashed: {err}"]
        check(res["window_sum"] == 350, "the window counts e1 once and leaves out the late e2 (350)", f"got {res['window_sum']}")
        check(res["late_dlq"] == ["e2"], "the late event goes to late_dlq", f"got {res['late_dlq']}")
        check(res["matching_chunks"] == ["d2"], "only chunks from the active model are returned", f"got {res['matching_chunks']}")

    # 2. hidden data, compared with the reference fix
    ref = load(ref_dir / f"{key}.py", "chaos_ref")
    ref_fn = getattr(ref, spec["function"])
    try:
        got_runs = list(hidden_runs(key, fn))
    except Exception as e:
        got_runs = None
        check(False, "hidden data: your fix runs on data it has not seen", f"it crashed: {type(e).__name__}: {e}")
    if got_runs is not None:
        for (text, got), (_, want) in zip(got_runs, hidden_runs(key, ref_fn)):
            try:
                same = [canon(key, g) for g in got] == [canon(key, w) for w in want]
            except Exception:
                same = False
            check(same, f"hidden data ({text}) gives the right result", "re-read the 'What must be true' list at the top of broken_pipeline.py")

    all_ok = all(m.startswith("PASS") for m in msgs) and passed > 0
    return (passed if all_ok else 0), msgs


def cmd_list():
    print("Modules with a local chaos drill:\n")
    for key, spec in ARCHETYPES.items():
        print(f"  {', '.join(spec['modules']):28} {spec['title']}")
    print("\nRun:  python3 scripts/chaos_drill.py init <module> <folder>")
    return 0


def cmd_init(mod_id, folder, code=None):
    key, spec = get_archetype(mod_id)
    if not key:
        print(f"No local chaos drill for {mod_id} yet. Its chaos lab is done in the web app.")
        return cmd_list() or 2
    target = Path(os.path.expanduser(folder)).resolve()
    target.mkdir(parents=True, exist_ok=True)
    dest = target / "broken_pipeline.py"
    if dest.exists() and code is None:
        print(f"{dest} already exists; it was left as it is. Delete it first to start again.")
        return 1
    dest.write_text(code if code is not None else spec["broken_code"], encoding="utf-8")
    print(f"Chaos drill for {mod_id}: {spec['title']}\n")
    print(f"1. Read the symptom at the top of, and fix:  {dest}")
    print(f"2. Check your fix:  python3 scripts/chaos_drill.py verify {mod_id} {folder}")
    return 0


def cmd_verify(mod_id, folder):
    key, _ = get_archetype(mod_id)
    if not key:
        print(f"No local chaos drill for {mod_id}.")
        return 2
    passed, msgs = run_tests(mod_id, Path(os.path.expanduser(folder)).resolve())
    for m in msgs:
        print(m)
    if not passed:
        print("\nNot yet: fix the first FAIL in broken_pipeline.py and run verify again.")
        return 1
    py = f"{sys.version_info.major}.{sys.version_info.minor}"
    osname = platform.system().lower() or "unknown"
    fields = [VERSION, mod_id, str(passed), py, osname]
    chk = hashlib.sha256(("|".join(fields)).encode("utf-8")).hexdigest()[:6]
    print(f"\nFixed: {passed} checks passed, including hidden data.")
    print(f"Chaos code (paste it into the Chaos tab of the web app):  {':'.join(fields + [chk])}")
    return 0


def self_test():
    """Broken code must fail, the reference fix must pass, and the app must list exactly these modules."""
    bad = 0
    for key, spec in ARCHETYPES.items():
        for mod_id in spec["modules"]:
            tmp = tempfile.mkdtemp(prefix="chaos-test-")
            try:
                (Path(tmp) / "broken_pipeline.py").write_text(spec["broken_code"], encoding="utf-8")
                broken, _ = run_tests(mod_id, tmp)
                shutil.copy(REF / f"{key}.py", Path(tmp) / "broken_pipeline.py")
                fixed, msgs = run_tests(mod_id, tmp)
                ok = broken == 0 and fixed > 0
                print(f"{mod_id:8} {key:20} broken {'fails' if broken == 0 else 'PASSES  <-- should fail'}, fix {'passes' if fixed else 'FAILS  <-- should pass'}")
                if not ok:
                    bad += 1
                    print("\n".join(msgs))
            finally:
                shutil.rmtree(tmp, ignore_errors=True)
    app = (ROOT / "app" / "js" / "app.js").read_text(encoding="utf-8")
    m = re.search(r"const CHAOS_DRILL_MODULES = \[([^\]]*)\]", app)
    listed = sorted(re.findall(r'"(mod-[0-9-]+)"', m.group(1))) if m else None
    want = sorted(x for s in ARCHETYPES.values() for x in s["modules"])
    print(f"app.js CHAOS_DRILL_MODULES {'matches' if listed == want else 'DOES NOT MATCH  <-- update app.js'} ({len(want)} modules)")
    bad += listed != want
    print("\nAll good." if not bad else f"\n{bad} problem(s).")
    return 1 if bad else 0


def main(argv):
    ap = argparse.ArgumentParser(description="Chaos drill: fix a broken pipeline on your own computer.")
    ap.add_argument("action", choices=("list", "init", "verify", "self-test"))
    ap.add_argument("mod_id", nargs="?", help="module id, e.g. mod-0-2")
    ap.add_argument("folder", nargs="?", help="your workspace folder, e.g. ~/df-chaos/mod-0-2")
    args = ap.parse_args(argv)
    if args.action == "list":
        return cmd_list()
    if args.action == "self-test":
        return self_test()
    if not args.mod_id:
        ap.error("give a module id, e.g. mod-0-2 (see: python3 scripts/chaos_drill.py list)")
    folder = args.folder or f"~/df-chaos/{args.mod_id}"
    return cmd_init(args.mod_id, folder) if args.action == "init" else cmd_verify(args.mod_id, folder)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
