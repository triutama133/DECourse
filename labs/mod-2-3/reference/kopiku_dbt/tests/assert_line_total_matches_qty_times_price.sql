-- A singular test: returns the rows that BREAK the rule. The test passes when it returns nothing.
select order_id, line_no
from {{ ref('fct_order_items') }}
where line_total_idr <> qty * unit_price_idr
