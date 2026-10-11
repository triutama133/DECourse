select
    product_id::bigint as product_id,
    name,
    category,
    origin,
    roast_level,
    price_idr::bigint as price_idr
from {{ source('raw', 'products') }}
