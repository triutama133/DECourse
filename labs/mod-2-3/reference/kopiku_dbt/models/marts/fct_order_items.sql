-- Grain: one row per order line (of orders that survived staging).
select
    i.order_id,
    i.line_no,
    o.order_date,
    o.customer_id,
    i.product_id,
    i.qty,
    i.unit_price_idr,
    i.qty * i.unit_price_idr as line_total_idr,
    o.status as order_status,
    o._loaded_at as loaded_at
from {{ ref('stg_order_items') }} i
join {{ ref('stg_orders') }} o on o.order_id = i.order_id
