#!/usr/bin/env python3
"""DataForge pull request review practice (PR1: tokens).

Builds a small local Git repository holding a teammate's pull request: a ticket that says what the code
must do, and a commit whose code does not quite do it. You review it the way you would at work:

  1. Read the ticket and the diff:   git -C <repo> show HEAD
  2. Run the tests:                  python3 <repo>/test_pr.py   (or python3 -m pytest <repo>/test_pr.py -v)
  3. Fix pr_pipeline.py in your editor until the tests pass
  4. Commit the fix:                 git -C <repo> commit -am "fix: ..."
  5. Get the token:                  python3 scripts/pr_review.py verify <pr_id> <repo>

The checks run your function on the dataset in the ticket and on a second dataset you do not see in
advance, and compare both with the reference fix. Pasting the reference fix is refused.

Commands:
  python3 scripts/pr_review.py list
  python3 scripts/pr_review.py init <pr_id> <repo_dir>
  python3 scripts/pr_review.py verify <pr_id> <repo_dir>
  python3 scripts/pr_review.py --self-test
"""
import ast
import hashlib
import hmac
import importlib.util
import json
import platform
import subprocess
import sys
import tempfile
from pathlib import Path


def _sha256(val: str) -> str:
    return hashlib.sha256(val.encode("utf-8")).hexdigest()


def _hmac_hex(secret: str, msg: str) -> str:
    return hmac.new(secret.encode("utf-8"), msg.encode("utf-8"), hashlib.sha256).hexdigest()


def make_pr_token(pr_id: str, passed: int, commits: int) -> str:
    py = f"{sys.version_info.major}.{sys.version_info.minor}"
    os_name = platform.system().lower()[:7] or "linux"
    fields = ["PR1", pr_id, str(passed), str(commits), py, os_name]
    chk = _sha256("|".join(fields))[:6]
    return ":".join(fields + [chk])


# Each case: the function name, the ticket (what the code must do, as a teammate's PR description would say),
# the code before the PR, the PR's code (three defects, no labels), and the reference fix.
PR_CASES = {
    "pr-1": {
        "title": "PR #104: merge incoming orders into the order mart",
        "fn": "merge_incremental_orders",
        "ticket": """Ticket ORD-88: incremental merge for the order mart.
- Incoming rows whose order_date is before min_allowed_date are too old: skip them.
  Rows on or after min_allowed_date are accepted, late arrivals included.
- When an order already exists, the incoming row replaces it if its updated_at is the same or newer.
- net_idr = gross_idr - discount_idr - tax_idr for paid, shipped and delivered orders, 0 for any other
  status. Statuses arrive in mixed case with stray spaces. Existing rows get net_idr computed the same way.
- Return {"rows": [...] sorted by order_id, "total_net_idr": sum of net_idr}.""",
        "baseline": '''"""Order mart merge (before PR #104)."""


def merge_incremental_orders(existing_rows, incoming_rows, min_allowed_date):
    raise NotImplementedError
''',
        "buggy": '''"""Order mart merge. PR #104 by junior-de: implements ticket ORD-88 (see TICKET.md)."""
ACTIVE = {"paid", "shipped", "delivered"}


def _net(row):
    return int(row["gross_idr"]) - int(row["discount_idr"])


def merge_incremental_orders(existing_rows, incoming_rows, min_allowed_date):
    merged = {}
    for r in existing_rows:
        row = dict(r)
        row["net_idr"] = _net(row)
        merged[str(row["order_id"])] = row

    for r in incoming_rows:
        if str(r["order_date"]) <= str(min_allowed_date):
            continue
        oid = str(r["order_id"])
        if oid in merged:
            continue
        row = dict(r)
        row["net_idr"] = _net(row)
        merged[oid] = row

    out = [merged[k] for k in sorted(merged)]
    return {"rows": out, "total_net_idr": sum(x["net_idr"] for x in out)}
''',
        "reference": '''"""Order mart merge, reviewed and fixed."""
ACTIVE = {"paid", "shipped", "delivered"}


def _net(row):
    if str(row.get("status", "")).strip().lower() not in ACTIVE:
        return 0
    return int(row["gross_idr"]) - int(row["discount_idr"]) - int(row["tax_idr"])


def merge_incremental_orders(existing_rows, incoming_rows, min_allowed_date):
    merged = {}
    for r in existing_rows:
        row = dict(r)
        row["net_idr"] = _net(row)
        merged[str(row["order_id"])] = row

    for r in incoming_rows:
        if str(r["order_date"]) < str(min_allowed_date):
            continue
        oid = str(r["order_id"])
        if oid in merged and str(r["updated_at"]) < str(merged[oid]["updated_at"]):
            continue
        row = dict(r)
        row["net_idr"] = _net(row)
        merged[oid] = row

    out = [merged[k] for k in sorted(merged)]
    return {"rows": out, "total_net_idr": sum(x["net_idr"] for x in out)}
''',
    },
    "pr-2": {
        "title": "PR #219: daily partitioned loader with quarantine",
        "fn": "run_daily_partition_load",
        "ticket": """Ticket ING-31: daily loader for the payments table, run by the orchestrator once per logical_date.
- Load only batch rows whose partition_date equals logical_date.
- Re-running the same logical_date (a retry or a backfill) must give exactly the same table: replace that
  date's partition, keep every other date.
- amount_idr must be a positive integer (it may arrive as a string). Rows that fail go to quarantine_ids
  by record_id, never into the table, and never disappear silently.
- Return {"table": rows sorted by (partition_date, record_id), "quarantine_ids": [...],
  "partition_sum_idr": sum of amount_idr in the logical_date partition}.""",
        "baseline": '''"""Daily loader (before PR #219)."""


def run_daily_partition_load(existing_table, raw_batch, logical_date):
    raise NotImplementedError
''',
        "buggy": '''"""Daily loader. PR #219 by data-intern: implements ticket ING-31 (see TICKET.md)."""
from datetime import date


def run_daily_partition_load(existing_table, raw_batch, logical_date):
    today = date.today().isoformat()
    table = [dict(r) for r in existing_table]
    quarantine_ids = []

    for r in raw_batch:
        if str(r.get("partition_date")) != today:
            continue
        try:
            amt = int(r["amount_idr"])
            if amt <= 0:
                raise ValueError("amount must be positive")
            table.append({"record_id": str(r["record_id"]), "partition_date": today, "amount_idr": amt})
        except Exception:
            pass

    table.sort(key=lambda x: (x["partition_date"], x["record_id"]))
    psum = sum(x["amount_idr"] for x in table if x["partition_date"] == str(logical_date))
    return {"table": table, "quarantine_ids": quarantine_ids, "partition_sum_idr": psum}
''',
        "reference": '''"""Daily loader, reviewed and fixed."""


def run_daily_partition_load(existing_table, raw_batch, logical_date):
    ld = str(logical_date)
    table = [dict(r) for r in existing_table if str(r.get("partition_date")) != ld]
    quarantine_ids = []

    for r in raw_batch:
        if str(r.get("partition_date")) != ld:
            continue
        try:
            amt = int(r["amount_idr"])
            if amt <= 0:
                raise ValueError("amount must be positive")
            table.append({"record_id": str(r["record_id"]), "partition_date": ld, "amount_idr": amt})
        except (KeyError, TypeError, ValueError):
            quarantine_ids.append(str(r.get("record_id", "")))

    table.sort(key=lambda x: (x["partition_date"], x["record_id"]))
    psum = sum(x["amount_idr"] for x in table if x["partition_date"] == ld)
    return {"table": table, "quarantine_ids": quarantine_ids, "partition_sum_idr": psum}
''',
    },
    "pr-3": {
        "title": "PR #308: blacklist filter and hot-key salting",
        "fn": "filter_and_salt_events",
        "ticket": """Ticket SPK-12: prepare click events for a join that is skewed on merchant_id.
- Drop events whose user_id is in blacklist_user_ids. The blacklist comes from a table and may contain
  None or blank values; those match nobody, and must not change the result for anyone else.
- A missing or blank merchant_id becomes "UNKNOWN_MERCHANT", which counts as a hot merchant too.
- salted_key: for a hot merchant, its n-th event in event_id order (n from 0) gets f"{merchant}#{n % num_salts}";
  any other merchant gets f"{merchant}#0". The same input must always give the same keys.
- Return {"salted_events": [{"event_id", "user_id", "merchant_id", "salted_key"}] in event_id order,
  "bucket_counts": {salted_key: count}}.""",
        "baseline": '''"""Blacklist filter and skew salting (before PR #308)."""


def filter_and_salt_events(events, blacklist_user_ids, hot_merchants, num_salts=4):
    raise NotImplementedError
''',
        "buggy": '''"""Blacklist filter and skew salting. PR #308 by analytics-dev: implements ticket SPK-12 (see TICKET.md).

Ported from our SQL: WHERE user_id NOT IN (SELECT user_id FROM blacklist).
"""


def _not_in(value, values):
    # same three-valued logic as SQL NOT IN
    if any(v is None for v in values):
        return False
    return value not in values


def filter_and_salt_events(events, blacklist_user_ids, hot_merchants, num_salts=4):
    hot = set(hot_merchants)
    out = []
    buckets = {}
    for ev in sorted(events, key=lambda x: str(x["event_id"])):
        uid = str(ev.get("user_id") or "")
        if not _not_in(uid, blacklist_user_ids):
            continue
        mid = str(ev.get("merchant_id") or "")
        if mid in hot:
            skey = f"{mid}#{hash(ev['event_id']) % num_salts}"
        else:
            skey = f"{mid}#0"
        out.append({"event_id": str(ev["event_id"]), "user_id": uid, "merchant_id": mid, "salted_key": skey})
        buckets[skey] = buckets.get(skey, 0) + 1
    return {"salted_events": out, "bucket_counts": buckets}
''',
        "reference": '''"""Blacklist filter and skew salting, reviewed and fixed."""


def filter_and_salt_events(events, blacklist_user_ids, hot_merchants, num_salts=4):
    blocked = {str(u).strip() for u in blacklist_user_ids if u is not None and str(u).strip()}
    hot = {str(m).strip() for m in hot_merchants if m is not None} | {"UNKNOWN_MERCHANT"}
    seen = {}
    out = []
    buckets = {}
    for ev in sorted(events, key=lambda x: str(x["event_id"])):
        uid = str(ev.get("user_id") or "").strip()
        if uid in blocked:
            continue
        mid = str(ev.get("merchant_id") or "").strip() or "UNKNOWN_MERCHANT"
        if mid in hot:
            n = seen.get(mid, 0)
            seen[mid] = n + 1
            skey = f"{mid}#{n % int(num_salts)}"
        else:
            skey = f"{mid}#0"
        out.append({"event_id": str(ev["event_id"]), "user_id": uid, "merchant_id": mid, "salted_key": skey})
        buckets[skey] = buckets.get(skey, 0) + 1
    return {"salted_events": out, "bucket_counts": buckets}
''',
    },
    "pr-4": {
        "title": "PR #412: point-in-time features and email tokens for fraud training",
        "fn": "build_pit_features_and_tokenize",
        "ticket": """Ticket ML-7: training rows for the fraud model.
- pit_risk_score: the user's risk_score from the latest feature_log row with updated_at <= the transaction's
  tx_ts, or 0 if there is none. The model may only learn from what was known at the time of the transaction.
- user_token: HMAC-SHA256, keyed with secret_salt, of the email trimmed and lower-cased, as hex. The same
  person must get the same token whatever the email's case or spacing.
- The training table must not contain the email itself.
- Return a list of {"tx_id", "user_token", "pit_risk_score"} sorted by tx_id.""",
        "baseline": '''"""Fraud training features (before PR #412)."""


def build_pit_features_and_tokenize(transactions, feature_log, secret_salt):
    raise NotImplementedError
''',
        "buggy": '''"""Fraud training features. PR #412 by ml-intern: implements ticket ML-7 (see TICKET.md)."""
import hashlib


def build_pit_features_and_tokenize(transactions, feature_log, secret_salt):
    out = []
    for tx in sorted(transactions, key=lambda x: str(x["tx_id"])):
        uid = str(tx["user_id"])
        rows = [f for f in feature_log if str(f["user_id"]) == uid]
        score = max(rows, key=lambda f: int(f["updated_at"]))["risk_score"] if rows else 0
        token = hashlib.sha256(str(tx["email"]).encode()).hexdigest()
        out.append({
            "tx_id": str(tx["tx_id"]),
            "user_token": token,
            "email": tx["email"],
            "pit_risk_score": int(score),
        })
    return out
''',
        "reference": '''"""Fraud training features, reviewed and fixed."""
import hashlib
import hmac


def build_pit_features_and_tokenize(transactions, feature_log, secret_salt):
    out = []
    for tx in sorted(transactions, key=lambda x: str(x["tx_id"])):
        uid = str(tx["user_id"])
        ts = int(tx["tx_ts"])
        rows = [f for f in feature_log if str(f["user_id"]) == uid and int(f["updated_at"]) <= ts]
        score = max(rows, key=lambda f: int(f["updated_at"]))["risk_score"] if rows else 0
        email = str(tx.get("email", "")).strip().lower()
        token = hmac.new(str(secret_salt).encode(), email.encode(), hashlib.sha256).hexdigest()
        out.append({"tx_id": str(tx["tx_id"]), "user_token": token, "pit_risk_score": int(score)})
    return out
''',
    },
}


def _datasets(pr_id: str):
    """Two inputs per case: the one in the tests (visible) and a second one with other values (hidden)."""
    if pr_id == "pr-1":
        visible = (
            [{"order_id": "O1", "order_date": "2026-02-01", "status": "paid", "gross_idr": 100000, "discount_idr": 0, "tax_idr": 10000, "updated_at": "2026-02-01T08:00:00"}],
            [
                {"order_id": "O1", "order_date": "2026-02-01", "status": "delivered", "gross_idr": 100000, "discount_idr": 10000, "tax_idr": 9000, "updated_at": "2026-02-03T10:00:00"},
                {"order_id": "O2_LATE", "order_date": "2026-02-02", "status": "paid", "gross_idr": 50000, "discount_idr": 0, "tax_idr": 5000, "updated_at": "2026-02-03T11:00:00"},
                {"order_id": "O3_REF", "order_date": "2026-02-03", "status": "refunded", "gross_idr": 80000, "discount_idr": 0, "tax_idr": 8000, "updated_at": "2026-02-03T12:00:00"},
                {"order_id": "O4_TOO_OLD", "order_date": "2026-01-20", "status": "paid", "gross_idr": 90000, "discount_idr": 0, "tax_idr": 9000, "updated_at": "2026-02-03T12:00:00"},
            ],
            "2026-02-01",
        )
        hidden = (
            [
                {"order_id": "A1", "order_date": "2026-03-09", "status": "paid", "gross_idr": 200000, "discount_idr": 0, "tax_idr": 20000, "updated_at": "2026-03-09T10:00:00"},
                {"order_id": "A2", "order_date": "2026-03-10", "status": "Shipped", "gross_idr": 120000, "discount_idr": 10000, "tax_idr": 11000, "updated_at": "2026-03-10T09:00:00"},
            ],
            [
                {"order_id": "A1", "order_date": "2026-03-09", "status": "cancelled", "gross_idr": 200000, "discount_idr": 0, "tax_idr": 20000, "updated_at": "2026-03-11T08:00:00"},
                {"order_id": "A2", "order_date": "2026-03-10", "status": "paid", "gross_idr": 999999, "discount_idr": 0, "tax_idr": 0, "updated_at": "2026-03-10T08:00:00"},
                {"order_id": "A3", "order_date": "2026-03-10", "status": "delivered", "gross_idr": 300000, "discount_idr": 30000, "tax_idr": 27000, "updated_at": "2026-03-11T09:00:00"},
                {"order_id": "A4", "order_date": "2026-03-12", "status": "REFUNDED", "gross_idr": 70000, "discount_idr": 0, "tax_idr": 7000, "updated_at": "2026-03-12T09:00:00"},
                {"order_id": "A5", "order_date": "2026-03-11", "status": " Paid ", "gross_idr": 50000, "discount_idr": 0, "tax_idr": 5000, "updated_at": "2026-03-11T10:00:00"},
            ],
            "2026-03-10",
        )
        return visible, hidden
    if pr_id == "pr-2":
        visible = (
            [{"record_id": "R0", "partition_date": "2026-02-01", "amount_idr": 40000},
             {"record_id": "R1_OLD", "partition_date": "2026-02-02", "amount_idr": 99000}],
            [{"record_id": "R1", "partition_date": "2026-02-02", "amount_idr": 50000},
             {"record_id": "R2_BAD", "partition_date": "2026-02-02", "amount_idr": -100},
             {"record_id": "R3_OTHER_DAY", "partition_date": "2026-02-03", "amount_idr": 70000}],
            "2026-02-02",
        )
        hidden = (
            [{"record_id": "X1", "partition_date": "2026-04-04", "amount_idr": 10000},
             {"record_id": "X2", "partition_date": "2026-04-05", "amount_idr": 77000},
             {"record_id": "X3", "partition_date": "2026-04-05", "amount_idr": 1000}],
            [{"record_id": "Y1", "partition_date": "2026-04-05", "amount_idr": "15000"},
             {"record_id": "Y2", "partition_date": "2026-04-05", "amount_idr": "abc"},
             {"record_id": "Y3", "partition_date": "2026-04-05", "amount_idr": 0},
             {"record_id": "Y4", "partition_date": "2026-04-06", "amount_idr": 5000},
             {"record_id": "Y5", "partition_date": "2026-04-05", "amount_idr": 25000}],
            "2026-04-05",
        )
        return visible, hidden
    if pr_id == "pr-3":
        visible = (
            [{"event_id": "E1", "user_id": "U_BAD", "merchant_id": "M_HOT"},
             {"event_id": "E2", "user_id": "U_OK1", "merchant_id": "M_HOT"},
             {"event_id": "E3", "user_id": "U_OK2", "merchant_id": "M_HOT"},
             {"event_id": "E4", "user_id": "U_OK3", "merchant_id": None}],
            ["U_BAD", None, ""], ["M_HOT"], 2,
        )
        hidden = (
            [{"event_id": "E10", "user_id": "U1", "merchant_id": "H1"},
             {"event_id": "E11", "user_id": "U9", "merchant_id": "H1"},
             {"event_id": "E12", "user_id": "U2", "merchant_id": "H1"},
             {"event_id": "E13", "user_id": "U3", "merchant_id": "H2"},
             {"event_id": "E14", "user_id": "U4", "merchant_id": "H1"},
             {"event_id": "E15", "user_id": "U5", "merchant_id": "M3"},
             {"event_id": "E16", "user_id": "U6", "merchant_id": ""},
             {"event_id": "E17", "user_id": "U7", "merchant_id": "H1"},
             {"event_id": "E18", "user_id": "U8", "merchant_id": "H2"},
             {"event_id": "E19", "user_id": "U1", "merchant_id": "  "}],
            ["U9", None, " "], ["H1", "H2"], 3,
        )
        return visible, hidden
    if pr_id == "pr-4":
        visible = (
            [{"tx_id": "T1", "user_id": "U1", "tx_ts": 1000, "email": " Budi@Example.com "}],
            [{"user_id": "U1", "updated_at": 900, "risk_score": 25},
             {"user_id": "U1", "updated_at": 1500, "risk_score": 99}],
            "salt_2026",
        )
        hidden = (
            [{"tx_id": "T3", "user_id": "U2", "tx_ts": 3000, "email": "ani@mail.id"},
             {"tx_id": "T1", "user_id": "U1", "tx_ts": 500, "email": "x@y.z "},
             {"tx_id": "T2", "user_id": "U2", "tx_ts": 2000, "email": "ANI@mail.id"}],
            [{"user_id": "U2", "updated_at": 1999, "risk_score": 40},
             {"user_id": "U2", "updated_at": 2000, "risk_score": 55},
             {"user_id": "U2", "updated_at": 2500, "risk_score": 70},
             {"user_id": "U1", "updated_at": 600, "risk_score": 90}],
            "s3cr3t",
        )
        return visible, hidden
    raise ValueError(pr_id)


def _call(fn, pr_id, data):
    """Run fn on one dataset; pr-2 runs twice to prove a re-run changes nothing."""
    data = json.loads(json.dumps(data))   # each call gets its own copy, so a function that mutates its input cannot leak
    if pr_id == "pr-2":
        existing, batch, ld = data
        first = fn(existing, batch, ld)
        second = fn(first["table"], json.loads(json.dumps(batch)), ld)
        return {"first": first, "rerun": second}
    return fn(*data)


def _reference_fn(pr_id):
    ns = {}
    exec(compile(PR_CASES[pr_id]["reference"], f"<reference {pr_id}>", "exec"), ns)
    return ns[PR_CASES[pr_id]["fn"]]


def _shape(src: str) -> str:
    """The code's structure without comments, docstrings or formatting: used to refuse a pasted reference."""
    tree = ast.parse(src)
    for node in ast.walk(tree):
        body = getattr(node, "body", None)
        if isinstance(body, list) and body and isinstance(body[0], ast.Expr) and isinstance(getattr(body[0], "value", None), ast.Constant) and isinstance(body[0].value.value, str):
            node.body = body[1:] or [ast.Pass()]
    return ast.dump(tree, annotate_fields=False)


def run_pr_checks(pr_id: str, repo_dir: Path) -> tuple[int, list[str]]:
    if pr_id not in PR_CASES:
        raise ValueError(f"Unknown PR case '{pr_id}'. Valid: {', '.join(PR_CASES)}")
    p = Path(repo_dir) / "pr_pipeline.py"
    if not p.exists():
        raise FileNotFoundError(f"Missing {p}. Run: python3 scripts/pr_review.py init {pr_id} {repo_dir}")
    src = p.read_text(encoding="utf-8")
    if _shape(src) == _shape(PR_CASES[pr_id]["reference"]):
        raise AssertionError("This is the reference fix from scripts/pr_review.py. Write the fix yourself.")
    spec = importlib.util.spec_from_file_location(f"pr_{pr_id.replace('-', '_')}", p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    fn = getattr(mod, PR_CASES[pr_id]["fn"], None)
    if not callable(fn):
        raise AttributeError(f"{PR_CASES[pr_id]['fn']} not found in pr_pipeline.py")

    ref = _reference_fn(pr_id)
    visible, hidden = _datasets(pr_id)
    passed, errors = [], []

    def check(cond, desc, detail=None):
        (passed.append(desc) if cond else errors.append(f"FAIL: {desc}" + (f"\n      got: {detail}" if detail is not None else "")))

    def safe(data):
        try:
            return _call(fn, pr_id, data), None
        except Exception as e:  # a crash is a failed check, with the reason shown
            return None, f"{type(e).__name__}: {e}"

    got, err = safe(visible)
    want = _call(ref, pr_id, visible)
    if err:
        errors.append(f"FAIL: your function raised {err} on the ticket's dataset")
    elif pr_id == "pr-1":
        check([r["order_id"] for r in got.get("rows", [])] == ["O1", "O2_LATE", "O3_REF"], "keeps orders on or after min_allowed_date and skips O4_TOO_OLD", [r.get("order_id") for r in got.get("rows", [])])
        o1 = next((r for r in got.get("rows", []) if r.get("order_id") == "O1"), {})
        check(o1.get("status") == "delivered" and o1.get("net_idr") == 81000, "O1 takes its newer state, net 81000", {k: o1.get(k) for k in ("status", "net_idr")})
        check(got.get("total_net_idr") == 126000, "total_net_idr is 126000", got.get("total_net_idr"))
    elif pr_id == "pr-2":
        check(got["first"].get("partition_sum_idr") == 50000 and got["rerun"].get("partition_sum_idr") == 50000, "partition 2026-02-02 sums to 50000, also after a re-run", [got["first"].get("partition_sum_idr"), got["rerun"].get("partition_sum_idr")])
        check(got["first"].get("quarantine_ids") == ["R2_BAD"], "R2_BAD is quarantined", got["first"].get("quarantine_ids"))
        check([r.get("record_id") for r in got["rerun"].get("table", [])] == ["R0", "R1"], "after a re-run the table holds R0 and R1 only", [r.get("record_id") for r in got["rerun"].get("table", [])])
    elif pr_id == "pr-3":
        check(len(got.get("salted_events", [])) == 3, "a None in the blacklist removes only U_BAD's event", len(got.get("salted_events", [])))
        bc = got.get("bucket_counts", {})
        check(bc.get("M_HOT#0") == 1 and bc.get("M_HOT#1") == 1, "M_HOT is spread over M_HOT#0 and M_HOT#1", bc)
        check(any(r.get("merchant_id") == "UNKNOWN_MERCHANT" for r in got.get("salted_events", [])), "a missing merchant_id becomes UNKNOWN_MERCHANT", [r.get("merchant_id") for r in got.get("salted_events", [])])
    elif pr_id == "pr-4":
        r0 = (got or [{}])[0]
        check(r0.get("pit_risk_score") == 25, "T1 gets the score known at tx_ts (25), not the later 99", r0.get("pit_risk_score"))
        check(r0.get("user_token") == _hmac_hex("salt_2026", "budi@example.com"), "user_token is the keyed HMAC of the trimmed, lower-cased email", r0.get("user_token"))
        check("email" not in r0 and "budi" not in json.dumps(got).lower(), "no email in the output", sorted(r0))
    if not err:
        check(json.dumps(got, sort_keys=True) == json.dumps(want, sort_keys=True), "the ticket's dataset matches the reference fix exactly")

    got2, err2 = safe(hidden)
    want2 = _call(ref, pr_id, hidden)
    if err2:
        errors.append(f"FAIL: your function raised {err2} on the second dataset")
    else:
        check(json.dumps(got2, sort_keys=True) == json.dumps(want2, sort_keys=True),
              "a second dataset with other values matches the reference fix (re-read the ticket line by line)")

    if errors:
        raise AssertionError("\n".join(errors))
    return len(passed), passed


def _git(repo_dir: Path, *args: str) -> str:
    res = subprocess.run(["git", *args], cwd=str(repo_dir), capture_output=True, text=True, check=True)
    return res.stdout.strip()


def cmd_list():
    print("DataForge pull request review cases:")
    for pid, meta in PR_CASES.items():
        print(f"  - {pid:<6} : {meta['title']}")


def cmd_init(pr_id: str, repo_dir: Path, quiet: bool = False):
    if pr_id not in PR_CASES:
        print(f"Unknown PR case '{pr_id}'. Valid: {', '.join(PR_CASES)}")
        sys.exit(1)
    meta = PR_CASES[pr_id]
    if (repo_dir / ".git").exists():
        print(f"A Git repository already exists at {repo_dir}. Delete that folder to start this case again.")
        return
    repo_dir.mkdir(parents=True, exist_ok=True)
    _git(repo_dir, "init", "-q")
    _git(repo_dir, "config", "user.email", "learner@dataforge.local")
    _git(repo_dir, "config", "user.name", "DataForge Learner")
    (repo_dir / "pr_pipeline.py").write_text(meta["baseline"], encoding="utf-8")
    _git(repo_dir, "add", "pr_pipeline.py")
    _git(repo_dir, "commit", "-q", "-m", "chore: stub before the PR")

    (repo_dir / "pr_pipeline.py").write_text(meta["buggy"], encoding="utf-8")
    (repo_dir / "TICKET.md").write_text(meta["ticket"] + "\n", encoding="utf-8")
    scripts_dir = Path(__file__).resolve().parent
    (repo_dir / "test_pr.py").write_text(
        f'"""Tests for {pr_id}: {meta["title"]}"""\n'
        f"import sys\nfrom pathlib import Path\n\n"
        f"sys.path.insert(0, {str(scripts_dir)!r})\n"
        f"import pr_review\n\n\n"
        f"def test_pull_request_meets_the_ticket():\n"
        f"    pr_review.run_pr_checks({pr_id!r}, Path(__file__).resolve().parent)\n\n\n"
        f"if __name__ == \"__main__\":   # also runs without pytest: python3 test_pr.py\n"
        f"    try:\n"
        f"        n, _ = pr_review.run_pr_checks({pr_id!r}, Path(__file__).resolve().parent)\n"
        f"        print(f\"passed: {{n}} checks\")\n"
        f"    except AssertionError as e:\n"
        f"        print(e)\n"
        f"        sys.exit(1)\n",
        encoding="utf-8")
    _git(repo_dir, "add", "pr_pipeline.py", "TICKET.md", "test_pr.py")
    _git(repo_dir, "commit", "-q", "-m", f"feat: {meta['title']}")
    if quiet:
        return
    print(f"Created the pull request repository at {repo_dir}\n")
    print("Review it as you would at work:")
    print(f"  1. Read the ticket and the diff:  git -C {repo_dir} show HEAD")
    print(f"  2. Run the tests:                 python3 {repo_dir}/test_pr.py   (or: python3 -m pytest {repo_dir}/test_pr.py -v)")
    print(f"  3. Fix {repo_dir}/pr_pipeline.py until the tests pass")
    print(f"  4. Commit the fix:                git -C {repo_dir} commit -am \"fix: ...\"")
    print(f"  5. Get your token:                python3 scripts/pr_review.py verify {pr_id} {repo_dir}")


def cmd_verify(pr_id: str, repo_dir: Path):
    try:
        passed, details = run_pr_checks(pr_id, repo_dir)
    except Exception as e:
        print(f"Not yet: {pr_id}\n{e}")
        sys.exit(1)
    try:
        commits = int(_git(repo_dir, "rev-list", "--count", "HEAD"))
        status = _git(repo_dir, "status", "--porcelain", "--untracked-files=no")
    except Exception as e:
        print(f"Could not read the Git repository in {repo_dir}: {e}")
        sys.exit(1)
    if commits < 3:
        print(f"The code passes, but the fix is not committed yet ({commits} commits, need 3: stub, PR, your fix).")
        print(f"  Run: git -C {repo_dir} commit -am \"fix: ...\"")
        sys.exit(1)
    if status:
        print(f"{repo_dir} has uncommitted changes. Commit the fix, then verify again.")
        sys.exit(1)
    for d in details:
        print(f"  PASS {d}")
    print(f"  PASS the fix is committed ({commits} commits)")
    print(f"\nPaste this token into DataForge:\n\n  {make_pr_token(pr_id, passed, commits)}\n")


def cmd_self_test():
    """Per case: the PR's code fails, the reference passes, a pasted reference is refused, and code that
    returns the ticket dataset's answer as a constant fails on the second dataset."""
    with tempfile.TemporaryDirectory() as tmp:
        for pid, meta in PR_CASES.items():
            rdir = Path(tmp) / pid
            cmd_init(pid, rdir, quiet=True)
            try:
                run_pr_checks(pid, rdir)
                raise SystemExit(f"{pid}: the PR's code passed")
            except AssertionError:
                pass

            (rdir / "pr_pipeline.py").write_text(meta["reference"], encoding="utf-8")
            try:
                run_pr_checks(pid, rdir)
                raise SystemExit(f"{pid}: a pasted reference was accepted")
            except AssertionError as e:
                assert "reference fix" in str(e), e

            # the learner's own fix: same behaviour, different code
            fixed = meta["reference"] + "\n\nREVIEWED_BY = \"me\"\n"
            assert _shape(fixed) != _shape(meta["reference"]), pid
            (rdir / "pr_pipeline.py").write_text(fixed, encoding="utf-8")
            passed, _ = run_pr_checks(pid, rdir)
            _git(rdir, "commit", "-q", "-am", "fix: review findings")
            commits = int(_git(rdir, "rev-list", "--count", "HEAD"))

            # the browser must accept this token for this case only (app/js/proof.js)
            tok = make_pr_token(pid, passed, commits)
            js = ("const P=require(process.argv[1]);const a=P.verifyPrReview(process.argv[2],process.argv[3]);"
                  "const b=P.verifyPrReview('pr-0',process.argv[3]);process.stdout.write(String(a.ok&&!b.ok))")
            proof_js = str(Path(__file__).resolve().parents[1] / "app" / "js" / "proof.js")
            try:
                ok = subprocess.run(["node", "-e", js, proof_js, pid, tok], capture_output=True, text=True).stdout
                assert ok == "true", f"{pid}: proof.js did not accept {tok}"
            except FileNotFoundError:
                pass   # no Node.js here: the Python side is still tested

            visible, _ = _datasets(pid)
            answer = _call(_reference_fn(pid), pid, visible)
            if pid == "pr-2":
                cheat = ("import json\n_A = json.loads(%r)\n_N = [0]\n"
                         "def %s(*a, **k):\n    _N[0] += 1\n    return _A['first'] if _N[0] %% 2 else _A['rerun']\n") % (json.dumps(answer), meta["fn"])
            else:
                cheat = "import json\n_A = json.loads(%r)\ndef %s(*a, **k):\n    return _A\n" % (json.dumps(answer), meta["fn"])
            (rdir / "pr_pipeline.py").write_text(cheat, encoding="utf-8")
            try:
                run_pr_checks(pid, rdir)
                raise SystemExit(f"{pid}: a hard-coded answer passed")
            except AssertionError as e:
                assert "second dataset" in str(e), e
            print(f"  ok {pid}: PR code fails, fix passes {passed} checks ({commits} commits), copy refused, hard-coded answer fails")
    print("SELF_TEST_ALL_4_PR_REVIEWS_OK")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] == "list":
        cmd_list()
    elif args[0] == "--self-test":
        cmd_self_test()
    elif args[0] == "init" and len(args) >= 3:
        cmd_init(args[1], Path(args[2]).expanduser())
    elif args[0] == "verify" and len(args) >= 3:
        cmd_verify(args[1], Path(args[2]).expanduser())
    else:
        print(__doc__)
        sys.exit(1)
