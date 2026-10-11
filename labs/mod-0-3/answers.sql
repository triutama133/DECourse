-- Write one query under each marker. Keep the marker lines: the checker finds your answers by them.
-- Check your work:  python3 labs/mod-0-3/check.py

-- k-1 [kopiku] Customers from Jakarta
-- Return the name and tier of every customer whose city is Jakarta.
-- Hint: Filter with WHERE city = 'Jakarta'. Text literals in SQL use single quotes.

-- k-2 [kopiku] Orders per status
-- Return status and orders (the number of orders) for each status.
-- Hint: GROUP BY status, then COUNT(*).

-- k-3 [kopiku] Value of each order
-- Return order_id and order_total: the sum of qty * unit_price_idr over its lines.
-- Hint: Compute per line first (qty * unit_price_idr), then SUM and GROUP BY order_id.

-- k-4 [kopiku] The NULL trap: not Jakarta
-- Return the name of every customer whose city is not Jakarta, INCLUDING customers whose city is unknown (NULL).
-- Hint: city <> 'Jakarta' is never true for NULL (the result is UNKNOWN). Add OR city IS NULL.

-- k-5 [kopiku] Customers who never ordered
-- Return the name of every customer who has never placed any order.
-- Hint: LEFT JOIN from customers to orders, then keep rows whose order_id IS NULL.

-- k-6 [kopiku] Revenue per city (NULL city becomes Unknown)
-- Return city and revenue for delivered orders only. A NULL city must appear as 'Unknown'. revenue = sum of qty * unit_price_idr.
-- Hint: JOIN customers, orders, order_items. Use COALESCE(c.city, 'Unknown') for NULL, then GROUP BY the same expression.

-- k-7 [kopiku] Repeat customers (HAVING)
-- Return name and delivered_orders for customers with at least 2 delivered orders.
-- Hint: Filter rows with WHERE (status), filter groups with HAVING COUNT(*) >= 2.

-- k-8 [kopiku] The fan-out trap: shipping fees
-- Return a single number, shipping_total: the sum of shipping_fee_idr over delivered orders. Every order must be counted ONCE.
-- Hint: Do not JOIN to order_items: an order has several lines, so its fee would be counted several times. The orders table alone is enough.

-- k-9 [kopiku] Order size bands (CASE + CTE)
-- Return order_id and size: 'small' if order_total < 100000, 'medium' if < 200000, otherwise 'large'.
-- Hint: Compute each order's total in a CTE (WITH ... AS), then CASE WHEN in the outer query.

-- k-10 [kopiku] Share of each payment method
-- Return payment_method, orders and pct: its percentage of all orders, rounded to 1 decimal.
-- Hint: The denominator can be a scalar subquery: (SELECT COUNT(*) FROM orders). Multiply by 100.0 to avoid integer division.

