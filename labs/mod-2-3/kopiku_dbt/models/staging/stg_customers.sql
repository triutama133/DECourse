-- TODO. One row per customer_id: the LATEST delivered version (by _loaded_at), cleaned.
-- Columns: customer_id (bigint), full_name (trimmed), email (trimmed, lower case), city (NULL when empty), signup_date (date), tier, _loaded_at
-- Source: {{ source('raw', 'customers') }}   (all columns are text; the table is append-only and holds duplicates)
select 1 as todo
