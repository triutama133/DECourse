-- One row per order: the LATEST version, with types fixed and untrustworthy rows dropped.
with ranked as (
    select
        order_id::bigint as order_id,
        customer_id::bigint as customer_id,
        coalesce(try_strptime(order_ts, '%Y-%m-%dT%H:%M:%S'), try_strptime(order_ts, '%d/%m/%Y %H:%M')) as order_ts,
        lower(trim(status)) as status,
        trim(payment_method) as payment_method,
        try_cast(replace(regexp_replace(total_idr, '^\s*[Rr][Pp]\s*', ''), '.', '') as bigint) as total_idr,
        _loaded_at,
        row_number() over (partition by order_id order by _loaded_at desc) as rn
    from {{ source('raw', 'orders') }}
)
select
    order_id, customer_id, order_ts, cast(order_ts as date) as order_date,
    status, payment_method, total_idr, _loaded_at
from ranked
where rn = 1
  and order_ts is not null
  and total_idr > 0
