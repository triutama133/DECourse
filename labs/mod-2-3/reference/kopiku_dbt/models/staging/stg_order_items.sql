select
    order_id::bigint as order_id,
    line_no::int as line_no,
    product_id::bigint as product_id,
    qty::int as qty,
    unit_price_idr::bigint as unit_price_idr
from {{ source('raw', 'order_items') }}
