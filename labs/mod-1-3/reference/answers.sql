-- Reference answers. Try the questions yourself first.

-- ch-3 [logins] Longest login streak (gaps & islands)
WITH grouped AS (
  SELECT user_id, login_date,
         julianday(login_date) - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) AS grp
  FROM logins
),
streaks AS (
  SELECT user_id, grp, COUNT(*) AS days FROM grouped GROUP BY user_id, grp
)
SELECT user_id, MAX(days) AS longest_streak
FROM streaks
GROUP BY user_id;

-- ch-4 [clickstream] Sessionization (Lab 1.3)
WITH lagged AS (
  SELECT user_id, event_time,
         LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time) AS prev_time
  FROM user_clickstream
),
flagged AS (
  SELECT user_id, event_time,
         CASE WHEN prev_time IS NULL
                OR strftime('%s', event_time) - strftime('%s', prev_time) > 1800
              THEN 1 ELSE 0 END AS is_new
  FROM lagged
),
sessions AS (
  SELECT user_id, event_time,
         SUM(is_new) OVER (PARTITION BY user_id ORDER BY event_time) AS session_id
  FROM flagged
)
SELECT user_id, session_id, COUNT(*) AS clicks
FROM sessions
GROUP BY user_id, session_id;

-- w-1 [kopiku] Running total per customer
WITH t AS (
  SELECT order_id, SUM(qty * unit_price_idr) AS order_total
  FROM order_items
  GROUP BY order_id
)
SELECT o.customer_id, o.order_id, t.order_total,
       SUM(t.order_total) OVER (PARTITION BY o.customer_id ORDER BY o.order_date, o.order_id
                                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total
FROM orders o
JOIN t ON t.order_id = o.order_id;

-- w-2 [kopiku] Latest order per customer
WITH ranked AS (
  SELECT customer_id, order_id,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC, order_id DESC) AS rn
  FROM orders
)
SELECT customer_id, order_id
FROM ranked
WHERE rn = 1;

-- w-3 [kopiku] Gap between orders (LAG)
SELECT customer_id, order_id,
       CAST(julianday(order_date) - julianday(LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date, order_id)) AS INTEGER) AS days_since_prev
FROM orders;

-- w-4 [kopiku] Order share of the customer's total
WITH t AS (
  SELECT order_id, SUM(qty * unit_price_idr) AS order_total
  FROM order_items
  GROUP BY order_id
)
SELECT o.order_id,
       ROUND(100.0 * t.order_total / SUM(t.order_total) OVER (PARTITION BY o.customer_id), 1) AS pct_of_customer
FROM orders o
JOIN t ON t.order_id = o.order_id;

-- w-5 [kopiku] Ranking with ties
WITH t AS (
  SELECT order_id, SUM(qty * unit_price_idr) AS order_total
  FROM order_items
  GROUP BY order_id
)
SELECT order_id, order_total, DENSE_RANK() OVER (ORDER BY order_total DESC) AS rnk
FROM t;

-- w-6 [daily_sales] 7-day moving average
SELECT store, day,
       ROUND(AVG(revenue) OVER (PARTITION BY store ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)) AS avg_7d
FROM daily_sales;

-- w-7 [kopiku] Order quartiles (NTILE)
WITH t AS (
  SELECT order_id, SUM(qty * unit_price_idr) AS order_total
  FROM order_items
  GROUP BY order_id
)
SELECT order_id, NTILE(4) OVER (ORDER BY order_total, order_id) AS quartile
FROM t;

-- w-8 [categories] Category tree (recursive CTE)
WITH RECURSIVE tree AS (
  SELECT id, name, 0 AS depth, name AS path
  FROM categories
  WHERE parent_id IS NULL
  UNION ALL
  SELECT c.id, c.name, tree.depth + 1, tree.path || ' > ' || c.name
  FROM categories c
  JOIN tree ON c.parent_id = tree.id
)
SELECT id, depth, path FROM tree;
