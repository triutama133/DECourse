-- TODO. One row per customer from {{ ref('stg_customers') }}.
-- Columns: customer_id, full_name, email, city ('Unknown' when NULL), tier, signup_date
select 1 as todo
