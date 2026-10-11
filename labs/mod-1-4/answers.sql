-- Write one query under each marker. Keep the marker lines: the checker finds your answers by them.
-- Check your work:  python3 labs/mod-1-4/check.py

-- d-1 [scd_demo] Build the SCD Type 2 dimension
-- From customer_changes, return customer_id, city, tier, valid_from, valid_to and is_current. valid_to is the next version's effective_ts for the same customer, or '9999-12-31 00:00:00' for the last version (is_current = 1, otherwise 0).
-- Hint: LEAD(effective_ts, 1, '9999-12-31 00:00:00') OVER (PARTITION BY customer_id ORDER BY effective_ts) gives valid_to and the default for the last row.

-- d-2 [scd_demo] Tier at time of purchase (as-of join)
-- From orders_small and dim_customer, return order_id and the customer's tier AT THE TIME the order was placed.
-- Hint: Join on customer_id AND the time range: order_ts >= valid_from AND order_ts < valid_to. Without the range an order appears once per version.

-- d-3 [scd_demo] Revenue per tier at purchase
-- Return tier and revenue (sum of total_idr) per customer tier at the time the order was placed.
-- Hint: Use the as-of join from the previous challenge, then GROUP BY c.tier. Check that the grand total equals the sum of total_idr in orders_small (no duplicated rows).

-- d-4 [scd_demo] A date dimension from the calendar
-- Return date_key (YYYYMMDD as an integer), full_date, day_name and is_weekend for 7 days starting 2026-01-01, including days with no data. day_name: 'Sunday'..'Saturday'; is_weekend = 1 for Saturday and Sunday.
-- Hint: WITH RECURSIVE generates the 7 dates. strftime('%w', d) gives 0 for Sunday through 6 for Saturday.

