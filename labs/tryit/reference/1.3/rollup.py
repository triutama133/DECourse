# Reference solution for Try it 1.3-9 (KopiKu dataset, DuckDB or PostgreSQL syntax).

REVENUE_ROLLUP = """
SELECT c.city, o.payment_method, SUM(i.qty * i.unit_price_idr) AS revenue_idr,
       GROUPING(c.city) + GROUPING(o.payment_method) AS level
FROM orders o
JOIN order_items i ON i.order_id = o.order_id
JOIN customers c ON c.customer_id = o.customer_id
WHERE o.status = 'delivered'
GROUP BY ROLLUP (c.city, o.payment_method)
"""

STATUS_CUBE = "SELECT status, payment_method, COUNT(*) AS orders FROM orders GROUP BY CUBE (status, payment_method)"

TIER_OR_METHOD = """
SELECT c.tier, o.payment_method, COUNT(*) AS orders
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
GROUP BY GROUPING SETS ((c.tier), (o.payment_method))
"""
