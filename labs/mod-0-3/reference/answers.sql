-- Reference answers. Try the questions yourself first.

-- k-1 [kopiku] Customers from Jakarta
SELECT name, tier
FROM customers
WHERE city = 'Jakarta';

-- k-2 [kopiku] Orders per status
SELECT status, COUNT(*) AS orders
FROM orders
GROUP BY status;

-- k-3 [kopiku] Value of each order
SELECT order_id, SUM(qty * unit_price_idr) AS order_total
FROM order_items
GROUP BY order_id;

-- k-4 [kopiku] The NULL trap: not Jakarta
SELECT name
FROM customers
WHERE city <> 'Jakarta' OR city IS NULL;

-- k-5 [kopiku] Customers who never ordered
SELECT c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL;

-- k-6 [kopiku] Revenue per city (NULL city becomes Unknown)
SELECT COALESCE(c.city, 'Unknown') AS city, SUM(i.qty * i.unit_price_idr) AS revenue
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
JOIN order_items i ON i.order_id = o.order_id
WHERE o.status = 'delivered'
GROUP BY COALESCE(c.city, 'Unknown');

-- k-7 [kopiku] Repeat customers (HAVING)
SELECT c.name, COUNT(*) AS delivered_orders
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
WHERE o.status = 'delivered'
GROUP BY c.customer_id, c.name
HAVING COUNT(*) >= 2;

-- k-8 [kopiku] The fan-out trap: shipping fees
SELECT SUM(shipping_fee_idr) AS shipping_total
FROM orders
WHERE status = 'delivered';

-- k-9 [kopiku] Order size bands (CASE + CTE)
WITH totals AS (
  SELECT order_id, SUM(qty * unit_price_idr) AS order_total
  FROM order_items
  GROUP BY order_id
)
SELECT order_id,
       CASE WHEN order_total < 100000 THEN 'small'
            WHEN order_total < 200000 THEN 'medium'
            ELSE 'large' END AS size
FROM totals;

-- k-10 [kopiku] Share of each payment method
SELECT payment_method,
       COUNT(*) AS orders,
       ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM orders), 1) AS pct
FROM orders
GROUP BY payment_method;
