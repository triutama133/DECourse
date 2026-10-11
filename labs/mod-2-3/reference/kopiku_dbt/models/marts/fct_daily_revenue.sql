{{
    config(
        materialized='incremental',
        unique_key='order_date',
        incremental_strategy='delete+insert'
    )
}}
-- Grain: one row per order date. Cancelled and refunded orders earn nothing.
-- Incremental: orders can CHANGE after they were first loaded (a refund arrives days later),
-- so we do not look for "new dates" only: we recompute every date that had ANY order loaded since the last run.
-- Declare every ref() OUTSIDE the is_incremental() block: dbt reads refs when it builds the dependency graph,
-- before it knows whether this run is incremental, and fails if a ref is hidden inside the condition.
with orders as (
    select order_date, _loaded_at from {{ ref('stg_orders') }}
),
lines as (
    select * from {{ ref('fct_order_items') }}
    {% if is_incremental() %}
    where order_date in (
        select distinct order_date from orders
        where _loaded_at > (select max(max_loaded_at) from {{ this }})
    )
    {% endif %}
)
select
    order_date,
    count(distinct case when order_status not in ('cancelled', 'refunded') then order_id end) as orders,
    coalesce(sum(case when order_status not in ('cancelled', 'refunded') then line_total_idr end), 0) as revenue_idr,
    max(loaded_at) as max_loaded_at
from lines
group by order_date
