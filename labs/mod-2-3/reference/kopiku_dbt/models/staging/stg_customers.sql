-- One row per customer: the LATEST delivered version, cleaned.
with ranked as (
    select
        customer_id::bigint as customer_id,
        trim(full_name) as full_name,
        lower(trim(email)) as email,
        nullif(trim(city), '') as city,
        cast(signup_date as date) as signup_date,
        tier,
        _loaded_at,
        row_number() over (partition by customer_id order by _loaded_at desc) as rn
    from {{ source('raw', 'customers') }}
)
select customer_id, full_name, email, city, signup_date, tier, _loaded_at
from ranked
where rn = 1
