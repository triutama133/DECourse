"""Reference solution for Lab 2.4: a small Dagster project."""
import csv
import json
import os
from datetime import datetime
from pathlib import Path

from dagster import (
    AssetCheckExecutionContext,
    AssetCheckResult,
    AssetDep,
    AssetExecutionContext,
    ConfigurableResource,
    DailyPartitionsDefinition,
    Definitions,
    MaterializeResult,
    RetryPolicy,
    AllPartitionMapping,
    ScheduleDefinition,
    asset,
    asset_check,
    define_asset_job,
)

NO_REVENUE = {"cancelled", "refunded"}

# One partition per day, 1 to 30 January 2026 (end_date is exclusive).
daily = DailyPartitionsDefinition(start_date="2026-01-01", end_date="2026-01-31")


class Paths(ConfigurableResource):
    """Where to read raw data and write results. A resource, so tests and production can point elsewhere."""
    data_dir: str
    warehouse_dir: str


def _parse_ts(raw):
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%d/%m/%Y %H:%M"):
        try:
            return datetime.strptime(raw.strip(), fmt)
        except ValueError:
            pass
    return None


def _parse_total(raw):
    t = (raw or "").strip()
    if t.lower().startswith("rp"):
        t = t[2:].strip().replace(".", "")
    try:
        return int(t)
    except ValueError:
        return None


def _atomic_write(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


@asset(partitions_def=daily, retry_policy=RetryPolicy(max_retries=2, delay=1), group_name="kopiku")
def daily_orders(context: AssetExecutionContext, paths: Paths) -> MaterializeResult:
    """Clean orders of ONE day, written to <warehouse>/daily_orders/date=<day>/orders.ndjson. Re-running replaces the file."""
    day = context.partition_key
    seen, kept = set(), []
    with open(Path(paths.data_dir) / "orders.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            ts, total = _parse_ts(row["order_ts"]), _parse_total(row["total_idr"])
            if ts is None or total is None or total <= 0 or ts.date().isoformat() != day:
                continue
            oid = int(row["order_id"])
            if oid in seen:
                continue
            seen.add(oid)
            kept.append({"order_id": oid, "order_ts": ts.isoformat(timespec="seconds"),
                         "status": row["status"].strip().lower(), "total_idr": total})
    kept.sort(key=lambda r: r["order_id"])
    out = Path(paths.warehouse_dir) / "daily_orders" / f"date={day}" / "orders.ndjson"
    _atomic_write(out, "".join(json.dumps(r, sort_keys=True) + "\n" for r in kept))
    context.log.info(f"{day}: {len(kept)} orders")
    return MaterializeResult(metadata={"rows": len(kept), "path": str(out)})


@asset(partitions_def=daily, deps=[daily_orders], group_name="kopiku")
def daily_revenue(context: AssetExecutionContext, paths: Paths) -> MaterializeResult:
    """Revenue of ONE day from that day's clean orders. Cancelled and refunded orders earn nothing."""
    day = context.partition_key
    src = Path(paths.warehouse_dir) / "daily_orders" / f"date={day}" / "orders.ndjson"
    rows = [json.loads(line) for line in src.read_text().splitlines() if line.strip()]
    counted = [r for r in rows if r["status"] not in NO_REVENUE]
    result = {"date": day, "orders": len(counted), "revenue_idr": sum(r["total_idr"] for r in counted)}
    _atomic_write(Path(paths.warehouse_dir) / "daily_revenue" / f"date={day}.json", json.dumps(result, sort_keys=True))
    return MaterializeResult(metadata=result)


@asset(deps=[AssetDep(daily_revenue, partition_mapping=AllPartitionMapping())], group_name="kopiku")
def revenue_report(paths: Paths) -> MaterializeResult:
    """Unpartitioned: one CSV with every day that has been computed so far, sorted by date."""
    files = sorted((Path(paths.warehouse_dir) / "daily_revenue").glob("date=*.json"))
    rows = [json.loads(p.read_text()) for p in files]
    lines = ["date,orders,revenue_idr"] + [f'{r["date"]},{r["orders"]},{r["revenue_idr"]}' for r in rows]
    _atomic_write(Path(paths.warehouse_dir) / "revenue_report.csv", "\n".join(lines) + "\n")
    return MaterializeResult(metadata={"days": len(rows)})


@asset_check(asset=daily_orders)
def daily_orders_has_unique_ids(context: AssetCheckExecutionContext, paths: Paths) -> AssetCheckResult:
    day = context.partition_key
    src = Path(paths.warehouse_dir) / "daily_orders" / f"date={day}" / "orders.ndjson"
    ids = [json.loads(line)["order_id"] for line in src.read_text().splitlines() if line.strip()]
    return AssetCheckResult(passed=len(ids) == len(set(ids)) and len(ids) > 0, metadata={"rows": len(ids)})


@asset_check(asset=revenue_report)
def revenue_is_never_negative(paths: Paths) -> AssetCheckResult:
    lines = (Path(paths.warehouse_dir) / "revenue_report.csv").read_text().splitlines()[1:]
    revenues = [int(l.split(",")[2]) for l in lines]
    return AssetCheckResult(passed=bool(revenues) and min(revenues) >= 0, metadata={"days": len(revenues)})


daily_job = define_asset_job("daily_kopiku_job", selection=[daily_orders, daily_revenue])  # partitioning is inferred from the assets

daily_schedule = ScheduleDefinition(
    name="daily_kopiku_schedule",
    job=daily_job,
    cron_schedule="0 2 * * *",
    execution_timezone="Asia/Jakarta",
)

defs = Definitions(
    assets=[daily_orders, daily_revenue, revenue_report],
    asset_checks=[daily_orders_has_unique_ids, revenue_is_never_negative],
    jobs=[daily_job],
    schedules=[daily_schedule],
    resources={"paths": Paths(data_dir="data", warehouse_dir="warehouse")},
)
