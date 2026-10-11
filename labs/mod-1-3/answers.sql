-- Write one query under each marker. Keep the marker lines: the checker finds your answers by them.
-- Check your work:  python3 labs/mod-1-3/check.py

-- ch-3 [logins] Longest login streak (gaps & islands)
-- Return user_id and longest_streak (longest run of consecutive days) for every user.
-- Hint: Date minus row number is constant inside one streak. In SQLite use julianday(login_date) - ROW_NUMBER() OVER (...).

-- ch-4 [clickstream] Sessionization (Lab 1.3)
-- Return user_id, session_id and clicks (click count) per session. A new session starts when the gap from the previous click exceeds 30 minutes.
-- Hint: Use LAG() for the previous time, flag new sessions with 1/0, then a running SUM() as session_id. Seconds between: strftime('%s', a) - strftime('%s', b).

-- w-1 [kopiku] Running total per customer
-- Return customer_id, order_id, order_total and running_total: the cumulative sum of that customer's order_total, ordered by order_date then order_id.
-- Hint: Compute each order's total in a CTE, then SUM(...) OVER (PARTITION BY customer_id ORDER BY order_date, order_id).

-- w-2 [kopiku] Latest order per customer
-- Return customer_id and the order_id of each customer's LATEST order (largest order_date).
-- Hint: ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC), then keep rank 1. This is also the de-duplication pattern.

-- w-3 [kopiku] Gap between orders (LAG)
-- Return customer_id, order_id and days_since_prev: days since that customer's previous order (NULL for the first order).
-- Hint: LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date), then julianday(a) - julianday(b). Wrap with CAST(... AS INTEGER).

-- w-4 [kopiku] Order share of the customer's total
-- Return order_id and pct_of_customer: the order's share of that customer's total across all their orders, rounded to 1 decimal.
-- Hint: SUM(order_total) OVER (PARTITION BY customer_id) without ORDER BY gives the whole partition total on every row.

-- w-5 [kopiku] Ranking with ties
-- Return order_id, order_total and rnk: rank by total, largest first (1 = largest). Orders with equal totals share a rank, and the next rank must NOT skip.
-- Hint: There are three ranking functions: one skips after ties (RANK), one does not (DENSE_RANK), one gives unique numbers (ROW_NUMBER).

-- w-6 [daily_sales] 7-day moving average
-- Return store, day and avg_7d: the average revenue of that day and the 6 days before it in the same store (use the rows available at the start), rounded to a whole number.
-- Hint: AVG(revenue) OVER (PARTITION BY store ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW).

-- w-7 [kopiku] Order quartiles (NTILE)
-- Return order_id and quartile (1 to 4): split all orders by order_total, smallest first, into 4 groups as equal as possible. Break ties by order_id.
-- Hint: NTILE(4) OVER (ORDER BY order_total, order_id). With 18 orders the first groups get one extra row.

-- w-8 [categories] Category tree (recursive CTE)
-- Return id, depth (root = 0) and path like 'Coffee > Beans > Single Origin > Gayo' for every category.
-- Hint: WITH RECURSIVE: the anchor selects the root (parent_id IS NULL); the recursive part joins children to the previous rows and adds depth + 1.

