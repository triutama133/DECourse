select
    customer_id,
    full_name,
    email,
    coalesce(city, 'Unknown') as city,
    tier,
    signup_date
from {{ ref('stg_customers') }}
