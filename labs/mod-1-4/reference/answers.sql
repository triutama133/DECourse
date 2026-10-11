-- Reference answers. Try the questions yourself first.

-- d-1 [scd_demo] Build the SCD Type 2 dimension
WITH v AS (
  SELECT customer_id, city, tier,
         effective_ts AS valid_from,
         LEAD(effective_ts, 1, '9999-12-31 00:00:00') OVER (PARTITION BY customer_id ORDER BY effective_ts) AS valid_to
  FROM customer_changes
)
SELECT customer_id, city, tier, valid_from, valid_to,
       CASE WHEN valid_to = '9999-12-31 00:00:00' THEN 1 ELSE 0 END AS is_current
FROM v;

-- d-2 [scd_demo] Tier at time of purchase (as-of join)
SELECT o.order_id, c.tier
FROM orders_small o
JOIN dim_customer c
  ON c.customer_id = o.customer_id
 AND o.order_ts >= c.valid_from
 AND o.order_ts < c.valid_to;

-- d-3 [scd_demo] Revenue per tier at purchase
SELECT c.tier, SUM(o.total_idr) AS revenue
FROM orders_small o
JOIN dim_customer c
  ON c.customer_id = o.customer_id
 AND o.order_ts >= c.valid_from
 AND o.order_ts < c.valid_to
GROUP BY c.tier;

-- d-4 [scd_demo] A date dimension from the calendar
WITH RECURSIVE days(d) AS (
  SELECT date('2026-01-01')
  UNION ALL
  SELECT date(d, '+1 day') FROM days WHERE d < '2026-01-07'
)
SELECT CAST(strftime('%Y%m%d', d) AS INTEGER) AS date_key,
       d AS full_date,
       CASE strftime('%w', d) WHEN '0' THEN 'Sunday' WHEN '1' THEN 'Monday' WHEN '2' THEN 'Tuesday'
            WHEN '3' THEN 'Wednesday' WHEN '4' THEN 'Thursday' WHEN '5' THEN 'Friday' ELSE 'Saturday' END AS day_name,
       CASE WHEN strftime('%w', d) IN ('0', '6') THEN 1 ELSE 0 END AS is_weekend
FROM days;
