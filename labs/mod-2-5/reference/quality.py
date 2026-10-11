"""Reference solution for Lab 2.5: a data quality gate."""
import csv
import json
import re
import statistics
from collections import Counter
from datetime import datetime
from pathlib import Path

import yaml

ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$")


def load_contract(path):
    return yaml.safe_load(Path(path).read_text())


def _coerce(value, ftype):
    """Return (ok, coerced). Strict: the producer promised these types."""
    text = "" if value is None else str(value).strip()
    if ftype == "integer":
        return (True, int(text)) if re.fullmatch(r"-?\d+", text) else (False, None)
    if ftype == "timestamp":
        if not ISO.match(text):
            return False, None
        try:
            return True, datetime.fromisoformat(text)
        except ValueError:
            return False, None
    return (True, text) if text != "" else (False, None)


def validate_rows(rows, contract):
    """Return (valid, quarantined). A quarantined item is {"row": row, "errors": ["field: reason", ...]}."""
    fields = contract["fields"]
    unique = [f["name"] for f in fields if f.get("unique")]
    seen = {name: set() for name in unique}
    valid, quarantined = [], []
    for row in rows:
        errors = []
        clean = {}
        for f in fields:
            name = f["name"]
            raw = row.get(name)
            if raw is None or str(raw).strip() == "":
                if f.get("required"):
                    errors.append(f"{name}: missing")
                continue
            ok, value = _coerce(raw, f["type"])
            if not ok:
                errors.append(f"{name}: wrong type (expected {f['type']})")
                continue
            if "minimum" in f and value < f["minimum"]:
                errors.append(f"{name}: below minimum {f['minimum']}")
            if "allowed" in f and value not in f["allowed"]:
                errors.append(f"{name}: not an allowed value")
            clean[name] = value
        if not errors:
            for name in unique:
                if clean[name] in seen[name]:
                    errors.append(f"{name}: duplicate")
        if errors:
            quarantined.append({"row": row, "errors": errors})
        else:
            for name in unique:
                seen[name].add(clean[name])
            valid.append(row)
    return valid, quarantined


def check_schema(header, contract):
    expected = [f["name"] for f in contract["fields"]]
    return {"missing": [c for c in expected if c not in header], "unexpected": [c for c in header if c not in expected]}


def check_freshness(latest, now, max_age_hours):
    age = (now - latest).total_seconds() / 3600
    return {"ok": age <= max_age_hours, "age_hours": round(age, 2)}


def volume_anomaly(history, today, k=3.0):
    """Flag `today` if it is outside median +- k * robust spread of recent days."""
    med = statistics.median(history)
    mad = statistics.median([abs(x - med) for x in history])
    spread = max(1.4826 * mad, 0.05 * med, 1.0)   # never a zero-width band
    low, high = med - k * spread, med + k * spread
    return {"anomaly": not (low <= today <= high), "low": round(low, 1), "high": round(high, 1), "median": med}


def distribution_shift(before, after):
    """Total variation distance between two category count dicts: 0 = identical, 1 = completely different."""
    nb, na = sum(before.values()) or 1, sum(after.values()) or 1
    keys = set(before) | set(after)
    return round(0.5 * sum(abs(before.get(k, 0) / nb - after.get(k, 0) / na) for k in keys), 4)


def daily_counts(rows):
    c = Counter()
    for r in rows:
        c[r["order_ts"][:10]] += 1
    return dict(sorted(c.items()))


def run_gate(data_dir, contract_path, now, out_dir):
    """Run every check on <data_dir>/orders.csv. Returns a report dict with status 'pass', 'warn' or 'fail'."""
    contract = load_contract(contract_path)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    with open(Path(data_dir) / "orders.csv", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames
        rows = list(reader)

    report = {"checks": {}, "status": "pass"}
    schema = check_schema(header, contract)
    report["checks"]["schema"] = schema
    if schema["missing"] or schema["unexpected"]:
        report["status"] = "fail"
        report["reason"] = "schema drift"
        return report

    valid, bad = validate_rows(rows, contract)
    (out / "orders_valid.ndjson").write_text("".join(json.dumps(r, sort_keys=True) + "\n" for r in valid))
    (out / "quarantine.ndjson").write_text("".join(json.dumps(q, sort_keys=True) + "\n" for q in bad))
    reject_rate = len(bad) / len(rows) if rows else 1.0
    report["checks"]["contract"] = {"rows": len(rows), "valid": len(valid), "quarantined": len(bad), "reject_rate": round(reject_rate, 4)}
    if reject_rate > contract["sla"]["max_reject_rate"]:
        report["status"] = "fail"
        report["reason"] = "reject rate above the contract limit"
        return report

    latest = max(datetime.fromisoformat(r["order_ts"]) for r in valid)
    fresh = check_freshness(latest, now, contract["sla"]["freshness_hours"])
    report["checks"]["freshness"] = fresh
    if not fresh["ok"]:
        report["status"] = "fail"
        report["reason"] = "data is stale"
        return report

    counts = daily_counts(valid)
    days = list(counts)
    vol = volume_anomaly([counts[d] for d in days[-15:-1]], counts[days[-1]])
    report["checks"]["volume"] = {**vol, "day": days[-1], "count": counts[days[-1]]}
    if vol["anomaly"]:
        report["status"] = "warn"
        report["reason"] = "volume anomaly on the latest day"
    return report
