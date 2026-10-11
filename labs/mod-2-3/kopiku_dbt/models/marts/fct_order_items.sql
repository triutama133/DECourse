-- TODO. Grain: ONE ROW PER ORDER LINE, only for lines whose order exists in {{ ref('stg_orders') }}.
-- Columns: order_id, line_no, order_date, customer_id, product_id, qty, unit_price_idr,
--          line_total_idr (= qty * unit_price_idr), order_status (the order's status), loaded_at (the order's _loaded_at)
select 1 as todo
