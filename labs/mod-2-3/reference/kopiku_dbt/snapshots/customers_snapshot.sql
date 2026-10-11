{% snapshot customers_snapshot %}

{{
    config(
        target_schema='snapshots',
        unique_key='customer_id',
        strategy='check',
        check_cols=['city', 'tier']
    )
}}

select customer_id, city, tier from {{ ref('stg_customers') }}

{% endsnapshot %}
