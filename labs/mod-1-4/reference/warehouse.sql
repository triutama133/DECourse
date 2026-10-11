-- Reference solution for Lab 1.4 (SQLite).
DROP TABLE IF EXISTS fact_order_items;
DROP TABLE IF EXISTS dim_date;
DROP TABLE IF EXISTS dim_product;
DROP TABLE IF EXISTS dim_customer;

-- Date dimension: generated from the calendar, so days without orders still exist.
CREATE TABLE dim_date AS
WITH RECURSIVE bounds AS (
  SELECT date(MIN(order_ts)) AS d0, date(MAX(order_ts)) AS d1 FROM stg_orders
), days(d) AS (
  SELECT d0 FROM bounds
  UNION ALL
  SELECT date(d, '+1 day') FROM days, bounds WHERE d < d1
)
SELECT CAST(strftime('%Y%m%d', d) AS INTEGER) AS date_key,
       d AS full_date,
       CAST(strftime('%Y', d) AS INTEGER) AS year,
       CAST(strftime('%m', d) AS INTEGER) AS month,
       CAST(strftime('%d', d) AS INTEGER) AS day,
       CASE strftime('%w', d) WHEN '0' THEN 'Sunday' WHEN '1' THEN 'Monday' WHEN '2' THEN 'Tuesday'
            WHEN '3' THEN 'Wednesday' WHEN '4' THEN 'Thursday' WHEN '5' THEN 'Friday' ELSE 'Saturday' END AS day_name,
       CASE WHEN strftime('%w', d) IN ('0', '6') THEN 1 ELSE 0 END AS is_weekend
FROM days;

-- Product dimension (Type 1).
CREATE TABLE dim_product AS
SELECT ROW_NUMBER() OVER (ORDER BY product_id) AS product_sk,
       product_id, name, category, origin, roast_level, price_idr
FROM stg_products;

-- Customer dimension (Type 2): a baseline version at signup, then one version per change.
CREATE TABLE dim_customer AS
WITH versions AS (
  SELECT customer_id, COALESCE(city, 'Unknown') AS city, tier, signup_date || 'T00:00:00' AS valid_from
  FROM stg_customers
  UNION ALL
  SELECT customer_id, COALESCE(city, 'Unknown'), tier, effective_ts
  FROM stg_customer_changes
), ranged AS (
  SELECT *, LEAD(valid_from, 1, '9999-12-31T00:00:00') OVER (PARTITION BY customer_id ORDER BY valid_from) AS valid_to
  FROM versions
)
SELECT ROW_NUMBER() OVER (ORDER BY customer_id, valid_from) AS customer_sk,
       customer_id, city, tier, valid_from, valid_to,
       CASE WHEN valid_to = '9999-12-31T00:00:00' THEN 1 ELSE 0 END AS is_current
FROM ranged
UNION ALL
SELECT -1, -1, 'Unknown', 'Unknown', '1900-01-01T00:00:00', '9999-12-31T00:00:00', 1;

-- Fact table at the grain of one order line, pointing at the customer version valid at order time.
CREATE TABLE fact_order_items AS
SELECT i.order_id,
       i.line_no,
       CAST(strftime('%Y%m%d', o.order_ts) AS INTEGER) AS date_key,
       COALESCE(c.customer_sk, -1) AS customer_sk,
       p.product_sk,
       i.qty,
       i.unit_price_idr,
       i.qty * i.unit_price_idr AS line_total_idr
FROM stg_order_items i
JOIN stg_orders o ON o.order_id = i.order_id
LEFT JOIN dim_customer c ON c.customer_id = o.customer_id AND o.order_ts >= c.valid_from AND o.order_ts < c.valid_to
JOIN dim_product p ON p.product_id = i.product_id;
