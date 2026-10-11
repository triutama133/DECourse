"""Lab 2.4: orchestrating the KopiKu pipeline with Dagster.   Tests: pytest labs/mod-2-4 -v

Dagster thinks in ASSETS (the data that should exist) rather than tasks. Build:

  Paths             a ConfigurableResource with data_dir and warehouse_dir (strings): never hard-code paths in assets
  daily             DailyPartitionsDefinition from 2026-01-01 up to and including 2026-01-30 (end_date is exclusive)
  daily_orders      partitioned asset: the CLEAN orders of ONE day (partition_key = 'YYYY-MM-DD') from <data_dir>/orders.csv
                    -> <warehouse_dir>/daily_orders/date=<day>/orders.ndjson
                    clean = parse both timestamp formats and 'Rp 1.250.000' totals, lower-case status, drop total <= 0,
                    one row per order_id; rows sorted by order_id; each row a JSON object with sorted keys
                    (order_id, order_ts ISO text, status, total_idr). Re-running a partition REPLACES the file (atomic write).
                    Give it RetryPolicy(max_retries=2, delay=1).
  daily_revenue     partitioned asset depending on daily_orders: for that day count orders that are not cancelled/refunded
                    and sum their total_idr -> <warehouse_dir>/daily_revenue/date=<day>.json
                    with keys date, orders, revenue_idr
  revenue_report    UNpartitioned asset depending on ALL partitions of daily_revenue (AssetDep + AllPartitionMapping):
                    <warehouse_dir>/revenue_report.csv with header 'date,orders,revenue_idr' and one line per computed day, sorted
  two asset checks  daily_orders_has_unique_ids (on daily_orders) and revenue_is_never_negative (on revenue_report)
                    (@asset_check functions take an AssetCheckExecutionContext, not an AssetExecutionContext)
  daily_job         define_asset_job('daily_kopiku_job', selection=[daily_orders, daily_revenue])  (partitioning is inferred)
  daily_schedule    ScheduleDefinition named 'daily_kopiku_schedule': cron '0 2 * * *' in timezone 'Asia/Jakarta'
  defs              Definitions with all of the above and a default Paths resource (data_dir='data', warehouse_dir='warehouse')

Read test_lab.py first. Run the pipeline for real with:  dagster dev -f labs/mod-2-4/orchestration.py
"""
from dagster import Definitions  # noqa: F401  (add the other imports you need)

raise NotImplementedError("TODO: implement the Dagster definitions described above")
