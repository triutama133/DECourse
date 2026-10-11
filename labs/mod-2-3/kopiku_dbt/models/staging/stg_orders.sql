-- TODO. One row per order_id: the LATEST version by _loaded_at (updates arrive as new rows), typed and cleaned.
-- Columns: order_id, customer_id (bigint), order_ts (timestamp), order_date (date), status (trimmed, lower case),
--          payment_method (trimmed), total_idr (bigint), _loaded_at
-- order_ts arrives as '2026-01-31T14:03:00' OR '31/01/2026 14:03'; total_idr as '150000' OR 'Rp 1.250.000' OR '-5000'.
-- Drop orders whose timestamp cannot be read or whose total is not positive.
-- Hints: try_strptime, try_cast, regexp_replace, row_number() over (partition by ... order by _loaded_at desc)
-- Source: {{ source('raw', 'orders') }}
select 1 as todo
