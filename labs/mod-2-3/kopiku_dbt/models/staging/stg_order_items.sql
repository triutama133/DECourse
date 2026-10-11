-- TODO. Typed copy of the order lines.
-- Columns: order_id (bigint), line_no (int), product_id (bigint), qty (int), unit_price_idr (bigint)
-- Source: {{ source('raw', 'order_items') }}
select 1 as todo
