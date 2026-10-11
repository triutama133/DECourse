TODO: add `customers_snapshot.sql`: a dbt snapshot (SCD Type 2) of `ref('stg_customers')` selecting customer_id, city, tier,
target_schema 'snapshots', unique_key 'customer_id', strategy 'check', check_cols ['city', 'tier'].
