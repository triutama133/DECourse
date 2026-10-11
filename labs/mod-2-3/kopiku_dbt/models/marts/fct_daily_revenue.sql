-- TODO. An INCREMENTAL model: materialized='incremental', unique_key='order_date', incremental_strategy='delete+insert'.
-- Grain: one row per order_date. Columns: order_date, orders, revenue_idr, max_loaded_at
--   orders      = number of distinct orders that are NOT cancelled or refunded
--   revenue_idr = sum of line_total_idr over those orders (0 if none)
--   max_loaded_at = the latest loaded_at among the day's lines
-- On an incremental run, recompute every date that had ANY order loaded after the table's max(max_loaded_at):
-- orders change after they were first loaded (a refund arrives later), so 'only new dates' would be wrong.
-- Careful: put every ref() OUTSIDE the {% if is_incremental() %} block, or dbt cannot build its graph.
select 1 as todo
