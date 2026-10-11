"""Lab 2.5: a data quality gate.   Tests: pytest labs/mod-2-5 -v   (pip install -r labs/mod-2-5/requirements.txt)

First write contracts/orders.yaml (see its header). Then implement every function below.
"""
import csv
import json
import statistics
from collections import Counter
from datetime import datetime
from pathlib import Path

import yaml


def load_contract(path):
    """Read the YAML contract and return it as a dict."""
    raise NotImplementedError("TODO: load_contract")


def validate_rows(rows, contract):
    """rows: list of dicts of STRINGS (as read from CSV). Return (valid, quarantined).

    Check every contract field of every row, STRICTLY (the producer promised these formats):
      missing    required field absent or empty               -> "<field>: missing"
      wrong type integer must match -?\\d+ ; timestamp must be ISO 'YYYY-MM-DDTHH:MM:SS' and a real date
                 -> "<field>: wrong type (expected <type>)"          ('Rp 1.250.000' is NOT an integer)
      minimum    integer below the field's minimum            -> "<field>: below minimum <n>"
      allowed    value not in the field's allowed list        -> "<field>: not an allowed value"   (case-sensitive)
      duplicate  a field marked unique that already appeared in an EARLIER VALID row -> "<field>: duplicate"
    A row with any error goes to quarantined as {"row": <original row>, "errors": [<messages>]}; the others are valid.
    Keep the original input order. A row that fails a rule must not count as 'seen' for uniqueness."""
    raise NotImplementedError("TODO: validate_rows")


def check_schema(header, contract):
    """header: list of column names in the file. Return {"missing": [...], "unexpected": [...]} compared with the
    contract's field names (empty lists mean no drift)."""
    raise NotImplementedError("TODO: check_schema")


def check_freshness(latest, now, max_age_hours):
    """latest, now: datetimes. Return {"ok": bool, "age_hours": float rounded to 2 decimals}; ok when age <= max_age_hours."""
    raise NotImplementedError("TODO: check_freshness")


def volume_anomaly(history, today, k=3.0):
    """history: recent daily counts (list of ints), today: the new count. Robust to outliers: use the MEDIAN and the
    MAD (median absolute deviation), not the mean and standard deviation.
      spread = max(1.4826 * MAD, 0.05 * median, 1.0)        (the floors stop the band from collapsing to zero width)
      low, high = median - k * spread, median + k * spread
    Return {"anomaly": today is outside [low, high], "low": round(low, 1), "high": round(high, 1), "median": median}."""
    raise NotImplementedError("TODO: volume_anomaly")


def distribution_shift(before, after):
    """before, after: dicts mapping category -> count. Return the TOTAL VARIATION DISTANCE of the two distributions,
    0.5 * sum over categories of |share_before - share_after|, rounded to 4 decimals (0 = same, 1 = totally different)."""
    raise NotImplementedError("TODO: distribution_shift")


def daily_counts(rows):
    """Provided: {'YYYY-MM-DD': number of rows} from rows that have a valid ISO order_ts."""
    c = Counter()
    for r in rows:
        c[r["order_ts"][:10]] += 1
    return dict(sorted(c.items()))


def run_gate(data_dir, contract_path, now, out_dir):
    """Run every check on <data_dir>/orders.csv and return a report dict:
        {"status": "pass" | "warn" | "fail", "reason": <text, only when not pass>, "checks": {...}}
    In this order, stopping at the first failure:
      1. schema     check_schema on the CSV header; any missing/unexpected column -> status "fail", reason "schema drift"
      2. contract   validate_rows; write out_dir/orders_valid.ndjson and out_dir/quarantine.ndjson (one JSON object per
                    line, keys sorted); put {"rows","valid","quarantined","reject_rate"} in checks["contract"];
                    reject_rate above the contract's sla.max_reject_rate -> "fail", reason "reject rate above the contract limit"
      3. freshness  newest valid order_ts vs `now` and sla.freshness_hours -> "fail", reason "data is stale"
      4. volume     daily_counts of valid rows; volume_anomaly(last 14 days before the final day, final day's count);
                    an anomaly -> "warn", reason "volume anomaly on the latest day"
    Put each check's result in report["checks"] under the keys 'schema', 'contract', 'freshness', 'volume'."""
    raise NotImplementedError("TODO: run_gate")
